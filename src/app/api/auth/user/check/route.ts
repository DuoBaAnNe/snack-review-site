import { NextResponse } from 'next/server';
import { getUserSession } from '@/lib/user-auth';

export async function GET() {
    const session = await getUserSession();
    const res = NextResponse.json({ authenticated: !!session, user: session });
    res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    return res;
}
