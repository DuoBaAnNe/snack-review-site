# 阿里云 ECS 无 SSH 自动发布 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让用户以后只需说“上线阿里云”，即可在 TCP 22 长期关闭、ECS 无法访问 GitHub 的情况下，把精确 Git 提交安全发布到深圳 ECS，并自动验证或回滚。

**Architecture:** 本地 TypeScript 发布器完成测试、Git bundle 制作、SHA-256 计算、私有 OSS 上传、云助手固定命令调用和公网健康检查。ECS 通过实例 RAM 角色从 OSS 内网下载制品，统一交给扩展后的 `deploy.sh` 完成校验、构建、原子切换及回滚；Vercel 和安全组不在该流程的权限范围内。

**Tech Stack:** Node.js 24、TypeScript/tsx、Node Test Runner、Bash、Git bundle、ossutil 2.x、Alibaba Cloud CLI、ECS 云助手、RAM、私有 OSS、systemd、Nginx。

**Spec:** `docs/superpowers/specs/2026-08-27-ecs-automatic-deployment-without-ssh-design.md`

## Global Constraints

- TCP 22 长期关闭；自动化不得创建、修改或删除安全组规则。
- 普通“上线阿里云”不得执行 `git push`、Vercel CLI、Vercel Promote 或更新 Vercel。
- ECS 日常发布不得访问 GitHub；发布输入必须是精确的 40 位小写 Git SHA。
- 制品必须同时通过 SHA-256、Git bundle 和 `ecs-release-<full-sha>` 标签校验。
- 阿里云权限必须限定到专用 OSS 前缀、固定云助手命令和实例 `i-wz9doghzi13squhaxb6t`。
- 不使用主账号 AccessKey；凭据不得写入 Git、项目 `.env`、日志或聊天。
- 沿用 `/opt/linglingqi/releases`、`/opt/linglingqi/current`、`linglingqi.service`、`/api/health` 和现有自动回滚。
- 数据库结构或环境变量发生不兼容变化时，发布器必须停止，不能把 ECS 与 Vercel 留在不兼容版本。

## File Structure

- Modify: `deploy/ecs/deploy.sh` — 同一部署锁内支持在线 GitHub 模式和经过校验的离线 bundle 模式；共享构建、切换、健康检查及回滚逻辑。
- Create: `deploy/ecs/deploy-from-oss.sh` — 读取 root 管理的非密钥配置，通过 ECS 实例 RAM 角色从 OSS 下载精确制品，然后调用 `deploy.sh --bundle`。
- Create: `deploy/ecs/alibaba-deployment.example.json` — 记录部署配置结构，不包含凭据。
- Create: `deploy/ecs/cloud-assistant-command.sh` — 固定云助手命令模板，只接受 `release_sha` 参数。
- Create: `deploy/ecs/install-automatic-deployment.sh` — 一次性安装 ossutil、root-owned 发布脚本与配置。
- Create: `deploy/ecs/publish-alibaba-lib.ts` — 本地配置校验、命令构造、OSS/云助手 JSON 解析与轮询状态模型。
- Create: `deploy/ecs/publish-alibaba.ts` — 本地发布入口；测试、制作制品、上传、调用、验证及清理。
- Create: `deploy/ecs/publish-alibaba.test.ts` — 本地发布器的单元测试与命令边界测试。
- Modify: `deploy/ecs/deployment-assets.test.ts` — ECS 离线入口、权限、锁、校验和云助手模板的静态契约测试。
- Modify: `deploy/ecs/bootstrap-alibaba-linux.sh` — 为自动发布准备受控目录，不保存发布凭据。
- Modify: `deploy/ecs/README.md` — 一次性配置、日常发布、故障处理和手动回滚运行手册。
- Modify: `.gitignore` — 忽略仅本机保存的 `deploy/ecs/alibaba-deployment.local.json`。
- Modify: `package.json` — 增加 `test:aliyun-deploy` 和 `deploy:aliyun` 命令。

---

### Task 1: 在现有部署锁内加入离线 Git bundle 输入

**Files:**
- Modify: `deploy/ecs/deploy.sh`
- Modify: `deploy/ecs/deployment-assets.test.ts`

**Interfaces:**
- Consumes: 在线模式 `deploy.sh <git-sha>`；离线模式 `deploy.sh --bundle <full-git-sha> <bundle-path> <checksum-path>`。
- Produces: 已验证并导入 `/opt/linglingqi/repository.git` 的提交；后续 OSS 入口依赖该命令。

- [ ] **Step 1: 写离线模式的失败测试**

在 `deployment-assets.test.ts` 增加以下契约：

```ts
test('deploy accepts only a verified offline bundle under the deployment lock', () => {
    const deploy = read('deploy/ecs/deploy.sh');
    assert.match(deploy, /--bundle/);
    assert.match(deploy, /sha256sum --check/);
    assert.match(deploy, /git bundle verify/);
    assert.match(deploy, /ecs-release-\$\{requested_sha\}/);
    assertBefore(deploy, 'flock --exclusive --timeout 30', 'sha256sum --check');
    assertBefore(deploy, 'sha256sum --check', 'fetch --force');
});

test('offline deployment rejects short or uppercase commit identifiers', () => {
    const deploy = read('deploy/ecs/deploy.sh');
    assert.match(deploy, /\^\[0-9a-f\]\{40\}\$/);
});

test('offline deployment never fetches GitHub', () => {
    const deploy = read('deploy/ecs/deploy.sh');
    assert.match(deploy, /if \[\[ "\$\{source_mode\}" == "online" \]\]/);
    assert.match(deploy, /else[\s\S]*git bundle verify/);
});
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `npm run test:deployment`

Expected: FAIL，提示缺少 `--bundle`、`sha256sum --check` 或 `git bundle verify`。

- [ ] **Step 3: 实现严格参数解析和制品校验**

在 `deploy.sh` 最前面将参数解析为两个模式：

```bash
source_mode="online"
if [[ "$#" -eq 1 ]]; then
    requested_sha="$1"
elif [[ "$#" -eq 4 && "$1" == "--bundle" ]]; then
    source_mode="bundle"
    requested_sha="$2"
    bundle_path="$3"
    checksum_path="$4"
else
    echo "Usage: $0 <git-sha> | $0 --bundle <full-git-sha> <bundle-path> <checksum-path>" >&2
    exit 1
fi

if [[ "${source_mode}" == "bundle" && ! "${requested_sha}" =~ ^[0-9a-f]{40}$ ]]; then
    echo "Offline deployment requires a full lowercase 40-character Git SHA." >&2
    exit 1
fi
```

在现有 `flock` 成功后、任何仓库修改前完成：普通文件/非符号链接检查、root 所有权检查、`sha256sum --check`、`git bundle verify`。checksum 文件只允许一行 `<64 lowercase hex><two spaces>source.bundle`。

- [ ] **Step 4: 在同一锁内导入并授权精确标签**

在线模式保留原有 origin 校验和 fetch。离线模式只执行：

```bash
ecs_release_tag="ecs-release-${requested_sha}"
git -C "${repository_dir}" fetch --force "${bundle_path}" \
    "+refs/tags/${ecs_release_tag}:refs/tags/${ecs_release_tag}"
release_sha="$(git -C "${repository_dir}" rev-parse --verify "${requested_sha}^{commit}")"
tag_sha="$(git -C "${repository_dir}" rev-parse --verify "refs/tags/${ecs_release_tag}^{commit}")"
[[ "${release_sha}" == "${requested_sha}" && "${tag_sha}" == "${requested_sha}" ]]
```

若当前 `/api/health` 已报告同一个 SHA，则返回 `Already deployed and verified <sha>.`，不覆盖 release 目录；否则继续使用现有构建、原子切换和回滚代码。

- [ ] **Step 5: 运行部署资产测试**

Run: `npm run test:deployment`

Expected: PASS，包括原有在线发布契约和新增离线契约。

- [ ] **Step 6: 用临时裸仓库做离线导入集成测试**

Run:

```bash
temp_dir="$(mktemp -d)"
sha="$(git rev-parse HEAD)"
tag="ecs-release-${sha}"
git tag "${tag}" "${sha}"
git bundle create "${temp_dir}/source.bundle" "refs/tags/${tag}"
(cd "${temp_dir}" && sha256sum source.bundle > source.bundle.sha256)
git bundle verify "${temp_dir}/source.bundle"
git tag -d "${tag}"
rm -rf -- "${temp_dir}"
```

Expected: `git bundle verify` 成功，临时标签和临时目录被删除。

- [ ] **Step 7: 提交**

```bash
git add deploy/ecs/deploy.sh deploy/ecs/deployment-assets.test.ts
git commit -m "feat: support verified offline ecs releases"
```

---

### Task 2: 增加 ECS 的私有 OSS 下载入口

**Files:**
- Create: `deploy/ecs/deploy-from-oss.sh`
- Create: `deploy/ecs/alibaba-deployment.example.json`
- Modify: `deploy/ecs/deployment-assets.test.ts`

**Interfaces:**
- Consumes: `deploy-from-oss.sh <full-git-sha>` 和 `/etc/linglingqi/alibaba-deployment.json`。
- Produces: root 临时目录内的 `source.bundle`/`source.bundle.sha256`，随后调用 Task 1 的 `deploy.sh --bundle`。

- [ ] **Step 1: 写 OSS 入口失败测试**

```ts
test('OSS deployment uses an ECS RAM role and an exact immutable object key', () => {
    const script = read('deploy/ecs/deploy-from-oss.sh');
    assert.match(script, /\^\[0-9a-f\]\{40\}\$/);
    assert.match(script, /--mode EcsRamRole/);
    assert.match(script, /ecs-releases\/\$\{release_sha\}\/source\.bundle/);
    assert.match(script, /oss-cn-shenzhen-internal\.aliyuncs\.com/);
    assert.match(script, /mktemp --directory/);
    assert.match(script, /trap cleanup EXIT/);
    assert.match(script, /deploy\.sh" --bundle/);
});

test('OSS deployment config is data, not sourced shell', () => {
    const script = read('deploy/ecs/deploy-from-oss.sh');
    assert.doesNotMatch(script, /source .*alibaba-deployment/);
    assert.match(script, /JSON\.parse/);
});
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `npm run test:deployment`

Expected: FAIL，提示 `deploy-from-oss.sh` 不存在。

- [ ] **Step 3: 创建无密钥 JSON 配置结构**

`alibaba-deployment.example.json` 使用以下键：

```json
{
  "region": "cn-shenzhen",
  "bucket": "linglingqi-ecs-releases-example",
  "endpoint": "https://oss-cn-shenzhen-internal.aliyuncs.com",
  "prefix": "ecs-releases",
  "ecsRoleName": "LinglingqiEcsReleaseReader"
}
```

运行时配置必须验证：地域严格等于 `cn-shenzhen`；endpoint 严格等于深圳 OSS 内网 HTTPS；prefix 严格等于 `ecs-releases`；bucket 和 role 只允许各自官方字符集。

- [ ] **Step 4: 实现下载和清理**

`deploy-from-oss.sh` 必须：

```bash
release_sha="$1"
[[ "${release_sha}" =~ ^[0-9a-f]{40}$ ]]
download_dir="$(mktemp --directory /run/linglingqi-release.XXXXXXXX)"
chmod 0700 "${download_dir}"
trap cleanup EXIT INT TERM

ossutil cp "oss://${bucket}/${prefix}/${release_sha}/source.bundle" \
    "${download_dir}/source.bundle" --force \
    --mode EcsRamRole --ecs-role-name "${ecs_role_name}" \
    --region "${region}" --endpoint "${endpoint}"
ossutil cp "oss://${bucket}/${prefix}/${release_sha}/source.bundle.sha256" \
    "${download_dir}/source.bundle.sha256" --force \
    --mode EcsRamRole --ecs-role-name "${ecs_role_name}" \
    --region "${region}" --endpoint "${endpoint}"

/usr/local/libexec/linglingqi/deploy.sh --bundle "${release_sha}" \
    "${download_dir}/source.bundle" "${download_dir}/source.bundle.sha256"
```

不要输出配置、临时凭据或下载 URL 查询参数。

- [ ] **Step 5: 运行测试和 Shell 语法检查**

Run:

```bash
bash -n deploy/ecs/deploy-from-oss.sh
npm run test:deployment
```

Expected: 两条命令均 PASS。

- [ ] **Step 6: 提交**

```bash
git add deploy/ecs/deploy-from-oss.sh deploy/ecs/alibaba-deployment.example.json deploy/ecs/deployment-assets.test.ts
git commit -m "feat: download ecs releases from private oss"
```

---

### Task 3: 安装 root-owned 自动发布入口和固定云助手命令

**Files:**
- Create: `deploy/ecs/install-automatic-deployment.sh`
- Create: `deploy/ecs/cloud-assistant-command.sh`
- Modify: `deploy/ecs/bootstrap-alibaba-linux.sh`
- Modify: `deploy/ecs/deployment-assets.test.ts`

**Interfaces:**
- Consumes: 项目中的 `deploy.sh`、`deploy-from-oss.sh` 和最终真实 JSON 配置。
- Produces: `/usr/local/libexec/linglingqi/deploy.sh`、`/usr/local/libexec/linglingqi/deploy-from-oss.sh`、`/etc/linglingqi/alibaba-deployment.json` 与可保存为云助手命令的固定模板。

- [ ] **Step 1: 写安装权限和云助手边界测试**

```ts
test('automatic deployment installer creates root-owned non-writable entrypoints', () => {
    const installer = read('deploy/ecs/install-automatic-deployment.sh');
    assert.match(installer, /install -o root -g root -m 0755/);
    assert.match(installer, /\/usr\/local\/libexec\/linglingqi/);
    assert.match(installer, /install -o root -g root -m 0600/);
    assert.match(installer, /\/etc\/linglingqi\/alibaba-deployment\.json/);
    assert.match(installer, /ossutil version/);
});

test('Cloud Assistant command can invoke only the fixed OSS deploy entrypoint', () => {
    const command = read('deploy/ecs/cloud-assistant-command.sh');
    assert.match(command, /deploy-from-oss\.sh '{{release_sha}}'/);
    assert.doesNotMatch(command, /curl|git|ossutil|vercel|ssh/);
});
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `npm run test:deployment`

Expected: FAIL，提示安装脚本和云助手模板不存在。

- [ ] **Step 3: 实现幂等安装脚本**

安装脚本只以 root 运行，接受真实配置文件路径一个参数；先验证 JSON，再使用 `install` 原子复制脚本和配置。若 `ossutil version` 不存在，停止并提示按照官方 ossutil 2.x 安装步骤安装，不执行未校验的 `curl | bash`。

```bash
install -d -o root -g root -m 0755 /usr/local/libexec/linglingqi
install -o root -g root -m 0755 deploy/ecs/deploy.sh \
    /usr/local/libexec/linglingqi/deploy.sh
install -o root -g root -m 0755 deploy/ecs/deploy-from-oss.sh \
    /usr/local/libexec/linglingqi/deploy-from-oss.sh
install -o root -g root -m 0600 "${config_source}" \
    /etc/linglingqi/alibaba-deployment.json
```

`bootstrap-alibaba-linux.sh` 只创建 `/usr/local/libexec/linglingqi`，不写入 Bucket、角色或任何凭据。

- [ ] **Step 4: 创建固定参数化云助手命令**

```bash
#!/usr/bin/env bash
set -Eeuo pipefail
release_sha='{{release_sha}}'
[[ "${release_sha}" =~ ^[0-9a-f]{40}$ ]]
exec /usr/local/libexec/linglingqi/deploy-from-oss.sh "${release_sha}"
```

云助手保存时启用自定义参数，类型为 `RunShellScript`，超时设为 1800 秒，执行用户为 root；RAM 权限只允许调用该 CommandId 和目标实例。

- [ ] **Step 5: 运行测试和语法检查**

Run:

```bash
bash -n deploy/ecs/install-automatic-deployment.sh
bash -n deploy/ecs/cloud-assistant-command.sh
npm run test:deployment
```

Expected: PASS。

- [ ] **Step 6: 提交**

```bash
git add deploy/ecs/install-automatic-deployment.sh deploy/ecs/cloud-assistant-command.sh deploy/ecs/bootstrap-alibaba-linux.sh deploy/ecs/deployment-assets.test.ts
git commit -m "feat: install fixed cloud assistant deploy command"
```

---

### Task 4: 实现可测试的本地阿里云发布器

**Files:**
- Create: `deploy/ecs/publish-alibaba-lib.ts`
- Create: `deploy/ecs/publish-alibaba.ts`
- Create: `deploy/ecs/publish-alibaba.test.ts`
- Create: `deploy/ecs/alibaba-deployment.local.example.json`
- Modify: `.gitignore`
- Modify: `package.json`

**Interfaces:**
- Consumes: `deploy/ecs/alibaba-deployment.local.json`、当前 Git HEAD、`ossutil` 默认本地安全配置、Alibaba CLI profile `linglingqi-deployer`。
- Produces: `npm run deploy:aliyun -- --sha <full-sha>`；返回成功、已部署、回滚成功或需人工介入的明确状态。

- [ ] **Step 1: 写配置与参数校验失败测试**

```ts
test('parseConfig pins the only production ECS target', () => {
    const config = parseConfig(JSON.stringify({
        regionId: 'cn-shenzhen',
        instanceId: 'i-wz9doghzi13squhaxb6t',
        bucket: 'linglingqi-release-test',
        objectPrefix: 'ecs-releases',
        commandId: 'c-test123',
        aliyunProfile: 'linglingqi-deployer'
    }));
    assert.equal(config.instanceId, 'i-wz9doghzi13squhaxb6t');
});

test('validateReleaseSha rejects a short SHA', () => {
    assert.throws(() => validateReleaseSha('3a5acea'), /full lowercase/);
});

test('buildCommands has no SSH, Vercel, GitHub, push, or security-group action', () => {
    const rendered = JSON.stringify(buildCommands(validConfig, fullSha, 'C:\\release'));
    assert.doesNotMatch(rendered, /ssh|vercel|github|git push|AuthorizeSecurityGroup/i);
});
```

- [ ] **Step 2: 写云助手响应与终态失败测试**

```ts
test('parseInvokeId requires exactly one invocation id', () => {
    assert.equal(parseInvokeId('{"InvokeId":"t-test"}'), 't-test');
    assert.throws(() => parseInvokeId('{}'), /InvokeId/);
});

test('parseInvocation distinguishes success, failure, and running', () => {
    assert.equal(parseInvocation(successFixture).state, 'success');
    assert.equal(parseInvocation(failedFixture).state, 'failed');
    assert.equal(parseInvocation(runningFixture).state, 'running');
});
```

- [ ] **Step 3: 运行测试并确认失败**

Run: `npx --yes tsx@4.23.12 --test deploy/ecs/publish-alibaba.test.ts`

Expected: FAIL，提示发布器模块不存在。

- [ ] **Step 4: 实现纯函数库**

导出并固定以下接口：

```ts
export type DeployConfig = {
    regionId: 'cn-shenzhen';
    instanceId: 'i-wz9doghzi13squhaxb6t';
    bucket: string;
    objectPrefix: 'ecs-releases';
    commandId: string;
    aliyunProfile: 'linglingqi-deployer';
};

export type InvocationState =
    | { state: 'running' }
    | { state: 'success'; output: string; exitCode: 0 }
    | { state: 'failed'; output: string; exitCode: number };

export function parseConfig(json: string): DeployConfig;
export function validateReleaseSha(value: string): string;
export function buildObjectKeys(config: DeployConfig, sha: string): {
    bundleKey: string;
    checksumKey: string;
};
export function parseInvokeId(json: string): string;
export function parseInvocation(json: string): InvocationState;
```

所有 shell 命令使用 `spawn`/`execFile` 参数数组，不拼接可执行字符串。云助手 Parameters 只能是 `JSON.stringify({release_sha: sha})`。

- [ ] **Step 5: 实现发布编排**

`publish-alibaba.ts` 按以下固定顺序执行并在 `finally` 清理临时标签/目录：

```text
验证配置与 40 位 SHA
确认 SHA == git rev-parse HEAD
确认除明确忽略的本地工具目录外无未提交修改
npm run test:pagination
npm run test:map-panel
npm run test:detail-navigation
npm run test:deployment
npm run build
创建临时 ecs-release-<sha> 标签
git bundle create source.bundle refs/tags/ecs-release-<sha>
Node crypto 生成 source.bundle.sha256
ossutil api put-object 两次，均使用 --forbid-overwrite true
aliyun ecs DescribeCloudAssistantStatus
aliyun ecs InvokeCommand，保存 InvokeId
轮询 DescribeInvocations，最长 30 分钟
公网 fetch /api/health 并核对 gitSha
只删除本 SHA 的两个精确 OSS 对象
```

如果轮询超时，输出 InvokeId 并保留 OSS 对象供同一任务继续使用；不得触发第二次 InvokeCommand。

- [ ] **Step 6: 增加本地配置保护和 npm 命令**

`.gitignore` 增加：

```gitignore
/deploy/ecs/alibaba-deployment.local.json
```

`package.json` 增加：

```json
"test:aliyun-deploy": "npx --yes tsx@4.23.12 --test deploy/ecs/publish-alibaba.test.ts",
"deploy:aliyun": "npx --yes tsx@4.23.12 deploy/ecs/publish-alibaba.ts"
```

本地 example 配置只包含非秘密字段；真实文件由一次性配置步骤创建并保持 Git ignored。

- [ ] **Step 7: 运行单元测试和全量相关测试**

Run:

```bash
npm run test:aliyun-deploy
npm run test:deployment
npm run test:pagination
npm run test:map-panel
npm run test:detail-navigation
npm run build
```

Expected: 全部 PASS。

- [ ] **Step 8: 提交**

```bash
git add .gitignore package.json deploy/ecs/publish-alibaba-lib.ts deploy/ecs/publish-alibaba.ts deploy/ecs/publish-alibaba.test.ts deploy/ecs/alibaba-deployment.local.example.json
git commit -m "feat: add one-command Alibaba ECS publisher"
```

---

### Task 5: 写明最小权限和一次性控制台配置

**Files:**
- Create: `deploy/ecs/ram/ecs-release-reader-policy.json`
- Create: `deploy/ecs/ram/local-release-publisher-policy.json`
- Modify: `deploy/ecs/README.md`
- Modify: `deploy/ecs/deployment-assets.test.ts`

**Interfaces:**
- Consumes: 实际 OSS Bucket、阿里云账号 ID、固定 CommandId。
- Produces: ECS 实例角色 `LinglingqiEcsReleaseReader`、本地发布身份 `LinglingqiReleasePublisher` 和真实本地/服务器 JSON 配置。

- [ ] **Step 1: 写策略边界失败测试**

```ts
test('instance role can only read release objects', () => {
    const policy = JSON.parse(read('deploy/ecs/ram/ecs-release-reader-policy.json'));
    const text = JSON.stringify(policy);
    assert.match(text, /oss:GetObject/);
    assert.doesNotMatch(text, /oss:PutObject|oss:DeleteObject|oss:\*/);
    assert.match(text, /ecs-releases\/\*/);
});

test('publisher policy cannot change security groups or deploy Vercel', () => {
    const text = read('deploy/ecs/ram/local-release-publisher-policy.json');
    assert.match(text, /ecs:InvokeCommand/);
    assert.match(text, /ecs:DescribeInvocations/);
    assert.match(text, /oss:PutObject/);
    assert.match(text, /oss:DeleteObject/);
    assert.doesNotMatch(text, /AuthorizeSecurityGroup|RevokeSecurityGroup|ecs:\*/);
});
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `npm run test:deployment`

Expected: FAIL，提示 RAM 策略文件不存在。

- [ ] **Step 3: 创建精确策略模板并在安装时渲染实际 ARN**

实例策略只有：

```json
{
  "Effect": "Allow",
  "Action": ["oss:GetObject"],
  "Resource": ["acs:oss:*:*:RELEASE_BUCKET/ecs-releases/*"]
}
```

本地发布策略只有专用前缀的 `oss:PutObject`/`oss:GetObject`/`oss:DeleteObject`，以及目标 Command ARN 和 Instance ARN 的 `ecs:InvokeCommand`、查询 Cloud Assistant 状态/执行结果所需只读动作。实施时用实际账号 ID、Bucket 和 CommandId 生成最终策略，不把 AccessKey 放入策略或仓库。

- [ ] **Step 4: 把一次性控制台步骤写入 README**

按以下顺序写成逐屏步骤：

1. 深圳地域创建私有 OSS Bucket，关闭公共访问，配置 7 天生命周期清理 `ecs-releases/`。
2. 创建 `LinglingqiEcsReleaseReader` 实例角色，附加只读前缀策略并绑定实例 `i-wz9doghzi13squhaxb6t`。
3. 在 ECS 云助手确认 Agent 在线。
4. 使用“发送文件”或云助手一次性命令安装 ossutil 2.x、root-owned 脚本和服务器配置。
5. 保存 `cloud-assistant-command.sh` 为参数化命令，超时 1800 秒，记录实际 CommandId。
6. 创建 `LinglingqiReleasePublisher` RAM 身份并附加渲染后的最小策略。
7. 在本机配置 Alibaba CLI profile `linglingqi-deployer` 和 ossutil；凭据只进入各自用户配置。
8. 创建被 Git 忽略的 `deploy/ecs/alibaba-deployment.local.json`。
9. 保持安全组仅有网站需要的 80/443（以及用户保留的 ICMP），确认没有 22。

README 明确说明：不要粘贴 AccessKey 给 Codex；输入秘密时终端不回显或只显示一个 `*` 是正常现象。

- [ ] **Step 5: 运行测试**

Run: `npm run test:deployment`

Expected: PASS。

- [ ] **Step 6: 提交**

```bash
git add deploy/ecs/ram deploy/ecs/README.md deploy/ecs/deployment-assets.test.ts
git commit -m "docs: add least-privilege ECS release setup"
```

---

### Task 6: 一次性安装、真实演练与安全收口

**Files:**
- Modify only if verification exposes defects: files created or modified in Tasks 1–5
- Runtime-only, never commit: `deploy/ecs/alibaba-deployment.local.json`

**Interfaces:**
- Consumes: 已配置的 OSS、RAM 身份/角色、固定云助手 CommandId 和通过测试的发布器。
- Produces: 以后可由 Codex直接执行的无 SSH 阿里云发布通道。

- [ ] **Step 1: 记录发布前基线**

Run:

```powershell
Invoke-RestMethod https://linglingqi.fun/api/health
git rev-parse HEAD
git status --short
```

Expected: 健康接口返回当前 ECS SHA；明确记录新目标 SHA；除已知本地忽略文件外工作区干净。

- [ ] **Step 2: 验证 22 关闭且云助手在线**

使用阿里云 CLI 读取目标实例云助手状态，并在控制台确认安全组没有 TCP 22。不得为验证临时新增安全组规则。

Expected: `CloudAssistantStatus=true`，入方向只保留 80/443 和用户决定保留的 ICMP。

- [ ] **Step 3: 安装服务器端入口**

通过云助手的一次性受控操作安装 ossutil 2.x 和 Task 3 的文件，再执行：

```bash
ossutil version
stat -c '%U:%G %a %n' /usr/local/libexec/linglingqi/deploy.sh \
  /usr/local/libexec/linglingqi/deploy-from-oss.sh \
  /etc/linglingqi/alibaba-deployment.json
```

Expected: 脚本为 `root:root 755`，配置为 `root:root 600`。

- [ ] **Step 4: 执行首次无业务差异发布**

Run:

```powershell
npm run deploy:aliyun -- --sha (git rev-parse HEAD)
```

Expected: 本地测试通过、OSS 上传成功、云助手 ExitCode 0、公网健康接口 SHA 与 HEAD 完全一致、OSS 两个临时对象删除成功。

- [ ] **Step 5: 验证 Vercel 和安全组未变化**

比较发布前后的 Vercel Production SHA/部署时间，并重新查看 ECS 安全组。

Expected: Vercel 未新增 Production 部署；安全组仍没有 TCP 22；3000 未对公网开放。

- [ ] **Step 6: 演练失败不切换**

在测试制品中制造 checksum 不匹配并调用服务器入口；随后读取健康接口。

Expected: 云助手返回失败；`/opt/linglingqi/current` 和 `/api/health.gitSha` 保持原值；不发生服务中断。

- [ ] **Step 7: 执行最终验证**

Run:

```bash
npm run test:aliyun-deploy
npm run test:deployment
npm run test:pagination
npm run test:map-panel
npm run test:detail-navigation
npm run build
git status --short
```

Expected: 全部测试和构建 PASS；只有预期的本地 ignored 配置，Git 工作区无未提交修改。

- [ ] **Step 8: 提交演练中发现的必要修正**

只有前面验证导致代码或文档修正时执行：

```bash
git add deploy/ecs package.json .gitignore
git commit -m "fix: harden automated Alibaba deployment"
```

没有修正时不创建空提交。

## Self-Review

- Spec coverage: 覆盖无 SSH、OSS 私有制品、实例角色、固定云助手命令、本地一句话触发、幂等、并发、健康检查、回滚、清理、最小权限和 Vercel 隔离。
- Placeholder scan: 运行时未知的 Bucket、账号 ID 和 CommandId 只在一次性配置中由真实控制台值生成；计划不要求猜测或硬编码这些值。
- Type consistency: 本地入口统一使用 `DeployConfig`、40 位 `releaseSha` 和 `InvocationState`；云助手只接受同名 `release_sha`；服务器对象路径统一为 `ecs-releases/<sha>/source.bundle[.sha256]`。
