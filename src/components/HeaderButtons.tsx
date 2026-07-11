'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import ThemeToggle from './ThemeToggle';

interface UserInfo {
    id: number;
    email: string;
    username: string;
}

function truncateUsername(name: string): string {
    if (name.length <= 4) return name;
    return name.slice(0, 4) + '...';
}

export default function HeaderButtons() {
    const router = useRouter();
    const pathname = usePathname();
    const [user, setUser] = useState<UserInfo | null | undefined>(undefined);
    const [adminUser, setAdminUser] = useState<string | null | undefined>(undefined);

    useEffect(() => {
        Promise.all([
            fetch('/api/auth/user/check').then(r => r.json()),
            fetch('/api/auth/check').then(r => r.json()),
        ]).then(([userData, adminData]) => {
            setUser(userData.authenticated ? userData.user : null);
            setAdminUser(adminData.authenticated ? '西瓜Naive' : null);
        }).catch(() => {
            setUser(null);
            setAdminUser(null);
        });
    }, [pathname]);

    async function handleUserLogout() {
        await fetch('/api/auth/user/logout', { method: 'POST' });
        setUser(null);
        router.refresh();
    }

    async function handleAdminLogout() {
        await fetch('/api/auth/logout', { method: 'POST' });
        setAdminUser(null);
        router.refresh();
    }

    if (user === undefined && adminUser === undefined) return null;

    const btnBase = 'flex-1 min-w-0 md:min-w-[80px] px-1.5 md:px-3 py-2.5 text-xs md:text-sm font-medium text-center whitespace-nowrap transition-colors border-r border-white/30 last:border-r-0';
    const btnInactive = 'text-amber-900/60 hover:bg-white/20 hover:text-amber-900';

    const isLoggedIn = !!user || !!adminUser;
    const displayName = adminUser || (user ? truncateUsername(user.username) : null);

    return (
        <div className="flex flex-nowrap overflow-x-auto bg-gradient-to-b from-amber-100/60 via-orange-50/60 to-rose-100/60">
            <button
                onClick={() => { window.location.href = '/'; }}
                className={`${btnBase} ${btnInactive}`}
            >
                返回首页
            </button>

            {isLoggedIn ? (
                <>
                    <span className={`${btnBase} text-amber-900 font-bold bg-white/30`} title={displayName || ''}>
                        {displayName}
                    </span>
                    <button
                        onClick={async () => { await router.push('/add-snack'); }}
                        className={`${btnBase} ${btnInactive}`}
                    >
                        添加零食
                    </button>
                    <button
                        onClick={async () => { await router.push('/my-snacks'); }}
                        className={`${btnBase} ${btnInactive}`}
                    >
                        我的零食
                    </button>
                    <button
                        onClick={async () => { await router.push('/my-map'); }}
                        className={`${btnBase} ${btnInactive}`}
                    >
                        我的地图
                    </button>
                    <button
                        onClick={adminUser ? handleAdminLogout : handleUserLogout}
                        className={`${btnBase} ${btnInactive}`}
                    >
                        退出
                    </button>
                </>
            ) : (
                <>
                    <button
                        onClick={() => { window.location.href = '/login'; }}
                        className={`${btnBase} ${btnInactive}`}
                    >
                        登录
                    </button>
                    <button
                        onClick={() => { window.location.href = '/login?register=true'; }}
                        className={`${btnBase} ${btnInactive}`}
                    >
                        注册
                    </button>
                </>
            )}

            <ThemeToggle className={`${btnBase} ${btnInactive} max-w-[56px]`} />
        </div>
    );
}
