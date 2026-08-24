import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

function read(path: string) {
    return readFileSync(path, 'utf8');
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

test('deploy script uses versioned releases, an atomic symlink, and rollback', () => {
    const deploy = read('deploy/ecs/deploy.sh');
    assert.match(deploy, /repository\.git/);
    assert.match(deploy, /releases\/\$\{release_sha\}/);
    assert.match(deploy, /mv -Tf/);
    assert.match(deploy, /systemctl restart linglingqi\.service/);
    assert.match(deploy, /\/api\/health/);
    assert.match(deploy, /previous_target/);
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
