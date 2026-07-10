import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getUserByUsername, getDb } from '@/lib/db';
import { createSessionToken } from '@/lib/auth';
import { rateLimit, getClientIp } from '@/lib/rate-limit';

// Can be overridden without a code change by setting ADMIN_PASSWORD_HASH
const ADMIN_HASH = process.env.ADMIN_PASSWORD_HASH
    || '$2b$10$SzkjFVgLmN60pMEaukJXG.7kLjmoDRDYapAjrQ6BBQzb3Wtlabj3G';

export async function POST(request: Request) {
    // Brute-force protection: max 10 attempts per IP per 15 minutes
    const ip = getClientIp(request);
    if (!rateLimit(`admin-login:${ip}`, 10, 15 * 60 * 1000)) {
        return NextResponse.json(
            { success: false, error: '尝试次数过多，请15分钟后再试' },
            { status: 429 }
        );
    }

    const { username, password } = await request.json();

    const db = await getDb();
    let user = await getUserByUsername(username);

    // Auto-create admin if missing
    if (!user && (username === '西瓜Naive' || username === 'admin')) {
        const check = await db.execute("SELECT id FROM admin_users WHERE id = 1");
        if (check.rows.length === 0) {
            await db.execute("INSERT INTO admin_users (id, username, password_hash) VALUES (1, '西瓜Naive', ?)", [ADMIN_HASH]);
        } else {
            await db.execute("UPDATE admin_users SET username = '西瓜Naive', password_hash = ? WHERE id = 1", [ADMIN_HASH]);
        }
        const result = await db.execute("SELECT * FROM admin_users WHERE username = '西瓜Naive'");
        if (result.rows.length > 0) {
            const row = result.rows[0];
            user = { id: row.id as number, username: row.username as string, password_hash: row.password_hash as string };
        }
    }

    // One unified message — do not reveal whether the username exists
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
        return NextResponse.json({ success: false, error: '用户名或密码错误' }, { status: 401 });
    }

    const token = await createSessionToken(username);
    const response = NextResponse.json({ success: true });
    response.cookies.set('snack_admin_session', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 7,
    });
    return response;
}
