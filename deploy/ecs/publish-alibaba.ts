import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, rmdir, writeFile } from 'node:fs/promises';
import { rmdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import {
    buildCommands,
    cloudAssistantIsReady,
    parseConfig,
    parseInvocation,
    parseInvokeId,
    validateReleaseSha,
    type Command,
} from './publish-alibaba-lib';

export type { Command } from './publish-alibaba-lib';

type CommandResult = {
    stdout: string;
    stderr: string;
};

type HealthResponse = {
    status: string;
    gitSha: string;
};

export type PublisherDependencies = {
    exec(command: Command): Promise<CommandResult>;
    readFile(path: string): Promise<string | Uint8Array>;
    writeFile(path: string, content: string | Uint8Array): Promise<void>;
    makeTempDir(): Promise<string>;
    remove(path: string): Promise<void>;
    acquireLock(): Promise<LocalPublishLock>;
    fetchHealth(): Promise<HealthResponse>;
    sleep(milliseconds: number): Promise<void>;
    now(): number;
    warn(message: string): void;
};

export type LocalPublishLock = {
    release(): Promise<void>;
};

export type PublicationResult =
    | { state: 'success'; invokeId: string }
    | { state: 'already-deployed'; invokeId: string }
    | { state: 'rolled-back'; invokeId: string }
    | { state: 'manual-intervention'; invokeId: string }
    | { state: 'timed-out'; invokeId: string };

export type PublishOptions = {
    sha: string;
    configPath?: string;
    pollTimeoutMs?: number;
    pollIntervalMs?: number;
};

const lockPath = join(tmpdir(), 'linglingqi-alibaba-ecs-publisher.lock');
const healthEndpoint = 'https://linglingqi.fun/api/health';
const defaultPollTimeoutMs = 30 * 60 * 1_000;
const defaultPollIntervalMs = 5_000;

export function resolveSpawnCommand(
    command: Command,
    platform = process.platform,
    nodeExecutable = process.execPath,
    npmExecutable = process.env.npm_execpath,
): Command {
    if (platform !== 'win32' || command.file !== 'npm') {
        return command;
    }
    if (!npmExecutable) {
        throw new Error('npm_execpath is required to run npm safely on Windows');
    }
    return {
        file: nodeExecutable,
        args: [npmExecutable, ...command.args],
    };
}

function runCommand(command: Command): Promise<CommandResult> {
    return new Promise((resolveResult, reject) => {
        const resolvedCommand = resolveSpawnCommand(command);
        const child = spawn(resolvedCommand.file, resolvedCommand.args, {
            cwd: process.cwd(),
            shell: false,
            windowsHide: true,
        });
        let stdout = '';
        let stderr = '';
        child.stdout.setEncoding('utf8');
        child.stderr.setEncoding('utf8');
        child.stdout.on('data', (chunk: string) => {
            stdout += chunk;
        });
        child.stderr.on('data', (chunk: string) => {
            stderr += chunk;
        });
        child.once('error', () => {
            reject(new Error(`Could not start required command: ${command.file}`));
        });
        child.once('close', (code) => {
            if (code === 0) {
                resolveResult({ stdout, stderr });
                return;
            }
            reject(new Error(`Required command failed: ${command.file} (exit ${code ?? 'unknown'})`));
        });
    });
}

async function fetchPublicHealth(): Promise<HealthResponse> {
    const response = await fetch(healthEndpoint, {
        headers: { accept: 'application/json' },
    });
    if (!response.ok) {
        throw new Error(`Public health check returned HTTP ${response.status}`);
    }
    const value: unknown = await response.json();
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error('Public health check returned an invalid response');
    }
    const health = value as Record<string, unknown>;
    if (typeof health.status !== 'string' || typeof health.gitSha !== 'string') {
        throw new Error('Public health check omitted status or gitSha');
    }
    return { status: health.status, gitSha: health.gitSha };
}

export async function createLocalPublishLock(name = 'linglingqi-alibaba-ecs-publisher'): Promise<LocalPublishLock> {
    const path = name === 'linglingqi-alibaba-ecs-publisher'
        ? lockPath
        : join(tmpdir(), `${name}.lock`);
    try {
        await mkdir(path);
    } catch (error: unknown) {
        if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'EEXIST') {
            throw new Error('Another Alibaba ECS publisher is already running');
        }
        throw error;
    }

    let released = false;
    const releaseOnExit = () => {
        if (!released) {
            try {
                rmdirSync(path);
            } catch {
                // The lock is only a best-effort process-exit cleanup; ordinary cleanup reports errors.
            }
        }
    };
    process.once('exit', releaseOnExit);

    return {
        async release() {
            if (released) {
                return;
            }
            released = true;
            process.removeListener('exit', releaseOnExit);
            try {
                await rmdir(path);
            } catch (error: unknown) {
                if (!(typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT')) {
                    throw error;
                }
            }
        },
    };
}

function defaultDependencies(): PublisherDependencies {
    return {
        exec: runCommand,
        readFile: async (path) => readFile(path),
        writeFile: async (path, content) => writeFile(path, content),
        makeTempDir: async () => mkdtemp(join(tmpdir(), 'linglingqi-ecs-release-')),
        remove: async (path) => rm(path, { recursive: true, force: true }),
        acquireLock: () => createLocalPublishLock(),
        fetchHealth: fetchPublicHealth,
        sleep: async (milliseconds) => new Promise((resolveSleep) => setTimeout(resolveSleep, milliseconds)),
        now: () => Date.now(),
        warn: (message) => console.warn(message),
    };
}

function assertOnlyIgnoredLocalChanges(status: string): void {
    const entries = status.split(/\r?\n/).filter(Boolean);
    const disallowed = entries.filter((entry) => {
        const path = entry.slice(3);
        return !path.startsWith('.superpowers/') || path.includes(' -> ');
    });
    if (disallowed.length > 0) {
        throw new Error('Refusing to publish with uncommitted changes outside .superpowers/');
    }
}

function asText(value: string | Uint8Array): string {
    return typeof value === 'string' ? value : Buffer.from(value).toString('utf8');
}

function isAlreadyDeployed(output: string, sha: string): boolean {
    return output.includes(`Already deployed and verified ${sha}`);
}

function rollbackSucceeded(output: string, releaseSha: string): boolean {
    return new RegExp(`(?:^|\\r?\\n)Rollback restored and verified ${releaseSha}\\.(?:\\r?$|\\r?\\n)`).test(output);
}

function parseRequestReleaseSha(requestManifest: string): string {
    let value: unknown;
    try {
        value = JSON.parse(requestManifest);
    } catch {
        throw new Error('The current OSS request is not valid JSON');
    }
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error('The current OSS request is not an object');
    }
    const request = value as Record<string, unknown>;
    if (Object.keys(request).length !== 1 || typeof request.releaseSha !== 'string') {
        throw new Error('The current OSS request does not have exactly one releaseSha');
    }
    return validateReleaseSha(request.releaseSha);
}

async function cleanSuccessfulRelease(
    commands: ReturnType<typeof buildCommands>,
    releaseDirectory: string,
    releaseSha: string,
    dependencies: PublisherDependencies,
): Promise<void> {
    let confirmedReleaseSha: string;
    try {
        await dependencies.exec(commands.downloadRequestForConfirmation);
        confirmedReleaseSha = parseRequestReleaseSha(asText(await dependencies.readFile(`${releaseDirectory}/request-confirm.json`)));
    } catch {
        dependencies.warn('Could not safely confirm the current OSS request, so it and this release’s artifacts were retained.');
        return;
    }

    if (confirmedReleaseSha === releaseSha) {
        try {
            await dependencies.exec(commands.deleteRequest);
        } catch {
            dependencies.warn('Could not remove this release’s matching OSS request, so it and this release’s artifacts were retained.');
            return;
        }
    } else {
        dependencies.warn('The current OSS request names another valid release and was retained.');
    }

    for (const command of [commands.deleteBundle, commands.deleteChecksum]) {
        try {
            await dependencies.exec(command);
        } catch {
            dependencies.warn('Could not remove this release’s immutable OSS artifact; lifecycle cleanup will retain it temporarily.');
        }
    }
}

export async function publishAlibabaRelease(
    options: PublishOptions,
    providedDependencies?: Partial<PublisherDependencies>,
): Promise<PublicationResult> {
    const dependencies = { ...defaultDependencies(), ...providedDependencies };
    const releaseSha = validateReleaseSha(options.sha);
    const lock = await dependencies.acquireLock();
    let releaseDirectory: string | undefined;
    let commands: ReturnType<typeof buildCommands> | undefined;
    let tagCreated = false;

    try {
        const configPath = options.configPath ?? resolve(process.cwd(), 'deploy/ecs/alibaba-deployment.local.json');
        const config = parseConfig(asText(await dependencies.readFile(configPath)));
        const head = (await dependencies.exec({ file: 'git', args: ['rev-parse', 'HEAD'] })).stdout.trim();
        if (head !== releaseSha) {
            throw new Error('Requested SHA must exactly equal git HEAD');
        }
        assertOnlyIgnoredLocalChanges((await dependencies.exec({ file: 'git', args: ['status', '--porcelain=v1'] })).stdout);

        releaseDirectory = await dependencies.makeTempDir();
        commands = buildCommands(config, releaseSha, releaseDirectory);
        for (const command of commands.tests) {
            await dependencies.exec(command);
        }
        await dependencies.exec(commands.build);
        await dependencies.exec(commands.createTag);
        tagCreated = true;
        await dependencies.exec(commands.createBundle);

        const bundle = await dependencies.readFile(`${releaseDirectory}/source.bundle`);
        const checksum = createHash('sha256').update(bundle).digest('hex');
        await dependencies.writeFile(`${releaseDirectory}/source.bundle.sha256`, `${checksum}  source.bundle\n`);
        await dependencies.exec(commands.uploadBundle);
        await dependencies.exec(commands.uploadChecksum);

        const requestManifest = JSON.stringify({ releaseSha });
        await dependencies.writeFile(`${releaseDirectory}/request.json`, requestManifest);
        await dependencies.exec(commands.uploadRequest);

        const assistantStatus = await dependencies.exec(commands.describeCloudAssistant);
        if (!cloudAssistantIsReady(assistantStatus.stdout, config.instanceId)) {
            throw new Error('The pinned ECS instance does not have a ready Cloud Assistant agent');
        }

        const invocation = await dependencies.exec(commands.invoke);
        const invokeId = parseInvokeId(invocation.stdout);
        const startedAt = dependencies.now();
        const timeout = options.pollTimeoutMs ?? defaultPollTimeoutMs;
        const interval = options.pollIntervalMs ?? defaultPollIntervalMs;

        while (true) {
            const status = parseInvocation((await dependencies.exec(commands.describeInvocation(invokeId))).stdout);
            if (status.state === 'running') {
                if (dependencies.now() - startedAt >= timeout) {
                    dependencies.warn(`Cloud Assistant invocation ${invokeId} is still running or timed out; OSS artifacts were retained for this same invocation.`);
                    return { state: 'timed-out', invokeId };
                }
                await dependencies.sleep(interval);
                continue;
            }
            if (status.state === 'failed') {
                return rollbackSucceeded(status.output, releaseSha)
                    ? { state: 'rolled-back', invokeId }
                    : { state: 'manual-intervention', invokeId };
            }

            let health: HealthResponse;
            try {
                health = await dependencies.fetchHealth();
            } catch {
                dependencies.warn('The public health endpoint could not be verified; OSS artifacts were retained for diagnosis.');
                return { state: 'manual-intervention', invokeId };
            }
            if (health.status !== 'ok' || health.gitSha !== releaseSha) {
                dependencies.warn('The public health response did not match the requested SHA; OSS artifacts were retained for diagnosis.');
                return { state: 'manual-intervention', invokeId };
            }

            await cleanSuccessfulRelease(commands, releaseDirectory, releaseSha, dependencies);
            return isAlreadyDeployed(status.output, releaseSha)
                ? { state: 'already-deployed', invokeId }
                : { state: 'success', invokeId };
        }
    } finally {
        if (commands && tagCreated) {
            try {
                await dependencies.exec(commands.deleteTag);
            } catch {
                dependencies.warn('Could not remove the temporary Git release tag.');
            }
        }
        if (releaseDirectory) {
            try {
                await dependencies.remove(releaseDirectory);
            } catch {
                dependencies.warn('Could not remove the local temporary release directory.');
            }
        }
        await lock.release();
    }
}

function parseCommandLine(argv: string[]): PublishOptions {
    if (argv.length !== 2 || argv[0] !== '--sha') {
        throw new Error('Usage: npm run deploy:aliyun -- --sha <full-lowercase-git-sha>');
    }
    return { sha: argv[1] };
}

async function main(): Promise<void> {
    const result = await publishAlibabaRelease(parseCommandLine(process.argv.slice(2)));
    switch (result.state) {
        case 'success':
            console.log(`Alibaba ECS release completed: ${result.invokeId}`);
            return;
        case 'already-deployed':
            console.log(`Alibaba ECS already served this release: ${result.invokeId}`);
            return;
        case 'rolled-back':
            console.log(`Alibaba ECS reported a completed rollback: ${result.invokeId}`);
            process.exitCode = 1;
            return;
        case 'manual-intervention':
            console.error(`Alibaba ECS release needs manual intervention: ${result.invokeId}`);
            process.exitCode = 1;
            return;
        case 'timed-out':
            console.error(`Alibaba ECS invocation is still pending or timed out: ${result.invokeId}`);
            process.exitCode = 1;
            return;
    }
}

export function isEntryPoint(argumentPath: string | undefined, moduleUrl: string): boolean {
    if (!argumentPath) {
        return false;
    }
    return resolve(argumentPath) === resolve(fileURLToPath(moduleUrl));
}

if (isEntryPoint(process.argv[1], import.meta.url)) {
    void main().catch((error: unknown) => {
        const message = error instanceof Error ? error.message : 'Unknown deployment failure';
        console.error(`Alibaba ECS release was not started or completed: ${message}`);
        process.exitCode = 1;
    });
}
