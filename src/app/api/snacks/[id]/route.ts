import { NextResponse } from 'next/server';
import { getSnackById, updateSnack, deleteSnack } from '@/lib/db';
import { getSession } from '@/lib/auth';
import type { CreateSnackInput } from '@/types';

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const snack = await getSnackById(parseInt(id));
    if (!snack) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json(snack);
}

export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getSession();
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { id } = await params;
    const input: CreateSnackInput = await request.json();
    const snack = await updateSnack(parseInt(id), input);
    if (!snack) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json(snack);
}

export async function DELETE(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getSession();
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { id } = await params;
    const deleted = await deleteSnack(parseInt(id));
    if (!deleted) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
}
