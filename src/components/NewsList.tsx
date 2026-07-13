'use client';

import { useState } from 'react';
import type { NewsItem } from '@/types';

// Category badge colors — inline rgba tints so they read well in both
// light and dark themes without extra CSS.
const CATEGORIES: Record<string, { color: string; icon: string }> = {
    '创新': { color: '#f97316', icon: '💡' },
    '科研': { color: '#3b82f6', icon: '🔬' },
    '产业': { color: '#10b981', icon: '🏭' },
    '法规': { color: '#8b5cf6', icon: '📋' },
    '食品安全': { color: '#ef4444', icon: '⚠️' },
    '资讯': { color: '#6b7280', icon: '📰' },
    '环球美食': { color: '#eab308', icon: '🌍' },
    // Legacy tags from earlier versions
    '研究': { color: '#3b82f6', icon: '🔬' },
    '安全': { color: '#ef4444', icon: '⚠️' },
};

function hexToRgba(hex: string, alpha: number): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function parseTitle(raw: string): { cat: string | null; title: string } {
    const m = raw.match(/^【([^】]{1,6})】\s*(.*)$/);
    if (m && m[2]) return { cat: m[1], title: m[2] };
    return { cat: null, title: raw };
}

export default function NewsList({ news }: { news: NewsItem[] }) {
    const [expandedId, setExpandedId] = useState<number | null>(null);
    const [filter, setFilter] = useState<string | null>(null);

    if (news.length === 0) {
        return (
            <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
                <p className="text-gray-400">暂无新闻，敬请期待！</p>
            </div>
        );
    }

    // Which categories actually appear (for the filter chips)
    const presentCats = [...new Set(
        news.map((n) => parseTitle(n.title).cat).filter((c): c is string => !!c && !!CATEGORIES[c])
    )];

    const shown = filter
        ? news.filter((n) => parseTitle(n.title).cat === filter)
        : news;

    return (
        <div>
            {/* Category filter chips */}
            {presentCats.length > 1 && (
                <div className="flex flex-wrap items-center gap-2 mb-4">
                    <button
                        onClick={() => setFilter(null)}
                        className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                            filter === null
                                ? 'bg-amber-400 text-white border-amber-400'
                                : 'bg-white text-gray-500 border-gray-200 hover:border-amber-300'
                        }`}
                    >
                        全部
                    </button>
                    {presentCats.map((cat) => {
                        const meta = CATEGORIES[cat];
                        const active = filter === cat;
                        return (
                            <button
                                key={cat}
                                onClick={() => setFilter(active ? null : cat)}
                                className="px-3 py-1 rounded-full text-xs font-medium border transition-colors"
                                style={active
                                    ? { backgroundColor: meta.color, color: '#fff', borderColor: meta.color }
                                    : { backgroundColor: hexToRgba(meta.color, 0.12), color: meta.color, borderColor: hexToRgba(meta.color, 0.3) }}
                            >
                                {meta.icon} {cat}
                            </button>
                        );
                    })}
                </div>
            )}

            <div className="space-y-4">
                {shown.map((item) => {
                    const { cat, title } = parseTitle(item.title);
                    const meta = (cat && CATEGORIES[cat]) || null;
                    const accent = meta?.color || '#d1d5db';
                    const isWorldFood = cat === '环球美食';
                    const isExpanded = expandedId === item.id;
                    const preview = item.content.length > 150
                        ? item.content.slice(0, 150) + '...'
                        : item.content;

                    return (
                        <article
                            key={item.id}
                            className="bg-white rounded-xl border border-gray-100 p-5 md:p-6 hover:shadow-md transition-shadow"
                            style={{ borderLeft: `4px solid ${accent}` }}
                        >
                            <div className="flex items-center gap-2 mb-2">
                                {meta && (
                                    <span
                                        className="px-2 py-0.5 rounded-full text-[11px] font-semibold shrink-0"
                                        style={{ backgroundColor: hexToRgba(accent, 0.13), color: accent }}
                                    >
                                        {meta.icon} {cat}
                                    </span>
                                )}
                                <time className="text-xs text-gray-400 ml-auto shrink-0">
                                    {item.created_at.slice(0, 10)}
                                </time>
                            </div>

                            <h2 className={`font-semibold text-gray-900 mb-2 leading-snug ${isWorldFood ? 'text-xl' : 'text-lg'}`}>
                                {title}
                            </h2>

                            <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">
                                {isExpanded ? item.content : preview}
                            </p>

                            <div className="flex items-center gap-3 mt-3">
                                {item.content.length > 150 && (
                                    <button
                                        onClick={() => setExpandedId(isExpanded ? null : item.id)}
                                        className="text-xs text-orange-500 hover:text-orange-600"
                                    >
                                        {isExpanded ? '收起' : '展开全文'}
                                    </button>
                                )}
                                {item.source_url && (
                                    <a
                                        href={item.source_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs px-2.5 py-1 rounded-full border border-gray-200 text-gray-500 hover:text-orange-500 hover:border-orange-300 transition-colors"
                                    >
                                        阅读原文 ↗
                                    </a>
                                )}
                            </div>
                        </article>
                    );
                })}
            </div>
        </div>
    );
}
