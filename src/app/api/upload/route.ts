import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getUserSession } from '@/lib/user-auth';
import { createImage } from '@/lib/db';
import { rateLimit } from '@/lib/rate-limit';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_FILES_PER_REQUEST = 10;
const MAX_FILES_PER_DAY = 40;

export async function POST(request: Request) {
    const adminSession = await getSession();
    const userSession = !adminSession ? await getUserSession() : null;
    const session = adminSession || userSession;
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const files = formData.getAll('images') as File[];

    if (files.length === 0) {
        return NextResponse.json({ error: 'No images provided' }, { status: 400 });
    }
    if (files.length > MAX_FILES_PER_REQUEST) {
        return NextResponse.json({ error: `一次最多上传${MAX_FILES_PER_REQUEST}张图片` }, { status: 400 });
    }

    // Daily quota per account (admins included — protects the database)
    if (!rateLimit(`upload:${session.username}`, MAX_FILES_PER_DAY, 24 * 60 * 60 * 1000, files.length)) {
        return NextResponse.json({ error: '今日上传图片数量已达上限' }, { status: 429 });
    }

    const results = [];

    for (const file of files) {
        if (!ALLOWED_TYPES.includes(file.type)) {
            return NextResponse.json(
                { error: `Invalid file type: ${file.type}` },
                { status: 400 }
            );
        }
        if (file.size > MAX_SIZE) {
            return NextResponse.json(
                { error: `File too large: ${file.name}. Max 10MB` },
                { status: 400 }
            );
        }

        try {
            const buffer = Buffer.from(await file.arrayBuffer());
            const base64Data = buffer.toString('base64');

            const image = await createImage(file.name, base64Data, file.type);
            const { data: _, ...meta } = image;
            results.push(meta);
        } catch (e: any) {
            console.error('Upload error:', e);
            return NextResponse.json(
                { error: '上传失败，请稍后重试' },
                { status: 500 }
            );
        }
    }

    return NextResponse.json({ images: results });
}
