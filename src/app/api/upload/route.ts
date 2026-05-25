import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { createImage } from '@/lib/db';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

export async function POST(request: Request) {
    const session = await getSession();
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const files = formData.getAll('images') as File[];

    if (files.length === 0) {
        return NextResponse.json({ error: 'No images provided' }, { status: 400 });
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
            results.push(image);
        } catch (e: any) {
            console.error('Upload error:', e);
            return NextResponse.json(
                { error: `Upload failed: ${e.message || 'Unknown error'}` },
                { status: 500 }
            );
        }
    }

    return NextResponse.json({ images: results });
}
