import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { analyzeSnackImage } from '@/lib/ai';

export async function POST(request: Request) {
    const session = await getSession();
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { imageFilename } = await request.json();
    if (!imageFilename) {
        return NextResponse.json({ error: 'imageFilename is required' }, { status: 400 });
    }

    try {
        const result = await analyzeSnackImage(imageFilename);
        return NextResponse.json(result);
    } catch (error) {
        return NextResponse.json(
            { error: 'AI analysis failed', details: String(error) },
            { status: 500 }
        );
    }
}
