#!/usr/bin/env bash
set -Eeuo pipefail

snapshot_offline_bundle() (
    local input_bundle_path="$1"
    local input_checksum_path="$2"
    local trusted_parent_dir="$3"
    local expected_owner_uid="$4"
    local bundle_snapshot_dir=""
    local bundle_snapshot_path=""
    local snapshot_checksum_path=""
    local bundle_verification_repository=""

    cleanup_snapshot() {
        if [[ -n "${bundle_snapshot_dir}" && ! -L "${bundle_snapshot_dir}" && \
            "${bundle_snapshot_dir}" == "${trusted_parent_dir}/bundle."* ]]; then
            rm -rf -- "${bundle_snapshot_dir}"
        fi
    }
    trap cleanup_snapshot EXIT

    if [[ "$(basename -- "${input_bundle_path}")" != "source.bundle" ]]; then
        echo "Offline deployment bundle must be named source.bundle." >&2
        exit 1
    fi
    bundle_snapshot_dir="$(mktemp -d "${trusted_parent_dir}/bundle.XXXXXX")"
    chmod 0700 "${bundle_snapshot_dir}"
    bundle_snapshot_path="${bundle_snapshot_dir}/source.bundle"
    snapshot_checksum_path="${bundle_snapshot_dir}/source.bundle.sha256"
    if ! node - "${input_bundle_path}" "${input_checksum_path}" \
        "${bundle_snapshot_path}" "${snapshot_checksum_path}" "${expected_owner_uid}" <<'NODE'
const fs = require('node:fs');
const [bundleInput, checksumInput, bundleSnapshot, checksumSnapshot, expectedOwner] = process.argv.slice(2);
const noFollow = fs.constants.O_NOFOLLOW;
if (typeof noFollow !== 'number') {
    throw new Error('Offline deployment requires O_NOFOLLOW support');
}

function copyOpenedRegularFile(input, output) {
    const inputFd = fs.openSync(input, fs.constants.O_RDONLY | noFollow);
    try {
        const inputStat = fs.fstatSync(inputFd);
        if (!inputStat.isFile() || inputStat.uid !== Number(expectedOwner) || (inputStat.mode & 0o22) !== 0) {
            throw new Error('Offline deployment assets must be regular, root-owned, and not group- or world-writable');
        }
        const outputFd = fs.openSync(output, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL, 0o600);
        try {
            const buffer = Buffer.allocUnsafe(64 * 1024);
            for (;;) {
                const bytesRead = fs.readSync(inputFd, buffer, 0, buffer.length, null);
                if (bytesRead === 0) break;
                let bytesWritten = 0;
                while (bytesWritten < bytesRead) {
                    bytesWritten += fs.writeSync(outputFd, buffer, bytesWritten, bytesRead - bytesWritten);
                }
            }
            fs.fchmodSync(outputFd, 0o600);
        } finally {
            fs.closeSync(outputFd);
        }
    } finally {
        fs.closeSync(inputFd);
    }
}

copyOpenedRegularFile(bundleInput, bundleSnapshot);
copyOpenedRegularFile(checksumInput, checksumSnapshot);
NODE
    then
        exit 1
    fi
    if [[ "$(wc -l < "${snapshot_checksum_path}")" -ne 1 ]] || \
        ! grep -qxE '[0-9a-f]{64}  source\.bundle' "${snapshot_checksum_path}"; then
        echo "Offline deployment checksum must contain one SHA-256 entry for source.bundle." >&2
        exit 1
    fi
    if ! (
        cd -- "${bundle_snapshot_dir}"
        sha256sum --check --status "${snapshot_checksum_path}"
    ); then
        exit 1
    fi
    bundle_verification_repository="${bundle_snapshot_dir}/verification.git"
    if ! git init --bare --quiet "${bundle_verification_repository}" || \
        ! git -C "${bundle_verification_repository}" bundle verify "${bundle_snapshot_path}" >&2; then
        exit 1
    fi
    trap - EXIT
    printf '%s\n' "${bundle_snapshot_dir}"
)

import_verified_offline_bundle() {
    local target_repository="$1"
    local verified_bundle_path="$2"
    local requested_sha="$3"
    local ecs_release_tag="$4"
    local release_sha=""
    local tag_sha=""

    git -C "${target_repository}" fetch --force "${verified_bundle_path}" \
        "+refs/tags/${ecs_release_tag}:refs/tags/${ecs_release_tag}"
    if ! release_sha="$(git -C "${target_repository}" rev-parse --verify "${requested_sha}^{commit}" 2>/dev/null)" || \
        ! tag_sha="$(git -C "${target_repository}" rev-parse --verify \
            "refs/tags/${ecs_release_tag}^{commit}" 2>/dev/null)" || \
        [[ "${release_sha}" != "${requested_sha}" || "${tag_sha}" != "${requested_sha}" ]]; then
        echo "Offline bundle does not authorize the requested commit with its ECS release tag." >&2
        return 1
    fi
    printf '%s\n' "${release_sha}"
}

if [[ "${LINGLINGQI_DEPLOY_LIBRARY_ONLY:-}" == "true" && "${BASH_SOURCE[0]}" != "$0" ]]; then
    return 0
fi

if [[ "$(id -u)" != "0" ]]; then
    echo "This deployment script must run as root." >&2
    exit 1
fi
source_mode="online"
bundle_path=""
checksum_path=""
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
if [[ "${source_mode}" == "online" && ! "${requested_sha}" =~ ^[0-9a-fA-F]{7,40}$ ]]; then
    echo "The Git SHA must contain 7 to 40 hexadecimal characters." >&2
    exit 1
fi
ecs_release_tag="ecs-release-${requested_sha}"

repository_url="https://github.com/DuoBaAnNe/snack-review-site.git"
repository_dir="/opt/linglingqi/repository.git"
releases_dir="/opt/linglingqi/releases"
current_link="/opt/linglingqi/current"
next_link="/opt/linglingqi/current.next"
rollback_link="/opt/linglingqi/current.rollback"
environment_file="/etc/linglingqi/linglingqi.env"
health_url="http://127.0.0.1:3000/api/health"
deployment_lock_dir="/run/lock/linglingqi"
deployment_lock_file="/run/lock/linglingqi/deploy.lock"
deployment_lock_fd=""
environment_temp=""
bundle_snapshot_dir=""
next_link_created=false
rollback_link_created=false

cleanup() {
    if [[ -n "${environment_temp}" && -e "${environment_temp}" ]]; then
        rm -f -- "${environment_temp}"
    fi
    if [[ "${next_link_created}" == "true" && -L "${next_link}" ]]; then
        rm -f -- "${next_link}"
    fi
    if [[ "${rollback_link_created}" == "true" && -L "${rollback_link}" ]]; then
        rm -f -- "${rollback_link}"
    fi
    if [[ -n "${bundle_snapshot_dir}" && ! -L "${bundle_snapshot_dir}" && \
        "${bundle_snapshot_dir}" == "${deployment_lock_dir}/bundle."* ]]; then
        rm -rf -- "${bundle_snapshot_dir}"
    fi
}
trap cleanup EXIT

if [[ -L "${deployment_lock_dir}" ]] || \
    [[ -e "${deployment_lock_dir}" && ! -d "${deployment_lock_dir}" ]]; then
    echo "Refusing to use an unexpected deployment lock directory." >&2
    exit 1
fi
install -d -o root -g root -m 0700 "${deployment_lock_dir}"
if [[ -L "${deployment_lock_file}" ]] || \
    [[ -e "${deployment_lock_file}" && ! -f "${deployment_lock_file}" ]]; then
    echo "Refusing to use an unexpected deployment lock file." >&2
    exit 1
fi
if [[ ! -e "${deployment_lock_file}" ]]; then
    touch "${deployment_lock_file}"
fi
chown root:root "${deployment_lock_file}"
chmod 0600 "${deployment_lock_file}"
exec {deployment_lock_fd}<>"${deployment_lock_file}"
if ! flock --exclusive --timeout 30 "${deployment_lock_fd}"; then
    echo "Another deployment still holds the lock after 30 seconds." >&2
    exit 1
fi

if [[ "${source_mode}" == "bundle" ]]; then
    bundle_snapshot_dir="$(snapshot_offline_bundle "${bundle_path}" "${checksum_path}" \
        "${deployment_lock_dir}" "0")"
    bundle_path="${bundle_snapshot_dir}/source.bundle"
fi

if [[ ! -f "${environment_file}" || -L "${environment_file}" ]]; then
    echo "Install a regular environment file at ${environment_file} first." >&2
    exit 1
fi
if [[ "$(stat -c '%a' "${environment_file}")" != "600" ]]; then
    echo "The environment file must have mode 0600." >&2
    exit 1
fi

read_app_git_sha() {
    node - "${environment_file}" <<'NODE'
const fs = require('node:fs');
const file = process.argv[2];
const content = fs.readFileSync(file, 'utf8');
const matches = [...content.matchAll(/^APP_GIT_SHA=([^\r\n]*)(?:\r)?$/gm)];
if (matches.length !== 1) {
    throw new Error('Environment file must contain exactly one APP_GIT_SHA assignment');
}
process.stdout.write(matches[0][1]);
NODE
}

update_app_git_sha() {
    local new_sha="$1"
    environment_temp="$(mktemp "${environment_file}.tmp.XXXXXX")"
    node - "${environment_file}" "${environment_temp}" "${new_sha}" <<'NODE'
const fs = require('node:fs');
const [source, target, sha] = process.argv.slice(2);
const content = fs.readFileSync(source, 'utf8');
const pattern = /^APP_GIT_SHA=[^\r\n]*(\r?)$/gm;
const matches = [...content.matchAll(pattern)];
if (matches.length !== 1) {
    throw new Error('Environment file must contain exactly one APP_GIT_SHA assignment');
}
const updated = content.replace(pattern, (_line, carriageReturn) => `APP_GIT_SHA=${sha}${carriageReturn}`);
fs.writeFileSync(target, updated, { mode: 0o600 });
NODE
    chown --reference="${environment_file}" "${environment_temp}"
    chmod 0600 "${environment_temp}"
    mv -fT -- "${environment_temp}" "${environment_file}"
    environment_temp=""
}

health_matches_sha() {
    local expected_sha="$1"
    local maximum_seconds="$2"
    curl --fail --silent --show-error \
        --connect-timeout 2 --max-time "${maximum_seconds}" \
        "${health_url}" |
        node -e '
const fs = require("node:fs");
const expectedSha = process.argv[1];
const health = JSON.parse(fs.readFileSync(0, "utf8"));
if (health.status !== "ok" || health.gitSha !== expectedSha) process.exit(1);
' "${expected_sha}"
}

poll_health() {
    local expected_sha="$1"
    local deadline=$((SECONDS + 60))
    local remaining
    while ((SECONDS < deadline)); do
        remaining=$((deadline - SECONDS))
        if health_matches_sha "${expected_sha}" "${remaining}"; then
            return 0
        fi
        if ((SECONDS + 1 < deadline)); then
            sleep 1
        fi
    done
    return 1
}

install -d -o root -g root -m 0755 /opt/linglingqi
install -d -o root -g root -m 0755 "${releases_dir}"

if [[ -L "${repository_dir}" ]]; then
    echo "Refusing to use a symlinked repository target ${repository_dir}." >&2
    exit 1
elif [[ ! -e "${repository_dir}" ]]; then
    if [[ "${source_mode}" == "online" ]]; then
        git clone --bare "${repository_url}" "${repository_dir}"
    else
        git init --bare "${repository_dir}"
    fi
elif [[ ! -d "${repository_dir}" ]] || \
    [[ "$(git -C "${repository_dir}" rev-parse --is-bare-repository 2>/dev/null)" != "true" ]]; then
    echo "Refusing to replace unexpected repository target ${repository_dir}." >&2
    exit 1
fi
if [[ "${source_mode}" == "online" ]]; then
    if ! actual_repository_url="$(git -C "${repository_dir}" remote get-url origin 2>/dev/null)"; then
        echo "The bare repository does not have a readable origin URL." >&2
        exit 1
    fi
    if [[ "${actual_repository_url}" != "${repository_url}" ]]; then
        echo "The bare repository origin does not match the official repository URL." >&2
        exit 1
    fi
    git -C "${repository_dir}" fetch --force --prune origin \
        '+refs/heads/main:refs/remotes/origin/main'
    git -C "${repository_dir}" fetch --force origin \
        "+refs/tags/${ecs_release_tag}:refs/tags/${ecs_release_tag}" 2>/dev/null || true

    if ! release_sha="$(git -C "${repository_dir}" rev-parse --verify "${requested_sha}^{commit}" 2>/dev/null)"; then
        echo "The requested SHA does not resolve to a fetched commit." >&2
        exit 1
    fi
    main_authorized=false
    tag_authorized=false
    if git -C "${repository_dir}" merge-base --is-ancestor \
        "${release_sha}" refs/remotes/origin/main; then
        main_authorized=true
    fi
    if ecs_tag_sha="$(git -C "${repository_dir}" rev-parse --verify \
        "refs/tags/${ecs_release_tag}^{commit}" 2>/dev/null)" && \
        [[ "${ecs_tag_sha}" == "${release_sha}" ]]; then
        tag_authorized=true
    fi
    if [[ "${main_authorized}" != "true" && "${tag_authorized}" != "true" ]]; then
        echo "The requested commit is neither reachable from origin/main nor authorized by its ECS release tag." >&2
        exit 1
    fi
else
    release_sha="$(import_verified_offline_bundle "${repository_dir}" "${bundle_path}" \
        "${requested_sha}" "${ecs_release_tag}")"
fi

if health_matches_sha "${release_sha}" 2; then
    echo "Already deployed and verified ${release_sha}."
    exit 0
fi

release_dir="/opt/linglingqi/releases/${release_sha}"
if [[ -e "${release_dir}" || -L "${release_dir}" ]]; then
    echo "Release already exists; refusing to overwrite ${release_dir}." >&2
    exit 1
fi

previous_target=""
previous_sha="$(read_app_git_sha)"
if [[ -L "${current_link}" ]]; then
    previous_target="$(readlink -f -- "${current_link}")"
    if [[ -z "${previous_target}" || ! -d "${previous_target}" || \
        "${previous_target}" != "${releases_dir}/"* ]]; then
        echo "The current release symlink has an unexpected target." >&2
        exit 1
    fi
    previous_release_name="$(basename -- "${previous_target}")"
    if [[ ! "${previous_release_name}" =~ ^[0-9a-f]{40}$ ]] || \
        [[ "${previous_sha}" != "${previous_release_name}" ]]; then
        echo "Current release and APP_GIT_SHA are inconsistent; refusing deployment." >&2
        exit 1
    fi
elif [[ -e "${current_link}" ]]; then
    echo "Refusing to replace a non-symlink current release target." >&2
    exit 1
elif [[ -n "${previous_sha}" ]]; then
    echo "APP_GIT_SHA must be empty before the first deployment." >&2
    exit 1
fi

if [[ -e "${next_link}" || -L "${next_link}" || -e "${rollback_link}" || -L "${rollback_link}" ]]; then
    echo "Remove stale deployment transition links before retrying." >&2
    exit 1
fi

git -C "${repository_dir}" worktree add --detach "${release_dir}" "${release_sha}"
chown -R linglingqi:linglingqi "${release_dir}"
runuser --user linglingqi -- bash -c '
set -Eeuo pipefail
cd -- "$1"
npm ci
npm run test:pagination
npm run test:deployment
npm run build
' _ "${release_dir}"

rollback_after_failure() {
    local original_status="$1"
    local rollback_ok=true
    trap - ERR INT TERM
    set +e
    echo "Deployment failed; restoring the previous release." >&2

    if [[ -n "${previous_target}" ]]; then
        if ln -s -- "${previous_target}" "${rollback_link}"; then
            rollback_link_created=true
        else
            rollback_ok=false
        fi
        if [[ "${rollback_link_created}" == "true" ]]; then
            if mv -Tf -- "${rollback_link}" "${current_link}"; then
                rollback_link_created=false
            else
                rollback_ok=false
            fi
        fi
    elif [[ -L "${current_link}" ]] && \
        [[ "$(readlink -f -- "${current_link}")" == "${release_dir}" ]]; then
        rm -f -- "${current_link}"
    elif [[ ! -e "${current_link}" && ! -L "${current_link}" ]]; then
        :
    else
        rollback_ok=false
    fi

    if ! update_app_git_sha "${previous_sha}"; then
        rollback_ok=false
    fi
    if ! systemctl restart linglingqi.service; then
        rollback_ok=false
    fi
    if [[ -n "${previous_target}" ]]; then
        if ! poll_health "${previous_sha}"; then
            rollback_ok=false
        fi
    else
        echo "No prior release existed, so no prior health response can be restored." >&2
    fi

    if [[ "${rollback_ok}" != "true" ]]; then
        echo "Rollback did not restore a verified healthy prior release; operator action is required." >&2
    else
        echo "Rollback restored and verified ${previous_sha}." >&2
    fi
    if [[ "${original_status}" -eq 0 ]]; then
        original_status=1
    fi
    exit "${original_status}"
}

trap 'rollback_after_failure $?' ERR
trap 'rollback_after_failure 130' INT
trap 'rollback_after_failure 143' TERM

update_app_git_sha "${release_sha}"
ln -s -- "${release_dir}" "${next_link}"
next_link_created=true
mv -Tf -- "${next_link}" "${current_link}"
next_link_created=false
systemctl restart linglingqi.service
if ! poll_health "${release_sha}"; then
    echo "The new release did not report a matching healthy SHA within 60 seconds." >&2
    false
fi

trap - ERR INT TERM
echo "Deployed and verified ${release_sha}."
