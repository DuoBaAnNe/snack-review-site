import { NextResponse } from 'next/server';
import { getReviewsBySnackId, createReview, deleteReview, getUserById } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { getUserSession } from '@/lib/user-auth';
import { rateLimit } from '@/lib/rate-limit';

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const reviews = await getReviewsBySnackId(parseInt(id));
    const reviewsWithUsers = await Promise.all(
        reviews.map(async (r) => {
            const user = await getUserById(r.user_id);
            return { ...r, username: user?.username || '匿名' };
        })
    );
    return NextResponse.json(reviewsWithUsers);
}

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const userSession = await getUserSession();
    if (!userSession) {
        return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }

    // Spam protection: max 20 reviews per user per day
    if (!rateLimit(`review:${userSession.id}`, 20, 24 * 60 * 60 * 1000)) {
        return NextResponse.json({ error: '今日评论已达上限，明天再来吧' }, { status: 429 });
    }

    const { id } = await params;
    const body = await request.json();

    if (!body.review_text?.trim()) {
        return NextResponse.json({ error: '评测内容不能为空' }, { status: 400 });
    }
    if (body.review_text.length > 2000) {
        return NextResponse.json({ error: '评测内容过长（最多2000字）' }, { status: 400 });
    }

    const ratings = {
        taste: body.rating_taste_health ?? 5,
        ingredients: body.rating_ingredients_health ?? 5,
        packaging: body.rating_packaging_portability ?? 5,
        useCase: body.rating_use_case ?? 5,
        value: body.rating_value ?? 5,
    };

    const review = await createReview(userSession.id, parseInt(id), ratings, body.review_text);
    return NextResponse.json({ ...review, username: userSession.username }, { status: 201 });
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const adminSession = await getSession();
    if (!adminSession) {
        return NextResponse.json({ error: '仅管理员可删除评论' }, { status: 403 });
    }

    const url = new URL(request.url);
    const reviewId = parseInt(url.searchParams.get('reviewId') || '0');
    if (!reviewId) {
        return NextResponse.json({ error: '缺少 reviewId' }, { status: 400 });
    }

    const deleted = await deleteReview(reviewId);
    if (!deleted) {
        return NextResponse.json({ error: '评论不存在' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
}
