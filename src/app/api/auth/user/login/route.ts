import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getUserByEmail } from '@/lib/db';
import { createUserToken, userCookieName } from '@/lib/user-auth';
import { rateLimit, getClientIp } from '@/lib/rate-limit';

export async function POST(request: Request) {
    // Brute-force protection: max 10 attempts per IP per 15 minutes
    const ip = getClientIp(request);
    if (!rateLimit(`user-login:${ip}`, 10, 15 * 60 * 1000)) {
        return NextResponse.json({ error: '尝试次数过多，请15分钟后再试' }, { status: 429 });
    }

    const { email, password } = await request.json();

    if (!email || !password) {
        return NextResponse.json({ error: '邮箱和密码都是必填的' }, { status: 400 });
    }

    const user = await getUserByEmail(email);
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
        return NextResponse.json({ error: '邮箱或密码错误' }, { status: 401 });
    }

    const token = await createUserToken({ id: user.id, email: user.email, username: user.username });
    const res = NextResponse.json({ id: user.id, email: user.email, username: user.username });
    res.cookies.set(userCookieName(), token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7,
        path: '/',
    });
    return res;
}
