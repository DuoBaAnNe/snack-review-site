'use client';

import type { Snack } from '@/types';
import { getImageUrl } from '@/lib/image-url';

export function DateTile({ dateStr }: { dateStr: string }) {
    const d = new Date(dateStr + 'T00:00:00');
    return (
        <div className="aspect-square rounded-xl border border-amber-200/60 bg-gradient-to-br from-amber-100 to-rose-100 flex flex-col items-center justify-center select-none">
            <span className="text-lg md:text-2xl font-black text-amber-800 leading-tight">
                {d.getMonth() + 1}月{d.getDate()}日
            </span>
            <span className="text-xs text-amber-800/70 mt-1">{d.getFullYear()}</span>
        </div>
    );
}

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
        avgScore <= 3 ? 'text-red-300'
            : avgScore <= 6 ? 'text-amber-300'
                : 'text-green-300';
    const cover = snack.images[0];

    return (
        <button
            onMouseEnter={onEnter}
            onMouseLeave={onLeave}
            onClick={onOpen}
            className="relative aspect-square rounded-xl overflow-hidden bg-white border border-gray-100 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all text-left"
            aria-label={`查看 ${snack.product_name} 的测评`}
        >
            {cover ? (
                <img
                    src={getImageUrl(cover)}
                    alt={snack.product_name}
                    className="absolute inset-0 w-full h-full object-cover"
                />
            ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-100 text-4xl">
                    🍪
                </div>
            )}
            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent px-2 pt-8 pb-1.5">
                <p className="text-white text-xs font-medium truncate">{snack.product_name}</p>
                <p className={`text-[11px] font-bold ${scoreColor}`}>{avgScore.toFixed(1)} 分</p>
            </div>
        </button>
    );
}
