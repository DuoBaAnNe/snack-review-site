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
certificate_test_mode="${LINGLINGQI_CERTIFICATE_TEST_MODE:-0}"
if [[ "${certificate_test_mode}" == "1" ]]; then
    test_root="${LINGLINGQI_CERTIFICATE_TEST_ROOT:-}"
    test_destination="${LINGLINGQI_CERTIFICATE_DESTINATION_DIR:-}"
    unsafe_test_destination=false

    if [[ -z "${test_root}" || -z "${test_destination}" || \
        "${test_root}" != /* || "${test_root}" == "/" || \
        "${test_destination}" != /* || "${test_destination}" == "/" || \
        -L "${test_root}" || ! -d "${test_root}" || ! -O "${test_root}" || \
        "${test_root}" =~ (^|/)\.\.?(/|$) || \
        "${test_destination}" =~ (^|/)\.\.?(/|$) ]]; then
        unsafe_test_destination=true
    else
        canonical_test_root="$(realpath -e -- "${test_root}")"
        canonical_test_destination="$(realpath -m -- "${test_destination}")"
        if [[ "${test_root}" != "${canonical_test_root}" || \
            "${canonical_test_destination}" != "${canonical_test_root}"/* ]]; then
            unsafe_test_destination=true
        else
            relative_destination="${test_destination#"${canonical_test_root}"/}"
            destination_ancestor="${canonical_test_root}"
            IFS='/' read -r -a destination_parts <<<"${relative_destination}"
            for destination_part in "${destination_parts[@]}"; do
                destination_ancestor="${destination_ancestor}/${destination_part}"
                if [[ -L "${destination_ancestor}" ]] || \
                    [[ -e "${destination_ancestor}" && ! -d "${destination_ancestor}" ]]; then
                    unsafe_test_destination=true
                    break
                fi
            done
        fi
    fi

    if [[ "${unsafe_test_destination}" == "true" ]]; then
        echo "Unsafe certificate test destination." >&2
        exit 1
    fi
    destination_dir="${canonical_test_destination}"
    export LINGLINGQI_CERTIFICATE_TEST_PARENT_PID="$$"
elif [[ "${certificate_test_mode}" != "0" ]] || \
    [[ -v LINGLINGQI_CERTIFICATE_DESTINATION_DIR ]] || \
    [[ -v LINGLINGQI_CERTIFICATE_TEST_ROOT ]]; then
    echo "Certificate destination override requires explicit test mode." >&2
    exit 1
else
    unset LINGLINGQI_CERTIFICATE_TEST_PARENT_PID
fi

if [[ -L "${destination_dir}" ]] || \
    [[ -e "${destination_dir}" && ! -d "${destination_dir}" ]]; then
    echo "Certificate destination must be a non-symlinked directory." >&2
    exit 1
fi
certificate_path="${destination_dir}/fullchain.pem"
private_key_path="${destination_dir}/privkey.pem"
certificate_stage=""
private_key_stage=""
certificate_restore_stage=""
private_key_restore_stage=""
certificate_backup=""
private_key_backup=""
activation_status_file=""
had_certificate=false
had_private_key=false
nginx_was_active=false
live_files_replaced=false
activation_complete=false
preserve_backups=false
rollback_in_progress=false
activation_pid=""
activation_command_status=125
activation_interrupted_status=0

cleanup() {
    local cleanup_ok=true
    for temporary_path in \
        "${certificate_stage}" "${private_key_stage}" \
        "${certificate_restore_stage}" "${private_key_restore_stage}" \
        "${activation_status_file}"; do
        if [[ -n "${temporary_path}" && -f "${temporary_path}" ]]; then
            if ! rm -f -- "${temporary_path}"; then
                cleanup_ok=false
            fi
        fi
    done
    if [[ "${preserve_backups}" != "true" ]]; then
        for temporary_path in "${certificate_backup}" "${private_key_backup}"; do
            if [[ -n "${temporary_path}" && -f "${temporary_path}" ]]; then
                if ! rm -f -- "${temporary_path}"; then
                    cleanup_ok=false
                fi
            fi
        done
    fi
    [[ "${cleanup_ok}" == "true" ]]
}

restore_previous_certificate() {
    local restore_ok=true
    if [[ "${had_certificate}" == "true" && -f "${certificate_backup}" ]]; then
        certificate_restore_stage="$(mktemp "${destination_dir}/fullchain.restore.XXXXXX")"
        if cp --preserve=mode,ownership,timestamps -- \
            "${certificate_backup}" "${certificate_restore_stage}" && \
            mv -fT -- "${certificate_restore_stage}" "${certificate_path}"; then
            certificate_restore_stage=""
        else
            restore_ok=false
        fi
    elif [[ "${had_certificate}" == "true" ]]; then
        restore_ok=false
    elif ! rm -f -- "${certificate_path}"; then
        restore_ok=false
    fi

    if [[ "${had_private_key}" == "true" && -f "${private_key_backup}" ]]; then
        private_key_restore_stage="$(mktemp "${destination_dir}/privkey.restore.XXXXXX")"
        if cp --preserve=mode,ownership,timestamps -- \
            "${private_key_backup}" "${private_key_restore_stage}" && \
            mv -fT -- "${private_key_restore_stage}" "${private_key_path}"; then
            private_key_restore_stage=""
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

rollback_certificate_activation() {
    local files_restored=true
    local service_restored=true
    rollback_in_progress=true
    trap '' INT TERM

    if ! restore_previous_certificate; then
        files_restored=false
    fi

    if [[ "${nginx_was_active}" == "true" ]]; then
        if [[ "${files_restored}" != "true" ]] || ! nginx -t || \
            ! systemctl reload nginx; then
            service_restored=false
        fi
    elif ! systemctl stop nginx; then
        service_restored=false
    fi

    if [[ "${files_restored}" == "true" && "${service_restored}" == "true" ]]; then
        live_files_replaced=false
        preserve_backups=false
        return 0
    fi

    preserve_backups=true
    return 1
}

record_activation_interrupt() {
    local signal_status="$1"
    if [[ "${activation_interrupted_status}" -eq 0 ]]; then
        activation_interrupted_status="${signal_status}"
    fi
}

run_activation_command() {
    activation_command_status=125
    activation_interrupted_status=0
    activation_status_file="$(mktemp "${destination_dir}/activation.status.XXXXXX")"
    trap 'record_activation_interrupt 130' INT
    trap 'record_activation_interrupt 143' TERM

    (
        set +e
        "$@"
        command_status="$?"
        printf '%s\n' "${command_status}" >"${activation_status_file}"
        exit "${command_status}"
    ) &
    activation_pid="$!"

    set +e
    while kill -0 "${activation_pid}" 2>/dev/null; do
        wait "${activation_pid}"
    done
    set -e

    if [[ -s "${activation_status_file}" ]]; then
        activation_command_status="$(<"${activation_status_file}")"
        if [[ ! "${activation_command_status}" =~ ^[0-9]+$ ]]; then
            activation_command_status=125
        fi
    fi
    if [[ "${activation_command_status}" -eq 0 ]]; then
        activation_complete=true
        trap - EXIT
    fi
    if ! rm -f -- "${activation_status_file}"; then
        echo "Warning: unable to remove the activation status file." >&2
    fi
    activation_status_file=""
}

certificate_exit() {
    local exit_status="$?"
    trap - EXIT
    trap - INT
    trap - TERM
    set +e
    if [[ "${live_files_replaced}" == "true" && \
        "${activation_complete}" != "true" && \
        "${rollback_in_progress}" != "true" ]]; then
        echo "Certificate activation failed; restoring the previous live files." >&2
        if ! rollback_certificate_activation; then
            echo "Certificate rollback failed; operator action is required." >&2
            if [[ "${exit_status}" -eq 0 ]]; then
                exit_status=1
            fi
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

set +e
systemctl is-active --quiet nginx
nginx_state_status="$?"
set -e
case "${nginx_state_status}" in
    0) nginx_was_active=true ;;
    3) nginx_was_active=false ;;
    *)
        echo "Unable to determine the original Nginx service state." >&2
        exit 1
        ;;
esac

live_files_replaced=true
mv -fT -- "${certificate_stage}" "${certificate_path}"
certificate_stage=""
mv -fT -- "${private_key_stage}" "${private_key_path}"
private_key_stage=""
chown root:root "${certificate_path}" "${private_key_path}"
chmod 0644 "${certificate_path}"
chmod 0600 "${private_key_path}"
nginx -t

if [[ "${nginx_was_active}" == "true" ]]; then
    run_activation_command systemctl reload nginx
else
    run_activation_command systemctl start nginx
fi

if [[ "${activation_command_status}" -eq 0 ]]; then
    trap - EXIT INT TERM
    if ! cleanup; then
        echo "Warning: certificate activation committed, but temporary-file cleanup failed." >&2
    fi
    if [[ "${activation_interrupted_status}" -ne 0 ]]; then
        exit "${activation_interrupted_status}"
    fi
    echo "Certificate installed and Nginx activated."
    exit 0
fi

failure_status="${activation_command_status}"
if [[ "${activation_interrupted_status}" -ne 0 ]]; then
    failure_status="${activation_interrupted_status}"
fi
trap '' INT TERM
if ! rollback_certificate_activation; then
    echo "Certificate rollback failed; backups were retained for operator recovery." >&2
fi
trap - EXIT INT TERM
if ! cleanup; then
    echo "Warning: rollback completed, but temporary-file cleanup failed." >&2
fi
if [[ "${failure_status}" -eq 0 ]]; then
    failure_status=1
fi
exit "${failure_status}"
