import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { createImage } from '@/lib/db';
import { put } from '@vercel/blob';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads');
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB
const USE_BLOB = !!process.env.BLOB_READ_WRITE_TOKEN;

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
                { error: `Invalid file type: ${file.type}. Allowed: JPEG, PNG, WebP` },
                { status: 400 }
            );
        }
        if (file.size > MAX_SIZE) {
            return NextResponse.json(
                { error: `File too large: ${file.name}. Max 10MB` },
                { status: 400 }
            );
        }

        const ext = file.name.includes('.') ? file.name.split('.').pop() || 'jpg' : 'jpg';

        if (USE_BLOB) {
            const blobPath = `snack-images/${randomUUID()}.${ext}`;
            const blob = await put(blobPath, file, {
                access: 'public',
                addRandomSuffix: false,
            });
            const image = await createImage(blob.url, file.name);
            results.push(image);
        } else {
            // Local filesystem fallback for dev
            if (!fs.existsSync(UPLOAD_DIR)) {
                fs.mkdirSync(UPLOAD_DIR, { recursive: true });
            }
            const filename = `${randomUUID()}.${ext}`;
            const buffer = Buffer.from(await file.arrayBuffer());
            fs.writeFileSync(path.join(UPLOAD_DIR, filename), buffer);
            const image = await createImage(`/uploads/${filename}`, file.name);
            results.push(image);
        }
    }

    return NextResponse.json({ images: results });
}
