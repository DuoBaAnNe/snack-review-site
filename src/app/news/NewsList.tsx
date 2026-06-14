'use client';

import { useState } from 'react';
import type { NewsItem } from '@/types';

export default function NewsList({ news }: { news: NewsItem[] }) {
    const [expandedId, setExpandedId] = useState<number | null>(null);

    if (news.length === 0) {
        return (
            <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
                <p className="text-gray-400">暂无新闻，敬请期待！</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {news.map((item) => {
                const isExpanded = expandedId === item.id;
                const preview = item.content.length > 150
                    ? item.content.slice(0, 150) + '...'
                    : item.content;

                return (
                    <article
                        key={item.id}
                        className="bg-white rounded-xl border border-gray-100 p-6 hover:shadow-md transition-shadow"
                    >
                        <h2 className="text-lg font-semibold text-gray-900 mb-2">
                            {item.title}
                        </h2>
                        <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">
                            {isExpanded ? item.content : preview}
                        </p>
                        <div className="flex items-center justify-between mt-3">
                            <div className="flex items-center gap-3">
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
                                        className="text-xs text-gray-400 hover:text-orange-500"
                                    >
                                        🔗 来源
                                    </a>
                                )}
                            </div>
                            <time className="text-xs text-gray-400">
                                {item.created_at.slice(0, 10)}
                            </time>
                        </div>
                    </article>
                );
            })}
        </div>
    );
}
