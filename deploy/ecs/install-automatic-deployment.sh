#!/usr/bin/env bash
set -Eeuo pipefail

if [[ "$(id -u)" != "0" ]]; then
    echo "This automatic deployment installer must run as root." >&2
    exit 1
fi

if [[ "$#" -ne 1 ]]; then
    echo "Usage: $0 <alibaba-deployment.json>" >&2
    exit 1
fi

config_source="$1"
script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

if [[ ! -f "${config_source}" || -L "${config_source}" ]]; then
    echo "Deployment configuration must be a non-symlink regular file." >&2
    exit 1
fi

node --input-type=module - "${config_source}" <<'NODE'
import { readFileSync } from 'node:fs';

const [configSource] = process.argv.slice(2);
let config;
try {
    config = JSON.parse(readFileSync(configSource, 'utf8'));
} catch (error) {
    console.error(`Invalid deployment JSON: ${error.message}`);
    process.exit(1);
}

const expectedKeys = ['bucket', 'ecsRoleName', 'endpoint', 'prefix', 'region'];
if (config === null || Array.isArray(config) || typeof config !== 'object'
    || JSON.stringify(Object.keys(config).sort()) !== JSON.stringify(expectedKeys)) {
    console.error('Deployment configuration has an unexpected schema.');
    process.exit(1);
}
if (config.region !== 'cn-shenzhen'
    || config.endpoint !== 'https://oss-cn-shenzhen-internal.aliyuncs.com'
    || config.prefix !== 'ecs-releases'
    || typeof config.bucket !== 'string'
    || !/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(config.bucket)
    || typeof config.ecsRoleName !== 'string'
    || !/^[A-Za-z0-9.-]{1,64}$/.test(config.ecsRoleName)) {
    console.error('Deployment configuration contains invalid values.');
    process.exit(1);
}
NODE

if ! ossutil_version="$(ossutil version 2>&1)"; then
    echo "ossutil 2.x is required. Install it using the official ossutil 2.x installation instructions before rerunning." >&2
    exit 1
fi
if [[ ! "${ossutil_version}" =~ ^ossutil[[:space:]]+version:?[[:space:]]+2\.[0-9]+(\.[0-9]+)?$ ]]; then
    echo "ossutil 2.x is required. Install it using the official ossutil 2.x installation instructions before rerunning." >&2
    exit 1
fi

if [[ ! -d /etc/linglingqi || -L /etc/linglingqi ]]; then
    echo "Expected /etc/linglingqi from bootstrap-alibaba-linux.sh." >&2
    exit 1
fi

install -d -o root -g root -m 0755 /usr/local/libexec/linglingqi
install -o root -g root -m 0755 \
    "${script_dir}/deploy.sh" \
    /usr/local/libexec/linglingqi/deploy.sh
install -o root -g root -m 0755 \
    "${script_dir}/deploy-from-oss.sh" \
    /usr/local/libexec/linglingqi/deploy-from-oss.sh
install -o root -g root -m 0600 \
    "${config_source}" \
    /etc/linglingqi/alibaba-deployment.json

echo "Automatic deployment entrypoints installed."
