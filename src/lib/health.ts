export type HealthBody = {
    status: 'ok' | 'degraded';
    gitSha: string;
};

export type HealthResult = {
    statusCode: 200 | 503;
    body: HealthBody;
};

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
