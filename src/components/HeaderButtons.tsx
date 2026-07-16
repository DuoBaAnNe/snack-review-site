'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';

interface UserInfo {
    id: number;
    email: string;
    username: string;
}

function truncateUsername(name: string): string {
    if (name.length <= 5) return name;
    return name.slice(0, 5) + '…';
}

export default function HeaderButtons() {
    const router = useRouter();
    const pathname = usePathname();
    const [user, setUser] = useState<UserInfo | null | undefined>(undefined);
    const [adminUser, setAdminUser] = useState<string | null | undefined>(undefined);
    const [menuOpen, setMenuOpen] = useState(false);

    useEffect(() => {
        Promise.all([
            fetch('/api/auth/user/check').then(r => r.json()),
            fetch('/api/auth/check').then(r => r.json()),
        ]).then(([userData, adminData]) => {
            setUser(userData.authenticated ? userData.user : null);
            setAdminUser(adminData.authenticated ? (adminData.username || '西瓜Naive') : null);
        }).catch(() => {
            setUser(null);
            setAdminUser(null);
        });
    }, [pathname]);

    async function handleUserLogout() {
        await fetch('/api/auth/user/logout', { method: 'POST' });
        setUser(null);
        setMenuOpen(false);
        router.refresh();
    }

    async function handleAdminLogout() {
        await fetch('/api/auth/logout', { method: 'POST' });
        setAdminUser(null);
        setMenuOpen(false);
        router.refresh();
    }

    if (user === undefined && adminUser === undefined) {
        return <div className="w-16" />; // reserve space while loading
    }

    const isLoggedIn = !!user || !!adminUser;
    const displayName = adminUser || (user ? truncateUsername(user.username) : null);

    const item = 'block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-amber-50 transition-colors';

    return (
        <div className="flex items-center gap-1.5 shrink-0">
            {isLoggedIn ? (
                <div className="relative">
                    <button
                        onClick={() => setMenuOpen(!menuOpen)}
                        className="flex items-center gap-1.5 pl-2.5 pr-2 py-1.5 rounded-full bg-white/60 hover:bg-white text-sm font-medium text-amber-900 transition-colors"
                        title={displayName || ''}
                    >
                        <span className="w-6 h-6 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-white text-xs flex items-center justify-center">
                            {(displayName || '·').slice(0, 1)}
                        </span>
                        <span className="max-w-[80px] truncate">{displayName}</span>
                        <span className="text-xs text-amber-900/50">▾</span>
                    </button>
                    {menuOpen && (
                        <>
                            <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                            <div className="absolute right-0 mt-2 w-40 bg-white rounded-xl shadow-xl border border-gray-100 py-1 z-50 overflow-hidden">
                                <button className={item} onClick={() => { setMenuOpen(false); router.push('/add-snack'); }}>添加零食</button>
                                <button className={item} onClick={() => { setMenuOpen(false); router.push('/my-snacks'); }}>我的零食</button>
                                <button className={item} onClick={() => { setMenuOpen(false); router.push('/my-map'); }}>我的地图</button>
                                <div className="border-t border-gray-100 my-1" />
                                <button className={`${item} text-red-500`} onClick={adminUser ? handleAdminLogout : handleUserLogout}>退出登录</button>
                            </div>
                        </>
                    )}
                </div>
            ) : (
                <button
                    onClick={() => { window.location.href = '/login'; }}
                    className="px-4 py-1.5 rounded-full text-sm font-semibold text-white bg-gradient-to-r from-amber-400 to-orange-500 hover:opacity-90 transition-opacity"
                >
                    登录
                </button>
            )}
        </div>
    );
}
