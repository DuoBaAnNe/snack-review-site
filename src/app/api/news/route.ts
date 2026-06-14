import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getAllNews, createNews } from '@/lib/db';

export async function GET() {
    const news = await getAllNews();
    return NextResponse.json(news);
}

export async function POST(request: Request) {
    const session = await getSession();
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { title, content, source_url } = await request.json();
    if (!title || !content) {
        return NextResponse.json({ error: 'Title and content are required' }, { status: 400 });
    }

    const news = await createNews(title, content, source_url || '');
    return NextResponse.json(news, { status: 201 });
}
