'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { Snack } from '@/types';
import ImageCarousel from './ImageCarousel';
import RatingBar from './RatingBar';

const RATINGS: { key: keyof Snack; label: string; icon: string }[] = [
    { key: 'rating_taste_health', label: '口感与味道', icon: '👅' },
    { key: 'rating_ingredients_health', label: '配料与健康', icon: '🌿' },
    { key: 'rating_packaging_portability', label: '包装与便携', icon: '📦' },
    { key: 'rating_use_case', label: '适用场景', icon: '🎯' },
    { key: 'rating_value', label: '性价比', icon: '💰' },
];

function parseIngredients(text: string): string[] {
    return text
        .split(/[,，、;；\n]+/)
        .map((s) => s.trim())
        .filter(Boolean);
}

export default function SnackCard({ snack }: { snack: Snack }) {
    const [expanded, setExpanded] = useState(false);
    const ingredients = parseIngredients(snack.ingredients);

    return (
        <div className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-100 hover:shadow-lg transition-shadow"
            style={{ animation: 'fadeInUp 0.4s ease-out' }}>
            <div className="flex flex-col md:grid md:grid-cols-[200px_1fr_1fr_1fr_1fr]">
                {/* Col 1: Image */}
                <div className="md:border-r border-b border-gray-100 md:border-b-0 max-h-[300px] md:max-h-none">
                    <ImageCarousel images={snack.images} />
                </div>

                {/* Col 2: Brand & Product & Manufacturer */}
                <div className="md:border-r border-b border-gray-100 md:border-b-0 p-4">
                    <Link href={`/snacks/${snack.id}`} className="hover:underline">
                        <h2 className="text-lg font-bold text-gray-900 leading-tight">
                            {snack.product_name}
                        </h2>
                    </Link>
                    {snack.brand_name && (
                        <p className="text-sm text-orange-600 font-medium mt-1">
                            {snack.brand_name}
                        </p>
                    )}
                    <div className="mt-3 space-y-0.5 text-xs text-gray-400">
                        {snack.manufacturer_name && <p>制造商: {snack.manufacturer_name}</p>}
                        {snack.manufacturer_address && <p>地址: {snack.manufacturer_address}</p>}
                        {snack.brand_company && <p>品牌方: {snack.brand_company}</p>}
                    </div>
                </div>

                {/* Col 3: Ingredients */}
                <div className="md:border-r border-b border-gray-100 md:border-b-0 p-4">
                    <h3 className="font-semibold text-gray-800 mb-2 text-sm">配料表</h3>
                    {ingredients.length > 0 ? (
                        <ul className="text-xs text-gray-500 space-y-1 max-h-40 overflow-y-auto">
                            {ingredients.map((item, i) => (
                                <li key={i} className="flex items-start gap-1">
                                    <span className="text-gray-300 mt-0.5 shrink-0">·</span>
                                    <span>{item}</span>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-xs text-gray-300 italic">暂无配料信息</p>
                    )}
                </div>

                {/* Col 4: Ratings */}
                <div className="md:border-r border-b border-gray-100 md:border-b-0 p-4">
                    <h3 className="font-semibold text-gray-800 mb-3 text-sm">评分</h3>
                    <div className="space-y-2">
                        {RATINGS.map(({ key, label, icon }) => (
                            <RatingBar key={key} label={label} icon={icon} value={snack[key] as number} />
                        ))}
                    </div>
                </div>

                {/* Col 5: Review Text */}
                <div className="p-4">
                    <h3 className="font-semibold text-gray-800 mb-2 text-sm">评测</h3>
                    {snack.review_text ? (
                        <>
                            <p className={`text-xs text-gray-600 leading-relaxed whitespace-pre-wrap ${expanded ? '' : 'line-clamp-6'}`}>
                                {snack.review_text}
                            </p>
                            {snack.review_text.length > 200 && (
                                <button
                                    onClick={() => setExpanded(!expanded)}
                                    className="text-xs text-orange-500 hover:text-orange-600 mt-1"
                                >
                                    {expanded ? '收起' : '展开'}
                                </button>
                            )}
                        </>
                    ) : (
                        <p className="text-xs text-gray-300 italic">暂无评测</p>
                    )}
                </div>
            </div>
        </div>
    );
}
