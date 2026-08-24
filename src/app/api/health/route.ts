import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { evaluateHealth } from '@/lib/health';

export const dynamic = 'force-dynamic';

export async function GET() {
    const result = await evaluateHealth({
        gitSha: process.env.APP_GIT_SHA || process.env.VERCEL_GIT_COMMIT_SHA,
        checkDatabase: async () => {
            const db = await getDb();
            await db.execute('SELECT 1');
        },
    });

    return NextResponse.json(result.body, {
        status: result.statusCode,
        headers: { 'Cache-Control': 'no-store' },
    });
}
