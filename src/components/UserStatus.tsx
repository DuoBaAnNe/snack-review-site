'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

export default function UserStatus() {
    const [session, setSession] = useState<{ username: string } | null | undefined>(undefined);

    const check = useCallback(async () => {
        const res = await fetch('/api/auth/user/check');
        const data = await res.json();
        setSession(data.authenticated ? data.user : null);
    }, []);

    useEffect(() => { check(); }, [check]);

    async function logout() {
        await fetch('/api/auth/user/logout', { method: 'POST' });
        setSession(null);
    }

    if (session === undefined) return null;

    return (
        <div className="absolute top-2 right-2 md:top-3 md:right-4 z-20 flex items-center gap-1 md:gap-2">
            {session ? (
                <>
                    <span className="text-xs text-gray-500">{session.username}</span>
                    <button
                        onClick={logout}
                        className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                    >
                        退出
                    </button>
                </>
            ) : (
                <Link
                    href="/login"
                    className="text-xs px-3 py-1 rounded-full bg-white/70 text-gray-500 hover:text-orange-500 border border-gray-200 transition-colors"
                >
                    登录
                </Link>
            )}
        </div>
    );
}
