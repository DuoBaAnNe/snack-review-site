'use client';

import { useState, useMemo } from 'react';
import type { Snack, NewsItem } from '@/types';
import CategoryNav from './CategoryNav';
import SearchModal from './SearchModal';
import SnackGrid from './SnackGrid';
import NewsList from './NewsList';
import IngredientsView from './IngredientsView';

interface IngredientEntry {
    name: string;
    count: number;
    snacks: { id: number; product_name: string; brand_name: string; category: string }[];
}

interface Props {
    snacks: Snack[];
    news: NewsItem[];
}

export default function HomePageContent({ snacks, news }: Props) {
    const [viewMode, setViewMode] = useState<'snacks' | 'news' | 'ingredients'>('snacks');
    const [activeCategory, setActiveCategory] = useState<string | null>(null);
    const [searchOpen, setSearchOpen] = useState(false);

    const filtered = activeCategory
        ? snacks.filter((s) => s.category === activeCategory)
        : snacks;

    const ingredientsData = useMemo(() => {
        const map = new Map<string, IngredientEntry>();
        for (const snack of snacks) {
            if (!snack.ingredients) continue;
            const parts = snack.ingredients
                .split(/[,，、;；\n]+/)
                .map((s) => s.trim())
                .filter((s) => s.length > 0 && s.length < 30);

            for (const part of parts) {
                const existing = map.get(part);
                if (existing) {
                    existing.count++;
                    existing.snacks.push({
                        id: snack.id,
                        product_name: snack.product_name,
                        brand_name: snack.brand_name,
                        category: snack.category,
                    });
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
                    onSelectCategory={(cat) => { setActiveCategory(cat); setViewMode('snacks'); }}
                    onSelectNews={() => setViewMode('news')}
                    onSelectIngredients={() => setViewMode('ingredients')}
                    onOpenSearch={() => setSearchOpen(true)}
                />
            </div>
            <div className="mt-4">
                {viewMode === 'snacks' && <SnackGrid snacks={filtered} />}
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
