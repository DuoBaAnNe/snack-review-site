import { jwtVerify, SignJWT } from 'jose';
import { cookies } from 'next/headers';

const SECRET = new TextEncoder().encode(
    process.env.SESSION_SECRET || 'fallback-dev-secret-change-me'
);

const COOKIE_NAME = 'snack_user_session';

export interface UserSession {
    id: number;
    email: string;
    username: string;
}

export async function getUserSession(): Promise<UserSession | null> {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get(COOKIE_NAME)?.value;
        if (!token) return null;
        const { payload } = await jwtVerify(token, SECRET);
        return {
            id: payload.id as number,
            email: payload.email as string,
            username: payload.username as string,
        };
    } catch {
        return null;
    }
}

export async function createUserToken(session: UserSession): Promise<string> {
    return new SignJWT({ id: session.id, email: session.email, username: session.username })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('7d')
        .sign(SECRET);
}

export function userCookieName() {
    return COOKIE_NAME;
}
