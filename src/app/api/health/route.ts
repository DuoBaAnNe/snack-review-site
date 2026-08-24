import { NextResponse } from 'next/server';
import { evaluateHealth, probeDatabase } from '@/lib/health';

export const dynamic = 'force-dynamic';

export async function GET() {
    const result = await evaluateHealth({
        gitSha: process.env.APP_GIT_SHA || process.env.VERCEL_GIT_COMMIT_SHA,
        checkDatabase: probeDatabase,
    });

    return NextResponse.json(result.body, {
        status: result.statusCode,
        headers: { 'Cache-Control': 'no-store' },
    });
}
