# 零食省份争霸战 · 设计文档

日期：2026-07-26
项目：linglingqi.fun（七零十）新增功能
状态：已与产品方确认，待评审

## 1. 目标与玩法概述

在中国地图上，**每个省份是一个「派系」**，有自己的颜色。访客给喜欢的省份的零食**点赞**，为该省军队充能。系统自动推进一场持续演进、全网共享的战争：省份产小兵 → 向相邻省进攻 → 打赢就**占领对方领地（地图染成己方颜色）**，类似风险棋（Risk）。每周一季，分出胜负后重置再战。

核心循环：**点赞 → 产兵 → 进攻/占领 → 赛季结算 → 重置**。

### 关键决策（已确认）
- 数据来源：**真实点赞、全网共享**（存服务器）。
- 玩法：**自动对战 · 地盘争夺**（观战 + 点赞助攻，玩家不直接指挥战斗）。
- 战局：**持续演进 · 共享战场**（服务器持久保存战况）。**事件驱动，无固定时钟**——每次点赞把战线推进一步，地图随点赞逐渐变化；不设 N 分钟回合。
- 赛季：**唯一的固定日程**，到期结算胜负并重置战场。
- 点赞规则：**暂不限量**（先观察参与度；架构预留加限额的位置）。

## 2. 术语

- **派系（faction）**：34 个省级行政区，每个是一个派系，有固定颜色。用省份短名标识（如 `上海`）。
- **领地（territory）**：地图上的 34 块省级区域，每块当前归属某个派系。初始各归各家。
- **驻军（garrison）**：某块领地上的军队数值。点赞给己方领地增援，战斗中消耗。
- **省力（power）**：某派系本季累计获赞数 = 该省所有零食本季点赞之和（展示用，也是历史贡献值）。
- **推进步（step）**：一次战线结算。**由点赞事件触发**，不按时钟。
- **赛季（season）**：一周一季，结束时结算胜负并重置战场。是唯一的固定日程。

## 3. 架构与模块边界

分三层，边界清晰、可独立测试：

1. **战争引擎（纯函数模块）** `src/lib/war/engine.ts`
   - 输入：内存态战局快照 + 注入的随机源（RNG）。输出：推进一步后的新快照 + 本次产生的战报事件。
   - **不碰数据库、不碰时间**（时间与随机都由调用方注入），因此完全可单测、确定可复现。
2. **持久层 / 服务接口** `src/app/api/battle/*`、`src/lib/war/store.ts`
   - 从 Turso 读战局 → 调引擎（点赞时推进一步）→ 写回。负责赛季切换、并发保护。
3. **前端战场页** `src/app/battle/*`、`src/components/BattleMap.tsx`
   - 复用现有 echarts 中国地图，按归属染色；轮询战况、动画更新；点省份可给其零食点赞。

省份相邻关系 `src/lib/war/adjacency.ts` 为固定数据。省份颜色/全名映射复用 `SnackMapView` 已有的表，抽到 `src/lib/provinces-meta.ts` 共享。

## 4. 数据模型（Turso 新增）

所有建表用 `CREATE TABLE IF NOT EXISTS` + `ALTER TABLE ... ADD COLUMN`（遵循现有迁移写法），在应用启动/首次访问时幂等执行。

- `snacks.like_count INTEGER NOT NULL DEFAULT 0` —— 全时总赞（人气展示，新增列）。
- `war_season(id INTEGER PRIMARY KEY AUTOINCREMENT, start_at TEXT, end_at TEXT, status TEXT, winner_province TEXT NULL)` —— 赛季。`status ∈ {active, ended}`。
- `war_power(season_id INTEGER, province TEXT, likes INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(season_id, province))` —— 每派系本季省力（产兵来源）。
- `war_territory(province TEXT PRIMARY KEY, owner_province TEXT NOT NULL, garrison INTEGER NOT NULL DEFAULT 0)` —— 当前地图归属与驻军（34 行）。
- `war_log(id INTEGER PRIMARY KEY AUTOINCREMENT, season_id INTEGER, at TEXT, message TEXT, attacker TEXT, defender TEXT)` —— 战报，仅保留最近若干条。
- `war_meta(key TEXT PRIMARY KEY, value TEXT)` —— 存 `current_season_id`。（事件驱动，无需 last_tick 时间戳。）

## 5. 点赞系统

- 零食详情页加 **👍 点赞** 按钮（第一期先加在详情页；卡片上可后续再加）。
- 接口 `POST /api/snacks/:id/like`：
  1. `snacks.like_count += 1`。
  2. 计算该零食所属省份 `province = detectProvince(manufacturer_address) || detectProvince(manufacturer_name)`。
  3. 若 `province` 非空：先做赛季到期检查（`resolveSeasonIfEnded`），再 `applyLike(state, province)`——即 `war_power += 1` + 家乡增援 + 一次推进步（可能翻转领地），写回 DB。省份识别不出的零食只计全时赞、不参战。
  4. 返回新的 `like_count`（前端可另调 `state` 刷新地图）。
- **暂不限量、无需登录**。为将来加限额预留：点赞逻辑集中在一个函数里，加「每浏览器每日限额」时只需在入口加一层校验（浏览器标识存 localStorage + 服务端去重表），不影响其余设计。

## 6. 战争引擎机制

### 6.1 事件驱动推进
不设时钟、不设 N 分钟回合。战争推进由**点赞事件**触发：每次点赞先给该派系增援，然后执行**一次推进步（战线结算）**，可能翻转一到多块领地。读战况（`GET /api/battle/state`）**不改变战局**，只返回当前态并做赛季到期检查。因此无人参与时战局静止，一有点赞就前进——完全由玩家行为驱动。

引擎主函数（纯函数，注入 RNG，不碰 DB/时间）：
- `applyLike(state, province, rng) → { state, events }`：增援 + 一次推进步。
- `resolveSeasonIfEnded(state, now, rng) → { state, events }`：赛季到期/占满全国则结算+重置+开新季。

### 6.2 增援（点赞时）
点赞省份 P：
- `war_power(season, P) += 1`（累计省力/贡献，展示用）。
- 给 P **家乡领地**增援：若 P 仍占领自己的家乡领地，该领地 `garrison += REINFORCE_PER_LIKE`；若家乡已失守，则给 P 当前占领的**驻军最多的领地**增援（还有领地就还能打；全失守则该派系已出局，点赞只累计省力、不增援）。

### 6.3 推进步（战线结算，engine 内 combatStep）
遍历所有「相邻且归属不同」的领地对（前线），以打乱顺序用当前驻军结算。每对 (X, Y)：驻军多的一方为**进攻方**（相等则跳过）。设进攻方领地 A（驻军 Ga、派系 fa），防守方领地 D（驻军 Gd）：
- `commit = round(Ga * ATTACK_FRACTION)`
- `aPow = commit * rand(0.85, 1.15)`；`dPow = Gd * rand(0.85, 1.15) + BASE_DEFENSE`
- **攻破**（`aPow > dPow`）：`A.garrison -= commit`；`D.owner = fa`；`D.garrison = max(1, round(commit - Gd))`（余兵进驻并染色）；记战报「fa 攻占 D省」。
- **击退**（否则）：`A.garrison -= round(commit * REPEL_LOSS)`；`D.garrison = max(1, round(Gd - commit * DEF_LOSS))`；不易主。

每块领地每步最多发起一次进攻；随机项让弱省偶有翻盘。（`APPLY_STEPS_PER_LIKE` 支持一次点赞跑多步，默认 1；想让地图变化更快可调大。）

### 6.4 赛季（season）
唯一的固定日程。每周一北京时间 08:00 开新季。在**任意点赞或读战况**时惰性检查：
- 若某派系占领全部 34 块领地 → 立即赛季结束、该派系获胜。
- 否则若 `now >= season.end_at` → 赛季结束，`winner_province` = 占领领地最多的派系。

结算：`war_season.status=ended` 写入胜者（名人堂来源，第二期展示）→ 新建下一季（active，start=本周一，end=下周一 08:00）→ 重置 `war_territory`（领地归还本家、`garrison = BASE_GARRISON`）→ 本季赞不结转（新 `season_id`，`war_power` 从 0 起）。

并发保护：点赞与赛季结算都对 DB 做小事务；赛季结算用条件更新（`UPDATE war_season SET status='ended' WHERE id=? AND status='active'`）保证只结算一次，其余请求读到新季即可。

### 6.5 可调参数（集中在 `src/lib/war/config.ts`）
`BASE_GARRISON=10`、`REINFORCE_PER_LIKE=3`、`APPLY_STEPS_PER_LIKE=1`、`ATTACK_FRACTION=0.6`、`BASE_DEFENSE=3`、`REPEL_LOSS=0.6`、`DEF_LOSS=0.5`、随机区间 `0.85~1.15`、`WAR_LOG_KEEP=50`、赛季周期=1 周。上线后按手感微调。

## 7. 省份相邻数据

`src/lib/war/adjacency.ts` 维护 34 省的相邻表（对称）。跨海按相邻处理：`海南↔广东`、`台湾↔福建`、`香港/澳门↔广东`。单测校验：对称性、省份齐全、无自环。

## 8. 接口

- `POST /api/snacks/:id/like` —— 见 §5（增援 + 一次推进步）。
- `GET /api/battle/state` —— **只读**（不推进战斗，仅做赛季到期检查），返回：
  ```
  { season: { id, endsAt, status },
    territories: [ { province, owner, garrison } x34 ],
    leaderboard: [ { faction, territories, power } ... ],   // 按占领数排序
    log: [ { at, message } ... 最近若干条 ],
    lastWinner?: province }
  ```

## 9. 前端战场页 `/battle`

- 客户端组件 `BattleMap`：
  - echarts 中国地图，每块领地用其**归属派系颜色**填充（34 色固定调色板）。
  - 每约 4 秒轮询 `/api/battle/state`，平滑更新颜色与数字。
  - 侧栏：当前赛季 + 倒计时、**派系排行榜**（按占领领地数）、**战报滚动**。
  - 点击省份 → 弹层：显示归属、驻军，以及该省零食列表 + 👍 点赞按钮（点赞即时增援）。
- 导航加入口链接到 `/battle`。跳转一律用整页导航 / 原生 `<a>`（本站客户端路由失效的既知问题）。

## 10. 测试策略

- **引擎纯函数单测**（重点）：注入固定 RNG，验证——点赞给家乡增援、家乡失守时改增援最强领地、强省攻破弱邻并易主染色、击退不易主、占满全国触发提前获胜、赛季结束后重置与新季从 0 起、相邻表对称完整。
- **持久层**：赛季结算条件更新只结算一次；点赞事务正确写回领地/驻军/战报。
- **点赞接口**：`like_count` 与 `war_power` 各 +1、触发一次推进步；省份识别不出时只加 `like_count`、不参战。
- 引擎与 DB 解耦，绝大多数逻辑可在无网络环境下测（契合当前命令通道不稳的现实）。

## 11. 分期

- **第一期（MVP，本设计的实现范围）**：数据表 + 点赞接口与详情页按钮 + 事件驱动战争引擎 + `state` 接口 + 战场页（地图染色 + 排行榜 + 战报 + 点省点赞）。跑通完整闭环。
- **第二期（后续，另开计划）**：小兵行军动画、音效、名人堂页面、分享战况图、点赞限额、卡片上的点赞入口。

## 12. 风险与权衡

- **不限量点赞**：一个人/脚本可刷爆某省。已知取舍，先观察；架构预留限额位。
- **多数省份暂无零食**：0 省力，仅有初始 `BASE_GARRISON`，会被少数热门省蚕食——早期地图偏「热门省扩张」，可接受，且随零食增多改善。
- **事件驱动的静止**：无人点赞时战局完全静止（这正是设计意图）。若想「无人时也缓慢演进」，未来可加一个每日 cron 兜底跑几步（非必需）。
- **并发**：点赞与赛季结算并发时，用 DB 小事务 + 赛季条件更新（只结算一次）控制；轻微不一致对娱乐性无碍。
