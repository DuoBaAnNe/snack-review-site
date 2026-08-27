import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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
