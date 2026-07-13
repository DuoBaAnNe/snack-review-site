'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Snack, NewsItem } from '@/types';

export default function RecycleBin({
    snacks: initialSnacks,
    news: initialNews,
}: {
    snacks: Snack[];
    news: NewsItem[];
}) {
    const router = useRouter();
    const [snacks, setSnacks] = useState(initialSnacks);
    const [news, setNews] = useState(initialNews);
    const [message, setMessage] = useState('');

    async function handleRestoreSnack(id: number, name: string) {
        if (!confirm(`恢复零食「${name}」？`)) return;
        const res = await fetch(`/api/snacks/${id}`, { method: 'PATCH' });
        if (res.ok) {
            setSnacks((prev) => prev.filter((s) => s.id !== id));
            setMessage(`已恢复零食「${name}」`);
            router.refresh();
        }
    }

    async function handleRestoreNews(id: number, title: string) {
        if (!confirm(`恢复新闻「${title}」？`)) return;
        const res = await fetch(`/api/news/${id}`, { method: 'PATCH' });
        if (res.ok) {
            setNews((prev) => prev.filter((n) => n.id !== id));
            setMessage(`已恢复新闻「${title}」`);
            router.refresh();
        }
    }

    const empty = snacks.length === 0 && news.length === 0;
    if (empty) {
        return <p className="text-gray-400 text-center py-10">回收站为空</p>;
    }

    return (
        <div className="space-y-8">
            {message && <p className="text-green-500 text-sm">{message}</p>}

            {/* Deleted snacks */}
            <div>
                <h2 className="text-sm font-semibold text-gray-500 mb-3">
                    已删除的零食（{snacks.length}）
                </h2>
                {snacks.length === 0 ? (
                    <p className="text-gray-400 text-sm">无</p>
                ) : (
                    <div className="space-y-2">
                        {snacks.map((snack) => (
                            <div key={snack.id} className="flex items-center justify-between bg-white rounded-lg border border-gray-100 p-3">
                                <div>
                                    <span className="font-medium text-gray-700">{snack.brand_name}</span>
                                    <span className="text-gray-400 mx-2">|</span>
                                    <span className="text-gray-600">{snack.product_name}</span>
                                    <span className="text-gray-400 ml-2 text-xs">{snack.created_at?.slice(0, 10)}</span>
                                </div>
                                <button
                                    onClick={() => handleRestoreSnack(snack.id, snack.product_name)}
                                    className="px-3 py-1 text-xs text-green-600 hover:bg-green-50 rounded transition-colors"
                                >
                                    恢复
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Deleted news */}
            <div>
                <h2 className="text-sm font-semibold text-gray-500 mb-3">
                    已删除的资讯（{news.length}）
                </h2>
                {news.length === 0 ? (
                    <p className="text-gray-400 text-sm">无</p>
                ) : (
                    <div className="space-y-2">
                        {news.map((item) => (
                            <div key={item.id} className="flex items-center justify-between bg-white rounded-lg border border-gray-100 p-3 gap-3">
                                <div className="min-w-0">
                                    <span className="text-gray-700 truncate block">{item.title}</span>
                                    <span className="text-gray-400 text-xs">{item.created_at?.slice(0, 10)}</span>
                                </div>
                                <button
                                    onClick={() => handleRestoreNews(item.id, item.title)}
                                    className="px-3 py-1 text-xs text-green-600 hover:bg-green-50 rounded transition-colors shrink-0"
                                >
                                    恢复
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
