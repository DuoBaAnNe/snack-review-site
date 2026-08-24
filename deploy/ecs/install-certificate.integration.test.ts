import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
    chmodSync,
    existsSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    rmSync,
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
        if [[ "\${FAKE_FAIL_FIRST_RELOAD:-0}" == "1" && "\${count}" -eq 1 ]]; then
            exit 1
        fi
        ;;
    start)
        printf 'start\\n' >>"\${state}/calls"
        touch "\${state}/active"
        copy_loaded_files
        [[ "\${FAKE_FAIL_START_AFTER_ACTIVATION:-0}" != "1" ]]
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
    failStartAfterActivation?: boolean;
    stateProbeError?: boolean;
};

function runScenario(options: ScenarioOptions) {
    const root = mkdtempSync(join(tmpdir(), 'linglingqi-certificate-'));
    const fakeBin = join(root, 'bin');
    const destination = join(root, 'destination');
    const state = join(root, 'state');
    mkdirSync(fakeBin);
    mkdirSync(destination);
    mkdirSync(state);
    createFakeCommands(fakeBin);

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
                LINGLINGQI_CERTIFICATE_DESTINATION_DIR: toBashPath(destination),
                FAKE_SYSTEMCTL_STATE_DIR: toBashPath(state),
                FAKE_FAIL_FIRST_RELOAD: options.failFirstReload ? '1' : '0',
                FAKE_FAIL_START_AFTER_ACTIVATION: options.failStartAfterActivation ? '1' : '0',
                FAKE_IS_ACTIVE_ERROR: options.stateProbeError ? '1' : '0',
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
