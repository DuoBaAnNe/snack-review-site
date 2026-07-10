'use client';

import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';

export default function AdminNav() {
    const router = useRouter();
    const pathname = usePathname();

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
        <div className="flex items-center justify-between bg-white rounded-xl shadow-sm px-4 py-2 border border-gray-100">
            <div className="flex items-center gap-2">
                <Link href="/admin" className={linkClass('/admin')}>
                    Dashboard
                </Link>
                <Link href="/admin/new" className={linkClass('/admin/new')}>
                    + Add Snack
                </Link>
                <Link href="/admin/recycle" className={linkClass('/admin/recycle')}>
                    回收站
                </Link>
                <Link href="/news" className={linkClass('/news')}>
                    零食新闻
                </Link>
                <Link href="/ingredients" className={linkClass('/ingredients')}>
                    成分研究
                </Link>
                <Link href="/" className="text-sm text-gray-400 hover:text-gray-600 ml-4">
                    View Public Site
                </Link>
            </div>
            <button
                onClick={handleLogout}
                className="text-sm text-gray-400 hover:text-red-500 transition-colors"
            >
                Logout
            </button>
        </div>
    );
}
