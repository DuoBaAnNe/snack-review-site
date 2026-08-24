# China–Global Split Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Serve `linglingqi.fun` from the Shenzhen Alibaba Cloud ECS for China-mainland DNS requests while keeping overseas/default traffic on Vercel, with the same code, Turso data, login secret, HTTPS, health checks, and a tested DNS rollback path.

**Architecture:** AliDNS returns the ECS origin for China-mainland lines and the current Vercel-recommended target for overseas/default lines. On ECS, Nginx terminates TLS and proxies to a systemd-managed Next.js 16 process bound only to `127.0.0.1:3000`. Releases are built in versioned directories and switched through an atomic `current` symlink; both origins share the existing Turso database, while only Vercel runs the news Cron.

**Tech Stack:** Next.js 16.2.6, React 19, TypeScript, Node.js 24 LTS, Turso/libSQL, Nginx, systemd, Alibaba Cloud Linux 3, AliDNS, Vercel.

## Global Constraints

- Work in `C:\Users\周星星星\.local\bin\snack-review-site` and preserve unrelated untracked files and directories.
- Read the repository `AGENTS.md` and the relevant bundled Next.js 16 documentation before editing application code.
- Never print or commit secrets, `.env.local`, certificate private keys, cookies, database tokens, or Vercel tokens.
- Never ask the user to paste a secret into chat. Transfer the selected environment file directly over the encrypted SSH connection.
- Use the same `SESSION_SECRET` and Turso credentials on Vercel and ECS.
- Do not configure any Cron on ECS. `vercel.json` remains the sole scheduled news runner.
- Do not change public DNS until ECS passes local, direct-origin HTTPS, feature, and rollback checks.
- Do not hardcode a remembered Vercel DNS target. Read the target shown in Vercel Domain settings immediately before the DNS change.
- Bind Next.js only to `127.0.0.1:3000`; security-group port 3000 stays closed.
- Keep the existing Vercel deployment live throughout rollout.
- Use exact-file `git add` commands so `.vercel-backup-20260817-185640/`, `docs/superpowers/plans/` files unrelated to this plan, and `fix-cache.bat` are not accidentally committed.

---

### Task 1: Display the ICP filing in the shared footer

**Files:**
- Create: `src/components/Footer.icp.test.ts`
- Modify: `src/components/Footer.tsx`

- [ ] **Step 1: Add a failing footer rendering test**

Create `src/components/Footer.icp.test.ts`:

```tsx
import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import Footer from './Footer';

test('footer links the approved ICP filing to MIIT', () => {
    const html = renderToStaticMarkup(<Footer />);

    assert.match(html, /粤ICP备2026121558号-1/);
    assert.match(html, /href="https:\/\/beian\.miit\.gov\.cn\/"/);
    assert.match(html, /target="_blank"/);
    assert.match(html, /rel="noopener noreferrer"/);
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run:

```powershell
npx --yes tsx@4.23.12 --test src/components/Footer.icp.test.ts
```

Expected: failure because the current footer does not contain the ICP number or MIIT link.

- [ ] **Step 3: Add the filing link to the footer**

Add this paragraph after the copyright paragraph in `src/components/Footer.tsx`:

```tsx
<p className="mt-1">
    <a
        href="https://beian.miit.gov.cn/"
        target="_blank"
        rel="noopener noreferrer"
        className="transition-colors hover:text-gray-600"
    >
        粤ICP备2026121558号-1
    </a>
</p>
```

Do not add a public-security filing number or icon until the user receives the final number.

- [ ] **Step 4: Re-run the footer test**

Run:

```powershell
npx --yes tsx@4.23.12 --test src/components/Footer.icp.test.ts
```

Expected: 1 test passes.

- [ ] **Step 5: Commit only the footer change**

Run:

```powershell
git add src/components/Footer.tsx src/components/Footer.icp.test.ts
git commit -m "feat: display ICP filing in footer"
```

---

### Task 2: Add a database-aware, secret-safe health endpoint

**Files:**
- Create: `src/lib/health.ts`
- Create: `src/lib/health.test.ts`
- Create: `src/app/api/health/route.ts`

- [ ] **Step 1: Add failing unit tests for health evaluation**

Create `src/lib/health.test.ts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateHealth } from './health';

test('returns ok with the deployed git SHA after a successful database probe', async () => {
    let probes = 0;
    const result = await evaluateHealth({
        gitSha: 'abc1234',
        checkDatabase: async () => { probes += 1; },
    });

    assert.equal(probes, 1);
    assert.deepEqual(result, {
        statusCode: 200,
        body: { status: 'ok', gitSha: 'abc1234' },
    });
});

test('uses unknown when APP_GIT_SHA is absent', async () => {
    const result = await evaluateHealth({
        checkDatabase: async () => undefined,
    });

    assert.equal(result.body.gitSha, 'unknown');
});

test('returns a fixed degraded response without leaking database errors', async () => {
    const secretError = 'libsql://secret-host?authToken=must-not-leak';
    const result = await evaluateHealth({
        gitSha: 'abc1234',
        checkDatabase: async () => { throw new Error(secretError); },
    });

    assert.deepEqual(result, {
        statusCode: 503,
        body: { status: 'degraded', gitSha: 'abc1234' },
    });
    assert.doesNotMatch(JSON.stringify(result), /must-not-leak/);
});
```

- [ ] **Step 2: Run the test and confirm the missing module failure**

Run:

```powershell
npx --yes tsx@4.23.12 --test src/lib/health.test.ts
```

Expected: failure because `src/lib/health.ts` does not exist.

- [ ] **Step 3: Implement the pure health evaluator**

Create `src/lib/health.ts`:

```ts
export type HealthBody = {
    status: 'ok' | 'degraded';
    gitSha: string;
};

export type HealthResult = {
    statusCode: 200 | 503;
    body: HealthBody;
};

export async function evaluateHealth({
    gitSha,
    checkDatabase,
}: {
    gitSha?: string;
    checkDatabase: () => Promise<void>;
}): Promise<HealthResult> {
    const normalizedGitSha = gitSha?.trim() || 'unknown';

    try {
        await checkDatabase();
        return {
            statusCode: 200,
            body: { status: 'ok', gitSha: normalizedGitSha },
        };
    } catch {
        return {
            statusCode: 503,
            body: { status: 'degraded', gitSha: normalizedGitSha },
        };
    }
}
```

- [ ] **Step 4: Run the evaluator tests**

Run:

```powershell
npx --yes tsx@4.23.12 --test src/lib/health.test.ts
```

Expected: 3 tests pass.

- [ ] **Step 5: Add the dynamic route handler**

Create `src/app/api/health/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { evaluateHealth } from '@/lib/health';

export const dynamic = 'force-dynamic';

export async function GET() {
    const result = await evaluateHealth({
        gitSha: process.env.APP_GIT_SHA || process.env.VERCEL_GIT_COMMIT_SHA,
        checkDatabase: async () => {
            const db = await getDb();
            await db.execute('SELECT 1');
        },
    });

    return NextResponse.json(result.body, {
        status: result.statusCode,
        headers: { 'Cache-Control': 'no-store' },
    });
}
```

The route returns only status and commit identity. It must not return database URLs, tokens, user details, exceptions, or stack traces.

- [ ] **Step 6: Run focused checks and build**

Run:

```powershell
npx --yes tsx@4.23.12 --test src/lib/health.test.ts
npm run lint
npm run build
```

Expected: all three commands exit 0 and the route appears in the Next.js build output.

- [ ] **Step 7: Commit the health endpoint**

Run:

```powershell
git add src/lib/health.ts src/lib/health.test.ts src/app/api/health/route.ts
git commit -m "feat: add database-aware health endpoint"
```

---

### Task 3: Specify and test ECS deployment assets before implementation

**Files:**
- Create: `deploy/ecs/deployment-assets.test.ts`

- [ ] **Step 1: Add contract tests for the deployment assets**

Create `deploy/ecs/deployment-assets.test.ts`:

```ts
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
    assert.match(nginx, /proxy_pass http:\/\/127\.0\.0\.1:3000;/);
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
        'APP_GIT_SHA=',
    ];
    for (const name of required) assert.match(envExample, new RegExp(`^${name}$`, 'm'));
    assert.doesNotMatch(envExample, /VERCEL_OIDC_TOKEN|BLOB_READ_WRITE_TOKEN/);
});
```

- [ ] **Step 2: Run the test and confirm it fails on missing assets**

Run:

```powershell
npx --yes tsx@4.23.12 --test deploy/ecs/deployment-assets.test.ts
```

Expected: failures because the Nginx, systemd, bootstrap, deploy, and environment-example files do not exist yet.

- [ ] **Step 3: Commit only the failing contract test**

Run:

```powershell
git add deploy/ecs/deployment-assets.test.ts
git commit -m "test: define ECS deployment contracts"
```

---

### Task 4: Implement reproducible Alibaba Cloud Linux deployment assets

**Files:**
- Create: `deploy/ecs/systemd/linglingqi.service`
- Create: `deploy/ecs/nginx/linglingqi.conf`
- Create: `deploy/ecs/linglingqi.env.example`
- Create: `deploy/ecs/bootstrap-alibaba-linux.sh`
- Create: `deploy/ecs/deploy.sh`
- Create: `deploy/ecs/install-certificate.sh`
- Create: `deploy/ecs/README.md`
- Modify: `package.json`

- [ ] **Step 1: Add the systemd service**

Create `deploy/ecs/systemd/linglingqi.service`:

```ini
[Unit]
Description=linglingqi.fun Next.js service
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=linglingqi
Group=linglingqi
WorkingDirectory=/opt/linglingqi/current
Environment=NODE_ENV=production
EnvironmentFile=/etc/linglingqi/linglingqi.env
ExecStart=/usr/bin/npm run start -- --hostname 127.0.0.1 --port 3000
Restart=always
RestartSec=5
TimeoutStopSec=30
KillSignal=SIGTERM
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full
ProtectHome=true
ReadWritePaths=/opt/linglingqi

[Install]
WantedBy=multi-user.target
```

- [ ] **Step 2: Add the Nginx origin configuration**

Create `deploy/ecs/nginx/linglingqi.conf` with:

```nginx
limit_req_zone $binary_remote_addr zone=linglingqi_general:10m rate=20r/s;

server {
    listen 80;
    listen [::]:80;
    server_name linglingqi.fun www.linglingqi.fun;
    return 301 https://linglingqi.fun$request_uri;
}

server {
    listen 443 ssl;
    listen [::]:443 ssl;
    http2 on;
    server_name www.linglingqi.fun;

    ssl_certificate /etc/nginx/ssl/linglingqi/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/linglingqi/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    return 301 https://linglingqi.fun$request_uri;
}

server {
    listen 443 ssl;
    listen [::]:443 ssl;
    http2 on;
    server_name linglingqi.fun;

    ssl_certificate /etc/nginx/ssl/linglingqi/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/linglingqi/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    client_max_body_size 110m;
    limit_req zone=linglingqi_general burst=40 nodelay;

    add_header X-Content-Type-Options nosniff always;
    add_header Referrer-Policy strict-origin-when-cross-origin always;
    add_header X-Frame-Options SAMEORIGIN always;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection "";
        proxy_connect_timeout 10s;
        proxy_send_timeout 90s;
        proxy_read_timeout 90s;
    }
}
```

The 110MB request limit covers the existing application maximum of 10 files × 10MB plus multipart overhead. The 90-second proxy timeout exceeds the current longest 60-second AI request timeout.

- [ ] **Step 3: Add a value-free environment template**

Create `deploy/ecs/linglingqi.env.example`:

```dotenv
TURSO_DATABASE_URL=
TURSO_AUTH_TOKEN=
SESSION_SECRET=
ANTHROPIC_AUTH_TOKEN=
ANTHROPIC_BASE_URL=
ANTHROPIC_MODEL=
ADMIN_PASSWORD_HASH=
CRON_SECRET=
APP_GIT_SHA=
```

`ADMIN_PASSWORD_HASH` and `CRON_SECRET` are optional. Do not copy `VERCEL_OIDC_TOKEN`, `BLOB_*`, `VERCEL_*`, Turbo/Nx variables, or any Vercel deployment metadata to ECS.

- [ ] **Step 4: Add the idempotent Alibaba Cloud Linux bootstrap script**

Create `deploy/ecs/bootstrap-alibaba-linux.sh` with `set -Eeuo pipefail` and these exact behaviors:

1. Abort unless `id -u` is `0`.
2. Install `curl`, `git`, `nginx`, `tar`, and `gzip` with `dnf install -y`.
3. Download the NodeSource Node 24 setup script over HTTPS to a temporary file, execute it, remove it, then install `nodejs`.
4. Abort unless `node --version` matches `^v24\.`.
5. Create the locked service user with `useradd --system --create-home --home-dir /var/lib/linglingqi --shell /sbin/nologin linglingqi` when absent.
6. Create `/opt/linglingqi/releases`, `/etc/linglingqi`, and `/etc/nginx/ssl/linglingqi` with least-privilege ownership and modes.
7. Create and activate a 2GiB `/swapfile` only when it is absent; add exactly one `/swapfile swap swap defaults 0 0` line to `/etc/fstab`.
8. Install the checked-in systemd unit to `/etc/systemd/system/linglingqi.service` and Nginx config to `/etc/nginx/conf.d/linglingqi.conf`.
9. Run `systemctl daemon-reload` and `systemctl enable nginx linglingqi.service`; do not start the app before environment and certificate files exist.

Use a cleanup trap for the downloaded NodeSource script. Do not use shell tracing (`set -x`) because later deployment operations involve secret paths.

- [ ] **Step 5: Add the atomic release/rollback script**

Create `deploy/ecs/deploy.sh` with `set -Eeuo pipefail`. It must:

1. Require root and accept exactly one full or abbreviated Git SHA argument.
2. Validate the argument with `^[0-9a-fA-F]{7,40}$`.
3. Clone `https://github.com/DuoBaAnNe/snack-review-site.git` as a bare repository at `/opt/linglingqi/repository.git` when absent; otherwise fetch `origin main`.
4. Resolve the argument to a full commit reachable from `origin/main`; abort if it is not an ancestor of `origin/main`.
5. Record the current symlink target as `previous_target` without deleting it.
6. Check out the commit into `/opt/linglingqi/releases/${release_sha}` without overwriting another release.
7. Chown the release to `linglingqi:linglingqi`.
8. As `linglingqi`, run `npm ci`, `npm run test:pagination`, `npm run test:deployment`, and `npm run build` inside the release.
9. Update only the `APP_GIT_SHA=` line in `/etc/linglingqi/linglingqi.env`, preserving all secret lines and file mode `0600`.
10. Create `/opt/linglingqi/current.next` pointing to the release and atomically replace `/opt/linglingqi/current` with `mv -Tf`.
11. Restart `linglingqi.service` and poll `http://127.0.0.1:3000/api/health` for up to 60 seconds.
12. Require the health JSON to contain both `"status":"ok"` and the exact `release_sha`.
13. On failure, restore `previous_target`, restore its SHA in the environment file, restart the service, verify its local health endpoint, and exit non-zero.
14. Never print the environment file or run with `set -x`.

Use Node.js—not grep—to parse the health JSON so formatting cannot create false positives.

- [ ] **Step 6: Add the certificate installation script**

Create `deploy/ecs/install-certificate.sh`. It must:

1. Require root and exactly two readable file arguments: full certificate chain first, private key second.
2. Install them as `/etc/nginx/ssl/linglingqi/fullchain.pem` mode `0644` and `/etc/nginx/ssl/linglingqi/privkey.pem` mode `0600`, owned by root.
3. Run `nginx -t` before reloading.
4. Reload Nginx only after validation succeeds.
5. Never print either file’s contents.

- [ ] **Step 7: Add the operator runbook**

Create `deploy/ecs/README.md` documenting, in order:

- confirmed host facts: Alibaba Cloud Linux 3, Shenzhen, public IP `120.79.2.186`;
- required security group: public 80/443, restricted 22, no public 3000;
- SSH public-key authentication and prohibition on sharing the private key;
- bootstrap invocation from the repository root;
- the exact environment allowlist from Step 3 and secure SCP/install workflow;
- certificate upload/install commands;
- deployment command using the chosen Git SHA;
- `curl` health checks and `curl --resolve` pre-DNS checks;
- AliDNS record matrix from the confirmed design;
- manual rollback to the Vercel-recommended target;
- log commands: `journalctl -u linglingqi.service`, `systemctl status`, and Nginx access/error logs;
- monthly system updates and TLS-expiry checks;
- an explicit warning that ECS must not run the Vercel Cron paths on a schedule.

- [ ] **Step 8: Add the deployment test script**

Add this entry to `package.json` scripts without changing `test:pagination`:

```json
"test:deployment": "npx --yes tsx@4.23.12 --test src/components/Footer.icp.test.ts src/lib/health.test.ts deploy/ecs/deployment-assets.test.ts"
```

- [ ] **Step 9: Run contract and shell syntax tests**

Run from Git Bash or WSL for shell syntax, and PowerShell for the TypeScript test:

```powershell
npx --yes tsx@4.23.12 --test deploy/ecs/deployment-assets.test.ts
bash -n deploy/ecs/bootstrap-alibaba-linux.sh
bash -n deploy/ecs/deploy.sh
bash -n deploy/ecs/install-certificate.sh
```

Expected: all commands exit 0.

- [ ] **Step 10: Run the full local verification set**

Run:

```powershell
npm run test:pagination
npm run test:deployment
npm run lint
npm run build
```

Expected: every command exits 0.

- [ ] **Step 11: Commit only the deployment assets**

Run:

```powershell
git add deploy/ecs/systemd/linglingqi.service deploy/ecs/nginx/linglingqi.conf deploy/ecs/linglingqi.env.example deploy/ecs/bootstrap-alibaba-linux.sh deploy/ecs/deploy.sh deploy/ecs/install-certificate.sh deploy/ecs/README.md package.json
git commit -m "ops: add Alibaba ECS deployment assets"
```

---

### Task 5: Review, push, and verify the common release commit

**Files:**
- Verify only; no expected file changes

- [ ] **Step 1: Review the exact change set and check for secrets**

Run:

```powershell
git status --short --branch
git diff origin/main...HEAD --stat
git diff origin/main...HEAD -- src package.json deploy/ecs docs/superpowers/specs docs/superpowers/plans/2026-08-24-china-global-split-deployment.md
rg -n "(eyJ|Bearer |authToken=|TURSO_AUTH_TOKEN=.+|SESSION_SECRET=.+|ANTHROPIC_AUTH_TOKEN=.+|BEGIN .*PRIVATE KEY)" src deploy docs package.json
```

Expected: only intended files changed; the secret scan finds no populated credential or private key. Treat value-free example names as safe.

- [ ] **Step 2: Run fresh verification from the current commit**

Run:

```powershell
npm ci
npm run test:pagination
npm run test:deployment
npm run lint
npm run build
```

Expected: all commands exit 0 after a clean lockfile install.

- [ ] **Step 3: Push main only after reviewing the commits**

Run:

```powershell
git log --oneline origin/main..HEAD
git push origin main
```

Record the release SHA without abbreviating it:

```powershell
git rev-parse HEAD
```

- [ ] **Step 4: Verify Vercel deployed that exact SHA**

Wait for the Vercel production deployment to complete. Then check:

```powershell
curl.exe --fail --silent --show-error https://linglingqi.fun/api/health
```

Expected: HTTP 200, `status` is `ok`, and `gitSha` equals the recorded release SHA. The route uses ECS `APP_GIT_SHA` first and Vercel's automatically supplied `VERCEL_GIT_COMMIT_SHA` second, so no deployment-specific SHA needs to be maintained manually in Vercel.

Do not proceed to ECS rollout if Vercel and the intended release SHA differ.

---

### Task 6: Lock down and bootstrap the Shenzhen ECS

**Files:**
- Remote configuration only

- [ ] **Step 1: Establish key-based SSH access**

Check for an existing dedicated key on the local machine. If none exists, create an Ed25519 key dedicated to this ECS and add only its `.pub` content through the Alibaba Cloud console. Never send or upload the private key except to the local SSH client.

Verify login before disabling password/root SSH:

```powershell
ssh -i $env:USERPROFILE\.ssh\linglingqi_ecs admin@120.79.2.186
```

Use the actual non-root administrator account configured on the instance. Confirm `sudo -v` succeeds.

- [ ] **Step 2: Configure the Alibaba Cloud security group**

Before saving rules, record a screenshot/export of the current rules. Configure:

- TCP 80 from `0.0.0.0/0` and `::/0`;
- TCP 443 from `0.0.0.0/0` and `::/0`;
- TCP 22 only from the current administrator public IP;
- no inbound TCP 3000 rule.

Verify SSH still works in a second terminal before closing the first session.

- [ ] **Step 3: Harden SSH without locking out administration**

Create a drop-in under `/etc/ssh/sshd_config.d/` that sets:

```text
PasswordAuthentication no
PermitRootLogin no
PubkeyAuthentication yes
```

Run `sshd -t`, reload sshd, and verify a new key-based session before ending the existing session. If the new session fails, revert the drop-in from the still-open session.

- [ ] **Step 4: Transfer the checked-in deployment directory and run bootstrap**

From the local repository, transfer only `deploy/ecs` to the administrator’s home directory, then on ECS run:

```bash
sudo bash ~/ecs/bootstrap-alibaba-linux.sh
node --version
free -h
swapon --show
systemctl is-enabled nginx
```

Expected: Node reports `v24.x`, approximately 2GiB swap is active, and Nginx is enabled.

- [ ] **Step 5: Verify exposure and service ownership**

Run on ECS:

```bash
id linglingqi
sudo ss -lntp
sudo stat -c '%U:%G %a %n' /etc/linglingqi /opt/linglingqi
```

Expected: the service user exists; nothing listens publicly on port 3000; application directories have the ownership defined by the bootstrap script.

---

### Task 7: Transfer production configuration and deploy the release

**Files:**
- Local secret source: `.env.local` (read only; never commit)
- Remote secret target: `/etc/linglingqi/linglingqi.env`

- [ ] **Step 1: Build a minimal environment file locally without printing values**

In PowerShell, parse `.env.local` and copy only these existing keys into a newly created temporary file:

```text
TURSO_DATABASE_URL
TURSO_AUTH_TOKEN
SESSION_SECRET
ANTHROPIC_AUTH_TOKEN
ANTHROPIC_BASE_URL
ANTHROPIC_MODEL
ADMIN_PASSWORD_HASH
CRON_SECRET
```

Require non-empty values for the first six names. `ADMIN_PASSWORD_HASH` and `CRON_SECRET` may be absent. Add `APP_GIT_SHA=` with no value; the deploy script fills it. Do not display the resulting file.

If any required key is missing, retrieve it from the Vercel Production environment through authenticated tooling or the Vercel dashboard; never place it in chat or shell history.

- [ ] **Step 2: Transfer and install the environment file securely**

Use `scp` over the verified SSH key to transfer the temporary file to the administrator’s home directory. On ECS, install it with:

```bash
sudo install -o linglingqi -g linglingqi -m 0600 ~/linglingqi.env /etc/linglingqi/linglingqi.env
rm -f ~/linglingqi.env
sudo stat -c '%U:%G %a %n' /etc/linglingqi/linglingqi.env
```

Expected: `linglingqi:linglingqi 600`. Delete the local temporary file immediately after a successful transfer. Do not run `cat` on either copy.

- [ ] **Step 3: Deploy the exact SHA verified on Vercel**

Run on ECS, substituting the already-recorded full SHA as the single script argument:

```bash
sudo bash ~/ecs/deploy.sh "$release_sha"
```

Here `release_sha` must be assigned from the previously recorded `git rev-parse HEAD` result in that shell; do not use `latest` or an unverified branch tip.

- [ ] **Step 4: Verify local process and database health**

Run on ECS:

```bash
systemctl status linglingqi.service --no-pager
curl --fail --silent --show-error http://127.0.0.1:3000/api/health
ss -lntp | grep 3000
```

Expected: service is active; health is `ok` with the exact SHA; port 3000 listens only on `127.0.0.1`.

- [ ] **Step 5: Prove deployment rollback before DNS cutover**

Run the deploy script with an intentionally invalid-but-well-formed SHA such as forty `f` characters. Expected: it aborts before changing `current`. Then verify the service remains healthy and `readlink -f /opt/linglingqi/current` is unchanged.

Do not simulate a failure by deleting releases, the environment file, certificates, or the active symlink.

---

### Task 8: Install ECS TLS and test the origin without changing DNS

**Files:**
- Remote certificate files only; never commit the private key

- [ ] **Step 1: Issue/download the Alibaba Cloud certificate**

Obtain a valid certificate covering both `linglingqi.fun` and `www.linglingqi.fun`. Use DNS validation records without altering the existing public traffic records. Download the Nginx-format full chain and private key through the Alibaba Cloud certificate console.

- [ ] **Step 2: Transfer and install the certificate**

Transfer the full-chain and private-key files over SCP to the administrator’s home directory, run `install-certificate.sh` with those two paths, then securely delete the home-directory copies. Keep any local private-key copy outside the repository and in a protected location.

- [ ] **Step 3: Validate HTTPS directly against ECS**

From the local machine, bypass public DNS while keeping the real Host/SNI:

```powershell
curl.exe --fail --silent --show-error --resolve linglingqi.fun:443:120.79.2.186 https://linglingqi.fun/api/health
curl.exe --fail --silent --show-error --resolve www.linglingqi.fun:443:120.79.2.186 https://www.linglingqi.fun/
```

Expected: the apex health endpoint returns `ok` and the exact release SHA; `www` redirects to the apex over HTTPS without certificate warnings.

- [ ] **Step 4: Run the complete pre-DNS feature checklist against ECS**

Use a temporary local hosts override or browser network mapping so `linglingqi.fun` resolves to `120.79.2.186` only on the test machine. Verify:

- homepage loads with snacks and the China map;
- food news expands and the nearby collapse control remains available while scrolling;
- snack cards paginate after the configured first page;
- snack and news images load;
- admin and regular-user login work;
- registration, comments, and ratings work;
- image upload accepts expected image types and rejects oversized files;
- admin create/edit/delete flow works using disposable test data;
- `/api/health` returns no credentials or user data;
- footer shows `粤ICP备2026121558号-1` and opens the MIIT site;
- no ECS scheduler invokes `/api/cron/news` or `/api/cron/enrich`.

Remove the local hosts override immediately after testing. Confirm normal DNS still reaches Vercel.

- [ ] **Step 5: Compare both origins before cutover**

Compare the Vercel public health response and ECS `--resolve` health response. Both must report the same full SHA and `status: ok`. Compare representative snack, news, comment, and image records to confirm both origins see the same Turso data.

Stop here and repair any mismatch before touching AliDNS.

---

### Task 9: Configure AliDNS intelligent routing with a reversible cutover

**Files:**
- DNS provider configuration only

- [ ] **Step 1: Snapshot the current DNS and Vercel domain targets**

Export or screenshot all current AliDNS records for `@` and `www`, including type, line, value, TTL, and status. In Vercel Project → Domains, record the currently recommended DNS target for both hostnames. Confirm the existing Vercel site and certificate are healthy.

- [ ] **Step 2: Create and verify the origin-only record**

Create:

| Host | Type | Line | Value |
|---|---|---|---|
| `cn-origin` | A | Default | `120.79.2.186` |

Use the shortest TTL currently allowed by the AliDNS plan for rollout. Verify `cn-origin.linglingqi.fun` resolves to `120.79.2.186`. This record alone does not move public apex/`www` traffic.

- [ ] **Step 3: Reconfirm the rollback value and ECS readiness at action time**

Immediately before modifying `@` or `www`, verify:

- ECS `curl --resolve` health is `ok`;
- Vercel public health is `ok`;
- both SHA values match;
- the Vercel-recommended DNS target recorded in Step 1 is still current;
- the current AliDNS record export is saved.

If any check fails, do not perform the cutover.

- [ ] **Step 4: Add China-mainland and overseas/default lines**

Configure this matrix using the Vercel target observed in Step 1:

| Host | Type | Line | Value |
|---|---|---|---|
| `@` | CNAME | China mainland | `cn-origin.linglingqi.fun` |
| `@` | Vercel-required type | Overseas | current Vercel-recommended target |
| `@` | Vercel-required type | Default | current Vercel-recommended target |
| `www` | CNAME | China mainland | `cn-origin.linglingqi.fun` |
| `www` | Vercel-required type | Overseas | current Vercel-recommended target |
| `www` | Vercel-required type | Default | current Vercel-recommended target |

Where AliDNS rejects a CNAME at the apex because of an existing incompatible record, use the AliDNS-supported record type/value that Vercel shows for the apex while preserving the China-mainland versus overseas/default line split. Do not delete the last working Vercel default path until its replacement is active.

- [ ] **Step 5: Verify geographic answers and HTTPS**

Use AliDNS diagnostic tools or independent China-mainland and overseas DNS probes:

- China-mainland answer must lead to `120.79.2.186` through `cn-origin`;
- overseas/default answer must lead to the Vercel target;
- both `https://linglingqi.fun` and `https://www.linglingqi.fun` must present valid certificates;
- both origins must report the same health SHA.

Account for recursive DNS caching; do not diagnose expected TTL delay as application failure.

- [ ] **Step 6: Observe the rollout before increasing TTL**

For the initial observation window, watch:

```bash
sudo journalctl -u linglingqi.service --since "15 minutes ago" --no-pager
sudo tail -n 200 /var/log/nginx/error.log
sudo systemctl show linglingqi.service -p NRestarts
free -h
df -h /
```

Also check homepage/health response time, Nginx 5xx, Turso errors, bandwidth, certificate expiry, login, uploads, news, and map behavior. After stability is confirmed, set the routing records to approximately 600-second TTL.

- [ ] **Step 7: Perform a controlled DNS rollback drill**

During a low-traffic window:

1. Change only the China-mainland `@` and `www` records to the recorded Vercel-recommended target.
2. Verify China-mainland probes return Vercel after TTL/cache expiry.
3. Confirm the public site and shared data remain available.
4. Restore the China-mainland records to `cn-origin.linglingqi.fun`.
5. Verify ECS health and geographic routing again.
6. Record timestamps, observed propagation time, exact record values, and the result in `deploy/ecs/README.md` under a dated rollback-drill log.

Because both origins share Turso, the drill must not copy, restore, or merge application data.

- [ ] **Step 8: Commit the rollback-drill record if the runbook changed**

If the dated drill result was added to the runbook, run:

```powershell
git add deploy/ecs/README.md
git commit -m "docs: record ECS DNS rollback drill"
git push origin main
```

Then deploy that new documentation-only SHA to ECS as well, so `/api/health` again reports the same commit on Vercel and ECS.

---

### Task 10: Final acceptance and handoff

**Files:**
- Verify only; update `deploy/ecs/README.md` only if observed operational facts differ

- [ ] **Step 1: Run the acceptance matrix**

Confirm all of the following with dated evidence:

- China-mainland DNS route reaches Shenzhen ECS;
- overseas/default DNS route reaches Vercel;
- apex and `www` HTTPS are valid on both origins;
- `/api/health` is `ok` on both origins and reports the same SHA;
- snacks, images, map, news, comments, login, registration, upload, and admin flows work;
- news collapse control and snack pagination have no regression;
- a write made through one origin appears through the other within the known cache window;
- only Vercel runs daily news Cron;
- ICP filing link is visible;
- port 3000 is not public;
- DNS rollback procedure was successfully exercised;
- public-security filing is still omitted until the final number is issued.

- [ ] **Step 2: Record operational ownership**

In `deploy/ecs/README.md`, ensure the ongoing checklist contains:

- monthly Alibaba Cloud Linux, Node.js, and Nginx security update review;
- disk, memory, swap, service restart, Nginx 5xx, and Turso failure checks;
- TLS-expiry reminder early enough to renew before expiry;
- deployment procedure requiring a verified Git SHA;
- the exact AliDNS rollback path to Vercel;
- the future action to add the公安备案 icon/number/link after approval.

- [ ] **Step 3: Run final repository verification**

Run:

```powershell
npm run test:pagination
npm run test:deployment
npm run lint
npm run build
git status --short --branch
```

Expected: all checks exit 0. Any remaining untracked pre-existing user files stay unmodified and uncommitted.
