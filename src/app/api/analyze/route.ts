import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { analyzeSnackImage } from '@/lib/ai';

export async function POST(request: Request) {
    const session = await getSession();
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { base64Data, mimeType } = await request.json();
    if (!base64Data) {
        return NextResponse.json({ error: 'base64Data is required' }, { status: 400 });
    }

    try {
        const result = await analyzeSnackImage(base64Data, mimeType || 'image/jpeg');
        return NextResponse.json(result);
    } catch (error) {
        // Log the details server-side only — do not leak internals to the client
        console.error('AI analysis failed:', error);
        return NextResponse.json(
            { error: 'AI 识别失败，请稍后重试' },
            { status: 500 }
        );
    }
}
