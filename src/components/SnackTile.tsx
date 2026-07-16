'use client';

import type { Snack } from '@/types';
import { getImageUrl } from '@/lib/image-url';

interface Props {
    snack: Snack;
    onEnter: () => void;
    onLeave: () => void;
    onOpen: () => void;
}

export default function SnackTile({ snack, onEnter, onLeave, onOpen }: Props) {
    const avgScore = (
        snack.rating_taste_health +
        snack.rating_ingredients_health +
        snack.rating_packaging_portability +
        snack.rating_use_case +
        snack.rating_value
    ) / 5;
    const scoreColor =
        avgScore <= 3 ? '#ef4444'
            : avgScore <= 6 ? '#f59e0b'
                : '#16a34a';
    const cover = snack.images[0];
    // Google Arts & Culture-style card: the brand name sits large and
    // centered over the photo (product name is shown in the popup card)
    const label = snack.brand_name || snack.product_name;

    return (
        <button
            onMouseEnter={onEnter}
            onMouseLeave={onLeave}
            onClick={onOpen}
            className="group relative block w-full aspect-square rounded-2xl overflow-hidden bg-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-0.5 transition-all"
            aria-label={`查看 ${snack.product_name} 的测评`}
        >
            {cover ? (
                <img
                    src={getImageUrl(cover)}
                    alt={snack.product_name}
                    className="absolute inset-0 w-full h-full object-cover"
                />
            ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-100 text-5xl">🍪</div>
            )}

            {/* Darkening scrim so the centered label stays readable on any photo */}
            <div className="absolute inset-0 bg-black/25 group-hover:bg-black/35 transition-colors" />

            {/* Score badge — top-left, position unchanged */}
            <span
                className="absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-full bg-white/95 text-sm font-black shadow z-10"
                style={{ color: scoreColor }}
            >
                {avgScore.toFixed(1)}
            </span>

            {/* Brand name — large, centered */}
            <div className="absolute inset-0 flex items-center justify-center px-3">
                <span
                    className="text-white font-black text-center leading-tight tracking-wide line-clamp-3"
                    style={{ fontSize: 'clamp(1.1rem, 2.2vw, 1.9rem)', textShadow: '0 2px 12px rgba(0,0,0,0.5)' }}
                >
                    {label}
                </span>
            </div>
        </button>
    );
}
