'use client';

import { useEffect, useState } from 'react';
import { shouldShowBackToTop } from '@/lib/back-to-top';

export default function BackToTopButton() {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        let frame = 0;
        const update = () => {
            cancelAnimationFrame(frame);
            frame = requestAnimationFrame(() => setVisible(shouldShowBackToTop(window.scrollY)));
        };

        frame = requestAnimationFrame(update);
        window.addEventListener('scroll', update, { passive: true });
        return () => {
            cancelAnimationFrame(frame);
            window.removeEventListener('scroll', update);
        };
    }, []);

    const returnToTop = () => {
        const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
    };

    return (
        <button
            type="button"
            onClick={returnToTop}
            aria-label="返回页面顶部"
            aria-hidden={!visible}
            tabIndex={visible ? 0 : -1}
            className={`fixed bottom-5 right-5 z-40 grid h-11 w-11 place-items-center rounded-full border border-gray-200/80 bg-white/90 text-gray-700 shadow-[0_8px_24px_-10px_rgba(15,23,42,0.45)] backdrop-blur-md transition-all duration-200 hover:-translate-y-0.5 hover:border-orange-300 hover:bg-orange-500 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2 ${
                visible ? 'pointer-events-auto translate-y-0 scale-100 opacity-100' : 'pointer-events-none translate-y-2 scale-90 opacity-0'
            }`}
        >
            <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
                <path d="m6 14 6-6 6 6" />
            </svg>
        </button>
    );
}
