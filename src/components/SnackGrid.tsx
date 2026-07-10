'use client';

import { useState, useRef, useEffect } from 'react';
import type { Snack } from '@/types';
import SnackCard from './SnackCard';
import SnackTile, { DateTile } from './SnackTile';

type GridItem =
    | { type: 'date'; date: string }
    | { type: 'snack'; snack: Snack };

export default function SnackGrid({ snacks, isAdmin }: { snacks: Snack[]; isAdmin?: boolean }) {
    const [active, setActive] = useState<Snack | null>(null);
    const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Esc closes the popup card
    useEffect(() => {
        if (!active) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setActive(null);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [active]);

    function cancelTimers() {
        if (openTimer.current) { clearTimeout(openTimer.current); openTimer.current = null; }
        if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; }
    }

    function handleTileEnter(snack: Snack) {
        cancelTimers();
        openTimer.current = setTimeout(() => setActive(snack), 250);
    }

    function handleTileLeave() {
        if (openTimer.current) { clearTimeout(openTimer.current); openTimer.current = null; }
        scheduleClose();
    }

    function scheduleClose() {
        if (closeTimer.current) clearTimeout(closeTimer.current);
        closeTimer.current = setTimeout(() => setActive(null), 250);
    }

    function cancelClose() {
        if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; }
    }

    if (snacks.length === 0) {
        return (
            <div className="text-center py-20 text-gray-400">
                <svg className="w-16 h-16 mx-auto mb-4 text-gray-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
                        d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m8.25 3v6.75m0 0l-3-3m3 3l3-3M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                </svg>
                <p className="text-lg">还没有零食评测，敬请期待！</p>
            </div>
        );
    }

    // Flatten into one grid: a date tile, then that day's snack tiles, then the next date...
    // (snacks arrive sorted by created_at DESC)
    const items: GridItem[] = [];
    let lastDate = '';
    for (const snack of snacks) {
        const dateKey = snack.created_at.slice(0, 10);
        if (dateKey !== lastDate) {
            items.push({ type: 'date', date: dateKey });
            lastDate = dateKey;
        }
        items.push({ type: 'snack', snack });
    }

    return (
        <>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3 md:gap-4">
                {items.map((item) =>
                    item.type === 'date' ? (
                        <DateTile key={`date-${item.date}`} dateStr={item.date} />
                    ) : (
                        <SnackTile
                            key={item.snack.id}
                            snack={item.snack}
                            onEnter={() => handleTileEnter(item.snack)}
                            onLeave={handleTileLeave}
                            onOpen={() => { cancelTimers(); setActive(item.snack); }}
                        />
                    )
                )}
            </div>

            {/* Hover/tap popup: the full snack card */}
            {active && (
                <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-3 md:p-8 pointer-events-none">
                    <div
                        className="pointer-events-auto relative w-full max-w-5xl max-h-[92vh] overflow-y-auto rounded-xl shadow-2xl"
                        onMouseEnter={cancelClose}
                        onMouseLeave={scheduleClose}
                    >
                        <button
                            onClick={() => setActive(null)}
                            aria-label="关闭"
                            className="absolute top-2 left-2 z-30 w-7 h-7 rounded-full bg-black/40 hover:bg-black/60 text-white text-sm flex items-center justify-center transition-colors"
                        >
                            ✕
                        </button>
                        <SnackCard snack={active} isAdmin={isAdmin} />
                    </div>
                </div>
            )}
        </>
    );
}
