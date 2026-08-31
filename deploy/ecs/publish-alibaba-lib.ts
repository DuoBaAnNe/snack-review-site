import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

export type DeployConfig = {
    regionId: 'cn-shenzhen';
    instanceId: 'i-wz9doghzi13squhaxb6t';
    bucket: string;
    objectPrefix: 'ecs-releases';
    commandId: string;
    aliyunProfile: 'linglingqi-deployer';
};

export type InvocationState =
    | { state: 'running' }
    | { state: 'success'; output: string; exitCode: 0 }
    | { state: 'failed'; output: string; exitCode: number };

export type ObjectKeys = {
    bundleKey: string;
    checksumKey: string;
    requestKey: string;
};

export type Command = {
    file: string;
    args: string[];
};

const expectedConfigKeys = [
    'aliyunProfile',
    'bucket',
    'commandId',
    'instanceId',
    'objectPrefix',
    'regionId',
];

const runningStatuses = new Set(['Pending', 'Running', 'Scheduled', 'Stopping']);
const successfulStatuses = new Set(['Success']);
const failedStatuses = new Set(['Failed', 'Stopped', 'Timeout', 'Cancelled', 'Rejected']);

function parseJson(value: string, context: string): unknown {
    try {
        return JSON.parse(value);
    } catch {
        throw new Error(`${context} must be valid JSON`);
    }
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireString(value: unknown, field: string): string {
    if (typeof value !== 'string' || value.length === 0) {
        throw new Error(`${field} must be a non-empty string`);
    }
    return value;
}

export function parseConfig(json: string): DeployConfig {
    const value = parseJson(json, 'Alibaba deployment config');
    if (!isRecord(value)) {
        throw new Error('Alibaba deployment config must be an object');
    }

    const keys = Object.keys(value).sort();
    if (JSON.stringify(keys) !== JSON.stringify(expectedConfigKeys)) {
        throw new Error('Alibaba deployment config has unexpected fields');
    }

    if (value.regionId !== 'cn-shenzhen') {
        throw new Error('regionId must be cn-shenzhen');
    }
    if (value.instanceId !== 'i-wz9doghzi13squhaxb6t') {
        throw new Error('instanceId is not the pinned production ECS instance');
    }
    if (value.objectPrefix !== 'ecs-releases') {
        throw new Error('objectPrefix must be ecs-releases');
    }
    if (value.aliyunProfile !== 'linglingqi-deployer') {
        throw new Error('aliyunProfile must be linglingqi-deployer');
    }

    const bucket = requireString(value.bucket, 'bucket');
    const commandId = requireString(value.commandId, 'commandId');
    if (!/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(bucket)) {
        throw new Error('bucket has an invalid OSS bucket name');
    }
    if (!/^c-[A-Za-z0-9-]{1,126}$/.test(commandId)) {
        throw new Error('commandId has an invalid Cloud Assistant command id');
    }

    return {
        regionId: 'cn-shenzhen',
        instanceId: 'i-wz9doghzi13squhaxb6t',
        bucket,
        objectPrefix: 'ecs-releases',
        commandId,
        aliyunProfile: 'linglingqi-deployer',
    };
}

export function validateReleaseSha(value: string): string {
    if (!/^[0-9a-f]{40}$/.test(value)) {
        throw new Error('release SHA must be a full lowercase 40-character Git SHA');
    }
    return value;
}

export function buildObjectKeys(config: DeployConfig, sha: string): ObjectKeys {
    const releaseSha = validateReleaseSha(sha);
    return {
        bundleKey: `${config.objectPrefix}/${releaseSha}/source.bundle`,
        checksumKey: `${config.objectPrefix}/${releaseSha}/source.bundle.sha256`,
        requestKey: `${config.objectPrefix}/requests/current.json`,
    };
}

export function parseInvokeId(json: string): string {
    const value = parseJson(json, 'InvokeCommand response');
    if (!isRecord(value) || typeof value.InvokeId !== 'string' || value.InvokeId.length === 0) {
        throw new Error('InvokeCommand response must contain exactly one InvokeId');
    }
    return value.InvokeId;
}

function getSingleInvocation(value: unknown): Record<string, unknown> {
    if (!isRecord(value) || !isRecord(value.Invocations) || !Array.isArray(value.Invocations.Invocation) || value.Invocations.Invocation.length !== 1 || !isRecord(value.Invocations.Invocation[0])) {
        throw new Error('DescribeInvocations response must contain exactly one invocation');
    }
    return value.Invocations.Invocation[0];
}

function getSingleInstance(invocation: Record<string, unknown>): Record<string, unknown> {
    if (!isRecord(invocation.InvokeInstances) || !Array.isArray(invocation.InvokeInstances.InvokeInstance) || invocation.InvokeInstances.InvokeInstance.length !== 1 || !isRecord(invocation.InvokeInstances.InvokeInstance[0])) {
        throw new Error('DescribeInvocations response must contain exactly one instance result');
    }
    return invocation.InvokeInstances.InvokeInstance[0];
}

export function parseInvocation(json: string): InvocationState {
    const invocation = getSingleInvocation(parseJson(json, 'DescribeInvocations response'));
    const instance = getSingleInstance(invocation);
    const status = instance.InvocationStatus ?? invocation.InvocationStatus;
    if (typeof status !== 'string') {
        throw new Error('DescribeInvocations response has no InvocationStatus');
    }
    if (runningStatuses.has(status)) {
        return { state: 'running' };
    }

    const output = typeof instance.Output === 'string' ? instance.Output : '';
    const reportedExitCode = instance.ExitCode;
    const exitCode = typeof reportedExitCode === 'number' && Number.isInteger(reportedExitCode) ? reportedExitCode : undefined;
    if (successfulStatuses.has(status) && exitCode === 0) {
        return { state: 'success', output, exitCode: 0 };
    }
    if (failedStatuses.has(status) || successfulStatuses.has(status)) {
        return { state: 'failed', output, exitCode: exitCode && exitCode !== 0 ? exitCode : 1 };
    }
    throw new Error(`DescribeInvocations returned an unsupported InvocationStatus: ${status}`);
}

function fileBody(path: string): string {
    return pathToFileURL(resolve(path)).href;
}

function profile(config: DeployConfig): string[] {
    return ['--profile', config.aliyunProfile];
}

export function buildCommands(config: DeployConfig, sha: string, releaseDirectory: string): {
    gitHead: Command;
    gitStatus: Command;
    tests: Command[];
    build: Command;
    createTag: Command;
    deleteTag: Command;
    createBundle: Command;
    uploadBundle: Command;
    uploadChecksum: Command;
    uploadRequest: Command;
    describeCloudAssistant: Command;
    invoke: Command;
    describeInvocation: (invokeId: string) => Command;
    downloadRequestForConfirmation: Command;
    deleteBundle: Command;
    deleteChecksum: Command;
    deleteRequest: Command;
} {
    const releaseSha = validateReleaseSha(sha);
    const keys = buildObjectKeys(config, releaseSha);
    const tag = `ecs-release-${releaseSha}`;
    const bundlePath = `${releaseDirectory}/source.bundle`;
    const checksumPath = `${releaseDirectory}/source.bundle.sha256`;
    const requestPath = `${releaseDirectory}/request.json`;
    const requestConfirmationPath = `${releaseDirectory}/request-confirm.json`;
    const ossPut = (key: string, path: string, immutable: boolean): Command => ({
        file: 'ossutil',
        args: [
            'api', 'put-object', '--bucket', config.bucket, '--key', key,
            '--body', fileBody(path),
            ...(immutable ? ['--forbid-overwrite', 'true'] : []),
        ],
    });
    const ossDelete = (key: string): Command => ({
        file: 'ossutil',
        args: ['api', 'delete-object', '--bucket', config.bucket, '--key', key],
    });

    return {
        gitHead: { file: 'git', args: ['rev-parse', 'HEAD'] },
        gitStatus: { file: 'git', args: ['status', '--porcelain=v1'] },
        tests: [
            { file: 'npm', args: ['run', 'test:pagination'] },
            { file: 'npm', args: ['run', 'test:map-panel'] },
            { file: 'npm', args: ['run', 'test:detail-navigation'] },
            { file: 'npm', args: ['run', 'test:deployment'] },
        ],
        build: { file: 'npm', args: ['run', 'build'] },
        createTag: { file: 'git', args: ['tag', tag, releaseSha] },
        deleteTag: { file: 'git', args: ['tag', '--delete', tag] },
        createBundle: { file: 'git', args: ['bundle', 'create', bundlePath, `refs/tags/${tag}`] },
        uploadBundle: ossPut(keys.bundleKey, bundlePath, true),
        uploadChecksum: ossPut(keys.checksumKey, checksumPath, true),
        uploadRequest: ossPut(keys.requestKey, requestPath, false),
        describeCloudAssistant: {
            file: 'aliyun',
            args: [
                'ecs', 'DescribeCloudAssistantStatus', '--RegionId', config.regionId,
                '--InstanceId.1', config.instanceId, ...profile(config),
            ],
        },
        invoke: {
            file: 'aliyun',
            args: [
                'ecs', 'InvokeCommand', '--RegionId', config.regionId,
                '--CommandId', config.commandId,
                '--InstanceId.1', config.instanceId,
                '--RepeatMode', 'Once',
                ...profile(config),
            ],
        },
        describeInvocation: (invokeId) => ({
            file: 'aliyun',
            args: [
                'ecs', 'DescribeInvocations', '--RegionId', config.regionId,
                '--InvokeId', invokeId,
                '--InstanceId', config.instanceId,
                '--IncludeOutput', 'true',
                '--ContentEncoding', 'PlainText',
                ...profile(config),
            ],
        }),
        downloadRequestForConfirmation: {
            file: 'ossutil',
            args: [
                'cp', `oss://${config.bucket}/${keys.requestKey}`, requestConfirmationPath, '--force',
            ],
        },
        deleteBundle: ossDelete(keys.bundleKey),
        deleteChecksum: ossDelete(keys.checksumKey),
        deleteRequest: ossDelete(keys.requestKey),
    };
}

export function cloudAssistantIsReady(json: string, expectedInstanceId: string): boolean {
    const value = parseJson(json, 'DescribeCloudAssistantStatus response');
    if (!isRecord(value) || !isRecord(value.InstanceCloudAssistantStatusSet) || !Array.isArray(value.InstanceCloudAssistantStatusSet.InstanceCloudAssistantStatus)) {
        throw new Error('DescribeCloudAssistantStatus response has an invalid shape');
    }
    const statuses = value.InstanceCloudAssistantStatusSet.InstanceCloudAssistantStatus;
    return statuses.length === 1 && isRecord(statuses[0]) && statuses[0].InstanceId === expectedInstanceId && statuses[0].CloudAssistantStatus === true;
}
