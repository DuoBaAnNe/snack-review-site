import { NextResponse } from 'next/server';
import { getSnackById, updateSnack, deleteSnack, restoreSnack } from '@/lib/db';
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
        // Log details server-side only — do not leak internals to the client
        console.error('PUT /api/snacks/[id] error:', e.message, e);
        return NextResponse.json({ error: '服务器错误，请稍后重试' }, { status: 500 });
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

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const adminSession = await getSession();
    if (!adminSession) {
        return NextResponse.json({ error: '仅管理员可恢复' }, { status: 403 });
    }
    const { id } = await params;
    const restored = await restoreSnack(parseInt(id));
    if (!restored) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
}
