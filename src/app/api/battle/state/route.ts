import { NextResponse } from 'next/server';
import { getBattleState } from '@/lib/war/store';

export const dynamic = 'force-dynamic';

// Read-only snapshot of the war (also lazily rotates an expired season).
export async function GET() {
    try {
        const state = await getBattleState();
        return NextResponse.json(state);
    } catch (e: any) {
        console.error('[battle-state]', e?.message || e);
        return NextResponse.json({ error: '读取战况失败' }, { status: 500 });
    }
}
