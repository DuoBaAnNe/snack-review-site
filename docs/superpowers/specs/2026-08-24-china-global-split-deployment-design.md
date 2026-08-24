# 国内阿里云与境外 Vercel 分流部署设计

日期：2026-08-24
状态：用户已确认

## 背景

`linglingqi.fun` 当前部署在 Vercel，权威 DNS 已由阿里云云解析 DNS 管理。网站使用 Next.js 16，零食、资讯、账号、评论和图片存储在同一个 Turso/libSQL 数据库中。

域名已经通过阿里云 ICP 备案，备案号为 `粤ICP备2026121558号-1`。公安联网备案正在办理。

用户已经购买一台位于深圳的全新阿里云 ECS：

- Alibaba Cloud Linux 3.2104 LTS 64 位
- 2 vCPU、2 GiB 内存
- 40 GiB ESSD Entry 系统盘
- 3 Mbps 固定公网带宽

## 目标

1. 中国内地用户访问 `linglingqi.fun` 或 `www.linglingqi.fun` 时进入深圳 ECS。
2. 中国境外用户继续进入 Vercel。
3. 两个站点运行同一套代码并访问同一个 Turso 数据库，避免数据同步和冲突。
4. 保持登录、后台、上传、评论、资讯、地图等现有动态功能。
5. 国内 ECS 异常时可以通过 DNS 快速人工回退到 Vercel。
6. 整个切换过程可在正式 DNS 变更前完成验证，避免停机上线。

## 第一阶段不包含

- 不迁移 Turso 数据库。
- 不建立国内外双数据库或数据复制。
- 不启用阿里云 GTM 自动故障切换。
- 不启用阿里云 CDN。
- 不建设 GitHub 到 ECS 的全自动部署流水线。
- 不改变 Vercel 当前的自动部署流程。

这些能力根据实际访问速度、流量和稳定性数据决定是否进入第二阶段。

## 选定架构

```text
中国内地用户
      │
      ▼
阿里云智能 DNS ──────► 深圳 ECS / Nginx / Next.js
                              │
                              ▼
                         Turso 数据库

中国境外用户
      │
      ▼
阿里云智能 DNS ──────► Vercel / Next.js
                              │
                              ▼
                         同一 Turso 数据库
```

选择阿里云云解析 DNS 的中国内地/境外线路实现第一阶段分流。阿里云 GTM 作为后续可选升级，而不是首发依赖。

## ECS 运行结构

```text
公网 80/443
     │
     ▼
Nginx（HTTPS、反向代理、安全响应头）
     │
     ▼
127.0.0.1:3000
     │
     ▼
Next.js Node.js 生产服务
     │
     ▼
Turso
```

### 基础软件

- Node.js 24 LTS，与当前 Vercel 和本地验证环境保持一致。
- Nginx 负责 80/443、TLS 和反向代理。
- `systemd` 管理 Next.js 进程，配置开机启动和异常自动重启。
- 为 2 GiB 内存的实例增加约 2 GiB Swap，降低 `npm ci` 和 `next build` 时内存不足的风险。
- 应用目录为 `/opt/linglingqi`。
- 应用使用独立的 `linglingqi` Linux 服务账户运行。
- `systemd` 服务名称固定为 `linglingqi.service`。
- Next.js 只监听 `127.0.0.1:3000`，不直接暴露到公网。

### 发布方式

第一阶段在 ECS 上提供一条受控部署脚本，执行以下固定流程：

1. 拉取 GitHub `main` 的指定提交。
2. 安装锁文件指定的依赖。
3. 运行功能测试与生产构建。
4. 构建成功后原子更新当前版本。
5. 重启 `systemd` 服务。
6. 运行本机和公网健康检查。
7. 检查失败时保留上一版本并恢复服务。

Vercel 仍由 GitHub `main` 自动部署。ECS 和 Vercel 的最终提交 SHA 必须一致。

## 环境变量和数据

ECS 使用与 Vercel 相同的生产环境值，至少包括：

- `TURSO_DATABASE_URL`
- `TURSO_AUTH_TOKEN`
- `SESSION_SECRET`
- 管理员和用户认证所需变量
- AI 分析所需变量

环境变量通过加密连接写入 `/etc/linglingqi/linglingqi.env`，文件所有者为应用服务账户，权限设置为 `0600`。密钥不得写入 Git、设计文档、部署日志或聊天消息。

两个站点共享：

- 零食与图片
- 食品资讯
- 用户与登录相关数据
- 评论与评分
- 后台增删改数据

两个 Next.js 实例的进程内缓存彼此独立。当前零食查询缓存最长约 10 秒，因此写入后两个地区可能存在不超过约 10 秒的显示差异，但持久化数据保持一致。

`SESSION_SECRET` 必须完全相同，保证用户被不同 DNS 线路解析到另一个来源时，现有会话仍可验证。

每日资讯 Cron 继续只在 Vercel 执行。ECS 不配置相同的定时任务，避免重复生成资讯。

## DNS 设计

当前权威 DNS 为阿里云 `dns31.hichina.com` 和 `dns32.hichina.com`，正式修改继续在阿里云云解析 DNS 完成。

实施时先建立国内源站记录，再为主域名增加分线路记录：

| 主机记录 | 解析线路 | 目标 |
|---|---|---|
| `cn-origin` | 默认 | A 记录 `120.79.2.186` |
| `@` | 中国内地 | CNAME 到 `cn-origin.linglingqi.fun` |
| `@` | 中国境外 | Vercel 域名设置当时显示的推荐目标 |
| `@` | 默认 | Vercel 域名设置当时显示的推荐目标 |
| `www` | 中国内地 | CNAME 到 `cn-origin.linglingqi.fun` |
| `www` | 中国境外 | Vercel 域名设置当时显示的推荐目标 |
| `www` | 默认 | Vercel 域名设置当时显示的推荐目标 |

Vercel 目标不得凭记忆硬编码；切换当天从 Vercel 项目 Domain 设置读取并验证。

首次切换使用阿里云当前套餐允许的较短 TTL。稳定观察后将 TTL 调整为约 600 秒。

智能解析根据递归 DNS/LocalDNS 的来源位置判断线路。使用境外公共 DNS、VPN 或特殊网络的少量中国内地用户可能进入 Vercel，这属于 DNS 地理分流的预期限制，不作为故障处理。

## HTTPS 与域名

- Vercel 继续维护其生产来源上的 TLS 证书。
- ECS 通过阿里云证书服务为 `linglingqi.fun` 和 `www.linglingqi.fun` 配置单独的有效证书。
- DNS 切换前必须完成 ECS 证书安装并验证完整证书链。
- Nginx 同时接受主域名和 `www`，并按现有网站规范统一规范域名，避免重复内容。
- 证书到期监控必须在上线时启用。

同一个域名在两个来源使用不同但均有效的证书是允许的；用户只会看到当前 DNS 路由到的来源所提供的证书。

## 网络与安全

阿里云安全组仅开放：

- TCP 80：全部访问来源，用于 HTTP 跳转和必要验证。
- TCP 443：全部访问来源，用于 HTTPS。
- TCP 22：仅允许管理端固定 IP；如管理端无固定 IP，则每次管理前临时放行并在完成后收紧。

其他规则：

- 禁止公网直接访问 Next.js 3000 端口。
- SSH 仅允许密钥认证，禁用密码登录和 root 远程登录。
- 应用使用独立的低权限 Linux 服务账户运行。
- Nginx 设置请求体大小、超时和基础速率限制，确保图片上传仍可用但不接受异常大请求。
- 系统、Node.js 和 Nginx 安全更新按月检查。
- 日志不得记录密码、令牌、完整 Cookie 或上传图片的 Base64 内容。

## 健康检查、监控和错误处理

应用增加 `/api/health` 健康检查地址，且不返回密钥、用户信息或业务数据。该地址至少验证：

- Next.js 进程能够响应。
- Turso 可以完成轻量只读查询。
- 返回 `APP_GIT_SHA` 当前部署提交标识，便于比较 ECS 与 Vercel 版本。

ECS 监控至少包含：

- HTTPS 可用性和响应时间
- CPU、内存、Swap、磁盘空间
- Next.js 服务重启次数
- Nginx 5xx 数量
- Turso 查询失败
- TLS 证书到期时间

第一阶段不自动修改 DNS。若 ECS 健康检查持续失败：

1. 将 `@` 和 `www` 的中国内地线路暂时改回 Vercel 推荐目标。
2. 等待 DNS TTL 和递归 DNS 缓存过期。
3. 在不影响用户的情况下修复 ECS。
4. 验证通过后重新启用中国内地线路。

因为两个来源共用 Turso，DNS 回退不涉及数据恢复或合并。

若 Turso 本身不可用，两个来源都会受影响。此风险属于第一阶段明确接受的单点依赖，后续是否迁移或复制数据库由实际监控数据决定。

## 合规展示

网站页脚增加并持续显示：

- `粤ICP备2026121558号-1`
- 链接到工信部备案系统 `https://beian.miit.gov.cn/`

公安联网备案正在办理，本次不显示不存在的公安备案号。取得正式编号后，再增加公安备案图标、编号和指定链接。

## 上线顺序

1. 在代码中加入 ICP 备案号和健康检查。
2. 完成本地测试和生产构建。
3. 配置 ECS 安全组、系统账户、Swap、Node.js、Nginx 和 `systemd`。
4. 通过安全通道写入生产环境变量。
5. 部署代码并安装 ECS TLS 证书。
6. 使用 `curl --resolve` 等方式令请求携带正式域名但直连 ECS，验证 HTTPS 和 Host 配置，不修改公众 DNS。
7. 验证首页、零食、图片、地图、资讯、登录、注册、上传、评论、后台和健康检查。
8. 对比 ECS 与 Vercel 的提交 SHA 和数据结果。
9. 创建阿里云中国内地智能解析记录，保留境外和默认 Vercel 记录。
10. 分别从中国内地和境外解析节点检查 DNS 结果。
11. 观察错误率、延迟、带宽和 Turso 查询时间。
12. 稳定后将 TTL 调整为约 600 秒。

## 验收标准

- 中国内地 DNS 检测节点解析到深圳 ECS。
- 中国境外 DNS 检测节点解析到 Vercel。
- `linglingqi.fun` 和 `www.linglingqi.fun` 的 HTTPS 均正常。
- ECS 与 Vercel 运行同一个 Git 提交。
- 两个来源显示相同的零食、资讯和评论数据。
- 登录会话可在两个来源验证。
- 上传和后台写入后，另一个来源在缓存期限内显示更新。
- 每日资讯任务没有重复执行。
- 首页、地图、资讯展开/收起、零食分页和后台流程无回归。
- 页面页脚正确显示 ICP 备案号。
- DNS 回退操作经过一次演练并留下步骤记录。

## 参考资料

- [阿里云：按解析请求来源进行智能域名解析](https://help.aliyun.com/zh/dns/pubz-intelligent-analysis)
- [阿里云：解析线路优先级与中国内地/境外线路](https://help.aliyun.com/zh/dns/pubz-resolve-line-enumeration/)
- [阿里云：GTM 地理位置访问策略与健康检查](https://help.aliyun.com/zh/dns/product-price-for-gtm)
- [阿里云：多云场景全局容灾实践](https://help.aliyun.com/zh/dns/use-gtm-to-implement-global-disaster-recovery-in-multi-cloud-scenarios)
- [阿里云：ICP备案及公安联网备案流程](https://help.aliyun.com/zh/icp-filing/basic-icp-service/user-guide/icp-filing-application-overview)
- [Vercel：使用外部 DNS 配置自定义域名](https://vercel.com/docs/domains/set-up-custom-domain)
- [Next.js：Node.js 与 Docker 部署方式](https://nextjs.org/docs/app/getting-started/deploying)
