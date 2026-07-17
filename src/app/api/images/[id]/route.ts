import { NextResponse } from 'next/server';
import { getDb, getImageById } from '@/lib/db';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

    // ?cutout=1 serves the background-removed PNG (404 lets the frontend
    // degrade to the normal photo)
    const wantCutout = new URL(request.url).searchParams.get('cutout') === '1';
    if (wantCutout) {
        const db = await getDb();
        const result = await db.execute(
            'SELECT cutout FROM snack_images WHERE id = ?',
            [Number(id)]
        );
        const cutout = (result.rows[0]?.cutout as string) || '';
        if (!cutout) {
            return new NextResponse('No cutout', { status: 404 });
        }
        return new NextResponse(Buffer.from(cutout, 'base64'), {
            status: 200,
            headers: {
                'Content-Type': 'image/png',
                'Cache-Control': 'public, max-age=31536000, s-maxage=31536000, immutable',
            },
        });
    }

    const image = await getImageById(Number(id));
    if (!image) {
        return new NextResponse('Not found', { status: 404 });
    }

    const buffer = Buffer.from(image.data, 'base64');
    return new NextResponse(buffer, {
        status: 200,
        headers: {
            'Content-Type': image.mime_type,
            // max-age: browser cache; s-maxage: Vercel edge cache (serves
            // repeat requests from a nearby PoP instead of the US function)
            'Cache-Control': 'public, max-age=31536000, s-maxage=31536000, immutable',
        },
    });
}
