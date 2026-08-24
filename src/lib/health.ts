import { createClient } from '@libsql/client';

type HealthClient = Pick<ReturnType<typeof createClient>, 'execute' | 'close'>;
type HealthClientFactory = (config: Parameters<typeof createClient>[0]) => HealthClient;

export type HealthBody = {
    status: 'ok' | 'degraded';
    gitSha: string;
};

export type HealthResult = {
    statusCode: 200 | 503;
    body: HealthBody;
};

export async function probeDatabase(
    createHealthClient: HealthClientFactory = createClient,
): Promise<void> {
    const client = createHealthClient({
        url: process.env.TURSO_DATABASE_URL || 'file:./database/snacks.db',
        authToken: process.env.TURSO_AUTH_TOKEN,
    });

    try {
        await client.execute('SELECT 1');
    } finally {
        client.close();
    }
}

export async function evaluateHealth({
    gitSha,
    checkDatabase,
}: {
    gitSha?: string;
    checkDatabase: () => Promise<void>;
}): Promise<HealthResult> {
    const normalizedGitSha = gitSha?.trim() || 'unknown';

    try {
        await checkDatabase();
        return {
            statusCode: 200,
            body: { status: 'ok', gitSha: normalizedGitSha },
        };
    } catch {
        return {
            statusCode: 503,
            body: { status: 'degraded', gitSha: normalizedGitSha },
        };
    }
}
