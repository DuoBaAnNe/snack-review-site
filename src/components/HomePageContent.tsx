'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import type { Snack, NewsItem } from '@/types';
import CategoryNav from './CategoryNav';
import SearchModal from './SearchModal';
import SnackGrid from './SnackGrid';
import NewsList from './NewsList';
import IngredientsView from './IngredientsView';

const WorldSnackMap = dynamic(() => import('./WorldSnackMap'), {
    loading: () => (
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-4">
            <h2 className="text-lg font-bold text-gray-800 mb-2 text-center">零食地图</h2>
            <div className="animate-pulse h-[520px] bg-gray-100 rounded-lg flex items-center justify-center">
                <span className="text-gray-400">加载中...</span>
            </div>
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

type ViewMode = 'snacks' | 'news' | 'ingredients' | 'map';
const VALID_VIEWS: ViewMode[] = ['snacks', 'news', 'ingredients', 'map'];

export default function HomePageContent({ snacks, news }: Props) {
    const router = useRouter();
    const searchParams = useSearchParams();

    // Initialize view/category from the URL so filtered views are shareable
    const urlView = searchParams.get('view');
    const initialView: ViewMode = VALID_VIEWS.includes(urlView as ViewMode) ? (urlView as ViewMode) : 'snacks';
    const [viewMode, setViewMode] = useState<ViewMode>(initialView);
    const [activeCategory, setActiveCategory] = useState<string | null>(searchParams.get('cat'));
    const [searchOpen, setSearchOpen] = useState(false);
    const [isAdmin, setIsAdmin] = useState(false);

    // Follow URL changes too (e.g. the 返回首页 button navigates to "/"),
    // so the view resets when the address changes
    useEffect(() => {
        const v = searchParams.get('view');
        setViewMode(VALID_VIEWS.includes(v as ViewMode) ? (v as ViewMode) : 'snacks');
        setActiveCategory(searchParams.get('cat'));
    }, [searchParams]);

    // One admin check for the whole page (instead of one per card)
    useEffect(() => {
        fetch('/api/auth/check')
            .then(res => res.json())
            .then(data => setIsAdmin(data.authenticated))
            .catch(() => setIsAdmin(false));
    }, []);

    const applyState = useCallback((view: ViewMode, cat: string | null) => {
        setViewMode(view);
        setActiveCategory(cat);
        const params = new URLSearchParams();
        if (view !== 'snacks') params.set('view', view);
        if (cat) params.set('cat', cat);
        const qs = params.toString();
        router.replace(qs ? `/?${qs}` : '/', { scroll: false });
    }, [router]);

    const filtered = activeCategory
        ? snacks.filter((s) => s.category === activeCategory)
        : snacks;

    const ingredientsData = useMemo(() => {
        const map = new Map<string, IngredientEntry>();
        for (const snack of snacks) {
            if (!snack.ingredients) continue;
            // Split on separators but NOT inside parentheses
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
                } else {
                    current += ch;
                }
            }
            const trimmed = current.trim();
            if (trimmed.length > 0 && trimmed.length < 30) parts.push(trimmed);
            const uniqueParts = [...new Set(parts)];

            for (const part of uniqueParts) {
                const existing = map.get(part);
                if (existing) {
                    if (!existing.snacks.some((s) => s.id === snack.id)) {
                        existing.count++;
                        existing.snacks.push({
                            id: snack.id,
                            product_name: snack.product_name,
                            brand_name: snack.brand_name,
                            category: snack.category,
                        });
                    }
                } else {
                    map.set(part, {
                        name: part,
                        count: 1,
                        snacks: [{
                            id: snack.id,
                            product_name: snack.product_name,
                            brand_name: snack.brand_name,
                            category: snack.category,
                        }],
                    });
                }
            }
        }
        return Array.from(map.values()).sort((a, b) => b.count - a.count);
    }, [snacks]);

    return (
        <>
            <div className="full-bleed bg-gradient-to-b from-rose-100/50 to-gray-50 pt-2 pb-1 px-4">
                <CategoryNav
                    activeCategory={activeCategory}
                    activeView={viewMode}
                    onSelectCategory={(cat) => applyState('snacks', cat)}
                    onSelectMap={() => applyState('map', activeCategory)}
                    onSelectNews={() => applyState('news', activeCategory)}
                    onSelectIngredients={() => applyState('ingredients', activeCategory)}
                    onOpenSearch={() => setSearchOpen(true)}
                />
            </div>
            <div className="mt-4">
                {viewMode === 'snacks' && <SnackGrid snacks={filtered} isAdmin={isAdmin} />}
                {viewMode === 'map' && <WorldSnackMap snacks={snacks} />}
                {viewMode === 'news' && <NewsList news={news} />}
                {viewMode === 'ingredients' && (
                    <IngredientsView ingredients={ingredientsData} totalSnacks={snacks.length} />
                )}
            </div>
            {searchOpen && (
                <SearchModal
                    snacks={snacks}
                    onClose={() => setSearchOpen(false)}
                />
            )}
        </>
    );
}
