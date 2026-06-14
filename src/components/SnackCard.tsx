'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { Snack, Review } from '@/types';
import ImageCarousel from './ImageCarousel';
import RatingBar from './RatingBar';

const RATINGS: { key: keyof Snack; label: string; icon: string }[] = [
    { key: 'rating_taste_health', label: '口感与味道', icon: '👅' },
    { key: 'rating_ingredients_health', label: '配料与健康', icon: '🌿' },
    { key: 'rating_packaging_portability', label: '包装与便携', icon: '📦' },
    { key: 'rating_use_case', label: '适用场景', icon: '🎯' },
    { key: 'rating_value', label: '性价比', icon: '💰' },
];

const REVIEW_RATING_LABELS: { key: string; short: string }[] = [
    { key: 'rating_taste_health', short: '口感' },
    { key: 'rating_ingredients_health', short: '配料' },
    { key: 'rating_packaging_portability', short: '包装' },
    { key: 'rating_use_case', short: '场景' },
    { key: 'rating_value', short: '性价比' },
];

function parseIngredients(text: string): string[] {
    return text
        .split(/[,，、;；\n]+/)
        .map((s) => s.trim())
        .filter(Boolean);
}

export default function SnackCard({ snack }: { snack: Snack }) {
    const [expanded, setExpanded] = useState(false);
    const [showMoreReviews, setShowMoreReviews] = useState(false);
    const [reviews, setReviews] = useState<Review[]>([]);
    const [reviewsLoaded, setReviewsLoaded] = useState(false);
    const ingredients = parseIngredients(snack.ingredients);

    async function loadReviews() {
        if (reviewsLoaded) return;
        try {
            const res = await fetch(`/api/snacks/${snack.id}/reviews`);
            if (res.ok) {
                const data = await res.json();
                setReviews(data);
            }
        } catch { /* ignore */ }
        setReviewsLoaded(true);
    }

    async function handleToggleReviews() {
        if (!showMoreReviews && !reviewsLoaded) {
            await loadReviews();
        }
        setShowMoreReviews(!showMoreReviews);
    }

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
                    {snack.created_by && (
                        <p className="text-xs text-gray-400 mt-2">首评: {snack.created_by}</p>
                    )}
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

            {/* More Reviews Section */}
            <div className="border-t border-gray-100">
                <button
                    onClick={handleToggleReviews}
                    className="w-full text-center text-sm text-orange-500 hover:text-orange-600 py-2 transition-colors"
                >
                    {showMoreReviews ? '收起' : reviewsLoaded ? `查看更多 (${reviews.length})` : '查看更多'}
                </button>
                {showMoreReviews && (
                    <div className="px-4 pb-4 space-y-3">
                        {reviews.length === 0 && reviewsLoaded && (
                            <p className="text-center text-xs text-gray-400 py-4">暂无更多评论</p>
                        )}
                        {reviews.map((review) => (
                            <div key={review.id} className="border-l-2 border-amber-200 pl-3 py-2">
                                <div className="flex items-center gap-2 text-xs text-gray-400 mb-2">
                                    <span className="font-medium text-gray-600">{review.username || '匿名'}</span>
                                    <span>{review.created_at.slice(0, 10)}</span>
                                </div>
                                <div className="flex flex-wrap gap-x-3 gap-y-1 mb-2">
                                    {REVIEW_RATING_LABELS.map(({ key, short }) => (
                                        <span key={key} className="text-xs text-gray-500">
                                            {short}: {(review as any)[key]}
                                        </span>
                                    ))}
                                </div>
                                <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-wrap line-clamp-4">
                                    {review.review_text}
                                </p>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
