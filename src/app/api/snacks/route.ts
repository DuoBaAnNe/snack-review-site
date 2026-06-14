import { NextResponse } from 'next/server';
import { getAllSnacks, createSnack } from '@/lib/db';
import { getSession } from '@/lib/auth';
import type { CreateSnackInput } from '@/types';

export async function GET() {
    const snacks = await getAllSnacks();
    return NextResponse.json(snacks);
}

export async function POST(request: Request) {
    const session = await getSession();
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    try {
        const input: CreateSnackInput = await request.json();
        const snack = await createSnack(input);
        return NextResponse.json(snack, { status: 201 });
    } catch (e: any) {
        console.error('POST /api/snacks error:', e.message, e);
        return NextResponse.json({ error: e.message || 'Server error' }, { status: 500 });
    }
}
