#!/usr/bin/env bash
set -Eeuo pipefail

if [[ "$(id -u)" != "0" ]]; then
    echo "This deployment script must run as root." >&2
    exit 1
fi
if [[ "$#" -ne 1 ]]; then
    echo "Usage: $0 <git-sha>" >&2
    exit 1
fi

requested_sha="$1"
if [[ ! "${requested_sha}" =~ ^[0-9a-fA-F]{7,40}$ ]]; then
    echo "The Git SHA must contain 7 to 40 hexadecimal characters." >&2
    exit 1
fi

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
    git clone --bare "${repository_url}" "${repository_dir}"
elif [[ ! -d "${repository_dir}" ]] || \
    [[ "$(git -C "${repository_dir}" rev-parse --is-bare-repository 2>/dev/null)" != "true" ]]; then
    echo "Refusing to replace unexpected repository target ${repository_dir}." >&2
    exit 1
fi
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

if ! release_sha="$(git -C "${repository_dir}" rev-parse --verify "${requested_sha}^{commit}" 2>/dev/null)"; then
    echo "The requested SHA does not resolve to a fetched commit." >&2
    exit 1
fi
if ! git -C "${repository_dir}" merge-base --is-ancestor \
    "${release_sha}" refs/remotes/origin/main; then
    echo "The requested commit is not reachable from origin/main." >&2
    exit 1
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
