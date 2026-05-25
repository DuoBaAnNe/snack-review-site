import { jwtVerify, SignJWT } from 'jose';
import { cookies } from 'next/headers';

const SECRET = new TextEncoder().encode(
    process.env.SESSION_SECRET || 'fallback-dev-secret-change-me'
);

export async function getSession(): Promise<{ username: string } | null> {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('snack_admin_session')?.value;
        if (!token) return null;
        const { payload } = await jwtVerify(token, SECRET);
        return { username: payload.username as string };
    } catch {
        return null;
    }
}

export async function createSessionToken(username: string): Promise<string> {
    return new SignJWT({ username })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('7d')
        .sign(SECRET);
}
