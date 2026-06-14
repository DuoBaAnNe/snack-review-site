import { NextResponse } from 'next/server';
import { getAllSnacks, createSnack, countUserSnacksToday } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { getUserSession } from '@/lib/user-auth';
import type { CreateSnackInput } from '@/types';

export async function GET() {
    const snacks = await getAllSnacks();
    return NextResponse.json(snacks);
}

export async function POST(request: Request) {
    const adminSession = await getSession();
    const userSession = !adminSession ? await getUserSession() : null;
    const session = adminSession || userSession;
    const isAdmin = !!adminSession;

    if (!session) {
        return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }

    try {
        const input: CreateSnackInput = await request.json();

        // Validate required fields for non-admin users
        if (!isAdmin) {
            if (!input.image_ids || input.image_ids.length === 0) {
                return NextResponse.json({ error: '请至少上传一张图片' }, { status: 400 });
            }
            if (!input.brand_name?.trim()) {
                return NextResponse.json({ error: '品牌名称不能为空' }, { status: 400 });
            }
            if (!input.product_name?.trim()) {
                return NextResponse.json({ error: '产品名称不能为空' }, { status: 400 });
            }

            const todayCount = await countUserSnacksToday(session.username);
            if (todayCount >= 10) {
                return NextResponse.json({ error: '今日上传已达上限（10款）' }, { status: 429 });
            }
        }

        const createdBy = session.username;
        const snack = await createSnack(input, createdBy);
        return NextResponse.json(snack, { status: 201 });
    } catch (e: any) {
        console.error('POST /api/snacks error:', e.message, e);
        return NextResponse.json({ error: e.message || 'Server error' }, { status: 500 });
    }
}
