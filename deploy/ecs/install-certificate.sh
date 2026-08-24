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

cleanup() {
    for temporary_path in \
        "${certificate_stage}" "${private_key_stage}" \
        "${certificate_backup}" "${private_key_backup}"; do
        if [[ -n "${temporary_path}" && -f "${temporary_path}" ]]; then
            rm -f -- "${temporary_path}"
        fi
    done
}
trap cleanup EXIT

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

if mv -fT -- "${certificate_stage}" "${certificate_path}" && \
    mv -fT -- "${private_key_stage}" "${private_key_path}" && \
    chown root:root "${certificate_path}" "${private_key_path}" && \
    chmod 0644 "${certificate_path}" && \
    chmod 0600 "${private_key_path}" && \
    nginx -t; then
    certificate_stage=""
    private_key_stage=""
else
    if [[ "${had_certificate}" == "true" ]]; then
        mv -fT -- "${certificate_backup}" "${certificate_path}"
        certificate_backup=""
    else
        rm -f -- "${certificate_path}"
    fi
    if [[ "${had_private_key}" == "true" ]]; then
        mv -fT -- "${private_key_backup}" "${private_key_path}"
        private_key_backup=""
    else
        rm -f -- "${private_key_path}"
    fi
    echo "Nginx validation failed; the previous certificate files were restored." >&2
    exit 1
fi

systemctl reload nginx
echo "Certificate installed and Nginx reloaded."
