'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import type { Snack, NewsItem } from '@/types';
import HomeSidebar from './HomeSidebar';
import SearchModal from './SearchModal';
import SnackGrid from './SnackGrid';
import NewsList from './NewsList';
import IngredientsView from './IngredientsView';

const WorldSnackMap = dynamic(() => import('./WorldSnackMap'), {
    loading: () => (
        <div className="animate-pulse h-[520px] bg-gray-100 flex items-center justify-center">
            <span className="text-gray-400">零食地图加载中…</span>
        </div>
    ),
    ssr: false,
});

interface IngredientEntry {
    name: string;
    count: number;
    snacks: { id: number; product_name: string; brand_name: string; category: string }[];
}

interface Props {
    snacks: Snack[];
    news: NewsItem[];
}

function SectionTitle({ icon, title, hint }: { icon: string; title: string; hint?: string }) {
    return (
        <div className="flex items-baseline gap-2 mb-4">
            <span className="text-xl">{icon}</span>
            <h2 className="text-xl font-black text-gray-900">{title}</h2>
            {hint && <span className="text-xs text-gray-400">{hint}</span>}
        </div>
    );
}

export default function HomePageContent({ snacks, news }: Props) {
    const searchParams = useSearchParams();
    const [activeCategory, setActiveCategory] = useState<string | null>(searchParams.get('cat'));
    const [searchOpen, setSearchOpen] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);
    const [isAdmin, setIsAdmin] = useState(false);

    useEffect(() => {
        fetch('/api/auth/check')
            .then((res) => res.json())
            .then((data) => setIsAdmin(data.authenticated))
            .catch(() => setIsAdmin(false));
    }, []);

    const selectCategory = useCallback((cat: string | null) => {
        setActiveCategory(cat);
        window.history.replaceState(null, '', cat ? `/?cat=${encodeURIComponent(cat)}` : '/');
        document.getElementById('sec-snacks')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, []);

    const goSection = useCallback((id: string) => {
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, []);

    const filtered = useMemo(
        () => activeCategory ? snacks.filter((snack) => snack.category === activeCategory) : snacks,
        [activeCategory, snacks],
    );

    const ingredientsData = useMemo(() => {
        const map = new Map<string, IngredientEntry>();
        for (const snack of snacks) {
            if (!snack.ingredients) continue;
            const raw = snack.ingredients;
            const parts: string[] = [];
            let depth = 0;
            let current = '';
            for (let i = 0; i < raw.length; i++) {
                const ch = raw[i];
                if (ch === '(' || ch === '（') { depth++; current += ch; }
                else if (ch === ')' || ch === '）') { depth = Math.max(0, depth - 1); current += ch; }
                else if (depth === 0 && /[,，、;；\n]/.test(ch)) {
                    const trimmed = current.trim();
                    if (trimmed.length > 0 && trimmed.length < 30) parts.push(trimmed);
                    current = '';
                } else { current += ch; }
            }
            const trimmed = current.trim();
            if (trimmed.length > 0 && trimmed.length < 30) parts.push(trimmed);
            const uniqueParts = [...new Set(parts)];
            for (const part of uniqueParts) {
                const existing = map.get(part);
                if (existing) {
                    if (!existing.snacks.some((s) => s.id === snack.id)) {
                        existing.count++;
                        existing.snacks.push({ id: snack.id, product_name: snack.product_name, brand_name: snack.brand_name, category: snack.category });
                    }
                } else {
                    map.set(part, { name: part, count: 1, snacks: [{ id: snack.id, product_name: snack.product_name, brand_name: snack.brand_name, category: snack.category }] });
                }
            }
        }
        return Array.from(map.values()).sort((a, b) => b.count - a.count);
    }, [snacks]);

    return (
        <>
            {/* Hamburger — sits to the LEFT of the 七零十 title; toggles the menu */}
            <button
                onClick={() => setMenuOpen((v) => !v)}
                aria-label={menuOpen ? '关闭菜单' : '打开菜单'}
                className="fixed top-2.5 left-2 z-50 w-9 h-9 rounded-lg flex items-center justify-center text-gray-600 hover:bg-white/60 transition-colors"
            >
                <span className="text-xl leading-none">☰</span>
            </button>

            <HomeSidebar
                open={menuOpen}
                onClose={() => setMenuOpen(false)}
                activeCategory={activeCategory}
                onSelectCategory={selectCategory}
                onGoSection={goSection}
                onOpenSearch={() => setSearchOpen(true)}
            />

            <div className="space-y-14 pb-16">
                {/* Snacks */}
                <section id="sec-snacks" className="scroll-mt-16 max-w-[1400px] mx-auto px-3 md:px-6 pt-4">
                    <SectionTitle icon="🍬" title={activeCategory || '全部零食'} hint={`${filtered.length} 款`} />
                    <SnackGrid snacks={filtered} isAdmin={isAdmin} />
                </section>

                {/* Map — warm full-bleed colour band spanning the viewport width */}
                <section id="sec-map" className="scroll-mt-16">
                    <div className="max-w-[1400px] mx-auto px-3 md:px-6">
                        <SectionTitle icon="🗺️" title="零食地图" hint="按产地看分布" />
                    </div>
                    <div className="full-bleed" style={{ backgroundColor: '#faf0e4' }}>
                        <div className="max-w-[1400px] mx-auto px-3 md:px-6">
                            <WorldSnackMap snacks={snacks} />
                        </div>
                    </div>
                </section>

                {/* News */}
                <section id="sec-news" className="scroll-mt-16 max-w-[1400px] mx-auto px-3 md:px-6">
                    <SectionTitle icon="📰" title="食品资讯" hint="每日自动更新" />
                    <NewsList news={news} />
                </section>

                {/* Ingredients */}
                <section id="sec-ing" className="scroll-mt-16 max-w-[1400px] mx-auto px-3 md:px-6">
                    <SectionTitle icon="🔬" title="成分科普" hint="点配料看科普" />
                    <IngredientsView ingredients={ingredientsData} totalSnacks={snacks.length} />
                </section>
            </div>

            {searchOpen && <SearchModal snacks={snacks} onClose={() => setSearchOpen(false)} />}
        </>
    );
}
