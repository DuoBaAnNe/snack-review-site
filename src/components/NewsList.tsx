'use client';

import { useRef, useState } from 'react';
import type { NewsItem } from '@/types';

// Category → badge color, cover emoji, and a cover gradient (two stops).
const CATEGORIES: Record<string, { color: string; icon: string; grad: [string, string] }> = {
    '创新': { color: '#f97316', icon: '💡', grad: ['#fb923c', '#ea580c'] },
    '科研': { color: '#3b82f6', icon: '🔬', grad: ['#60a5fa', '#2563eb'] },
    '产业': { color: '#10b981', icon: '🏭', grad: ['#34d399', '#059669'] },
    '法规': { color: '#8b5cf6', icon: '📋', grad: ['#a78bfa', '#7c3aed'] },
    '食品安全': { color: '#ef4444', icon: '⚠️', grad: ['#f87171', '#dc2626'] },
    '资讯': { color: '#6b7280', icon: '📰', grad: ['#9ca3af', '#4b5563'] },
    '环球美食': { color: '#eab308', icon: '🌍', grad: ['#fbbf24', '#d97706'] },
    // Legacy tags
    '研究': { color: '#3b82f6', icon: '🔬', grad: ['#60a5fa', '#2563eb'] },
    '安全': { color: '#ef4444', icon: '⚠️', grad: ['#f87171', '#dc2626'] },
};
const FALLBACK = CATEGORIES['资讯'];

function parseTitle(raw: string): { cat: string | null; title: string } {
    const m = raw.match(/^【([^】]{1,6})】\s*(.*)$/);
    if (m && m[2]) return { cat: m[1], title: m[2] };
    return { cat: null, title: raw };
}

const MAX_ROWS = 6;
const COLS = 3;               // lg grid columns
const MAX_SHOWN = MAX_ROWS * COLS; // at most 6 rows
const MAX_MOBILE_SHOWN = 10;

export function scrollToNewsSection(listElement: HTMLElement | null) {
    const scrollTarget = listElement?.closest<HTMLElement>('#sec-news') ?? listElement;
    scrollTarget?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export default function NewsList({ news }: { news: NewsItem[] }) {
    const [expanded, setExpanded] = useState<Set<number>>(new Set());
    const [filter, setFilter] = useState<string | null>(null);
    const [showAll, setShowAll] = useState(false);
    const newsListRef = useRef<HTMLDivElement>(null);

    if (news.length === 0) {
        return (
            <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
                <p className="text-gray-400">还没有资讯，敬请期待！</p>
            </div>
        );
    }

    const presentCats = [...new Set(
        news.map((n) => parseTitle(n.title).cat).filter((c): c is string => !!c && !!CATEGORIES[c])
    )];

    const matched = filter ? news.filter((n) => parseTitle(n.title).cat === filter) : news;
    const shown = showAll ? matched : matched.slice(0, MAX_SHOWN);
    const hasMore = matched.length > MAX_SHOWN;
    const hasMoreOnMobile = matched.length > MAX_MOBILE_SHOWN;

    function toggle(id: number) {
        setExpanded((prev) => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    }

    function collapseNews() {
        setShowAll(false);
        requestAnimationFrame(() => {
            scrollToNewsSection(newsListRef.current);
        });
    }

    return (
        <div ref={newsListRef}>
            {/* Category filters */}
            {presentCats.length > 1 && (
                <div className="flex flex-wrap items-center gap-2 mb-5">
                    <button
                        onClick={() => setFilter(null)}
                        className={`px-3.5 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                            filter === null ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
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
                                className="px-3.5 py-1.5 rounded-full text-xs font-medium border transition-colors"
                                style={active
                                    ? { backgroundColor: meta.color, color: '#fff', borderColor: meta.color }
                                    : { backgroundColor: '#fff', color: meta.color, borderColor: meta.color + '55' }}
                            >
                                {meta.icon} {cat}
                            </button>
                        );
                    })}
                </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
                {shown.map((item, index) => {
                    const { cat, title } = parseTitle(item.title);
                    const meta = (cat && CATEGORIES[cat]) || FALLBACK;
                    const isExp = expanded.has(item.id);
                    const date = item.created_at.slice(0, 10);
                    return (
                        <article
                            key={item.id}
                            className={`group bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-all flex-col ${
                                !showAll && index >= MAX_MOBILE_SHOWN ? 'hidden md:flex' : 'flex'
                            }`}
                        >
                            {/* Cover */}
                            <div
                                className="relative h-32 overflow-hidden"
                                style={{ background: `linear-gradient(135deg, ${meta.grad[0]}, ${meta.grad[1]})` }}
                            >
                                <span className="absolute -right-2 -bottom-3 text-[92px] leading-none opacity-25 select-none group-hover:scale-110 transition-transform origin-bottom-right">
                                    {meta.icon}
                                </span>
                                <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-white/25 backdrop-blur text-white text-[11px] font-semibold">
                                    {meta.icon} {cat || '资讯'}
                                </span>
                                <time className="absolute top-3.5 right-3 text-[11px] text-white/90 font-medium">{date}</time>
                            </div>

                            {/* Body */}
                            <div className="p-4 flex flex-col flex-1">
                                <h3 className="font-bold text-gray-900 leading-snug line-clamp-2 mb-2">{title}</h3>
                                <p className={`text-sm text-gray-600 leading-relaxed whitespace-pre-wrap ${isExp ? '' : 'line-clamp-3'}`}>
                                    {item.content}
                                </p>
                                <div className="mt-auto pt-3 flex items-center gap-3">
                                    {item.content.length > 90 && (
                                        <button
                                            onClick={() => toggle(item.id)}
                                            className="text-xs font-medium text-orange-500 hover:text-orange-600"
                                        >
                                            {isExp ? '收起' : '展开全文'}
                                        </button>
                                    )}
                                    {item.source_url && (
                                        <a
                                            href={item.source_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="ml-auto text-xs px-2.5 py-1 rounded-full border border-gray-200 text-gray-500 hover:text-orange-500 hover:border-orange-300 transition-colors"
                                        >
                                            阅读原文 ↗
                                        </a>
                                    )}
                                </div>
                            </div>
                        </article>
                    );
                })}
            </div>

            {showAll && hasMoreOnMobile && (
                <div className="fixed bottom-20 right-5 z-30 md:sticky md:bottom-6 md:float-right md:mt-6 md:ml-auto md:w-fit">
                    <button
                        onClick={collapseNews}
                        aria-label="收起资讯列表"
                        className="rounded-full bg-gray-900 px-5 py-2 text-sm text-white shadow-lg transition-colors hover:bg-gray-700"
                    >
                        收起资讯
                    </button>
                </div>
            )}

            {hasMoreOnMobile && !showAll && (
                <div className={`text-center mt-6 ${hasMore ? '' : 'md:hidden'}`}>
                    <button
                        onClick={() => setShowAll(true)}
                        className="px-5 py-2 rounded-full border border-gray-200 text-sm text-gray-600 hover:border-orange-300 hover:text-orange-500 transition-colors"
                    >
                        {`查看更多资讯（共 ${matched.length} 条）`}
                    </button>
                </div>
            )}
        </div>
    );
}
