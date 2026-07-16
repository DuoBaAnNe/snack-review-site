import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { createUser, getUserByEmail, canRegisterFromIp } from '@/lib/db';
import { createUserToken, userCookieName } from '@/lib/user-auth';
import { rateLimit, getClientIp } from '@/lib/rate-limit';

export async function POST(request: Request) {
    // Attempt throttling: max 10 register attempts per IP per hour
    // (the 1-account-per-IP-per-day rule below still applies on success)
    const ip = getClientIp(request);
    if (!rateLimit(`register:${ip}`, 10, 60 * 60 * 1000)) {
        return NextResponse.json({ error: '操作过于频繁，请稍后再试' }, { status: 429 });
    }

    const { email, username, password } = await request.json();

    if (!email || !username || !password) {
        return NextResponse.json({ error: '所有字段都是必填的' }, { status: 400 });
    }
    if (password.length < 6) {
        return NextResponse.json({ error: '密码至少需要6位' }, { status: 400 });
    }

    const existing = await getUserByEmail(email);
    if (existing) {
        return NextResponse.json({ error: '该邮箱已注册' }, { status: 409 });
    }

    // IP rate limiting: 1 registration per IP per 24 hours
    const canRegister = await canRegisterFromIp(ip);
    if (!canRegister) {
        return NextResponse.json({ error: '该IP今日已注册，请24小时后再试' }, { status: 429 });
    }

    const passwordHash = bcrypt.hashSync(password, 10);
    const userId = await createUser(email, username, passwordHash, ip);

    const token = await createUserToken({ id: userId, email, username });
    const res = NextResponse.json({ id: userId, email, username }, { status: 201 });
    res.cookies.set(userCookieName(), token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7,
        path: '/',
    });
    return res;
}
