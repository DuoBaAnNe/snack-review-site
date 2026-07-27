import { NextResponse } from 'next/server';
import { likeSnack } from '@/lib/war/store';

// Public, unlimited for now (see spec §5): a like bumps the all-time counter
// and advances the province war if the snack maps to a province.
export async function POST(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const snackId = parseInt(id, 10);
    if (Number.isNaN(snackId)) {
        return NextResponse.json({ error: 'bad id' }, { status: 400 });
    }
    try {
        const { likeCount, province } = await likeSnack(snackId);
        return NextResponse.json({ likeCount, province });
    } catch (e: any) {
        if (/not found/i.test(e?.message || '')) {
            return NextResponse.json({ error: 'snack not found' }, { status: 404 });
        }
        console.error('[like]', e?.message || e);
        return NextResponse.json({ error: '点赞失败，请重试' }, { status: 500 });
    }
}
