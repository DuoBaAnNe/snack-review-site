# 七零十阿里云 ECS 发布说明（无需 SSH）

这份说明用于 `linglingqi.fun` 的中国内地版本。目标服务器固定为深圳 ECS
`i-wz9doghzi13squhaxb6t`，公网 IP 为 `120.79.2.186`。

## 日常上线：用户只需要说一句话

一次性配置完成后，用户只需要对 Codex 说“上线阿里云”。Codex 会在项目目录运行
`npm run deploy:aliyun` 这一发布入口，并自动带上当前完整 Git SHA：

```powershell
npm run deploy:aliyun -- --sha <当前提交的40位小写SHA>
```

发布器会先检查工作区、运行相关测试和生产构建，再上传私有 OSS 制品，调用固定且
**无参数**的云助手命令，最后核对公网 `/api/health` 的 SHA。普通发布只更新阿里云
ECS；只有用户明确说“重大更新上线 Vercel”时才更新 Vercel。

日常上线不会做以下事情：

- 不开放或使用 TCP 22，不修改安全组。
- 不让 ECS 连接 GitHub，不执行 `git push`。
- 不执行 Vercel CLI、Promote 或任何 Vercel 部署。
- 不把 AccessKey、数据库令牌或网站环境变量写进 Git、日志或聊天。

## 一次性准备：先记录三个非秘密值

下面九步只做一次。开始前准备一张纸或本机临时记事文件，记录：

1. 新建的私有 OSS Bucket 名称，下面用 `RELEASE_BUCKET` 表示。
2. 阿里云主账号 ID，下面用 `ACCOUNT_ID` 表示。它不是 AccessKey。
3. 第五步创建的固定云助手命令 ID，下面用 `COMMAND_ID` 表示。

这三个是资源标识，不是登录密码。策略模板中的大写占位符必须全部替换，替换后的
策略再粘贴进阿里云控制台；不要把实际策略另存并提交到 Git。

### 第 1 屏：创建深圳私有 OSS Bucket

1. 打开“对象存储 OSS”控制台，选择深圳地域 `cn-shenzhen`，新建专用 Bucket。
2. 读写权限选择“私有”，开启“阻止公共访问”，不要开启公共读或公共写。
3. 打开该 Bucket 的“生命周期”，新建规则，前缀填写 `ecs-releases/`。
4. 让该前缀中的对象在 7 天后删除。生命周期只是失败清理的兜底；成功发布会主动
   删除本次制品。
5. 记录 Bucket 名称。不要手工创建公开下载链接。

### 第 2 屏：创建 ECS 只读实例角色

1. 打开“RAM 访问控制 > 权限管理 > 权限策略”，新建自定义 JSON 策略。
2. 打开 [ecs-release-reader-policy.json](ram/ecs-release-reader-policy.json)，只把其中
   每个 `RELEASE_BUCKET` 替换为第一步的真实 Bucket 名称。
3. 保存策略，例如命名为 `LinglingqiEcsReleaseReaderPolicy`。
4. 打开“RAM 角色 > 创建角色”，可信实体选择阿里云服务，受信服务选择 ECS，角色
   名称填写 `LinglingqiEcsReleaseReader`。
5. 给该角色附加刚才的自定义策略。
6. 回到 ECS 实例详情，把角色绑定到实例 `i-wz9doghzi13squhaxb6t`。

该角色只有 `oss:GetObject`，而且只能读取
`RELEASE_BUCKET/ecs-releases/`。它不能上传、删除或列举其他对象，也不需要 AccessKey。

### 第 3 屏：确认云助手在线

1. 打开目标 ECS 的“运维与监控 > 云助手”。
2. 确认 Agent 状态为“在线”。
3. 如果离线，只按阿里云控制台给出的官方修复步骤恢复 Agent；不要为此开放 22。

### 第 4 屏：安装服务器端固定入口

这一步是一次性的受控安装，不是日常发布。通过云助手“发送文件”或一次性安装命令，
把以下文件放到 ECS 的 root 专用临时目录：

- `deploy/ecs/deploy.sh`
- `deploy/ecs/deploy-from-oss.sh`
- `deploy/ecs/install-automatic-deployment.sh`
- 一份根据 `deploy/ecs/alibaba-deployment.example.json` 生成的服务器配置

服务器配置只修改 `bucket` 为真实 Bucket；其余必须保持：

```json
{
  "region": "cn-shenzhen",
  "bucket": "RELEASE_BUCKET",
  "endpoint": "https://oss-cn-shenzhen-internal.aliyuncs.com",
  "prefix": "ecs-releases",
  "ecsRoleName": "LinglingqiEcsReleaseReader"
}
```

先按阿里云官方说明安装并确认 `ossutil 2.x`，然后以 root 从项目文件所在目录执行：

```bash
ossutil version
bash deploy/ecs/install-automatic-deployment.sh /root/alibaba-deployment.json
stat -c '%U:%G %a %n' \
  /usr/local/libexec/linglingqi/deploy.sh \
  /usr/local/libexec/linglingqi/deploy-from-oss.sh \
  /etc/linglingqi/alibaba-deployment.json
```

两个脚本应是 `root:root 755`，配置应是 `root:root 600`。安装器不会执行
`curl | bash`，也不会在服务器保存长期 AccessKey。

### 第 5 屏：保存固定、无参数的云助手命令

1. 打开“云助手 > 命令 > 创建命令”，类型选择 Linux Shell/`RunShellScript`。
2. 命令内容完整复制 `deploy/ecs/cloud-assistant-command.sh`。
3. 执行用户选择 root，超时填写 1800 秒。
4. **关闭自定义参数**。该命令不接受 SHA、路径或任意 Shell 参数；SHA 只从私有 OSS
   的 `ecs-releases/requests/current.json` 读取。
5. 保存后记录实际 `COMMAND_ID`。不要使用“立即运行命令”或可输入任意脚本的
   `RunCommand` 代替它。

固定命令只会执行：

```bash
/usr/local/libexec/linglingqi/deploy-from-oss.sh
```

请求文件只能包含 `{"releaseSha":"40位小写SHA"}`；服务器自行推导 bundle 和校验
文件路径，不信任请求文件提供的路径。

### 第 6 屏：创建本地发布 RAM 身份

1. 打开“RAM 访问控制 > 身份管理 > 用户”，创建
   `LinglingqiReleasePublisher`。不要使用主账号 AccessKey，默认不要开启控制台登录。
2. 新建自定义 JSON 策略，打开
   [local-release-publisher-policy.json](ram/local-release-publisher-policy.json)。
3. 替换所有 `RELEASE_BUCKET`、`ACCOUNT_ID`、`COMMAND_ID`，确认文件里不再有这三个
   大写占位符后保存。
4. 把该策略只附加给 `LinglingqiReleasePublisher`。

该身份只能在 `ecs-releases/` 上传、读取和删除对象；只能查询目标实例云助手状态、
查询固定命令的执行结果，并在固定实例上调用固定命令。它没有安全组、SSH、任意命令、
Vercel、DNS 或其他 OSS 路径权限。

### 第 7 屏：只在本机配置 Alibaba CLI 和 ossutil

在 Windows PowerShell 中安装官方 Alibaba Cloud CLI 和 ossutil 2.x，然后运行：

```powershell
aliyun configure --profile linglingqi-deployer
ossutil config
```

按提示输入 `LinglingqiReleasePublisher` 的凭据，地域选择 `cn-shenzhen`，ossutil 使用
深圳公网 endpoint。凭据只进入当前 Windows 用户的 CLI/ossutil 配置目录，不进入项目
`.env` 或 JSON 文件。

**不要把 AccessKey ID、AccessKey Secret 或临时安全令牌发给 Codex。** 输入秘密时，
终端完全不显示内容、显示很多 `*`，或者粘贴后只显示一个 `*`，都可能是正常的安全
输入表现；回车后回到命令提示符也不代表失败。需要确认时只运行不会打印秘密的身份
查询命令。

### 第 8 屏：创建被 Git 忽略的本地配置

复制示例文件：

```powershell
Copy-Item deploy/ecs/alibaba-deployment.local.example.json deploy/ecs/alibaba-deployment.local.json
```

只替换 `bucket` 和 `commandId`，其他固定值不要改：

```json
{
  "regionId": "cn-shenzhen",
  "instanceId": "i-wz9doghzi13squhaxb6t",
  "bucket": "RELEASE_BUCKET",
  "objectPrefix": "ecs-releases",
  "commandId": "COMMAND_ID",
  "aliyunProfile": "linglingqi-deployer"
}
```

`deploy/ecs/alibaba-deployment.local.json` 已被 `.gitignore` 忽略。该文件虽不含 AccessKey，
仍然只保留在本机，不要提交。

### 第 9 屏：收紧并保持安全组

目标实例入方向保持：

- TCP 80：公网网站 HTTP。
- TCP 443：公网网站 HTTPS。
- 用户决定保留的 ICMP。

确认没有 TCP 22，也没有公网 TCP 3000。云助手使用阿里云实例管理通道，不需要 SSH
入站规则。以后普通上线也不要临时新增 22。

## 一次性验证

从项目根目录运行：

```powershell
npm run test:aliyun-deploy
npm run test:deployment
git status --short
```

真实首次演练必须保持 22 关闭。发布完成后检查：

```powershell
Invoke-RestMethod https://linglingqi.fun/api/health
```

返回的 `gitSha` 必须与本机发布的完整 SHA 相同；安全组和 Vercel Production 部署不得
发生变化。

## 失败时怎么处理

- 本地测试或构建失败：没有上传、没有调用 ECS，修好代码后再试。
- 云助手离线：不要开放 22 自动回退；网站继续运行旧版本，先恢复 Agent。
- 显示 InvocationId 且仍在运行或超时：保存这个 InvocationId，查询同一次执行；不要
  再触发第二次命令。
- 公网健康 SHA 不一致：保留 OSS 制品供诊断，不改 DNS，不自动发布 Vercel。
- 新版本健康检查失败：服务器会尝试恢复上一版本；只有日志明确显示恢复成功，才算
  已安全回滚。

查看 ECS 服务状态时可通过云助手固定的诊断流程执行：

```bash
systemctl status linglingqi.service --no-pager
journalctl -u linglingqi.service --since '15 minutes ago' --no-pager
curl --fail --silent --show-error http://127.0.0.1:3000/api/health
```

不要把令牌、Cookie、完整环境文件或用户数据复制到聊天或工单。

## 仍然不变的运维边界

- Nginx 对外只监听 80/443，Next.js 只监听 `127.0.0.1:3000`。
- 证书必须覆盖 `linglingqi.fun` 和 `www.linglingqi.fun`；证书更新后验证两个域名 HTTPS。
- 中国内地 DNS 指向深圳 ECS；境外和默认线路继续使用 Vercel。自动发布脚本从不修改
  DNS。
- 不在 ECS 配置 Cron、systemd timer 或其他调度器调用 `/api/cron/news` 和
  `/api/cron/enrich`；这些任务仍只由 Vercel 调度，避免共享 Turso 数据被重复处理。
- 数据库结构、环境变量或 API 契约若与当前 Vercel 版本不兼容，必须先做联合发布或
  迁移方案，不能直接只更新 ECS。

## 服务器重建与长期维护（不属于日常上线）

下面内容只在重建服务器、更新证书或排查基础设施时使用，不能混入普通发布流程。

### 环境文件白名单

ECS 的 `/etc/linglingqi/linglingqi.env` 只允许以下名称：

```text
TURSO_DATABASE_URL
TURSO_AUTH_TOKEN
SESSION_SECRET
ANTHROPIC_AUTH_TOKEN
ANTHROPIC_BASE_URL
ANTHROPIC_MODEL
ADMIN_PASSWORD_HASH
CRON_SECRET
APP_GIT_SHA
```

前六项必填，`ADMIN_PASSWORD_HASH` 和 `CRON_SECRET` 可选；`APP_GIT_SHA` 留空，由
`deploy.sh` 管理。环境文件通过云助手受控“发送文件”交给服务器，再安装为
`linglingqi:linglingqi 600`。不要把 Vercel、Blob、OIDC、Turbo、Nx 或部署元数据变量
复制到 ECS；不要显示或粘贴环境文件内容。

若全新服务器需要执行基础安装，只通过经确认的一次性云助手安装操作，在仓库文件所在
目录执行：

```bash
bash deploy/ecs/bootstrap-alibaba-linux.sh
node --version
swapon --show
systemctl is-enabled nginx
```

基础脚本准备 Node.js 24、Nginx、服务账号和 swap，但不会代替环境文件、证书或自动
发布入口的安装。

### TLS 证书更新

证书必须同时覆盖 `linglingqi.fun` 和 `www.linglingqi.fun`。通过云助手受控“发送文件”
把完整证书链和私钥放入 root 临时目录，不要把私钥发到聊天或提交 Git，然后执行：

```bash
bash deploy/ecs/install-certificate.sh /root/fullchain.pem /root/privkey.pem
rm -f -- /root/fullchain.pem /root/privkey.pem
```

安装器会先验证完整 Nginx 配置；若激活失败，会恢复上一份证书。更新后验证两个域名的
HTTPS 和 `/api/health`。

### DNS 记录边界与手动回退

修改 DNS 前必须先导出当前 AliDNS 记录，并在 Vercel 项目的 Domain 设置中读取当时
推荐的记录类型和目标值，不要猜测或把未来可能变化的 Vercel 目标硬编码进脚本。

| 主机记录 | 类型 | 解析线路 | 目标 |
| --- | --- | --- | --- |
| `cn-origin` | A | 默认 | `120.79.2.186` |
| `@` | CNAME | 中国内地 | `cn-origin.linglingqi.fun` |
| `@` | Vercel 当前要求 | 境外 | Vercel 当前推荐目标 |
| `@` | Vercel 当前要求 | 默认 | Vercel 当前推荐目标 |
| `www` | CNAME | 中国内地 | `cn-origin.linglingqi.fun` |
| `www` | Vercel 当前要求 | 境外 | Vercel 当前推荐目标 |
| `www` | Vercel 当前要求 | 默认 | Vercel 当前推荐目标 |

如果 ECS 长时间不健康，手动把 `@` 和 `www` 的中国内地线路恢复为事先记录的 Vercel
目标，等待 TTL 和递归缓存后重新检查 HTTPS。自动发布器永远不执行 DNS 回退。

### 日志与每月维护

诊断时避免输出秘密：

```bash
journalctl -u linglingqi.service --since '15 minutes ago' --no-pager
systemctl status linglingqi.service --no-pager
tail -n 200 /var/log/nginx/error.log
```

至少每月在维护窗口检查系统安全更新、磁盘和 swap，并提前查看证书到期时间：

```bash
dnf check-update
echo | openssl s_client -servername linglingqi.fun \
  -connect linglingqi.fun:443 2>/dev/null | openssl x509 -noout -dates
```
