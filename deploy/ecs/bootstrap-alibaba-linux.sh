#!/usr/bin/env bash
set -Eeuo pipefail

if [[ "$(id -u)" != "0" ]]; then
    echo "This bootstrap script must run as root." >&2
    exit 1
fi

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
nodesource_script=""
fstab_temp=""
swap_created=false

cleanup() {
    if [[ -n "${nodesource_script}" && -e "${nodesource_script}" ]]; then
        rm -f -- "${nodesource_script}"
    fi
    if [[ -n "${fstab_temp}" && -e "${fstab_temp}" ]]; then
        rm -f -- "${fstab_temp}"
    fi
    if [[ "${swap_created}" == "true" ]]; then
        swapoff /swapfile >/dev/null 2>&1 || true
        rm -f -- /swapfile
    fi
}
trap cleanup EXIT

dnf install -y curl git nginx tar gzip

nodesource_script="$(mktemp /tmp/nodesource-setup.XXXXXX)"
curl --fail --silent --show-error --location \
    https://rpm.nodesource.com/setup_24.x \
    --output "${nodesource_script}"
bash "${nodesource_script}"
rm -f -- "${nodesource_script}"
nodesource_script=""
dnf install -y nodejs

node_version="$(node --version)"
if [[ ! "${node_version}" =~ ^v24. ]] || [[ "${node_version}" != v24.* ]]; then
    echo "Node.js 24 is required after installation." >&2
    exit 1
fi

if ! id linglingqi >/dev/null 2>&1; then
    useradd --system --create-home --home-dir /var/lib/linglingqi \
        --shell /sbin/nologin linglingqi
fi

install -d -o root -g root -m 0755 /opt/linglingqi
install -d -o root -g root -m 0755 /opt/linglingqi/releases
install -d -o root -g linglingqi -m 0750 /etc/linglingqi
install -d -o root -g root -m 0700 /etc/nginx/ssl/linglingqi

if [[ ! -e /swapfile ]]; then
    swap_created=true
    dd if=/dev/zero of=/swapfile bs=1M count=2048 status=progress
    chmod 0600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    swap_created=false
fi

if [[ ! -f /etc/fstab || -L /etc/fstab ]]; then
    echo "Refusing to replace an unexpected /etc/fstab target." >&2
    exit 1
fi
fstab_temp="$(mktemp /etc/fstab.linglingqi.XXXXXX)"
awk '$1 != "/swapfile" { print } END { print "/swapfile swap swap defaults 0 0" }' \
    /etc/fstab >"${fstab_temp}"
chown root:root "${fstab_temp}"
chmod 0644 "${fstab_temp}"
mv -fT -- "${fstab_temp}" /etc/fstab
fstab_temp=""

install -o root -g root -m 0644 \
    "${script_dir}/systemd/linglingqi.service" \
    /etc/systemd/system/linglingqi.service
install -o root -g root -m 0644 \
    "${script_dir}/nginx/linglingqi.conf" \
    /etc/nginx/conf.d/linglingqi.conf

systemctl daemon-reload
systemctl enable nginx linglingqi.service

echo "Bootstrap complete. Install the environment and certificate before starting services."
