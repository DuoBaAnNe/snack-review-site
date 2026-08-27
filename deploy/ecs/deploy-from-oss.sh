#!/usr/bin/env bash
set -Eeuo pipefail

if [[ "$(id -u)" != "0" ]]; then
    echo "This deployment script must run as root." >&2
    exit 1
fi
if [[ "$#" -ne 0 ]]; then
    echo "Usage: $0" >&2
    exit 1
fi

config_file="/etc/linglingqi/alibaba-deployment.json"
deployment_script="/usr/local/libexec/linglingqi/deploy.sh"
download_dir=""

cleanup() {
    if [[ -n "${download_dir}" && ! -L "${download_dir}" && \
        "${download_dir}" == /run/linglingqi-release.* ]]; then
        rm -rf -- "${download_dir}"
    fi
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

if [[ -L "${config_file}" || ! -f "${config_file}" ]]; then
    echo "Install a regular OSS deployment configuration file first." >&2
    exit 1
fi
if [[ "$(stat -c '%u:%a' "${config_file}")" != "0:600" ]]; then
    echo "The OSS deployment configuration file must be root-owned with mode 0600." >&2
    exit 1
fi
if [[ ! -x "${deployment_script}" || -L "${deployment_script}" ]]; then
    echo "The deployment script is not an expected executable file." >&2
    exit 1
fi

validated_config="$(node - "${config_file}" <<'NODE'
const fs = require('node:fs');

const configPath = process.argv[2];
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const expectedKeys = ['bucket', 'ecsRoleName', 'endpoint', 'prefix', 'region'];
if (!config || typeof config !== 'object' || Array.isArray(config) ||
    JSON.stringify(Object.keys(config).sort()) !== JSON.stringify(expectedKeys)) {
    throw new Error('OSS deployment configuration has unexpected fields');
}
if (config.region !== 'cn-shenzhen' ||
    config.endpoint !== 'https://oss-cn-shenzhen-internal.aliyuncs.com' ||
    config.prefix !== 'ecs-releases' ||
    typeof config.bucket !== 'string' ||
    typeof config.ecsRoleName !== 'string' ||
    !/^[a-z0-9][a-z0-9-]{2,61}[a-z0-9]$/.test(config.bucket) ||
    !/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(config.ecsRoleName)) {
    throw new Error('OSS deployment configuration is invalid');
}
process.stdout.write([config.region, config.bucket, config.endpoint, config.prefix, config.ecsRoleName].join('\n'));
NODE
)"
mapfile -t config_values <<< "${validated_config}"
if [[ "${#config_values[@]}" -ne 5 ]]; then
    echo "The OSS deployment configuration could not be read safely." >&2
    exit 1
fi
region="${config_values[0]}"
bucket="${config_values[1]}"
endpoint="${config_values[2]}"
prefix="${config_values[3]}"
ecs_role_name="${config_values[4]}"

download_dir="$(mktemp --directory /run/linglingqi-release.XXXXXXXX)"
chmod 0700 "${download_dir}"
request_manifest_path="${download_dir}/current.json"

ossutil cp "oss://${bucket}/ecs-releases/requests/current.json" \
    "${request_manifest_path}" --force \
    --mode EcsRamRole --ecs-role-name "${ecs_role_name}" \
    --region "${region}" --endpoint "${endpoint}" >/dev/null
chmod 0600 "${request_manifest_path}"

release_sha="$(node - "${request_manifest_path}" <<'NODE'
const fs = require('node:fs');

const request = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
if (!request || typeof request !== 'object' || Array.isArray(request) ||
    Object.keys(request).length !== 1 ||
    !Object.hasOwn(request, 'releaseSha') ||
    typeof request.releaseSha !== 'string' ||
    !/^[0-9a-f]{40}$/.test(request.releaseSha)) {
    throw new Error('Deployment request must contain exactly one valid releaseSha');
}
process.stdout.write(request.releaseSha);
NODE
)"
if [[ ! "${release_sha}" =~ ^[0-9a-f]{40}$ ]]; then
    echo "The OSS deployment request contains an invalid release SHA." >&2
    exit 1
fi

bundle_path="${download_dir}/source.bundle"
checksum_path="${download_dir}/source.bundle.sha256"
ossutil cp "oss://${bucket}/ecs-releases/${release_sha}/source.bundle" \
    "${bundle_path}" --force \
    --mode EcsRamRole --ecs-role-name "${ecs_role_name}" \
    --region "${region}" --endpoint "${endpoint}" >/dev/null
ossutil cp "oss://${bucket}/ecs-releases/${release_sha}/source.bundle.sha256" \
    "${checksum_path}" --force \
    --mode EcsRamRole --ecs-role-name "${ecs_role_name}" \
    --region "${region}" --endpoint "${endpoint}" >/dev/null
chmod 0600 "${bundle_path}" "${checksum_path}"

"/usr/local/libexec/linglingqi/deploy.sh" --bundle "${release_sha}" "${bundle_path}" "${checksum_path}"
