'use client';

import { useState } from 'react';
import Link from 'next/link';

interface SnackRef {
    id: number;
    product_name: string;
    brand_name: string;
    category: string;
}

interface IngredientEntry {
    name: string;
    count: number;
    snacks: SnackRef[];
}

const ADDITIVE_KNOWLEDGE: Record<string, string> = {
    '苯甲酸钠': '防腐剂，广泛应用于碳酸饮料和酱料，在规定剂量内安全。',
    '山梨酸钾': '常见防腐剂，毒性低于苯甲酸钠，用于乳制品、烘焙食品。',
    '阿斯巴甜': '人工甜味剂，甜度为蔗糖的200倍，苯丙酮尿症患者需避免。',
    '安赛蜜': '人工甜味剂，不被人体代谢，常与阿斯巴甜复配使用。',
    '甜蜜素': '人工甜味剂，部分国家禁用。国家食品安全标准有严格限量。',
    '柠檬酸': '酸度调节剂，广泛存在于柑橘类水果中，用于调节食品酸度。',
    '谷氨酸钠': '即味精的化学成分，用于提鲜。WHO和FAO均认定安全。',
    '特丁基对苯二酚': '即TBHQ，抗氧化剂，用于油脂防腐。超量摄入有风险。',
    '二氧化钛': '白色素/增白剂，2022年起欧盟禁用。国内部分食品仍使用。',
    '焦亚硫酸钠': '漂白剂/防腐剂，用于果脯蜜饯，过量可能引起过敏反应。',
    '碳酸氢钠': '即小苏打，膨松剂，用于烘焙食品使口感松软。安全性高。',
    '黄原胶': '增稠剂/稳定剂，由微生物发酵产生，用于改善食品质地。',
};

export default function IngredientsView({
    ingredients,
    totalSnacks,
}: {
    ingredients: IngredientEntry[];
    totalSnacks: number;
}) {
    const [selected, setSelected] = useState<IngredientEntry | null>(null);
    const [search, setSearch] = useState('');

    const filtered = search.trim()
        ? ingredients.filter((i) => i.name.includes(search.trim()))
        : ingredients;

    // Top 50 for display, rest via search
    const displayed = search.trim() ? filtered.slice(0, 100) : ingredients.slice(0, 50);

    function getFrequencyColor(count: number): string {
        const pct = count / totalSnacks;
        if (pct >= 0.5) return 'bg-red-100 text-red-700 border-red-200';
        if (pct >= 0.25) return 'bg-orange-100 text-orange-700 border-orange-200';
        if (pct >= 0.1) return 'bg-yellow-100 text-yellow-700 border-yellow-200';
        return 'bg-gray-100 text-gray-600 border-gray-200';
    }

    return (
        <div>
            {/* Search */}
            <div className="mb-6">
                <input
                    type="text"
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setSelected(null); }}
                    placeholder="搜索配料成分..."
                    className="w-full max-w-md px-4 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-400"
                />
            </div>

            {/* Ingredient Tags */}
            <div className="bg-white rounded-xl border border-gray-100 p-6 mb-6">
                <h2 className="text-sm font-semibold text-gray-800 mb-4">
                    {search ? `搜索结果 (${displayed.length})` : `高频配料 Top ${displayed.length}`}
                </h2>
                <div className="flex flex-wrap gap-2">
                    {displayed.map((ing) => (
                        <button
                            key={ing.name}
                            onClick={() => setSelected(selected?.name === ing.name ? null : ing)}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                                selected?.name === ing.name
                                    ? 'bg-amber-400 text-white border-amber-400'
                                    : `${getFrequencyColor(ing.count)} hover:border-amber-300`
                            }`}
                        >
                            {ing.name}
                            <span className="ml-1 opacity-60">({ing.count})</span>
                        </button>
                    ))}
                </div>
                {!search && ingredients.length > 50 && (
                    <p className="text-xs text-gray-400 mt-4">
                        显示出现频率最高的50种配料，使用搜索框查找更多
                    </p>
                )}
            </div>

            {/* Selected Ingredient Detail */}
            {selected && (
                <div className="bg-white rounded-xl border border-gray-100 p-6 mb-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-1">
                        {selected.name}
                    </h2>
                    <p className="text-sm text-gray-500 mb-4">
                        出现在 {selected.count} 款零食中（占比 {(selected.count / totalSnacks * 100).toFixed(1)}%）
                    </p>

                    {/* Knowledge card */}
                    {ADDITIVE_KNOWLEDGE[selected.name] && (
                        <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 mb-4">
                            <span className="text-xs font-medium text-blue-600">📖 科普</span>
                            <p className="text-xs text-blue-700 mt-1">{ADDITIVE_KNOWLEDGE[selected.name]}</p>
                        </div>
                    )}

                    {/* Snacks with this ingredient */}
                    <h3 className="text-sm font-semibold text-gray-800 mb-3">含此配料的零食：</h3>
                    <div className="space-y-2">
                        {selected.snacks.map((s) => (
                            <Link
                                key={s.id}
                                href={`/snacks/${s.id}`}
                                className="flex items-center gap-3 px-3 py-2 bg-gray-50 rounded-lg hover:bg-amber-50 transition-colors"
                            >
                                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 text-gray-500 shrink-0">
                                    {s.category}
                                </span>
                                <span className="text-sm text-gray-700">
                                    {s.brand_name && <span className="text-orange-500">{s.brand_name} · </span>}
                                    {s.product_name}
                                </span>
                            </Link>
                        ))}
                    </div>
                </div>
            )}

            {/* Stats */}
            {!selected && !search && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-white rounded-xl border border-gray-100 p-4 text-center">
                        <div className="text-2xl font-bold text-orange-500">{ingredients.length}</div>
                        <div className="text-xs text-gray-400 mt-1">配料种类</div>
                    </div>
                    <div className="bg-white rounded-xl border border-gray-100 p-4 text-center">
                        <div className="text-2xl font-bold text-orange-500">{totalSnacks}</div>
                        <div className="text-xs text-gray-400 mt-1">零食总数</div>
                    </div>
                    <div className="bg-white rounded-xl border border-gray-100 p-4 text-center">
                        <div className="text-2xl font-bold text-orange-500">
                            {ingredients.filter((i) => i.count >= totalSnacks * 0.25).length}
                        </div>
                        <div className="text-xs text-gray-400 mt-1">高频配料（≥25%）</div>
                    </div>
                    <div className="bg-white rounded-xl border border-gray-100 p-4 text-center">
                        <div className="text-2xl font-bold text-orange-500">
                            {Object.keys(ADDITIVE_KNOWLEDGE).filter((k) => ingredients.some((i) => i.name === k)).length}
                        </div>
                        <div className="text-xs text-gray-400 mt-1">已知添加剂</div>
                    </div>
                </div>
            )}
        </div>
    );
}
