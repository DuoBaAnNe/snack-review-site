'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import HomeSidebar from './HomeSidebar';
import { getSnackDetailNavigationHref } from '@/lib/snack-detail-navigation';

export default function SnackDetailNavigation() {
    const router = useRouter();
    const [menuOpen, setMenuOpen] = useState(false);

    return (
        <>
            <button
                onClick={() => setMenuOpen((open) => !open)}
                aria-label={menuOpen ? '关闭菜单' : '打开菜单'}
                className="fixed top-2.5 left-2 z-50 w-9 h-9 rounded-lg flex items-center justify-center text-gray-600 hover:bg-white/60 transition-colors"
            >
                <span className="text-xl leading-none">☰</span>
            </button>

            <HomeSidebar
                open={menuOpen}
                onClose={() => setMenuOpen(false)}
                activeCategory={null}
                onSelectCategory={(category) => {
                    setMenuOpen(false);
                    router.push(getSnackDetailNavigationHref({ kind: 'category', category }));
                }}
                onGoSection={(id) => {
                    setMenuOpen(false);
                    if (id === 'sec-map' || id === 'sec-news' || id === 'sec-ing') {
                        router.push(getSnackDetailNavigationHref({ kind: 'section', id }));
                    }
                }}
                onOpenSearch={() => {
                    setMenuOpen(false);
                    router.push(getSnackDetailNavigationHref({ kind: 'search' }));
                }}
            />
        </>
    );
}
