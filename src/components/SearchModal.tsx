'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import type { Snack } from '@/types';

interface Props {
    snacks: Snack[];
    onClose: () => void;
}

export default function SearchModal({ snacks, onClose }: Props) {
    const [query, setQuery] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        inputRef.current?.focus();
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [onClose]);

    const results = query.trim().length > 0
        ? snacks.filter((s) => {
            const q = query.toLowerCase();
            return (
                s.brand_name.toLowerCase().includes(q) ||
                s.product_name.toLowerCase().includes(q) ||
                s.ingredients.toLowerCase().includes(q)
            );
        })
        : [];

    return (
        <div
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-start justify-center pt-[15vh]"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[70vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200">
                    <span className="text-lg">🔍</span>
                    <input
                        ref={inputRef}
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="搜索品牌、产品、配料..."
                        className="flex-1 text-sm py-2 outline-none bg-transparent"
                    />
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 text-xl px-1"
                    >
                        ✕
                    </button>
                </div>
                <div className="overflow-y-auto flex-1 p-2">
                    {query.trim().length === 0 ? (
                        <p className="text-gray-400 text-sm text-center py-8">
                            输入关键词开始搜索
                        </p>
                    ) : results.length === 0 ? (
                        <p className="text-gray-400 text-sm text-center py-8">
                            没有找到匹配的零食
                        </p>
                    ) : (
                        <ul className="space-y-1">
                            {results.map((s) => (
                                <li key={s.id}>
                                    <Link
                                        href={`/snacks/${s.id}`}
                                        onClick={onClose}
                                        className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-amber-50 transition-colors"
                                    >
                                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 shrink-0">
                                            {s.category}
                                        </span>
                                        <span className="text-sm font-medium text-gray-800">
                                            {s.brand_name && `${s.brand_name} · `}{s.product_name}
                                        </span>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </div>
    );
}
