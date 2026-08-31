import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import test from 'node:test';

function read(path: string) {
    return readFileSync(path, 'utf8');
}

function assertBefore(content: string, first: string, second: string) {
    const firstIndex = content.indexOf(first);
    const secondIndex = content.indexOf(second);
    assert.notEqual(firstIndex, -1, `missing first marker: ${first}`);
    assert.notEqual(secondIndex, -1, `missing second marker: ${second}`);
    assert.ok(firstIndex < secondIndex, `${first} must precede ${second}`);
}

function findBash() {
    if (process.env.BASH) return process.env.BASH;
    if (process.platform !== 'win32') return 'bash';
    const gitExecPath = spawnSync('git', ['--exec-path'], { encoding: 'utf8' });
    assert.equal(gitExecPath.status, 0, gitExecPath.stderr);
    const bash = resolve(gitExecPath.stdout.trim(), '..', '..', '..', 'bin', 'bash.exe');
    assert.ok(existsSync(bash), `Git Bash was not found at ${bash}`);
    return bash;
}

function runOssDeploymentScenario(options: {
    args?: string;
    directExecution?: boolean;
    manifest?: string;
    ossutilFailure?: boolean;
}) {
    const bash = findBash();
    const tempRoot = mkdtempSync(resolve(process.env.TEMP ?? process.env.TMP ?? '.', 'linglingqi-oss-test-'));
    const command = [
        'set -Eeuo pipefail',
        'if [[ "$(uname -s)" =~ ^(MINGW|MSYS|CYGWIN) ]]; then temp_root="$(cygpath -u "$1")"; else temp_root="$1"; fi',
        'runtime_dir="${temp_root}/runtime"',
        'fake_bin="${temp_root}/bin"',
        'mkdir -p "${runtime_dir}" "${fake_bin}"',
        'cat > "${temp_root}/config.json" <<\'JSON\'',
        '{"region":"cn-shenzhen","bucket":"abc","endpoint":"https://oss-cn-shenzhen-internal.aliyuncs.com","prefix":"ecs-releases","ecsRoleName":"9.release-reader"}',
        'JSON',
        'cat > "${fake_bin}/ossutil" <<\'FAKE_OSSUTIL\'',
        '#!/usr/bin/env bash',
        'set -Eeuo pipefail',
        'printf "%s\\n" "$*" >> "${LINGLINGQI_OSS_TEST_ROOT}/ossutil-calls"',
        'if [[ "${LINGLINGQI_OSS_TEST_OSSUTIL_FAILURE:-}" == "true" ]]; then exit 55; fi',
        'if [[ "$2" == *"ecs-releases/requests/current.json" ]]; then',
        '    printf "%s" "${LINGLINGQI_OSS_TEST_MANIFEST}" > "$3"',
        'else',
        '    printf "artifact" > "$3"',
        'fi',
        'FAKE_OSSUTIL',
        'cat > "${temp_root}/fake-deploy.sh" <<\'FAKE_DEPLOY\'',
        '#!/usr/bin/env bash',
        'set -Eeuo pipefail',
        '[[ "$#" -eq 4 && "$1" == "--bundle" && -f "$3" && -f "$4" ]]',
        'printf "%s\\n" "$@" >> "${LINGLINGQI_OSS_TEST_ROOT}/deploy-call"',
        'FAKE_DEPLOY',
        'chmod +x "${fake_bin}/ossutil" "${temp_root}/fake-deploy.sh"',
        'export LINGLINGQI_OSS_DEPLOY_LIBRARY_ONLY=true',
        'export LINGLINGQI_OSS_DEPLOY_TEST_MODE=true',
        'export LINGLINGQI_OSS_TEST_CONFIG_FILE="${temp_root}/config.json"',
        'export LINGLINGQI_OSS_TEST_RUNTIME_DIR="${runtime_dir}"',
        'export LINGLINGQI_OSS_TEST_OSSUTIL="${fake_bin}/ossutil"',
        'export LINGLINGQI_OSS_TEST_DEPLOY_SCRIPT="${temp_root}/fake-deploy.sh"',
        'export LINGLINGQI_OSS_TEST_ROOT="${temp_root}"',
        `export LINGLINGQI_OSS_TEST_MANIFEST='${options.manifest ?? '{"releaseSha":"0123456789abcdef0123456789abcdef01234567"}'}'`,
        options.ossutilFailure ? 'export LINGLINGQI_OSS_TEST_OSSUTIL_FAILURE=true' : '',
        options.directExecution ? 'bash "$2"' : 'source "$2"',
        options.directExecution ? '' : `main${options.args ? ` ${options.args}` : ''}`,
    ].filter(Boolean).join('\n');
    const result = spawnSync(bash, ['-lc', command, 'bash', tempRoot, 'deploy/ecs/deploy-from-oss.sh'], { encoding: 'utf8' });
    return { result, runtimeDir: resolve(tempRoot, 'runtime'), tempRoot };
}

function runAutomaticInstallerScenario(options: {
    config: string;
    ossutilExitCode: number;
    ossutilOutput: string;
}) {
    const bash = findBash();
    const tempRoot = mkdtempSync(resolve(process.env.TEMP ?? process.env.TMP ?? '.', 'linglingqi-installer-test-'));
    const command = [
        'set -Eeuo pipefail',
        'if [[ "$(uname -s)" =~ ^(MINGW|MSYS|CYGWIN) ]]; then temp_root="$(cygpath -u "$1")"; else temp_root="$1"; fi',
        'fake_bin="${temp_root}/bin"',
        'mkdir -p "${fake_bin}"',
        'cat > "${temp_root}/config.json" <<\'JSON\'',
        options.config,
        'JSON',
        'cat > "${fake_bin}/id" <<\'FAKE_ID\'',
        '#!/usr/bin/env bash',
        'if [[ "$1" == "-u" ]]; then printf "0\\n"; exit 0; fi',
        'exec /usr/bin/id "$@"',
        'FAKE_ID',
        'cat > "${fake_bin}/ossutil" <<\'FAKE_OSSUTIL\'',
        '#!/usr/bin/env bash',
        'printf "%s\\n" "$*" >> "${LINGLINGQI_INSTALLER_TEST_ROOT}/ossutil-calls"',
        'printf "%s\\n" "${LINGLINGQI_INSTALLER_TEST_OSSUTIL_OUTPUT}"',
        'exit "${LINGLINGQI_INSTALLER_TEST_OSSUTIL_EXIT}"',
        'FAKE_OSSUTIL',
        'cat > "${fake_bin}/install" <<\'FAKE_INSTALL\'',
        '#!/usr/bin/env bash',
        'printf "%s\\n" "$*" >> "${LINGLINGQI_INSTALLER_TEST_ROOT}/install-calls"',
        'FAKE_INSTALL',
        'chmod +x "${fake_bin}/id" "${fake_bin}/ossutil" "${fake_bin}/install"',
        'export LINGLINGQI_INSTALLER_TEST_ROOT="${temp_root}"',
        `export LINGLINGQI_INSTALLER_TEST_OSSUTIL_EXIT='${options.ossutilExitCode}'`,
        `export LINGLINGQI_INSTALLER_TEST_OSSUTIL_OUTPUT='${options.ossutilOutput}'`,
        'PATH="${fake_bin}:${PATH}" bash "$2" "${temp_root}/config.json"',
    ].join('\n');
    const result = spawnSync(bash, ['-lc', command, 'bash', tempRoot, 'deploy/ecs/install-automatic-deployment.sh'], { encoding: 'utf8' });
    return { result, tempRoot };
}

test('systemd runs Next.js as the dedicated user on loopback', () => {
    const service = read('deploy/ecs/systemd/linglingqi.service');
    assert.match(service, /^User=linglingqi$/m);
    assert.match(service, /^Group=linglingqi$/m);
    assert.match(service, /^WorkingDirectory=\/opt\/linglingqi\/current$/m);
    assert.match(service, /^EnvironmentFile=\/etc\/linglingqi\/linglingqi\.env$/m);
    assert.match(service, /--hostname 127\.0\.0\.1 --port 3000/);
    assert.match(service, /^Restart=always$/m);
});

test('nginx terminates TLS and proxies only to the loopback app', () => {
    const nginx = read('deploy/ecs/nginx/linglingqi.conf');
    assert.match(nginx, /server_name linglingqi\.fun www\.linglingqi\.fun;/);
    assert.equal((nginx.match(/listen 443 ssl http2;/g) ?? []).length, 2);
    assert.doesNotMatch(nginx, /^\s*http2 on;$/m);
    const proxyPassTargets = [...nginx.matchAll(/proxy_pass\s+([^;\s]+)\s*;/g)].map((match) => match[1]);
    assert.deepEqual(proxyPassTargets, ['http://127.0.0.1:3000']);
    assert.match(nginx, /client_max_body_size 110m;/);
    assert.match(nginx, /proxy_read_timeout 90s;/);
    assert.match(nginx, /ssl_certificate \/etc\/nginx\/ssl\/linglingqi\/fullchain\.pem;/);
    assert.match(nginx, /return 301 https:\/\/linglingqi\.fun\$request_uri;/);
});

test('bootstrap provisions Node 24, swap, nginx, user, and directories', () => {
    const bootstrap = read('deploy/ecs/bootstrap-alibaba-linux.sh');
    assert.match(bootstrap, /setup_24\.x/);
    assert.match(bootstrap, /\^v24\./);
    assert.match(bootstrap, /\/swapfile/);
    assert.match(bootstrap, /useradd.*linglingqi/);
    assert.match(bootstrap, /systemctl enable nginx/);
    assert.match(bootstrap, /\/opt\/linglingqi\/releases/);
});

test('bootstrap rejects symlinked and non-regular swap targets before writing', () => {
    const bootstrap = read('deploy/ecs/bootstrap-alibaba-linux.sh');
    assertBefore(bootstrap, '[[ -L /swapfile ]]', 'dd if=/dev/zero of=/swapfile');
    assertBefore(bootstrap, '[[ -e /swapfile && ! -f /swapfile ]]', 'dd if=/dev/zero of=/swapfile');
});

test('deploy script uses versioned releases, an atomic symlink, and rollback', () => {
    const deploy = read('deploy/ecs/deploy.sh');
    assert.match(deploy, /repository\.git/);
    assert.match(deploy, /releases\/\$\{release_sha\}/);
    assert.match(deploy, /mv -Tf/);
    assert.match(deploy, /systemctl restart linglingqi\.service/);
    assert.match(deploy, /\/api\/health/);
    assert.match(deploy, /previous_target/);
});

test('deploy serializes validation, build, activation, health, and rollback', () => {
    const deploy = read('deploy/ecs/deploy.sh');
    assert.match(deploy, /deployment_lock_file="\/run\/lock\/linglingqi\/deploy\.lock"/);
    assert.match(deploy, /chown root:root "\$\{deployment_lock_file\}"/);
    assert.match(deploy, /flock --exclusive --timeout 30 "\$\{deployment_lock_fd\}"/);
    assertBefore(deploy, 'flock --exclusive --timeout 30', 'if [[ ! -f "${environment_file}"');
    assertBefore(deploy, 'flock --exclusive --timeout 30', 'git clone --bare');
});

test('deploy accepts only a verified offline bundle under the deployment lock', () => {
    const deploy = read('deploy/ecs/deploy.sh');
    assert.match(deploy, /--bundle/);
    assert.match(deploy, /sha256sum --check/);
    assert.match(deploy, /git -C "\$\{bundle_verification_repository\}" bundle verify/);
    assert.match(deploy, /ecs-release-\$\{requested_sha\}/);
    assertBefore(deploy, 'flock --exclusive --timeout 30', 'snapshot_offline_bundle "${bundle_path}"');
    assertBefore(deploy, 'sha256sum --check', 'fetch --force');
});

test('offline deployment rejects short or uppercase commit identifiers', () => {
    const deploy = read('deploy/ecs/deploy.sh');
    assert.match(deploy, /\^\[0-9a-f\]\{40\}\$/);
});

test('offline deployment never fetches GitHub', () => {
    const deploy = read('deploy/ecs/deploy.sh');
    assert.match(deploy, /if \[\[ "\$\{source_mode\}" == "online" \]\]/);
    assert.match(deploy, /else[\s\S]*import_verified_offline_bundle/);
});

test('OSS deployment reads only a fixed request manifest and derives immutable release keys', () => {
    const script = read('deploy/ecs/deploy-from-oss.sh');
    assert.match(script, /if \[\[ "\$#" -ne 0 \]\]/);
    assert.match(script, /ecs-releases\/requests\/current\.json/);
    assert.match(script, /releaseSha/);
    assert.match(script, /\^\[0-9a-f\]\{40\}\$/);
    assert.match(script, /ecs-releases\/\$\{release_sha\}\/source\.bundle/);
    assert.match(script, /ecs-releases\/\$\{release_sha\}\/source\.bundle\.sha256/);
    assert.doesNotMatch(script, /release_sha="\$1"/);
    assert.match(script, /--mode EcsRamRole/);
    assert.match(script, /--ecs-role-name "\$\{ecs_role_name\}"/);
    assert.match(script, /oss-cn-shenzhen-internal\.aliyuncs\.com/);
    assert.match(script, /mktemp --directory \/run\/linglingqi-release\.XXXXXXXX/);
    assert.match(script, /trap cleanup EXIT/);
    assert.match(script, /deploy\.sh" --bundle/);
    assert.doesNotMatch(script, /exec .*deploy\.sh/);
});

test('OSS deployment parses a constrained JSON configuration without sourcing it', () => {
    const script = read('deploy/ecs/deploy-from-oss.sh');
    const example = JSON.parse(read('deploy/ecs/alibaba-deployment.example.json'));
    assert.deepEqual(example, {
        region: 'cn-shenzhen',
        bucket: 'linglingqi-ecs-releases-example',
        endpoint: 'https://oss-cn-shenzhen-internal.aliyuncs.com',
        prefix: 'ecs-releases',
        ecsRoleName: 'LinglingqiEcsReleaseReader',
    });
    assert.doesNotMatch(script, /(?:source|\.) .*alibaba-deployment/);
    assert.match(script, /JSON\.parse/);
    assert.match(script, /config\.region !== 'cn-shenzhen'/);
    assert.match(script, /config\.endpoint !== 'https:\/\/oss-cn-shenzhen-internal\.aliyuncs\.com'/);
    assert.match(script, /config\.prefix !== 'ecs-releases'/);
    assert.match(script, /\^\[a-z0-9\]\[a-z0-9-\]\{1,61\}\[a-z0-9\]\$/);
    assert.match(script, /\^\[A-Za-z0-9.-\]\{1,64\}\$/);
});

test('OSS deployment downloads a SHA-derived release once and cleans its temporary directory', () => {
    const scenario = runOssDeploymentScenario({});
    try {
        assert.equal(scenario.result.status, 0, scenario.result.stderr);
        assert.equal(readFileSync(resolve(scenario.tempRoot, 'ossutil-calls'), 'utf8').trim().split(/\r?\n/).length, 3);
        const deployArgs = readFileSync(resolve(scenario.tempRoot, 'deploy-call'), 'utf8').trim().split(/\r?\n/);
        assert.equal(deployArgs.length, 4);
        assert.deepEqual(deployArgs.slice(0, 2), ['--bundle', '0123456789abcdef0123456789abcdef01234567']);
        assert.match(deployArgs[2], /source\.bundle$/);
        assert.match(deployArgs[3], /source\.bundle\.sha256$/);
        assert.deepEqual(readdirSync(scenario.runtimeDir), []);
    } finally {
        rmSync(scenario.tempRoot, { recursive: true, force: true });
    }
});

test('OSS deployment rejects invocation parameters before downloading', () => {
    const scenario = runOssDeploymentScenario({ args: 'unexpected' });
    try {
        assert.notEqual(scenario.result.status, 0);
        assert.ok(!existsSync(resolve(scenario.tempRoot, 'ossutil-calls')));
        assert.ok(!existsSync(resolve(scenario.tempRoot, 'deploy-call')));
        assert.deepEqual(readdirSync(scenario.runtimeDir), []);
    } finally {
        rmSync(scenario.tempRoot, { recursive: true, force: true });
    }
});

test('OSS deployment accepts test dependencies only from a sourced library harness', () => {
    const scenario = runOssDeploymentScenario({ directExecution: true });
    try {
        assert.notEqual(scenario.result.status, 0);
        assert.ok(!existsSync(resolve(scenario.tempRoot, 'ossutil-calls')));
        assert.ok(!existsSync(resolve(scenario.tempRoot, 'deploy-call')));
        assert.deepEqual(readdirSync(scenario.runtimeDir), []);
    } finally {
        rmSync(scenario.tempRoot, { recursive: true, force: true });
    }
});

test('OSS deployment rejects a manifest with fields beyond releaseSha and cleans up', () => {
    const scenario = runOssDeploymentScenario({
        manifest: '{"releaseSha":"0123456789abcdef0123456789abcdef01234567","path":"untrusted"}',
    });
    try {
        assert.notEqual(scenario.result.status, 0);
        assert.ok(existsSync(resolve(scenario.tempRoot, 'ossutil-calls')));
        assert.ok(!existsSync(resolve(scenario.tempRoot, 'deploy-call')));
        assert.deepEqual(readdirSync(scenario.runtimeDir), []);
    } finally {
        rmSync(scenario.tempRoot, { recursive: true, force: true });
    }
});

test('OSS deployment stops before deploy when ossutil fails and cleans up', () => {
    const scenario = runOssDeploymentScenario({ ossutilFailure: true });
    try {
        assert.notEqual(scenario.result.status, 0);
        assert.ok(existsSync(resolve(scenario.tempRoot, 'ossutil-calls')));
        assert.ok(!existsSync(resolve(scenario.tempRoot, 'deploy-call')));
        assert.deepEqual(readdirSync(scenario.runtimeDir), []);
    } finally {
        rmSync(scenario.tempRoot, { recursive: true, force: true });
    }
});

test('automatic deployment installer installs root-owned entrypoints and constrained configuration', () => {
    const installer = read('deploy/ecs/install-automatic-deployment.sh');
    assert.match(installer, /\[\[ "\$\(id -u\)" != "0" \]\]/);
    assert.match(installer, /install -d -o root -g root -m 0755 \/usr\/local\/libexec\/linglingqi/);
    assert.match(installer, /install -o root -g root -m 0755[\s\S]*deploy\.sh[\s\S]*\/usr\/local\/libexec\/linglingqi\/deploy\.sh/);
    assert.match(installer, /install -o root -g root -m 0755[\s\S]*deploy-from-oss\.sh[\s\S]*\/usr\/local\/libexec\/linglingqi\/deploy-from-oss\.sh/);
    assert.match(installer, /install -o root -g root -m 0600[\s\S]*\/etc\/linglingqi\/alibaba-deployment\.json/);
    assert.match(installer, /ossutil version/);
    assert.match(installer, /official ossutil 2\.x installation instructions/);
    assert.doesNotMatch(installer, /curl\s*\|\s*(?:ba)?sh/);
});

test('automatic deployment installer validates supplied JSON before querying ossutil', () => {
    const scenario = runAutomaticInstallerScenario({
        config: '{',
        ossutilExitCode: 0,
        ossutilOutput: 'ossutil version 2.1.0',
    });
    try {
        assert.notEqual(scenario.result.status, 0);
        assert.ok(!existsSync(resolve(scenario.tempRoot, 'ossutil-calls')));
        assert.ok(!existsSync(resolve(scenario.tempRoot, 'install-calls')));
    } finally {
        rmSync(scenario.tempRoot, { recursive: true, force: true });
    }
});

test('automatic deployment installer rejects failed ossutil 2.x checks before installing files', () => {
    const scenario = runAutomaticInstallerScenario({
        config: '{"region":"cn-shenzhen","bucket":"abc","endpoint":"https://oss-cn-shenzhen-internal.aliyuncs.com","prefix":"ecs-releases","ecsRoleName":"9.release-reader"}',
        ossutilExitCode: 55,
        ossutilOutput: 'ossutil version 2.1.0',
    });
    try {
        assert.notEqual(scenario.result.status, 0);
        assert.match(scenario.result.stderr, /ossutil 2\.x is required/);
        assert.equal(readFileSync(resolve(scenario.tempRoot, 'ossutil-calls'), 'utf8').trim(), 'version');
        assert.ok(!existsSync(resolve(scenario.tempRoot, 'install-calls')));
    } finally {
        rmSync(scenario.tempRoot, { recursive: true, force: true });
    }
});

test('automatic deployment installer rejects non-version ossutil output before installing files', () => {
    const scenario = runAutomaticInstallerScenario({
        config: '{"region":"cn-shenzhen","bucket":"abc","endpoint":"https://oss-cn-shenzhen-internal.aliyuncs.com","prefix":"ecs-releases","ecsRoleName":"9.release-reader"}',
        ossutilExitCode: 0,
        ossutilOutput: 'unexpected output mentioning 2.1.0',
    });
    try {
        assert.notEqual(scenario.result.status, 0);
        assert.match(scenario.result.stderr, /ossutil 2\.x is required/);
        assert.equal(readFileSync(resolve(scenario.tempRoot, 'ossutil-calls'), 'utf8').trim(), 'version');
        assert.ok(!existsSync(resolve(scenario.tempRoot, 'install-calls')));
    } finally {
        rmSync(scenario.tempRoot, { recursive: true, force: true });
    }
});

test('Cloud Assistant command has no parameters and invokes only the fixed OSS deploy entrypoint', () => {
    const command = read('deploy/ecs/cloud-assistant-command.sh');
    assert.match(command, /^#!\/usr\/bin\/env bash$/m);
    assert.match(command, /^exec \/usr\/local\/libexec\/linglingqi\/deploy-from-oss\.sh$/m);
    assert.doesNotMatch(command, /\{\{|\}\}|\$[0-9]|release_sha/);
    assert.doesNotMatch(command, /curl|git|ossutil|ssh|vercel/);
});

test('ECS release reader policy grants only object reads under the release prefix', () => {
    const policy = JSON.parse(read('deploy/ecs/ram/ecs-release-reader-policy.json'));
    assert.deepEqual(policy, {
        Version: '1',
        Statement: [{
            Effect: 'Allow',
            Action: ['oss:GetObject'],
            Resource: ['acs:oss:*:*:RELEASE_BUCKET/ecs-releases/*'],
        }],
    });
});

test('local release publisher policy is limited to release objects and one fixed ECS command target', () => {
    const policy = JSON.parse(read('deploy/ecs/ram/local-release-publisher-policy.json'));
    assert.deepEqual(policy, {
        Version: '1',
        Statement: [
            {
                Effect: 'Allow',
                Action: ['oss:PutObject', 'oss:GetObject', 'oss:DeleteObject'],
                Resource: ['acs:oss:*:*:RELEASE_BUCKET/ecs-releases/*'],
            },
            {
                Effect: 'Allow',
                Action: ['ecs:InvokeCommand'],
                Resource: [
                    'acs:ecs:cn-shenzhen:ACCOUNT_ID:command/COMMAND_ID',
                    'acs:ecs:cn-shenzhen:ACCOUNT_ID:instance/i-wz9doghzi13squhaxb6t',
                ],
            },
            {
                Effect: 'Allow',
                Action: ['ecs:DescribeCloudAssistantStatus'],
                Resource: ['acs:ecs:cn-shenzhen:ACCOUNT_ID:instance/i-wz9doghzi13squhaxb6t'],
            },
            {
                Effect: 'Allow',
                Action: ['ecs:DescribeInvocations'],
                Resource: [
                    'acs:ecs:cn-shenzhen:ACCOUNT_ID:command/COMMAND_ID',
                    'acs:ecs:cn-shenzhen:ACCOUNT_ID:instance/i-wz9doghzi13squhaxb6t',
                ],
            },
        ],
    });

    const actions = policy.Statement.flatMap((statement: { Action: string[] }) => statement.Action);
    assert.ok(!actions.includes('ecs:*'));
    assert.ok(!actions.includes('oss:*'));
    const text = JSON.stringify(policy);
    assert.doesNotMatch(text, /SecurityGroup|RunCommand|CreateCommand|ModifyCommand|DeleteCommand|AccessKey|vercel|ssh/i);
});

test('bootstrap creates the automatic deployment directory without deployment configuration', () => {
    const bootstrap = read('deploy/ecs/bootstrap-alibaba-linux.sh');
    assert.match(bootstrap, /install -d -o root -g root -m 0755 \/usr\/local\/libexec\/linglingqi/);
    assert.doesNotMatch(bootstrap, /alibaba-deployment\.json|ecsRoleName|bucket|credential/i);
});

test('offline bundle validation snapshots an ordinary artifact before local verification and import', () => {
    const deploy = read('deploy/ecs/deploy.sh');
    assert.match(deploy, /snapshot_offline_bundle\(\)/);
    assert.match(deploy, /import_verified_offline_bundle\(\)/);
    assert.match(deploy, /O_NOFOLLOW/);
    assert.match(deploy, /process\.platform === 'win32'/);

    const bash = findBash();
    const command = [
        'set -Eeuo pipefail',
        'export LINGLINGQI_DEPLOY_LIBRARY_ONLY=true',
        'source "$1"',
        'temp_dir="$(mktemp -d)"',
        'cleanup() { rm -rf -- "${temp_dir}"; }',
        'trap cleanup EXIT',
        'git init -q "${temp_dir}/source"',
        'git -C "${temp_dir}/source" -c user.name=test -c user.email=test@example.com commit --allow-empty -qm source',
        'requested_sha="$(git -C "${temp_dir}/source" rev-parse HEAD)"',
        'ecs_release_tag="ecs-release-${requested_sha}"',
        'git -C "${temp_dir}/source" tag "${ecs_release_tag}" "${requested_sha}"',
        'mkdir "${temp_dir}/artifacts"',
        'git -C "${temp_dir}/source" bundle create "${temp_dir}/artifacts/source.bundle" "refs/tags/${ecs_release_tag}"',
        '(cd "${temp_dir}/artifacts" && printf "%s  source.bundle\\n" "$(sha256sum source.bundle | cut -d " " -f1)" > source.bundle.sha256)',
        'mkdir "${temp_dir}/trusted"',
        'bundle_snapshot_dir="$(snapshot_offline_bundle "${temp_dir}/artifacts/source.bundle" "${temp_dir}/artifacts/source.bundle.sha256" "${temp_dir}/trusted" "$(id -u)")"',
        '[[ "${bundle_snapshot_dir}" == "${temp_dir}/trusted/bundle."* ]]',
        'git init --bare -q "${temp_dir}/repository.git"',
        'release_sha="$(import_verified_offline_bundle "${temp_dir}/repository.git" "${bundle_snapshot_dir}/source.bundle" "${requested_sha}" "${ecs_release_tag}")"',
        'tag_sha="$(git -C "${temp_dir}/repository.git" rev-parse --verify "refs/tags/${ecs_release_tag}^{commit}")"',
        '[[ "${release_sha}" == "${requested_sha}" && "${tag_sha}" == "${requested_sha}" ]]',
    ].join('\n');
    const result = spawnSync(bash, ['-lc', command, 'bash', 'deploy/ecs/deploy.sh'], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
});

test('deploy rejects an untrusted bare repository before fetching', () => {
    const deploy = read('deploy/ecs/deploy.sh');
    assert.match(deploy, /\[\[ -L "\$\{repository_dir\}" \]\]/);
    assert.match(deploy, /remote get-url origin/);
    assert.match(deploy, /"\$\{actual_repository_url\}" != "\$\{repository_url\}"/);
    assertBefore(deploy, 'remote get-url origin', 'fetch --force --prune origin');
});

test('deploy accepts a dedicated ECS release tag without requiring origin main', () => {
    const deploy = read('deploy/ecs/deploy.sh');
    assert.match(deploy, /ecs-release-\$\{requested_sha\}/);
    assert.match(deploy, /refs\/tags\/\$\{ecs_release_tag\}/);
    assert.match(deploy, /The requested commit is neither reachable from origin\/main nor authorized by its ECS release tag/);
});

test('certificate installer reloads an active Nginx service', () => {
    const certificate = read('deploy/ecs/install-certificate.sh');
    assert.match(certificate, /LINGLINGQI_CERTIFICATE_DESTINATION_DIR/);
    assert.match(certificate, /nginx_was_active=true/);
    assert.match(certificate, /run_activation_command systemctl reload nginx/);
});

test('certificate installer starts an inactive Nginx service', () => {
    const certificate = read('deploy/ecs/install-certificate.sh');
    assert.match(certificate, /run_activation_command systemctl start nginx/);
    assert.match(certificate, /systemctl stop nginx/);
});

test('certificate installer restores live files on failure or interruption', () => {
    const certificate = read('deploy/ecs/install-certificate.sh');
    assert.match(certificate, /trap certificate_exit EXIT/);
    assert.match(certificate, /trap 'exit 130' INT/);
    assert.match(certificate, /trap 'exit 143' TERM/);
    assert.match(certificate, /restore_previous_certificate/);
    assert.match(certificate, /rollback_certificate_activation/);
    assert.match(certificate, /record_activation_interrupt/);
    assertBefore(certificate, 'trap certificate_exit EXIT', 'live_files_replaced=true');
    assertBefore(certificate, 'activation_complete=true', 'rm -f -- "${activation_status_file}"');
    assertBefore(certificate, 'activation_complete=true', 'trap - EXIT INT TERM');
});

test('certificate installer preserves backups when rollback itself fails', () => {
    const certificate = read('deploy/ecs/install-certificate.sh');
    assert.match(certificate, /if \[\[ "\$\{preserve_backups\}" != "true" \]\]; then/);
    assert.match(certificate, /if ! restore_previous_certificate; then[\s\S]*preserve_backups=true/);
});

test('environment example names secrets but contains no values', () => {
    const envExample = read('deploy/ecs/linglingqi.env.example');
    const required = [
        'TURSO_DATABASE_URL=',
        'TURSO_AUTH_TOKEN=',
        'SESSION_SECRET=',
        'ANTHROPIC_AUTH_TOKEN=',
        'ANTHROPIC_BASE_URL=',
        'ANTHROPIC_MODEL=',
        'ADMIN_PASSWORD_HASH=',
        'CRON_SECRET=',
        'APP_GIT_SHA=',
    ];
    const assignmentLines = envExample
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#'));
    for (const line of assignmentLines) {
        assert.match(line, /^(?:TURSO_DATABASE_URL|TURSO_AUTH_TOKEN|SESSION_SECRET|ANTHROPIC_AUTH_TOKEN|ANTHROPIC_BASE_URL|ANTHROPIC_MODEL|ADMIN_PASSWORD_HASH|CRON_SECRET|APP_GIT_SHA)=$/);
    }
    assert.deepEqual([...assignmentLines].sort(), [...required].sort());
});
