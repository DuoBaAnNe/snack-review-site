'use client';

import { useState, useEffect, useCallback } from 'react';
import type { SnackImage } from '@/types';

function imageUrl(img: SnackImage): string {
    if (img.data) {
        return `data:${img.mime_type};base64,${img.data}`;
    }
    return img.filename; // legacy URL
}

export default function ImageCarousel({ images }: { images: SnackImage[] }) {
    const [current, setCurrent] = useState(0);

    const next = useCallback(() => {
        setCurrent((c) => (c + 1) % images.length);
    }, [images.length]);

    useEffect(() => {
        if (images.length <= 1) return;
        const timer = setInterval(next, 4000);
        return () => clearInterval(timer);
    }, [next, images.length]);

    if (images.length === 0) {
        return (
            <div className="w-full aspect-square bg-gray-100 flex items-center justify-center">
                <svg className="w-12 h-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.41a2.25 2.25 0 013.182 0l2.909 2.91m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                </svg>
            </div>
        );
    }

    return (
        <div className="relative w-full aspect-square overflow-hidden group">
            <img
                src={imageUrl(images[current])}
                alt={images[current].original_name}
                className="w-full h-full object-cover"
            />
            {images.length > 1 && (
                <>
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
                        {images.map((_, i) => (
                            <button
                                key={i}
                                onClick={() => setCurrent(i)}
                                className={`w-2 h-2 rounded-full transition-all ${i === current ? 'bg-white scale-110' : 'bg-white/50'}`}
                            />
                        ))}
                    </div>
                    <button
                        onClick={() => setCurrent((c) => (c - 1 + images.length) % images.length)}
                        className="absolute left-1 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/30 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-sm"
                    >
                        &#8249;
                    </button>
                    <button
                        onClick={() => setCurrent((c) => (c + 1) % images.length)}
                        className="absolute right-1 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/30 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-sm"
                    >
                        &#8250;
                    </button>
                </>
            )}
        </div>
    );
}
