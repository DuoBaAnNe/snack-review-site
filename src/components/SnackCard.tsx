'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { Snack, Review } from '@/types';
import ImageCarousel from './ImageCarousel';
import RatingBar from './RatingBar';
import ConfirmDialog from './ConfirmDialog';

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
    const parts: string[] = [];
    let depth = 0;
    let current = '';
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (ch === '(' || ch === '（') { depth++; current += ch; }
        else if (ch === ')' || ch === '）') { depth = Math.max(0, depth - 1); current += ch; }
        else if (depth === 0 && /[,，、;；\n]/.test(ch)) {
            const trimmed = current.trim();
            if (trimmed) parts.push(trimmed);
            current = '';
        } else {
            current += ch;
        }
    }
    const trimmed = current.trim();
    if (trimmed) parts.push(trimmed);
    return parts;
}

function defaultReviewRatings() {
    return {
        rating_taste_health: 5,
        rating_ingredients_health: 5,
        rating_packaging_portability: 5,
        rating_use_case: 5,
        rating_value: 5,
    };
}

export default function SnackCard({ snack, isAdmin: isAdminProp }: { snack: Snack; isAdmin?: boolean }) {
    const router = useRouter();
    const [expanded, setExpanded] = useState(false);
    const [showIngredients, setShowIngredients] = useState(false);
    const [showRatingsMobile, setShowRatingsMobile] = useState(false);
    const [showMoreReviews, setShowMoreReviews] = useState(false);
    const [reviews, setReviews] = useState<Review[]>([]);
    const [reviewsLoaded, setReviewsLoaded] = useState(false);
    const [isAdminState, setIsAdminState] = useState(false);
    const isAdmin = isAdminProp ?? isAdminState;

    // In-app confirm dialog state (replaces browser confirm())
    const [confirmState, setConfirmState] = useState<{ message: string; action: () => void } | null>(null);

    // Review form state
    const [reviewText, setReviewText] = useState('');
    const [reviewRatings, setReviewRatings] = useState(defaultReviewRatings());
    const [reviewSaving, setReviewSaving] = useState(false);
    const [reviewError, setReviewError] = useState('');

    const ingredients = parseIngredients(snack.ingredients);
    const ingredientsText = ingredients.join('，');

    const avgScore = (
        snack.rating_taste_health +
        snack.rating_ingredients_health +
        snack.rating_packaging_portability +
        snack.rating_use_case +
        snack.rating_value
    ) / 5;
    const scoreColor =
        avgScore <= 3 ? 'text-red-500'
            : avgScore <= 6 ? 'text-amber-500'
                : 'text-green-600';

    const otherReviewCount = reviewsLoaded ? reviews.length : (snack.review_count ?? 0);
    const reviewerCount = otherReviewCount + (snack.review_text ? 1 : 0);

    useEffect(() => {
        if (isAdminProp !== undefined) return;
        fetch('/api/auth/check')
            .then(res => res.json())
            .then(data => setIsAdminState(data.authenticated))
            .catch(() => setIsAdminState(false));
    }, [isAdminProp]);

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

    async function handleSubmitReview() {
        if (!reviewText.trim()) {
            setReviewError('请输入评测内容');
            return;
        }
        setReviewSaving(true);
        setReviewError('');
        try {
            const res = await fetch(`/api/snacks/${snack.id}/reviews`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...reviewRatings, review_text: reviewText }),
            });
            if (res.ok) {
                const newReview = await res.json();
                setReviews((prev) => [...prev, newReview]);
                setReviewText('');
                setReviewRatings(defaultReviewRatings());
            } else {
                const data = await res.json();
                setReviewError(data.error || '提交失败');
            }
        } catch {
            setReviewError('网络错误，请重试');
        }
        setReviewSaving(false);
    }

    function handleDeleteSnack() {
        setConfirmState({
            message: `确定要删除「${snack.product_name}」这个零食吗？`,
            action: async () => {
                const res = await fetch(`/api/snacks/${snack.id}`, { method: 'DELETE' });
                if (res.ok) {
                    router.refresh();
                }
            },
        });
    }

    function handleDeleteReview(reviewId: number) {
        setConfirmState({
            message: '确定要删除这条评论吗？',
            action: async () => {
                const res = await fetch(`/api/snacks/${snack.id}/reviews?reviewId=${reviewId}`, { method: 'DELETE' });
                if (res.ok) {
                    setReviews((prev) => prev.filter((r) => r.id !== reviewId));
                }
            },
        });
    }

    const hasOtherReviews = reviews.length > 0;
    const toggleLabel = showMoreReviews
        ? '收起'
        : hasOtherReviews
            ? `查看更多 (${reviews.length}) / 我也要评`
            : reviewsLoaded
                ? '我也要评'
                : '查看更多 / 我也要评';

    return (
        <div className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-100 hover:shadow-lg transition-shadow relative"
            style={{ animation: 'fadeInUp 0.4s ease-out' }}>
            {confirmState && (
                <ConfirmDialog
                    message={confirmState.message}
                    onCancel={() => setConfirmState(null)}
                    onConfirm={() => {
                        confirmState.action();
                        setConfirmState(null);
                    }}
                />
            )}

            {/* Admin delete snack button */}
            {isAdmin && (
                <button
                    onClick={handleDeleteSnack}
                    className="absolute top-2 right-2 z-20 w-6 h-6 rounded-full bg-red-400/80 hover:bg-red-500 text-white text-xs flex items-center justify-center transition-colors"
                    title="删除零食"
                >
                    ✕
                </button>
            )}

            {/* min height reserves room for the expanded ingredients, so the card never resizes */}
            <div className="flex flex-col md:grid md:grid-cols-[240px_1.2fr_1fr_1.4fr] md:min-h-[240px]">
                {/* Col 1: Image — stretches from the top edge to the bottom edge on desktop */}
                <div className="relative md:border-r border-b border-gray-100 md:border-b-0">
                    <div className="aspect-square max-h-[300px] w-full overflow-hidden md:absolute md:inset-0 md:aspect-auto md:max-h-none">
                        <ImageCarousel images={snack.images} alt={snack.product_name} fill />
                    </div>
                </div>

                {/* Col 2: Name, brand, overall score, collapsed ingredients */}
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

                    <div className="mt-3 flex items-baseline gap-1.5">
                        <span className={`text-3xl font-black leading-none ${scoreColor}`}>
                            {avgScore.toFixed(1)}
                        </span>
                        <span className="text-xs text-gray-400">/ 10 综合评分</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1.5">
                        {reviewerCount > 0 ? `共 ${reviewerCount} 人评` : '暂无人评'}
                        {snack.created_by && (
                            <>
                                {' · 首评 '}
                                <span className="font-semibold text-orange-500">{snack.created_by}</span>
                            </>
                        )}
                    </p>

                    {ingredients.length > 0 ? (
                        <div className="mt-3">
                            <button
                                onClick={() => setShowIngredients(!showIngredients)}
                                className="text-xs text-gray-500 hover:text-orange-600 transition-colors"
                            >
                                配料 {ingredients.length} 项 {showIngredients ? '▾' : '▸'}
                            </button>
                            {showIngredients && (
                                // line-clamp keeps the card height stable; the full
                                // list is on the detail page (and in the hover tip)
                                <p
                                    className="mt-2 text-xs text-gray-500 leading-relaxed line-clamp-3"
                                    title={ingredientsText}
                                >
                                    {ingredientsText}
                                </p>
                            )}
                        </div>
                    ) : (
                        <p className="mt-3 text-xs text-gray-400">暂无配料信息</p>
                    )}
                </div>

                {/* Col 3: Ratings (collapsible on mobile) */}
                <div className="md:border-r border-b border-gray-100 md:border-b-0 p-4">
                    <button
                        onClick={() => setShowRatingsMobile(!showRatingsMobile)}
                        className="md:hidden font-semibold text-gray-800 text-sm"
                    >
                        评分 {showRatingsMobile ? '▾' : '▸'}
                    </button>
                    <h3 className="hidden md:block font-semibold text-gray-800 mb-3 text-sm">评分</h3>
                    <div className={`space-y-2 mt-3 md:mt-0 ${showRatingsMobile ? '' : 'hidden md:block'}`}>
                        {RATINGS.map(({ key, label, icon }) => (
                            <RatingBar key={key} label={label} icon={icon} value={snack[key] as number} />
                        ))}
                    </div>
                </div>

                {/* Col 4: Review Text; the toggle button sticks to the bottom edge */}
                <div className="p-4 flex flex-col">
                    <h3 className="font-semibold text-gray-800 mb-2 text-sm">评测</h3>
                    {snack.review_text ? (
                        <>
                            <p className={`text-sm text-gray-700 leading-relaxed whitespace-pre-wrap ${expanded ? '' : 'line-clamp-6'}`}>
                                {snack.review_text}
                            </p>
                            {snack.review_text.length > 160 && (
                                <button
                                    onClick={() => setExpanded(!expanded)}
                                    className="self-start text-xs text-orange-500 hover:text-orange-600 mt-1"
                                >
                                    {expanded ? '收起' : '展开'}
                                </button>
                            )}
                        </>
                    ) : (
                        <p className="text-sm text-gray-400 italic">暂无评测</p>
                    )}

                    <button
                        onClick={handleToggleReviews}
                        className="self-start mt-auto pt-3 text-sm text-orange-500 hover:text-orange-600 transition-colors"
                    >
                        {toggleLabel}
                    </button>
                </div>
            </div>

            {/* More Reviews + Review Form (expands below the card) */}
            {showMoreReviews && (
                <div className="border-t border-gray-100">
                    <div className="flex flex-col md:grid md:grid-cols-[240px_1fr_1fr]">
                        {/* Empty col 1 spacer */}
                        <div className="hidden md:block" />

                        {reviews.length === 0 && reviewsLoaded ? (
                            <div className="md:col-span-2 px-4 pb-4">
                                <p className="text-center text-xs text-gray-400 py-4">暂无更多评论</p>
                            </div>
                        ) : (
                            reviews.map((review, idx) => {
                                const isLeft = idx % 2 === 0;
                                const withBorder = isLeft ? 'md:border-r border-gray-100' : '';

                                return (
                                    <div key={review.id} className={`${withBorder} px-4 py-2 relative group`}>
                                        {isAdmin && (
                                            <button
                                                onClick={() => handleDeleteReview(review.id)}
                                                className="absolute top-2 right-2 w-5 h-5 rounded-full bg-red-400/70 hover:bg-red-500 text-white text-[10px] flex items-center justify-center transition-colors opacity-0 group-hover:opacity-100 z-10"
                                                title="删除评论"
                                            >
                                                ✕
                                            </button>
                                        )}
                                        <div className="grid grid-cols-2 gap-3">
                                            {/* Left: Ratings */}
                                            <div className="space-y-1.5">
                                                {RATINGS.map(({ key, label }) => (
                                                    <RatingBar key={key} label={label} value={(review as any)[key]} />
                                                ))}
                                            </div>
                                            {/* Right: Info + Text */}
                                            <div>
                                                <div className="text-xs text-gray-400 mb-1">
                                                    <span className="font-medium text-gray-600">测评人: {review.username || '匿名'}</span>
                                                    <span className="ml-1">{review.created_at.slice(0, 10)}</span>
                                                </div>
                                                <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-wrap">
                                                    {review.review_text}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}

                        {/* Review form — spans cols 2-3 */}
                        <div id={`review-form-${snack.id}`} className="md:col-span-2 px-4 pb-4 pt-4 border-t border-gray-100">
                            <div className="border border-amber-200 rounded-lg p-4 bg-amber-50/30">
                                <h4 className="text-sm font-semibold text-gray-700 mb-3">我也要评</h4>
                                <div className="flex flex-col md:grid md:grid-cols-2 gap-4">
                                    <div>
                                        <div className="space-y-2 mb-3">
                                            {REVIEW_RATING_LABELS.map(({ key, short }) => {
                                                const fullLabel = RATINGS.find(r => r.key === key)?.label || short;
                                                return (
                                                    <div key={key} className="flex items-center gap-2">
                                                        <label className="w-20 text-xs text-gray-500 shrink-0">{fullLabel}</label>
                                                        <input
                                                            type="range"
                                                            min={1}
                                                            max={10}
                                                            value={(reviewRatings as any)[key]}
                                                            onChange={(e) =>
                                                                setReviewRatings((prev) => ({
                                                                    ...prev,
                                                                    [key]: parseInt(e.target.value),
                                                                }))
                                                            }
                                                            className="flex-1 accent-orange-500 h-1.5"
                                                        />
                                                        <span className="w-6 text-center text-xs font-semibold text-gray-600">
                                                            {(reviewRatings as any)[key]}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                    <div>
                                        <textarea
                                            rows={4}
                                            value={reviewText}
                                            onChange={(e) => { setReviewText(e.target.value); setReviewError(''); }}
                                            placeholder="写下你对这款零食的评价..."
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-400 focus:border-transparent outline-none resize-y mb-3"
                                        />
                                        {reviewError && (
                                            <p className="text-red-400 text-xs mb-2">{reviewError}</p>
                                        )}
                                        <button
                                            onClick={handleSubmitReview}
                                            disabled={reviewSaving}
                                            className="px-4 py-1.5 bg-gradient-to-r from-amber-400 to-orange-500 text-white text-sm font-semibold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
                                        >
                                            {reviewSaving ? '保存中...' : '保存'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
