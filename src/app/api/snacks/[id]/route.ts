import { NextResponse } from 'next/server';
import { getSnackById, updateSnack, deleteSnack } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { getUserSession } from '@/lib/user-auth';
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
    const adminSession = await getSession();
    const userSession = !adminSession ? await getUserSession() : null;
    const username = adminSession?.username || userSession?.username;
    const isAdmin = !!adminSession;

    if (!username) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { id } = await params;
        const snackId = parseInt(id);

        // Admin can edit anything; user can only edit their own
        if (!isAdmin) {
            const existing = await getSnackById(snackId);
            if (!existing) {
                return NextResponse.json({ error: 'Not found' }, { status: 404 });
            }
            if (existing.created_by !== username) {
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
            }
        }

        const input: CreateSnackInput = await request.json();
        const snack = await updateSnack(snackId, input);
        if (!snack) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }
        return NextResponse.json(snack);
    } catch (e: any) {
        console.error('PUT /api/snacks/[id] error:', e.message, e);
        return NextResponse.json({ error: e.message || 'Server error' }, { status: 500 });
    }
}

export async function DELETE(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const adminSession = await getSession();
    const userSession = !adminSession ? await getUserSession() : null;
    const username = adminSession?.username || userSession?.username;
    const isAdmin = !!adminSession;

    if (!username) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const snackId = parseInt(id);

    if (!isAdmin) {
        const existing = await getSnackById(snackId);
        if (!existing) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }
        if (existing.created_by !== username) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
    }

    const deleted = await deleteSnack(snackId);
    if (!deleted) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
}
