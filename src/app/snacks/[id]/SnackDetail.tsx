'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { Snack } from '@/types';
import ImageCarousel from '@/components/ImageCarousel';
import RatingBar from '@/components/RatingBar';
import { getImageUrl } from '@/lib/image-url';
import type { SnackImage } from '@/types';

const RATINGS: { key: keyof Snack; label: string; icon: string }[] = [
    { key: 'rating_taste_health', label: '口感与味道', icon: '👅' },
    { key: 'rating_ingredients_health', label: '配料与健康', icon: '🌿' },
    { key: 'rating_packaging_portability', label: '包装与便携', icon: '📦' },
    { key: 'rating_use_case', label: '适用场景', icon: '🎯' },
    { key: 'rating_value', label: '性价比', icon: '💰' },
];

interface Props {
    snack: Snack;
    related: Snack[];
}

export default function SnackDetail({ snack, related }: Props) {
    const ingredients = snack.ingredients
        .split(/[,，、;；\n]+/)
        .map((s) => s.trim())
        .filter(Boolean);

    const avgRating = (
        (snack.rating_taste_health +
            snack.rating_ingredients_health +
            snack.rating_packaging_portability +
            snack.rating_use_case +
            snack.rating_value) /
        5
    ).toFixed(1);

    return (
        <div className="space-y-6">
            {/* Hero: Image + Header */}
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                <div className="flex flex-col md:flex-row">
                    {/* Image */}
                    <div className="md:w-[400px] shrink-0">
                        <ImageCarousel images={snack.images} alt={snack.product_name} />
                    </div>
                    {/* Header info */}
                    <div className="p-6 flex flex-col justify-center flex-1">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 self-start mb-3">
                            {snack.category}
                        </span>
                        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
                            {snack.product_name}
                        </h1>
                        {snack.brand_name && (
                            <p className="text-lg text-orange-500 font-medium mt-1">{snack.brand_name}</p>
                        )}
                        <div className="flex items-center gap-2 mt-3">
                            <span className="text-2xl font-bold text-orange-500">{avgRating}</span>
                            <span className="text-xs text-gray-400">/ 10 综合评分</span>
                        </div>
                        <div className="mt-4 space-y-1 text-xs text-gray-400">
                            {snack.manufacturer_name && <p>品牌持有方: {snack.manufacturer_name}</p>}
                            {snack.manufacturer_address && <p>地址: {snack.manufacturer_address}</p>}
                            {snack.brand_company && <p>品牌方: {snack.brand_company}</p>}
                        </div>
                        <p className="text-xs text-gray-400 mt-3">
                            更新于 {snack.updated_at.slice(0, 10)}
                        </p>
                    </div>
                </div>
            </div>

            {/* Ratings */}
            <div className="bg-white rounded-xl border border-gray-100 p-6">
                <h2 className="font-semibold text-gray-800 mb-4">评分详情</h2>
                <div className="space-y-3">
                    {RATINGS.map(({ key, label, icon }) => (
                        <RatingBar key={key} label={label} icon={icon} value={snack[key] as number} />
                    ))}
                </div>
            </div>

            {/* Ingredients */}
            <div className="bg-white rounded-xl border border-gray-100 p-6">
                <h2 className="font-semibold text-gray-800 mb-4">配料表</h2>
                {ingredients.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                        {ingredients.map((item, i) => (
                            <Link
                                key={i}
                                href={`/ingredients`}
                                className="px-3 py-1 bg-gray-50 border border-gray-200 rounded-full text-xs text-gray-600 hover:border-amber-300 hover:text-amber-600 transition-colors"
                            >
                                {item}
                            </Link>
                        ))}
                    </div>
                ) : (
                    <p className="text-sm text-gray-400">暂无配料信息</p>
                )}
            </div>

            {/* Review Text */}
            <div className="bg-white rounded-xl border border-gray-100 p-6">
                <h2 className="font-semibold text-gray-800 mb-4">评测</h2>
                {snack.review_text ? (
                    <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                        {snack.review_text}
                    </p>
                ) : (
                    <p className="text-sm text-gray-400 italic">暂无评测</p>
                )}
            </div>

            {/* Related Snacks */}
            {related.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-100 p-6">
                    <h2 className="font-semibold text-gray-800 mb-4">同类零食</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {related.map((r) => (
                            // Native anchor (full-page nav): client-side routing
                            // between two /snacks/[id] pages doesn't repaint on
                            // this site, so the card looked unclickable.
                            <a
                                key={r.id}
                                href={`/snacks/${r.id}`}
                                className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 hover:bg-amber-50 transition-colors cursor-pointer"
                            >
                                {r.images[0] ? (
                                    <img
                                        src={getImageUrl(r.images[0])}
                                        alt={r.product_name}
                                        className="w-12 h-12 rounded object-cover shrink-0"
                                    />
                                ) : (
                                    <div className="w-12 h-12 rounded bg-gray-200 shrink-0" />
                                )}
                                <div className="min-w-0">
                                    <p className="text-sm font-medium text-gray-800 truncate">{r.product_name}</p>
                                    <p className="text-xs text-gray-400 truncate">{r.brand_name}</p>
                                </div>
                            </a>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
