import type { Metadata } from 'next';
import { getAllSnacks } from '@/lib/db';
import IngredientsView from '@/components/IngredientsView';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
    title: '成分研究 - 零食奇计划',
    description: '零食成分深度分析',
};

interface IngredientEntry {
    name: string;
    count: number;
    snacks: { id: number; product_name: string; brand_name: string; category: string }[];
}

export default async function IngredientsPage() {
    const snacks = await getAllSnacks();

    // Parse and aggregate ingredients
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

    const ingredients = Array.from(map.values()).sort((a, b) => b.count - a.count);

    return (
        <div className="max-w-4xl mx-auto px-4 py-8 md:py-12">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">🔬 成分研究</h1>
            <p className="text-gray-500 text-sm mb-2">
                共解析 {ingredients.length} 种配料成分，覆盖 {snacks.length} 款零食
            </p>
            <IngredientsView ingredients={ingredients} totalSnacks={snacks.length} />
        </div>
    );
}
