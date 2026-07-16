'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import type { Snack } from '@/types';
import SnackCard from './SnackCard';
import { getImageUrl } from '@/lib/image-url';

const ANIM = 260;
const PER_ROW = 5;

function scoreOf(s: Snack) {
    return (s.rating_taste_health + s.rating_ingredients_health + s.rating_packaging_portability + s.rating_use_case + s.rating_value) / 5;
}
function scoreColor(v: number) {
    return v <= 3 ? '#ef4444' : v <= 6 ? '#f59e0b' : '#16a34a';
}
function chunk<T>(arr: T[], size: number): T[][] {
    const out: T[][] = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
}

export default function SnackGrid({ snacks, isAdmin }: { snacks: Snack[]; isAdmin?: boolean }) {
    const wrapRef = useRef<HTMLDivElement>(null);
    const [width, setWidth] = useState(0);
    const [hoverId, setHoverId] = useState<number | null>(null);
    const [selByRow, setSelByRow] = useState<Record<number, number>>({}); // per-row sticky focus (snack id) after a click
    const SLIDE_STEP = 18; // how far the row slides per card when the focus jumps (px)

    // Detail popup
    const [active, setActive] = useState<Snack | null>(null);
    const [visible, setVisible] = useState(false);
    const unmountTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Measure the content width so the row spans edge to edge
    useEffect(() => {
        const el = wrapRef.current;
        if (!el) return;
        const ro = new ResizeObserver((entries) => setWidth(entries[0].contentRect.width));
        ro.observe(el);
        setWidth(el.clientWidth);
        return () => ro.disconnect();
    }, []);

    const openCard = useCallback((snack: Snack) => {
        if (unmountTimer.current) { clearTimeout(unmountTimer.current); unmountTimer.current = null; }
        setActive(snack);
        requestAnimationFrame(() => setVisible(true));
    }, []);
    const close = useCallback(() => {
        setVisible(false);
        // Clear hover so the clicked card (per-row memory) keeps the peak
        // after the popup closes, instead of whatever sits under the cursor.
        setHoverId(null);
        if (unmountTimer.current) clearTimeout(unmountTimer.current);
        unmountTimer.current = setTimeout(() => setActive(null), ANIM);
    }, []);

    useEffect(() => {
        if (!active) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [active, close]);

    if (snacks.length === 0) {
        return (
            <div className="text-center py-16 text-gray-400">
                <div className="text-5xl mb-3">🍪</div>
                <p className="text-base">这个分类还没有零食，换一个看看？</p>
            </div>
        );
    }

    const rows = chunk(snacks, PER_ROW);
    const slot = width > 0 ? width / PER_ROW : 0;
    const CARD = Math.min(slot * 1.6, 432);    // +20% again — heavier overlap, bigger cards
    const peakScale = 1.1;
    // rowH fits the peak card exactly; the gap-8 between rows keeps peaks apart,
    // so bigger cards never cause different rows to overlap.
    const rowH = CARD * peakScale;

    return (
        <>
            {/* Full content width; overflow visible so scaled cards are never clipped */}
            <div ref={wrapRef} className="w-full flex flex-col gap-8">
                {width > 0 && rows.map((row, r) => {
                    const n = row.length;
                    const rowW = n * slot;
                    const startX = (width - rowW) / 2; // center the (possibly shorter) row
                    const rowCenter = (n - 1) / 2;
                    const hoverCol = row.findIndex((s) => s.id === hoverId);
                    const selCol = row.findIndex((s) => s.id === selByRow[r]);
                    // Focus priority: cursor > last clicked > middle default.
                    // The clicked card stays focused (no jump back to center).
                    const focus = hoverCol >= 0 ? hoverCol : (selCol >= 0 ? selCol : Math.round(rowCenter));
                    // Row slides only when the focused card changes (discrete),
                    // never while the cursor sits on the same card.
                    const shift = (rowCenter - focus) * SLIDE_STEP;

                    return (
                        <div key={r} className="relative w-full" style={{ height: rowH }}>
                          <div
                            className="absolute inset-0 transition-transform duration-300 ease-out"
                            style={{ transform: `translateX(${shift}px)` }}
                          >
                            {row.map((snack, col) => {
                                const dist = Math.abs(col - focus);
                                // Gentle falloff with a low floor, so even at
                                // dist 4 (focus at one end) every card is a
                                // distinct size: 1.1 / .92 / .84 / .76 / .68
                                const scale = dist === 0 ? peakScale : Math.max(0.6, 1 - dist * 0.08);
                                const z = 30 - dist;                 // focus highest, but all below the sticky top bar
                                const centerX = startX + slot * (col + 0.5);
                                const v = scoreOf(snack);
                                const cover = snack.images[0];
                                const label = snack.brand_name || snack.product_name;
                                const isFocus = dist === 0 && hoverCol >= 0;
                                return (
                                    <div
                                        key={snack.id}
                                        onMouseEnter={() => { if (!active) setHoverId(snack.id); }}
                                        onMouseLeave={() => setHoverId((h) => (h === snack.id ? null : h))}
                                        onClick={() => {
                                            setSelByRow((m) => ({ ...m, [r]: snack.id }));
                                            setHoverId(null); // hand the peak to the per-row click memory
                                            openCard(snack);
                                        }}
                                        className="absolute top-1/2 cursor-pointer transition-transform duration-300 ease-out will-change-transform"
                                        style={{
                                            width: CARD,
                                            height: CARD,
                                            left: centerX,
                                            transform: `translate(-50%, -50%) scale(${scale})`,
                                            zIndex: z,
                                        }}
                                    >
                                        <div className={`relative w-full h-full rounded-2xl overflow-hidden bg-gray-100 transition-shadow duration-300 ${isFocus ? 'shadow-2xl ring-1 ring-black/10' : 'shadow-lg'}`}>
                                            {cover ? (
                                                <img src={getImageUrl(cover)} alt={label} className="absolute inset-0 w-full h-full object-cover" />
                                            ) : (
                                                <div className="absolute inset-0 flex items-center justify-center text-6xl bg-gray-100">🍪</div>
                                            )}
                                            <div className={`absolute inset-0 transition-colors duration-300 ${isFocus ? 'bg-black/12' : 'bg-black/30'}`} />
                                            <span className="absolute top-3 left-3 px-2 py-0.5 rounded-full bg-white/95 text-sm font-black shadow" style={{ color: scoreColor(v) }}>
                                                {v.toFixed(1)}
                                            </span>
                                            <div className="absolute inset-0 flex items-center justify-center px-3">
                                                <span className="text-white text-2xl font-black text-center leading-tight line-clamp-3 drop-shadow-[0_2px_6px_rgba(0,0,0,0.65)]">
                                                    {label}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                          </div>
                        </div>
                    );
                })}
            </div>

            {/* Detail card — opens on click; fades + scales */}
            {active && (
                <div
                    className="fixed inset-0 z-[60] flex items-center justify-center p-3 md:p-8 transition-opacity duration-[260ms]"
                    style={{ opacity: visible ? 1 : 0, backgroundColor: visible ? 'rgba(0,0,0,0.45)' : 'rgba(0,0,0,0)' }}
                    onClick={close}
                >
                    <div
                        className="relative w-full max-w-5xl max-h-[92vh] overflow-y-auto rounded-xl shadow-2xl transition-all duration-[260ms] ease-out"
                        style={{ opacity: visible ? 1 : 0, transform: visible ? 'scale(1) translateY(0)' : 'scale(0.96) translateY(8px)' }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            onClick={close}
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
