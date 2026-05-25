import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { createImage } from '@/lib/db';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads');
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

export async function POST(request: Request) {
    const session = await getSession();
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!fs.existsSync(UPLOAD_DIR)) {
        fs.mkdirSync(UPLOAD_DIR, { recursive: true });
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

        const ext = path.extname(file.name) || '.jpg';
        const filename = `${randomUUID()}${ext}`;
        const buffer = Buffer.from(await file.arrayBuffer());
        fs.writeFileSync(path.join(UPLOAD_DIR, filename), buffer);

        const image = await createImage(filename, file.name);
        results.push(image);
    }

    return NextResponse.json({ images: results });
}
