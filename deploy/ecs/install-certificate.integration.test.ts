import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
    chmodSync,
    existsSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    symlinkSync,
    writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

const bashExecutable = process.platform === 'win32' ? 'D:\\Git\\bin\\bash.exe' : 'bash';
const installer = 'deploy/ecs/install-certificate.sh';

function toBashPath(path: string) {
    const normalized = resolve(path).replaceAll('\\', '/');
    const windowsPath = normalized.match(/^([A-Za-z]):\/(.*)$/);
    if (!windowsPath) return normalized;
    return `/${windowsPath[1].toLowerCase()}/${windowsPath[2]}`;
}

function writeExecutable(path: string, content: string) {
    writeFileSync(path, content, 'utf8');
    chmodSync(path, 0o755);
}

function createFakeCommands(fakeBin: string) {
    writeExecutable(join(fakeBin, 'id'), `#!/usr/bin/env bash
if [[ "\${1:-}" == "-u" ]]; then
    printf '0\\n'
    exit 0
fi
exit 1
`);
    writeExecutable(join(fakeBin, 'chown'), `#!/usr/bin/env bash
exit 0
`);
    writeExecutable(join(fakeBin, 'rm'), `#!/usr/bin/env bash
set -Eeuo pipefail
if [[ "\${FAKE_FAIL_ACTIVATION_STATUS_CLEANUP:-0}" == "1" ]]; then
    for operand in "$@"; do
        if [[ "\${operand}" == */activation.status.* ]]; then
            exit 99
        fi
    done
fi
if [[ "\${FAKE_FAIL_BACKUP_CLEANUP:-0}" == "1" ]]; then
    for operand in "$@"; do
        if [[ "\${operand}" == */fullchain.backup.* || "\${operand}" == */privkey.backup.* ]]; then
            exit 99
        fi
    done
fi
/usr/bin/rm "$@"
`);
    writeExecutable(join(fakeBin, 'install'), `#!/usr/bin/env bash
set -Eeuo pipefail
directory=false
operands=()
while [[ "$#" -gt 0 ]]; do
    case "$1" in
        -d) directory=true; shift ;;
        -o|-g|-m) shift 2 ;;
        --) shift ;;
        *) operands+=("$1"); shift ;;
    esac
done
if [[ "\${directory}" == "true" ]]; then
    mkdir -p -- "\${operands[0]}"
else
    cp -- "\${operands[0]}" "\${operands[1]}"
fi
`);
    writeExecutable(join(fakeBin, 'nginx'), `#!/usr/bin/env bash
set -Eeuo pipefail
[[ "\${1:-}" == "-t" ]]
[[ -f "\${LINGLINGQI_CERTIFICATE_DESTINATION_DIR}/fullchain.pem" ]]
[[ -f "\${LINGLINGQI_CERTIFICATE_DESTINATION_DIR}/privkey.pem" ]]
state="\${FAKE_SYSTEMCTL_STATE_DIR}"
count=0
[[ -f "\${state}/nginx-test-count" ]] && count="$(<"\${state}/nginx-test-count")"
count=$((count + 1))
printf '%s\\n' "\${count}" >"\${state}/nginx-test-count"
if [[ "\${FAKE_NGINX_FIRST_FAILURE_STATUS:-0}" -ne 0 && "\${count}" -eq 1 ]]; then
    exit "\${FAKE_NGINX_FIRST_FAILURE_STATUS}"
fi
`);
    writeExecutable(join(fakeBin, 'systemctl'), `#!/usr/bin/env bash
set -Eeuo pipefail
command="\${1:-}"
service="\${3:-\${2:-}}"
state="\${FAKE_SYSTEMCTL_STATE_DIR}"
destination="\${LINGLINGQI_CERTIFICATE_DESTINATION_DIR}"
copy_loaded_files() {
    cp -- "\${destination}/fullchain.pem" "\${state}/loaded-fullchain.pem"
    cp -- "\${destination}/privkey.pem" "\${state}/loaded-privkey.pem"
}
case "\${command}" in
    is-active)
        if [[ "\${FAKE_IS_ACTIVE_ERROR:-0}" == "1" ]]; then
            exit 4
        fi
        if [[ -f "\${state}/active" ]]; then
            exit 0
        fi
        exit 3
        ;;
    reload)
        printf 'reload\\n' >>"\${state}/calls"
        count=0
        [[ -f "\${state}/reload-count" ]] && count="$(<"\${state}/reload-count")"
        count=$((count + 1))
        printf '%s\\n' "\${count}" >"\${state}/reload-count"
        copy_loaded_files
        if [[ "\${FAKE_FIRST_RELOAD_FAILURE_STATUS:-0}" -ne 0 && "\${count}" -eq 1 ]]; then
            exit "\${FAKE_FIRST_RELOAD_FAILURE_STATUS}"
        fi
        if [[ "\${FAKE_RELOAD_FAILURE_STATUS:-0}" -ne 0 ]]; then
            exit "\${FAKE_RELOAD_FAILURE_STATUS}"
        fi
        if [[ -n "\${FAKE_SIGNAL_ON_RELOAD:-}" ]]; then
            kill -s "\${FAKE_SIGNAL_ON_RELOAD}" "\${LINGLINGQI_CERTIFICATE_TEST_PARENT_PID}"
        fi
        ;;
    start)
        printf 'start\\n' >>"\${state}/calls"
        touch "\${state}/active"
        copy_loaded_files
        [[ "\${FAKE_FAIL_START_AFTER_ACTIVATION:-0}" != "1" ]]
        if [[ -n "\${FAKE_SIGNAL_ON_START:-}" ]]; then
            kill -s "\${FAKE_SIGNAL_ON_START}" "\${LINGLINGQI_CERTIFICATE_TEST_PARENT_PID}"
        fi
        ;;
    stop)
        printf 'stop\\n' >>"\${state}/calls"
        rm -f -- "\${state}/active" "\${state}/loaded-fullchain.pem" "\${state}/loaded-privkey.pem"
        ;;
    *)
        printf 'unexpected systemctl call: %s %s\\n' "\${command}" "\${service}" >&2
        exit 64
        ;;
esac
`);
}

type ScenarioOptions = {
    initiallyActive: boolean;
    failFirstReload?: boolean;
    firstReloadFailureStatus?: number;
    failStartAfterActivation?: boolean;
    stateProbeError?: boolean;
    signalOnReload?: 'INT' | 'TERM';
    signalOnStart?: 'INT' | 'TERM';
    failActivationStatusCleanup?: boolean;
    failBackupCleanup?: boolean;
    nginxFirstFailureStatus?: number;
    reloadFailureStatus?: number;
    testMode?: boolean;
    destinationCase?: 'normal' | 'root' | 'escape' | 'symlink-ancestor';
};

function runScenario(options: ScenarioOptions) {
    const root = mkdtempSync(join(tmpdir(), 'linglingqi-certificate-'));
    const fakeBin = join(root, 'bin');
    const trustedRoot = join(root, 'trusted');
    let destination = join(trustedRoot, 'destination');
    const state = join(root, 'state');
    mkdirSync(fakeBin);
    mkdirSync(trustedRoot);
    mkdirSync(state);
    createFakeCommands(fakeBin);

    switch (options.destinationCase ?? 'normal') {
        case 'normal':
            mkdirSync(destination);
            break;
        case 'root':
            destination = '/';
            break;
        case 'escape':
            destination = `${toBashPath(trustedRoot)}/../escaped`;
            break;
        case 'symlink-ancestor': {
            const outside = join(root, 'outside');
            const symlinkAncestor = join(trustedRoot, 'linked');
            mkdirSync(outside);
            symlinkSync(outside, symlinkAncestor, 'junction');
            destination = join(symlinkAncestor, 'destination');
            break;
        }
    }

    const newCertificate = join(root, 'new-fullchain.pem');
    const newPrivateKey = join(root, 'new-privkey.pem');
    writeFileSync(newCertificate, 'new certificate\n', 'utf8');
    writeFileSync(newPrivateKey, 'new private key\n', 'utf8');

    if (options.initiallyActive) {
        writeFileSync(join(destination, 'fullchain.pem'), 'old certificate\n', 'utf8');
        writeFileSync(join(destination, 'privkey.pem'), 'old private key\n', 'utf8');
        writeFileSync(join(state, 'loaded-fullchain.pem'), 'old certificate\n', 'utf8');
        writeFileSync(join(state, 'loaded-privkey.pem'), 'old private key\n', 'utf8');
        writeFileSync(join(state, 'active'), '', 'utf8');
    }

    const result = spawnSync(
        bashExecutable,
        [
            '-c',
            'export PATH="$1:$PATH"; shift; exec bash "$@"',
            '_',
            toBashPath(fakeBin),
            installer,
            toBashPath(newCertificate),
            toBashPath(newPrivateKey),
        ],
        {
            cwd: resolve('.'),
            encoding: 'utf8',
            env: {
                ...process.env,
                LINGLINGQI_CERTIFICATE_TEST_MODE: options.testMode === false ? '0' : '1',
                LINGLINGQI_CERTIFICATE_TEST_ROOT: toBashPath(trustedRoot),
                LINGLINGQI_CERTIFICATE_DESTINATION_DIR:
                    options.destinationCase === 'escape' ? destination : toBashPath(destination),
                FAKE_SYSTEMCTL_STATE_DIR: toBashPath(state),
                FAKE_FIRST_RELOAD_FAILURE_STATUS: String(
                    options.firstReloadFailureStatus ?? (options.failFirstReload ? 1 : 0),
                ),
                FAKE_FAIL_START_AFTER_ACTIVATION: options.failStartAfterActivation ? '1' : '0',
                FAKE_IS_ACTIVE_ERROR: options.stateProbeError ? '1' : '0',
                FAKE_SIGNAL_ON_RELOAD: options.signalOnReload ?? '',
                FAKE_SIGNAL_ON_START: options.signalOnStart ?? '',
                FAKE_FAIL_ACTIVATION_STATUS_CLEANUP: options.failActivationStatusCleanup ? '1' : '0',
                FAKE_FAIL_BACKUP_CLEANUP: options.failBackupCleanup ? '1' : '0',
                FAKE_NGINX_FIRST_FAILURE_STATUS: String(options.nginxFirstFailureStatus ?? 0),
                FAKE_RELOAD_FAILURE_STATUS: String(options.reloadFailureStatus ?? 0),
            },
        },
    );

    return { root, destination, state, result };
}

test('renewal activation failure restores and reloads the prior certificate', () => {
    const scenario = runScenario({ initiallyActive: true, failFirstReload: true });
    try {
        assert.notEqual(scenario.result.status, 0, scenario.result.stderr);
        assert.equal(readFileSync(join(scenario.destination, 'fullchain.pem'), 'utf8'), 'old certificate\n');
        assert.equal(readFileSync(join(scenario.destination, 'privkey.pem'), 'utf8'), 'old private key\n');
        assert.equal(readFileSync(join(scenario.state, 'loaded-fullchain.pem'), 'utf8'), 'old certificate\n');
        assert.equal(readFileSync(join(scenario.state, 'loaded-privkey.pem'), 'utf8'), 'old private key\n');
        assert.equal(existsSync(join(scenario.state, 'calls')), true, scenario.result.stderr);
        assert.equal(readFileSync(join(scenario.state, 'calls'), 'utf8'), 'reload\nreload\n');
        assert.equal(existsSync(join(scenario.state, 'active')), true);
    } finally {
        rmSync(scenario.root, { recursive: true, force: true });
    }
});

test('first-install activation failure removes new files and stops Nginx', () => {
    const scenario = runScenario({ initiallyActive: false, failStartAfterActivation: true });
    try {
        assert.notEqual(scenario.result.status, 0, scenario.result.stderr);
        assert.equal(existsSync(join(scenario.destination, 'fullchain.pem')), false);
        assert.equal(existsSync(join(scenario.destination, 'privkey.pem')), false);
        assert.equal(existsSync(join(scenario.state, 'loaded-fullchain.pem')), false);
        assert.equal(existsSync(join(scenario.state, 'loaded-privkey.pem')), false);
        assert.equal(existsSync(join(scenario.state, 'active')), false);
        assert.equal(existsSync(join(scenario.state, 'calls')), true, scenario.result.stderr);
        assert.equal(readFileSync(join(scenario.state, 'calls'), 'utf8'), 'start\nstop\n');
    } finally {
        rmSync(scenario.root, { recursive: true, force: true });
    }
});

test('indeterminate original Nginx state aborts before replacing certificate files', () => {
    const scenario = runScenario({ initiallyActive: false, stateProbeError: true });
    try {
        assert.notEqual(scenario.result.status, 0, scenario.result.stderr);
        assert.equal(existsSync(join(scenario.destination, 'fullchain.pem')), false);
        assert.equal(existsSync(join(scenario.destination, 'privkey.pem')), false);
        assert.equal(existsSync(join(scenario.state, 'calls')), false);
        assert.equal(existsSync(join(scenario.state, 'active')), false);
    } finally {
        rmSync(scenario.root, { recursive: true, force: true });
    }
});

test('successful renewal commits the new certificate when INT arrives during reload', () => {
    const scenario = runScenario({ initiallyActive: true, signalOnReload: 'INT' });
    try {
        assert.equal(scenario.result.status, 130, scenario.result.stderr);
        assert.equal(readFileSync(join(scenario.destination, 'fullchain.pem'), 'utf8'), 'new certificate\n');
        assert.equal(readFileSync(join(scenario.destination, 'privkey.pem'), 'utf8'), 'new private key\n');
        assert.equal(readFileSync(join(scenario.state, 'loaded-fullchain.pem'), 'utf8'), 'new certificate\n');
        assert.equal(readFileSync(join(scenario.state, 'loaded-privkey.pem'), 'utf8'), 'new private key\n');
        assert.equal(existsSync(join(scenario.state, 'active')), true);
        assert.equal(readFileSync(join(scenario.state, 'calls'), 'utf8'), 'reload\n');
    } finally {
        rmSync(scenario.root, { recursive: true, force: true });
    }
});

test('successful first install commits the new certificate when TERM arrives during start', () => {
    const scenario = runScenario({ initiallyActive: false, signalOnStart: 'TERM' });
    try {
        assert.equal(scenario.result.status, 143, scenario.result.stderr);
        assert.equal(readFileSync(join(scenario.destination, 'fullchain.pem'), 'utf8'), 'new certificate\n');
        assert.equal(readFileSync(join(scenario.destination, 'privkey.pem'), 'utf8'), 'new private key\n');
        assert.equal(readFileSync(join(scenario.state, 'loaded-fullchain.pem'), 'utf8'), 'new certificate\n');
        assert.equal(readFileSync(join(scenario.state, 'loaded-privkey.pem'), 'utf8'), 'new private key\n');
        assert.equal(existsSync(join(scenario.state, 'active')), true);
        assert.equal(readFileSync(join(scenario.state, 'calls'), 'utf8'), 'start\n');
    } finally {
        rmSync(scenario.root, { recursive: true, force: true });
    }
});

test('successful activation stays committed when activation-status cleanup fails', () => {
    const scenario = runScenario({ initiallyActive: true, failActivationStatusCleanup: true });
    try {
        assert.equal(readFileSync(join(scenario.destination, 'fullchain.pem'), 'utf8'), 'new certificate\n');
        assert.equal(readFileSync(join(scenario.state, 'loaded-fullchain.pem'), 'utf8'), 'new certificate\n');
        assert.equal(existsSync(join(scenario.state, 'active')), true);
        assert.equal(readFileSync(join(scenario.state, 'calls'), 'utf8'), 'reload\n');
    } finally {
        rmSync(scenario.root, { recursive: true, force: true });
    }
});

test('rollback failure preserves the original interruption status', () => {
    const scenario = runScenario({
        initiallyActive: true,
        nginxFirstFailureStatus: 143,
        reloadFailureStatus: 42,
    });
    try {
        assert.equal(scenario.result.status, 143, scenario.result.stderr);
        assert.equal(readFileSync(join(scenario.destination, 'fullchain.pem'), 'utf8'), 'old certificate\n');
        assert.equal(readFileSync(join(scenario.state, 'loaded-fullchain.pem'), 'utf8'), 'old certificate\n');
        assert.equal(readFileSync(join(scenario.state, 'calls'), 'utf8'), 'reload\n');
    } finally {
        rmSync(scenario.root, { recursive: true, force: true });
    }
});

test('post-rollback cleanup failure preserves the activation failure status', () => {
    const scenario = runScenario({
        initiallyActive: true,
        firstReloadFailureStatus: 42,
        failBackupCleanup: true,
    });
    try {
        assert.equal(scenario.result.status, 42, scenario.result.stderr);
        assert.equal(readFileSync(join(scenario.destination, 'fullchain.pem'), 'utf8'), 'old certificate\n');
        assert.equal(readFileSync(join(scenario.state, 'loaded-fullchain.pem'), 'utf8'), 'old certificate\n');
        assert.equal(readFileSync(join(scenario.state, 'calls'), 'utf8'), 'reload\nreload\n');
    } finally {
        rmSync(scenario.root, { recursive: true, force: true });
    }
});

test('production mode rejects a certificate destination override', () => {
    const scenario = runScenario({ initiallyActive: false, testMode: false });
    try {
        assert.notEqual(scenario.result.status, 0, scenario.result.stderr);
        assert.match(scenario.result.stderr, /Certificate destination override requires explicit test mode/);
        assert.equal(existsSync(join(scenario.destination, 'fullchain.pem')), false);
        assert.equal(existsSync(join(scenario.state, 'calls')), false);
    } finally {
        rmSync(scenario.root, { recursive: true, force: true });
    }
});

test('test mode rejects the filesystem root as certificate destination', () => {
    const scenario = runScenario({ initiallyActive: false, destinationCase: 'root' });
    try {
        assert.notEqual(scenario.result.status, 0, scenario.result.stderr);
        assert.match(scenario.result.stderr, /Unsafe certificate test destination/);
        assert.equal(existsSync(join(scenario.state, 'calls')), false);
    } finally {
        rmSync(scenario.root, { recursive: true, force: true });
    }
});

test('test mode rejects a certificate destination that escapes its trusted root', () => {
    const scenario = runScenario({ initiallyActive: false, destinationCase: 'escape' });
    try {
        assert.notEqual(scenario.result.status, 0, scenario.result.stderr);
        assert.match(scenario.result.stderr, /Unsafe certificate test destination/);
        assert.equal(existsSync(join(scenario.root, 'escaped', 'fullchain.pem')), false);
        assert.equal(existsSync(join(scenario.state, 'calls')), false);
    } finally {
        rmSync(scenario.root, { recursive: true, force: true });
    }
});

test('test mode rejects a symlinked certificate destination ancestor', () => {
    const scenario = runScenario({ initiallyActive: false, destinationCase: 'symlink-ancestor' });
    try {
        assert.notEqual(scenario.result.status, 0, scenario.result.stderr);
        assert.match(scenario.result.stderr, /Unsafe certificate test destination/);
        assert.equal(existsSync(join(scenario.root, 'outside', 'destination', 'fullchain.pem')), false);
        assert.equal(existsSync(join(scenario.state, 'calls')), false);
    } finally {
        rmSync(scenario.root, { recursive: true, force: true });
    }
});
