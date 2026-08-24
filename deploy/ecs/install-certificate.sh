#!/usr/bin/env bash
set -Eeuo pipefail

if [[ "$(id -u)" != "0" ]]; then
    echo "This certificate installer must run as root." >&2
    exit 1
fi
if [[ "$#" -ne 2 ]]; then
    echo "Usage: $0 <full-certificate-chain> <private-key>" >&2
    exit 1
fi
if [[ ! -f "$1" || ! -r "$1" || ! -f "$2" || ! -r "$2" ]]; then
    echo "Both certificate arguments must be readable regular files." >&2
    exit 1
fi

certificate_source="$1"
private_key_source="$2"
destination_dir="/etc/nginx/ssl/linglingqi"
certificate_path="${destination_dir}/fullchain.pem"
private_key_path="${destination_dir}/privkey.pem"
certificate_stage=""
private_key_stage=""
certificate_backup=""
private_key_backup=""
had_certificate=false
had_private_key=false
live_files_replaced=false
activation_complete=false
preserve_backups=false

cleanup() {
    for temporary_path in "${certificate_stage}" "${private_key_stage}"; do
        if [[ -n "${temporary_path}" && -f "${temporary_path}" ]]; then
            rm -f -- "${temporary_path}"
        fi
    done
    if [[ "${preserve_backups}" != "true" ]]; then
        for temporary_path in "${certificate_backup}" "${private_key_backup}"; do
            if [[ -n "${temporary_path}" && -f "${temporary_path}" ]]; then
                rm -f -- "${temporary_path}"
            fi
        done
    fi
}

restore_previous_certificate() {
    local restore_ok=true
    if [[ "${had_certificate}" == "true" && -f "${certificate_backup}" ]]; then
        if mv -fT -- "${certificate_backup}" "${certificate_path}"; then
            certificate_backup=""
        else
            restore_ok=false
        fi
    elif [[ "${had_certificate}" == "true" ]]; then
        restore_ok=false
    elif ! rm -f -- "${certificate_path}"; then
        restore_ok=false
    fi

    if [[ "${had_private_key}" == "true" && -f "${private_key_backup}" ]]; then
        if mv -fT -- "${private_key_backup}" "${private_key_path}"; then
            private_key_backup=""
        else
            restore_ok=false
        fi
    elif [[ "${had_private_key}" == "true" ]]; then
        restore_ok=false
    elif ! rm -f -- "${private_key_path}"; then
        restore_ok=false
    fi

    [[ "${restore_ok}" == "true" ]]
}

certificate_exit() {
    local exit_status="$?"
    trap - EXIT
    trap - INT
    trap - TERM
    set +e
    if [[ "${live_files_replaced}" == "true" && "${activation_complete}" != "true" ]]; then
        echo "Certificate activation failed; restoring the previous live files." >&2
        if ! restore_previous_certificate; then
            echo "Certificate rollback failed; operator action is required." >&2
            preserve_backups=true
            exit_status=1
        fi
    fi
    cleanup
    exit "${exit_status}"
}

trap certificate_exit EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

install -d -o root -g root -m 0700 "${destination_dir}"
certificate_stage="$(mktemp "${destination_dir}/fullchain.stage.XXXXXX")"
private_key_stage="$(mktemp "${destination_dir}/privkey.stage.XXXXXX")"
install -o root -g root -m 0644 "${certificate_source}" "${certificate_stage}"
install -o root -g root -m 0600 "${private_key_source}" "${private_key_stage}"

if [[ -f "${certificate_path}" ]]; then
    had_certificate=true
    certificate_backup="$(mktemp "${destination_dir}/fullchain.backup.XXXXXX")"
    cp --preserve=mode,ownership,timestamps -- "${certificate_path}" "${certificate_backup}"
fi
if [[ -f "${private_key_path}" ]]; then
    had_private_key=true
    private_key_backup="$(mktemp "${destination_dir}/privkey.backup.XXXXXX")"
    cp --preserve=mode,ownership,timestamps -- "${private_key_path}" "${private_key_backup}"
fi

live_files_replaced=true
mv -fT -- "${certificate_stage}" "${certificate_path}"
certificate_stage=""
mv -fT -- "${private_key_stage}" "${private_key_path}"
private_key_stage=""
chown root:root "${certificate_path}" "${private_key_path}"
chmod 0644 "${certificate_path}"
chmod 0600 "${private_key_path}"
nginx -t

if systemctl is-active --quiet nginx; then
    systemctl reload nginx
else
    systemctl start nginx
fi

activation_complete=true
trap - EXIT INT TERM
cleanup
echo "Certificate installed and Nginx activated."
