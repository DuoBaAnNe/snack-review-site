'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface UserInfo {
    id: number;
    email: string;
    username: string;
}

export default function HeaderButtons() {
    const router = useRouter();
    const [user, setUser] = useState<UserInfo | null | undefined>(undefined);

    useEffect(() => {
        fetch('/api/auth/user/check')
            .then(res => res.json())
            .then(data => {
                setUser(data.authenticated ? data.user : null);
            })
            .catch(() => setUser(null));
    }, []);

    async function handleLogout() {
        await fetch('/api/auth/user/logout', { method: 'POST' });
        setUser(null);
        router.refresh();
    }

    if (user === undefined) return null;

    return (
        <div className="flex items-center justify-between px-4 py-2 bg-gradient-to-r from-amber-100/60 via-orange-50/60 to-rose-100/60 border-b border-orange-100">
            <div className="flex items-center gap-2 flex-wrap">
                <Link
                    href="/"
                    className="px-3 py-1 rounded-full bg-white/70 text-gray-600 hover:text-orange-500 border border-gray-200 transition-colors text-sm"
                >
                    返回首页
                </Link>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
                {user ? (
                    <>
                        <span className="text-sm text-gray-600 font-medium">{user.username}</span>
                        <Link
                            href="/add-snack"
                            className="px-3 py-1 rounded-full bg-white/70 text-orange-500 hover:text-orange-600 border border-orange-200 transition-colors text-sm"
                        >
                            添加零食
                        </Link>
                        <button
                            onClick={handleLogout}
                            className="px-3 py-1 rounded-full bg-white/70 text-gray-500 hover:text-red-500 border border-gray-200 transition-colors text-sm cursor-pointer"
                        >
                            退出
                        </button>
                    </>
                ) : (
                    <>
                        <button
                            onClick={() => { router.push('/login'); router.refresh(); }}
                            className="px-3 py-1 rounded-full bg-white/70 text-gray-600 hover:text-orange-500 border border-gray-200 transition-colors text-sm cursor-pointer"
                        >
                            登录
                        </button>
                        <button
                            onClick={() => { router.push('/login?register=true'); router.refresh(); }}
                            className="px-3 py-1 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 text-white hover:opacity-90 transition-opacity text-sm cursor-pointer"
                        >
                            注册
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}
