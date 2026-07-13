'use client';

import { useState } from 'react';
import type { NewsItem } from '@/types';

export default function NewsManager({ news: initialNews }: { news: NewsItem[] }) {
    const [news, setNews] = useState(initialNews);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({ title: '', content: '', source_url: '' });
    const [showForm, setShowForm] = useState(false);

    async function handleAdd() {
        if (!form.title.trim() || !form.content.trim()) return;
        setSaving(true);
        const res = await fetch('/api/news', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(form),
        });
        if (res.ok) {
            const created = await res.json();
            setNews((prev) => [created, ...prev]);
            setForm({ title: '', content: '', source_url: '' });
            setShowForm(false);
        }
        setSaving(false);
    }

    async function handleDelete(id: number) {
        const res = await fetch(`/api/news/${id}`, { method: 'DELETE' });
        if (res.ok) {
            setNews((prev) => prev.filter((n) => n.id !== id));
        }
    }

    return (
        <div>
            <button
                onClick={() => setShowForm(!showForm)}
                className="px-4 py-2 bg-white border border-gray-200 text-gray-600 rounded-lg text-sm hover:border-amber-300 transition-colors mb-4"
            >
                {showForm ? '取消' : '+ 添加新闻'}
            </button>

            {showForm && (
                <div className="bg-white rounded-xl border border-gray-100 p-6 mb-6 space-y-3">
                    <input
                        type="text"
                        placeholder="标题"
                        value={form.title}
                        onChange={(e) => setForm({ ...form, title: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-400"
                    />
                    <textarea
                        rows={6}
                        placeholder="内容"
                        value={form.content}
                        onChange={(e) => setForm({ ...form, content: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-400 resize-y"
                    />
                    <input
                        type="url"
                        placeholder="来源链接 (可选)"
                        value={form.source_url}
                        onChange={(e) => setForm({ ...form, source_url: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-400"
                    />
                    <button
                        onClick={handleAdd}
                        disabled={saving}
                        className="px-4 py-2 bg-gradient-to-r from-amber-400 to-orange-500 text-white font-medium rounded-lg text-sm hover:opacity-90 disabled:opacity-50"
                    >
                        {saving ? '保存中...' : '发布'}
                    </button>
                </div>
            )}

            {news.length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-100 p-8 text-center">
                    <p className="text-gray-400 text-sm">暂无新闻</p>
                </div>
            ) : (
                <div className="bg-white rounded-xl border border-gray-100 overflow-x-auto">
                    <table className="w-full min-w-[500px]">
                        <thead>
                            <tr className="border-b border-gray-100 bg-gray-50">
                                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">标题</th>
                                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">内容</th>
                                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">日期</th>
                                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">操作</th>
                            </tr>
                        </thead>
                        <tbody>
                            {news.map((item) => (
                                <tr key={item.id} className="border-b border-gray-50 hover:bg-gray-50">
                                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                                        {item.title}
                                    </td>
                                    <td className="px-4 py-3 text-xs text-gray-500 max-w-[300px] truncate">
                                        {item.content.slice(0, 80)}
                                    </td>
                                    <td className="px-4 py-3 text-xs text-gray-400">
                                        {item.created_at.slice(0, 10)}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <button
                                            onClick={() => handleDelete(item.id)}
                                            className="text-xs text-red-400 hover:text-red-600"
                                        >
                                            删除
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
