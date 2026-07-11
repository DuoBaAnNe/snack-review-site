'use client';

import { useState, useEffect, useCallback } from 'react';
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

interface InfoResult {
    title: string;
    summary: string;
    url: string;
    source: string;
    matched: string;
}

interface PartInfo {
    part: string;
    loading: boolean;
    info: InfoResult | null;
}

// Split a compound ingredient like 食用植物油（棕榈油、大豆油） into
// its component keywords: the outer name plus each item inside parentheses.
// Pure numeric codes (e.g. additive numbers) are skipped.
function splitCompound(name: string): string[] {
    const parts: string[] = [];
    const outer = name.match(/^[^（(]+/)?.[0]?.trim();
    if (outer && outer.length >= 2) parts.push(outer);
    const groups = name.match(/[（(]([^（）()]*)[）)]/g) || [];
    for (const g of groups) {
        const inner = g.slice(1, -1);
        for (const p of inner.split(/[、，,/;；]+/)) {
            const t = p.trim();
            if (t.length >= 2 && !/^[\d.%０-９\s]+$/.test(t) && !parts.includes(t)) {
                parts.push(t);
            }
        }
    }
    return parts.length > 0 ? parts : [name];
}

function sourceLabel(source: string): string {
    if (source === 'baidu') return '百度百科';
    if (source === 'wikipedia') return '维基百科';
    return source;
}

export default function IngredientsView({
    ingredients, totalSnacks,
}: { ingredients: IngredientEntry[]; totalSnacks: number }) {
    const [selected, setSelected] = useState<IngredientEntry | null>(null);
    const [search, setSearch] = useState('');
    const [infoList, setInfoList] = useState<PartInfo[]>([]);

    const fetchInfo = useCallback((name: string) => {
        const parts = splitCompound(name);
        setInfoList(parts.map((part) => ({ part, loading: true, info: null })));
        parts.forEach((part, idx) => {
            fetch(`/api/ingredient-info?name=${encodeURIComponent(part)}`)
                .then((res) => (res.ok ? res.json() : null))
                .then((data) => {
                    setInfoList((prev) => prev.map((e, i) =>
                        i === idx ? { ...e, loading: false, info: data || null } : e
                    ));
                })
                .catch(() => {
                    setInfoList((prev) => prev.map((e, i) =>
                        i === idx ? { ...e, loading: false } : e
                    ));
                });
        });
    }, []);

    useEffect(() => {
        if (selected) fetchInfo(selected.name);
        else setInfoList([]);
    }, [selected, fetchInfo]);

    const filtered = search.trim()
        ? ingredients.filter((i) => i.name.includes(search.trim()))
        : ingredients;

    const displayed = search.trim() ? filtered.slice(0, 100) : ingredients.slice(0, 50);

    function getFrequencyColor(count: number): string {
        const pct = count / totalSnacks;
        if (pct >= 0.5) return 'bg-red-100 text-red-700 border-red-200';
        if (pct >= 0.25) return 'bg-orange-100 text-orange-700 border-orange-200';
        if (pct >= 0.1) return 'bg-yellow-100 text-yellow-700 border-yellow-200';
        return 'bg-gray-100 text-gray-600 border-gray-200';
    }

    const isCompound = infoList.length > 1;

    return (
        <div>
            <div className="mb-6">
                <input
                    type="text"
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setSelected(null); }}
                    placeholder="搜索配料成分..."
                    className="w-full max-w-md px-4 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-400"
                />
            </div>

            {/* Tags */}
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
            </div>

            {/* Detail card */}
            {selected && (
                <div className="bg-white rounded-xl border border-gray-100 p-6 mb-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-1">{selected.name}</h2>
                    <p className="text-sm text-gray-500 mb-4">
                        出现在 {selected.count} 款零食中（占比 {(selected.count / totalSnacks * 100).toFixed(1)}%）
                    </p>

                    {/* Info card — one section per component for compound ingredients */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                        <div className="flex items-center gap-2 mb-3">
                            <span className="text-xs font-semibold text-blue-700">📖 成分科普</span>
                            {isCompound && (
                                <span className="text-xs text-blue-500 bg-blue-100 px-2 py-0.5 rounded-full">
                                    复合配料 · 已拆分为 {infoList.length} 个成分
                                </span>
                            )}
                        </div>

                        <div className="space-y-4">
                            {infoList.map((entry) => (
                                <div
                                    key={entry.part}
                                    className={isCompound ? 'border-t border-blue-200/60 pt-3 first:border-t-0 first:pt-0' : ''}
                                >
                                    {isCompound && (
                                        <p className="text-sm font-semibold text-blue-900 mb-1">
                                            {entry.part}
                                        </p>
                                    )}

                                    {entry.loading ? (
                                        <div className="space-y-2 animate-pulse">
                                            <div className="h-3 bg-blue-200 rounded w-3/4" />
                                            <div className="h-3 bg-blue-200 rounded w-full" />
                                        </div>
                                    ) : entry.info ? (
                                        <>
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-[11px] text-blue-400">
                                                    来源：{sourceLabel(entry.info.source)}
                                                </span>
                                                {entry.info.matched !== entry.part && (
                                                    <span className="text-[11px] text-blue-500 bg-blue-100 px-2 py-0.5 rounded-full">
                                                        匹配: {entry.info.matched}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-sm text-blue-800 leading-relaxed">{entry.info.summary}</p>
                                            {entry.info.url && (
                                                <a href={entry.info.url} target="_blank" rel="noopener noreferrer"
                                                    className="inline-block mt-1.5 text-xs text-blue-500 hover:text-blue-700 underline">
                                                    阅读全文 →
                                                </a>
                                            )}
                                        </>
                                    ) : (
                                        <div>
                                            <p className="text-sm text-blue-700 mb-2">
                                                未找到「{entry.part}」的科普信息，可以试试：
                                            </p>
                                            <div className="flex flex-wrap gap-2">
                                                <a href={`https://baike.baidu.com/item/${encodeURIComponent(entry.part)}`} target="_blank" rel="noopener noreferrer"
                                                    className="text-xs px-3 py-1 bg-white border border-blue-200 rounded-full text-blue-600 hover:bg-blue-100 transition-colors">
                                                    百度百科
                                                </a>
                                                <a href={`https://zh.wikipedia.org/wiki/${encodeURIComponent(entry.part)}`} target="_blank" rel="noopener noreferrer"
                                                    className="text-xs px-3 py-1 bg-white border border-blue-200 rounded-full text-blue-600 hover:bg-blue-100 transition-colors">
                                                    维基百科
                                                </a>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Snacks list */}
                    <h3 className="text-sm font-semibold text-gray-800 mb-3">含此配料的零食：</h3>
                    <div className="space-y-2">
                        {selected.snacks.map((s) => (
                            <Link key={s.id} href={`/snacks/${s.id}`}
                                className="flex items-center gap-3 px-3 py-2 bg-gray-50 rounded-lg hover:bg-amber-50 transition-colors">
                                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 text-gray-500 shrink-0">{s.category}</span>
                                <span className="text-sm text-gray-700">
                                    {s.brand_name && <span className="text-orange-500">{s.brand_name} · </span>}
                                    {s.product_name}
                                </span>
                            </Link>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}