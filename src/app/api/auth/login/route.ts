import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getUserByUsername } from '@/lib/db';
import { createSessionToken } from '@/lib/auth';

export async function POST(request: Request) {
    const { username, password } = await request.json();

    const user = await getUserByUsername(username);
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
        return NextResponse.json({ success: false, error: 'Invalid credentials' }, { status: 401 });
    }

    const token = await createSessionToken(username);
    const response = NextResponse.json({ success: true });
    response.cookies.set('snack_admin_session', token, {
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 7, // 7 days
    });
    return response;
}
