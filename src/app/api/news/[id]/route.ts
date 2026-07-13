import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { deleteNews, restoreNews } from '@/lib/db';

export async function DELETE(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getSession();
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const deleted = await deleteNews(parseInt(id));
    if (!deleted) {
        return NextResponse.json({ error: 'News not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
}

export async function PATCH(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getSession();
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const restored = await restoreNews(parseInt(id));
    if (!restored) {
        return NextResponse.json({ error: 'News not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
}
