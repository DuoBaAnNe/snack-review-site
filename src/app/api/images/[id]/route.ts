import { NextResponse } from 'next/server';
import { getImageById } from '@/lib/db';

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
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
