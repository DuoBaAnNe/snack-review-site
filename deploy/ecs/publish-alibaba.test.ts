import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    buildCommands,
    buildObjectKeys,
    fileBody,
    parseConfig,
    parseInvocation,
    parseInvokeId,
    validateReleaseSha,
} from './publish-alibaba-lib';
import {
    createLocalPublishLock,
    isEntryPoint,
    publishAlibabaRelease,
    resolveSpawnCommand,
    type Command,
    type PublisherDependencies,
} from './publish-alibaba';

const fullSha = '3a5acea4bd7cfb4f72706d4ca7c839499a75ff3d';
const validConfig = {
    regionId: 'cn-shenzhen',
    instanceId: 'i-wz9doghzi13squhaxb6t',
    bucket: 'linglingqi-release-test',
    objectPrefix: 'ecs-releases',
    commandId: 'c-test123',
    aliyunProfile: 'linglingqi-deployer',
};

test('OSS file bodies use the native Windows path format accepted by ossutil', () => {
    assert.equal(fileBody('C:\\release\\source.bundle', 'win32'), 'file://C:\\release\\source.bundle');
});

test('Windows npm commands run through node instead of spawning npm.cmd directly', () => {
    assert.deepEqual(
        resolveSpawnCommand(
            { file: 'npm', args: ['run', 'build'] },
            'win32',
            'C:\\node\\node.exe',
            'C:\\node\\node_modules\\npm\\bin\\npm-cli.js',
        ),
        {
            file: 'C:\\node\\node.exe',
            args: [
                'C:\\node\\node_modules\\npm\\bin\\npm-cli.js',
                'run',
                'build',
            ],
        },
    );
});

const successFixture = JSON.stringify({
    Invocations: {
        Invocation: [{
            InvocationStatus: 'Success',
            InvokeInstances: {
                InvokeInstance: [{
                    InstanceId: validConfig.instanceId,
                    InvocationStatus: 'Success',
                    ExitCode: 0,
                    Output: 'Release completed',
                }],
            },
        }],
    },
});

const failedFixture = JSON.stringify({
    Invocations: {
        Invocation: [{
            InvocationStatus: 'Failed',
            InvokeInstances: {
                InvokeInstance: [{
                    InstanceId: validConfig.instanceId,
                    InvocationStatus: 'Failed',
                    ExitCode: 1,
                    Output: 'Build failed',
                }],
            },
        }],
    },
});

const rollbackFixture = JSON.stringify({
    Invocations: {
        Invocation: [{
            InvocationStatus: 'Failed',
            InvokeInstances: {
                InvokeInstance: [{
                    InstanceId: validConfig.instanceId,
                    InvocationStatus: 'Failed',
                    ExitCode: 1,
                    Output: `Rollback restored and verified ${fullSha}.`,
                }],
            },
        }],
    },
});

const runningFixture = JSON.stringify({
    Invocations: {
        Invocation: [{
            InvocationStatus: 'Running',
            InvokeInstances: {
                InvokeInstance: [{
                    InstanceId: validConfig.instanceId,
                    InvocationStatus: 'Running',
                }],
            },
        }],
    },
});

test('parseConfig pins the only production ECS target', () => {
    const config = parseConfig(JSON.stringify(validConfig));
    assert.equal(config.instanceId, 'i-wz9doghzi13squhaxb6t');
});

test('parseConfig rejects unexpected fields and unpinned deployment settings', () => {
    assert.throws(() => parseConfig(JSON.stringify({ ...validConfig, secret: 'nope' })), /unexpected fields/);
    assert.throws(() => parseConfig(JSON.stringify({ ...validConfig, objectPrefix: 'other' })), /objectPrefix/);
});

test('validateReleaseSha rejects a short or uppercase SHA', () => {
    assert.throws(() => validateReleaseSha('3a5acea'), /full lowercase/);
    assert.throws(() => validateReleaseSha(fullSha.toUpperCase()), /full lowercase/);
});

test('buildObjectKeys pins the immutable release paths and fixed request manifest', () => {
    assert.deepEqual(buildObjectKeys(parseConfig(JSON.stringify(validConfig)), fullSha), {
        bundleKey: `ecs-releases/${fullSha}/source.bundle`,
        checksumKey: `ecs-releases/${fullSha}/source.bundle.sha256`,
        requestKey: 'ecs-releases/requests/current.json',
    });
});

test('buildCommands has no SSH, Vercel, GitHub, push, or security-group action', () => {
    const rendered = JSON.stringify(buildCommands(parseConfig(JSON.stringify(validConfig)), fullSha, 'C:\\release'));
    assert.doesNotMatch(rendered, /ssh|vercel|github|git push|AuthorizeSecurityGroup/i);
});

test('parseInvokeId requires exactly one invocation id', () => {
    assert.equal(parseInvokeId('{"InvokeId":"t-test"}'), 't-test');
    assert.throws(() => parseInvokeId('{}'), /InvokeId/);
    assert.throws(() => parseInvokeId('{"InvokeId":["t-one","t-two"]}'), /InvokeId/);
});

test('parseInvocation distinguishes success, failure, and running', () => {
    assert.equal(parseInvocation(successFixture).state, 'success');
    assert.equal(parseInvocation(failedFixture).state, 'failed');
    assert.equal(parseInvocation(runningFixture).state, 'running');
});

function makeDependencies(options: {
    invocationResponses?: string[];
    cloudAssistant?: string;
    confirmedRequest?: string;
    failRequestRead?: boolean;
    failRequestDelete?: boolean;
} = {}): {
    dependencies: PublisherDependencies;
    commands: Command[];
    writes: Map<string, string | Uint8Array>;
    warnings: string[];
} {
    const commands: Command[] = [];
    const writes = new Map<string, string | Uint8Array>();
    const warnings: string[] = [];
    const invocationResponses = [...(options.invocationResponses ?? [runningFixture, successFixture])];
    let clock = 0;

    return {
        commands,
        writes,
        warnings,
        dependencies: {
            async exec(command) {
                commands.push(command);
                if (command.file === 'git' && command.args.join(' ') === 'rev-parse HEAD') {
                    return { stdout: `${fullSha}\n`, stderr: '' };
                }
                if (command.file === 'git' && command.args[0] === 'status') {
                    return { stdout: '?? .superpowers/sdd/task-4-report.md\n', stderr: '' };
                }
                if (command.file === 'aliyun' && command.args[1] === 'DescribeCloudAssistantStatus') {
                    return { stdout: options.cloudAssistant ?? JSON.stringify({
                        InstanceCloudAssistantStatusSet: {
                            InstanceCloudAssistantStatus: [{
                                InstanceId: validConfig.instanceId,
                                CloudAssistantStatus: true,
                            }],
                        },
                    }), stderr: '' };
                }
                if (command.file === 'aliyun' && command.args[1] === 'InvokeCommand') {
                    return { stdout: '{"InvokeId":"t-test"}', stderr: '' };
                }
                if (command.file === 'aliyun' && command.args[1] === 'DescribeInvocations') {
                    return { stdout: invocationResponses.shift() ?? successFixture, stderr: '' };
                }
                if (command.file === 'ossutil' && command.args[1] === 'delete-object' &&
                    command.args[command.args.indexOf('--key') + 1] === 'ecs-releases/requests/current.json' &&
                    options.failRequestDelete) {
                    throw new Error('request manifest delete failed');
                }
                return { stdout: '', stderr: '' };
            },
            async readFile(file) {
                if (file.endsWith('alibaba-deployment.local.json')) {
                    return JSON.stringify(validConfig);
                }
                if (file.endsWith('source.bundle')) {
                    return new Uint8Array([1, 2, 3]);
                }
                if (file.endsWith('request-confirm.json')) {
                    if (options.failRequestRead) {
                        throw new Error('request manifest read failed');
                    }
                    return options.confirmedRequest ?? JSON.stringify({ releaseSha: fullSha });
                }
                throw new Error(`Unexpected read: ${file}`);
            },
            async writeFile(file, content) {
                writes.set(file, content);
            },
            async makeTempDir() {
                return 'C:\\release';
            },
            async remove() {},
            async acquireLock() {
                return { release: async () => {} };
            },
            async fetchHealth() {
                return { status: 'ok', gitSha: fullSha };
            },
            async sleep() {},
            now() {
                clock += 1_000;
                return clock;
            },
            warn(message) {
                warnings.push(message);
            },
        },
    };
}

test('publisher uploads immutable artifacts before the fixed request and invokes the fixed command once', async () => {
    const scenario = makeDependencies();

    const result = await publishAlibabaRelease({ sha: fullSha }, scenario.dependencies);

    assert.deepEqual(result, { state: 'success', invokeId: 't-test' });
    const putObjects = scenario.commands.filter((command) => command.file === 'ossutil' && command.args[1] === 'put-object');
    assert.equal(putObjects.length, 3);
    assert.match(putObjects[0].args[putObjects[0].args.indexOf('--key') + 1], new RegExp(`/${fullSha}/source\\.bundle$`));
    assert.match(putObjects[1].args[putObjects[1].args.indexOf('--key') + 1], new RegExp(`/${fullSha}/source\\.bundle\\.sha256$`));
    assert.equal(putObjects[2].args[putObjects[2].args.indexOf('--key') + 1], 'ecs-releases/requests/current.json');
    assert.ok(putObjects.slice(0, 2).every((command) => command.args.at(-1) === '--forbid-overwrite'));
    assert.equal(putObjects[2].args.includes('--forbid-overwrite'), false);
    const manifest = [...scenario.writes.entries()].find(([file]) => file.endsWith('request.json'));
    assert.deepEqual(manifest?.[1], JSON.stringify({ releaseSha: fullSha }));

    const invokes = scenario.commands.filter((command) => command.file === 'aliyun' && command.args[1] === 'InvokeCommand');
    assert.equal(invokes.length, 1);
    assert.equal(invokes[0].args.includes('--Parameters'), false);
    const polls = scenario.commands.filter((command) => command.file === 'aliyun' && command.args[1] === 'DescribeInvocations');
    assert.equal(polls.length, 2);
    assert.ok(polls.every((command) => command.args.includes('t-test')));

    const deletedKeys = scenario.commands
        .filter((command) => command.file === 'ossutil' && command.args[1] === 'delete-object')
        .map((command) => command.args[command.args.indexOf('--key') + 1]);
    assert.deepEqual(deletedKeys, [
        'ecs-releases/requests/current.json',
        `ecs-releases/${fullSha}/source.bundle`,
        `ecs-releases/${fullSha}/source.bundle.sha256`,
    ]);
});

test('publisher classifies deploy.sh verified rollback output as rolled back', async () => {
    const scenario = makeDependencies({ invocationResponses: [rollbackFixture] });

    const result = await publishAlibabaRelease({ sha: fullSha }, scenario.dependencies);

    assert.deepEqual(result, { state: 'rolled-back', invokeId: 't-test' });
});

test('publisher does not accept a verified rollback line for another release', async () => {
    const scenario = makeDependencies({ invocationResponses: [JSON.stringify({
        Invocations: {
            Invocation: [{
                InvocationStatus: 'Failed',
                InvokeInstances: {
                    InvokeInstance: [{
                        InstanceId: validConfig.instanceId,
                        InvocationStatus: 'Failed',
                        ExitCode: 1,
                        Output: `Rollback restored and verified ${'a'.repeat(40)}.`,
                    }],
                },
            }],
        },
    })] });

    const result = await publishAlibabaRelease({ sha: fullSha }, scenario.dependencies);

    assert.deepEqual(result, { state: 'manual-intervention', invokeId: 't-test' });
});

test('publisher leaves another valid request in place while deleting only this release artifacts', async () => {
    const scenario = makeDependencies({ confirmedRequest: JSON.stringify({ releaseSha: 'a'.repeat(40) }) });

    const result = await publishAlibabaRelease({ sha: fullSha }, scenario.dependencies);

    assert.deepEqual(result, { state: 'success', invokeId: 't-test' });
    const deletedKeys = scenario.commands
        .filter((command) => command.file === 'ossutil' && command.args[1] === 'delete-object')
        .map((command) => command.args[command.args.indexOf('--key') + 1]);
    assert.deepEqual(deletedKeys, [
        `ecs-releases/${fullSha}/source.bundle`,
        `ecs-releases/${fullSha}/source.bundle.sha256`,
    ]);
});

test('publisher preserves manifest and artifacts when reading the confirmation fails', async () => {
    const scenario = makeDependencies({ failRequestRead: true });

    const result = await publishAlibabaRelease({ sha: fullSha }, scenario.dependencies);

    assert.deepEqual(result, { state: 'success', invokeId: 't-test' });
    const deletedKeys = scenario.commands
        .filter((command) => command.file === 'ossutil' && command.args[1] === 'delete-object')
        .map((command) => command.args[command.args.indexOf('--key') + 1]);
    assert.deepEqual(deletedKeys, []);
    assert.ok(scenario.warnings.some((warning) => warning.includes('retained')));
});

test('publisher preserves manifest and artifacts when the confirmation is malformed', async () => {
    const scenario = makeDependencies({ confirmedRequest: JSON.stringify({ releaseSha: fullSha, unexpected: true }) });

    const result = await publishAlibabaRelease({ sha: fullSha }, scenario.dependencies);

    assert.deepEqual(result, { state: 'success', invokeId: 't-test' });
    const deletedKeys = scenario.commands
        .filter((command) => command.file === 'ossutil' && command.args[1] === 'delete-object')
        .map((command) => command.args[command.args.indexOf('--key') + 1]);
    assert.deepEqual(deletedKeys, []);
    assert.ok(scenario.warnings.some((warning) => warning.includes('retained')));
});

test('publisher preserves artifacts when deletion of its matching request fails', async () => {
    const scenario = makeDependencies({ failRequestDelete: true });

    const result = await publishAlibabaRelease({ sha: fullSha }, scenario.dependencies);

    assert.deepEqual(result, { state: 'success', invokeId: 't-test' });
    const deletedKeys = scenario.commands
        .filter((command) => command.file === 'ossutil' && command.args[1] === 'delete-object')
        .map((command) => command.args[command.args.indexOf('--key') + 1]);
    assert.deepEqual(deletedKeys, ['ecs-releases/requests/current.json']);
    assert.ok(scenario.warnings.some((warning) => warning.includes('retained')));
});

test('publisher times out without a second invocation and retains all OSS objects', async () => {
    const scenario = makeDependencies({ invocationResponses: [runningFixture] });
    scenario.dependencies.now = (() => {
        const readings = [0, 1_800_001];
        return () => readings.shift() ?? 1_800_001;
    })();

    const result = await publishAlibabaRelease({ sha: fullSha, pollTimeoutMs: 1_800_000 }, scenario.dependencies);

    assert.deepEqual(result, { state: 'timed-out', invokeId: 't-test' });
    assert.equal(scenario.commands.filter((command) => command.file === 'aliyun' && command.args[1] === 'InvokeCommand').length, 1);
    assert.equal(scenario.commands.filter((command) => command.file === 'ossutil' && command.args[1] === 'delete-object').length, 0);
});

test('publisher refuses a concurrent local publisher before running any external command', async () => {
    const scenario = makeDependencies();
    scenario.dependencies.acquireLock = async () => {
        throw new Error('Another Alibaba ECS publisher is already running');
    };

    await assert.rejects(
        () => publishAlibabaRelease({ sha: fullSha }, scenario.dependencies),
        /already running/,
    );
    assert.deepEqual(scenario.commands, []);
});

test('local publish lock excludes a second process and releases for the next publication', async () => {
    const lockRoot = await createLocalPublishLock('publish-alibaba-test-lock');
    await assert.rejects(() => createLocalPublishLock('publish-alibaba-test-lock'), /already running/);
    await lockRoot.release();
    const nextLock = await createLocalPublishLock('publish-alibaba-test-lock');
    await nextLock.release();
});

test('entry-point detection recognizes the Windows file URL of the publisher', () => {
    assert.equal(
        isEntryPoint('C:\\worktree\\deploy\\ecs\\publish-alibaba.ts', 'file:///C:/worktree/deploy/ecs/publish-alibaba.ts'),
        true,
    );
    assert.equal(
        isEntryPoint('C:\\worktree\\deploy\\ecs\\publish-alibaba.test.ts', 'file:///C:/worktree/deploy/ecs/publish-alibaba.ts'),
        false,
    );
});
