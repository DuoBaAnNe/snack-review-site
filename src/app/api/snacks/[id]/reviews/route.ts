import { NextResponse } from 'next/server';
import { getReviewsBySnackId, createReview, getUserById } from '@/lib/db';
import { getUserSession } from '@/lib/user-auth';

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

    const { id } = await params;
    const body = await request.json();

    if (!body.review_text?.trim()) {
        return NextResponse.json({ error: '评测内容不能为空' }, { status: 400 });
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
