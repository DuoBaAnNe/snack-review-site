# Alibaba Cloud Linux ECS runbook

## 1. Confirmed host

- Operating system: Alibaba Cloud Linux 3
- Region: Shenzhen
- Public IPv4 address: `120.79.2.186`

This directory prepares one self-hosted Next.js process behind Nginx. Run the
commands only after confirming that they target this host.

## 2. Security group

Allow public inbound TCP 80 and 443. Restrict TCP 22 to the administrator's
current fixed IP (or temporarily allow that IP only while administering the
host). Do not create any public inbound rule for TCP 3000; Next.js listens only
on `127.0.0.1:3000`.

## 3. SSH access

Use SSH public-key authentication. Disable password authentication and remote
root login only after proving a second key-authenticated session works. Never
share, upload, commit, or paste the SSH private key.

## 4. Bootstrap from the repository root

Transfer or clone the repository, enter its root, and run:

```bash
sudo bash deploy/ecs/bootstrap-alibaba-linux.sh
node --version
swapon --show
systemctl is-enabled nginx
```

Bootstrap installs Node.js 24 and Nginx, provisions the service account and 2
GiB swap, and enables services. It intentionally does not start the application
before its environment and certificate are installed.

## 5. Environment allowlist and secure installation

The ECS environment file may contain exactly these names:

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

The first six values are required. `ADMIN_PASSWORD_HASH` and `CRON_SECRET` are
optional; leave `APP_GIT_SHA` empty because `deploy.sh` manages it. Build the
file outside the repository without displaying it, transfer it over the
verified SSH connection, and install it on ECS:

```bash
# Run locally; replace the source path and administrator name.
scp /secure/local/path/linglingqi.env admin@120.79.2.186:~/linglingqi.env

# Run on ECS without printing the file.
sudo install -o linglingqi -g linglingqi -m 0600 \
  ~/linglingqi.env /etc/linglingqi/linglingqi.env
rm -f ~/linglingqi.env
sudo stat -c '%U:%G %a %n' /etc/linglingqi/linglingqi.env
```

Delete the local temporary copy after successful transfer. Never copy Vercel,
Blob, OIDC, Turbo, Nx, or deployment-metadata variables to ECS.

## 6. Install the TLS certificate

Obtain a certificate valid for `linglingqi.fun` and `www.linglingqi.fun`, then
transfer only the full chain and its private key over the verified SSH session:

```bash
# Run locally.
scp /secure/local/path/fullchain.pem /secure/local/path/privkey.pem \
  admin@120.79.2.186:~/

# Run on ECS from the repository root.
sudo bash deploy/ecs/install-certificate.sh ~/fullchain.pem ~/privkey.pem
rm -f ~/fullchain.pem ~/privkey.pem
```

The installer validates the complete Nginx configuration before reloading it.

## 7. Deploy a verified Git SHA

Choose the exact full commit already verified for the matching Vercel release.
Do not deploy a moving branch name or an unverified `latest` revision.

```bash
sudo bash deploy/ecs/deploy.sh '<verified-full-git-sha>'
```

The script accepts an abbreviated SHA but resolves it to the full commit,
requires it to be reachable from `origin/main`, tests and builds before the
atomic switch, and rolls back a failed activation when a prior release exists.

## 8. Health and pre-DNS checks

On ECS, verify the loopback service and exact deployed SHA:

```bash
curl --fail --silent --show-error http://127.0.0.1:3000/api/health
systemctl status linglingqi.service --no-pager
ss -lntp | grep 3000
```

Before changing public DNS, run these from a separate client. `--resolve` sends
the production Host/SNI name directly to the ECS without changing DNS:

```bash
curl --fail --silent --show-error \
  --resolve linglingqi.fun:443:120.79.2.186 \
  https://linglingqi.fun/api/health
curl --fail --silent --show-error --location \
  --resolve www.linglingqi.fun:443:120.79.2.186 \
  https://www.linglingqi.fun/api/health
```

Both responses must report `status` as `ok` and the chosen full Git SHA.

## 9. AliDNS record matrix

At cutover time, first read the current recommended values and record types in
the Vercel project's Domain settings. Never guess or hard-code that target.

| Host | Type | AliDNS line | Value |
| --- | --- | --- | --- |
| `cn-origin` | A | Default | `120.79.2.186` |
| `@` | CNAME | China mainland | `cn-origin.linglingqi.fun` |
| `@` | Vercel-required type | Overseas | current Vercel-recommended target |
| `@` | Vercel-required type | Default | current Vercel-recommended target |
| `www` | CNAME | China mainland | `cn-origin.linglingqi.fun` |
| `www` | Vercel-required type | Overseas | current Vercel-recommended target |
| `www` | Vercel-required type | Default | current Vercel-recommended target |

Use the shortest TTL permitted during rollout. After a stable observation
period, use approximately 600 seconds.

## 10. Manual DNS rollback to Vercel

Before cutover, export the current AliDNS records and record the then-current
Vercel-recommended target. If ECS health remains bad, change the China-mainland
records for both `@` and `www` back to that recorded Vercel-recommended target
using the record type Vercel currently requires. Keep the overseas/default
Vercel paths active, wait for the configured TTL and recursive caches, and
confirm public HTTPS and `/api/health` again. This is a manual operation; the
ECS scripts never mutate DNS.

## 11. Logs and service status

```bash
sudo journalctl -u linglingqi.service --since '15 minutes ago' --no-pager
sudo systemctl status linglingqi.service --no-pager
sudo tail -n 200 /var/log/nginx/access.log
sudo tail -n 200 /var/log/nginx/error.log
```

Do not copy tokens, complete cookies, uploaded Base64 data, or environment-file
contents into tickets, chat, or logs.

## 12. Monthly maintenance

At least monthly, install Alibaba Cloud Linux security updates in a controlled
maintenance window, review Node.js and Nginx security updates, confirm disk and
swap capacity, and inspect certificate expiry:

```bash
sudo dnf check-update
echo | openssl s_client -servername linglingqi.fun \
  -connect linglingqi.fun:443 2>/dev/null | openssl x509 -noout -dates
```

Renew and validate TLS before expiry, then repeat the `curl --resolve` checks.

## 13. No ECS Cron

**Do not configure Cron, a systemd timer, or any other ECS scheduler for the
Vercel Cron paths, including `/api/cron/news` and `/api/cron/enrich`.** Those
jobs remain scheduled only on Vercel so that shared Turso data is not processed
twice.
