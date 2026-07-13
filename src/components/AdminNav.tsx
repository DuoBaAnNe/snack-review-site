'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';

export default function AdminNav() {
    const router = useRouter();
    const pathname = usePathname();
    const [username, setUsername] = useState<string | null>(null);

    useEffect(() => {
        fetch('/api/auth/check')
            .then((r) => r.json())
            .then((d) => setUsername(d.username || null))
            .catch(() => setUsername(null));
    }, []);

    async function handleLogout() {
        await fetch('/api/auth/logout', { method: 'POST' });
        router.push('/login');
    }

    const linkClass = (href: string) =>
        `px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${pathname === href
            ? 'bg-orange-100 text-orange-700'
            : 'text-gray-600 hover:bg-gray-100'
        }`;

    return (
        <div className="flex items-center justify-between bg-white rounded-xl shadow-sm px-4 py-2 border border-gray-100 flex-wrap gap-2">
            <div className="flex items-center gap-2 flex-wrap">
                <Link href="/admin" className={linkClass('/admin')}>
                    管理台
                </Link>
                <Link href="/admin/new" className={linkClass('/admin/new')}>
                    + 添加零食
                </Link>
                <Link href="/admin/recycle" className={linkClass('/admin/recycle')}>
                    回收站
                </Link>
                {/* External views open in a new tab so the admin page is never lost */}
                <a href="/news" target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors">
                    食品资讯 ↗
                </a>
                <a href="/ingredients" target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors">
                    成分科普 ↗
                </a>
                <a href="/" target="_blank" rel="noopener noreferrer" className="text-sm text-gray-400 hover:text-gray-600 ml-2">
                    查看网站 ↗
                </a>
            </div>
            <div className="flex items-center gap-3">
                {username && (
                    <span className="text-sm text-gray-500">
                        管理员：<span className="font-semibold text-orange-500">{username}</span>
                    </span>
                )}
                <button
                    onClick={handleLogout}
                    className="text-sm text-gray-400 hover:text-red-500 transition-colors"
                >
                    退出登录
                </button>
            </div>
        </div>
    );
}
