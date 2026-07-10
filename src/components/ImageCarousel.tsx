'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { SnackImage } from '@/types';
import { getImageUrl } from '@/lib/image-url';

interface Props {
    images: SnackImage[];
    alt?: string;
    /** Fill the parent box instead of forcing a square shape */
    fill?: boolean;
}

export default function ImageCarousel({ images, alt, fill }: Props) {
    const [current, setCurrent] = useState(0);
    const touchStartX = useRef<number | null>(null);

    const shapeClass = fill ? 'w-full h-full' : 'w-full aspect-square';

    const next = useCallback(() => {
        setCurrent((c) => (c + 1) % images.length);
    }, [images.length]);

    const prev = useCallback(() => {
        setCurrent((c) => (c - 1 + images.length) % images.length);
    }, [images.length]);

    useEffect(() => {
        if (images.length <= 1) return;
        const timer = setInterval(next, 4000);
        return () => clearInterval(timer);
    }, [next, images.length]);

    if (images.length === 0) {
        return (
            <div className={`${shapeClass} bg-gray-100 flex items-center justify-center`}>
                <svg className="w-12 h-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.41a2.25 2.25 0 013.182 0l2.909 2.91m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                </svg>
            </div>
        );
    }

    return (
        <div
            className={`relative ${shapeClass} overflow-hidden group`}
            onTouchStart={(e) => { touchStartX.current = e.touches[0].clientX; }}
            onTouchEnd={(e) => {
                if (touchStartX.current === null) return;
                const dx = e.changedTouches[0].clientX - touchStartX.current;
                touchStartX.current = null;
                if (images.length <= 1) return;
                if (dx > 40) prev();
                else if (dx < -40) next();
            }}
        >
            <img
                src={getImageUrl(images[current])}
                alt={alt ? `${alt} 第 ${current + 1} 张图片` : images[current].original_name}
                className="w-full h-full object-cover"
            />
            {images.length > 1 && (
                <>
                    <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex">
                        {images.map((_, i) => (
                            <button
                                key={i}
                                onClick={() => setCurrent(i)}
                                className="p-1.5"
                                aria-label={`第 ${i + 1} 张图片`}
                            >
                                <span className={`block w-2 h-2 rounded-full transition-all ${i === current ? 'bg-white scale-110' : 'bg-white/50'}`} />
                            </button>
                        ))}
                    </div>
                    <button
                        onClick={prev}
                        aria-label="上一张"
                        className="absolute left-1 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/30 text-white md:opacity-0 md:group-hover:opacity-100 transition-opacity flex items-center justify-center text-base"
                    >
                        &#8249;
                    </button>
                    <button
                        onClick={next}
                        aria-label="下一张"
                        className="absolute right-1 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/30 text-white md:opacity-0 md:group-hover:opacity-100 transition-opacity flex items-center justify-center text-base"
                    >
                        &#8250;
                    </button>
                </>
            )}
        </div>
    );
}
