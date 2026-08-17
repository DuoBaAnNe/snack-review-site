'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import type { Snack } from '@/types';
import SnackCard from './SnackCard';
import { getImageUrl } from '@/lib/image-url';
import { paginateSnackItems, SNACKS_PER_ROW } from '@/lib/snack-pagination';

const ANIM = 260;

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

// --- Hover "snack rain" ---
// Pretty backgrounds, picked deterministically per snack so each card
// always rains on the same colour.
const RAIN_BG = [
    'linear-gradient(160deg, #ffe9c7, #ffb26b)',
    'linear-gradient(160deg, #ffd6e8, #ff8fab)',
    'linear-gradient(160deg, #d9f7e8, #6fd6a3)',
    'linear-gradient(160deg, #dbeafe, #93c5fd)',
    'linear-gradient(160deg, #fef9c3, #fde047)',
    'linear-gradient(160deg, #ede9fe, #c4b5fd)',
    'linear-gradient(160deg, #ffe4e6, #fda4af)',
    'linear-gradient(160deg, #cffafe, #67e8f9)',
];
// The rain is rebuilt with real randomness on every hover (see useMemo in the
// component), so no two hovers look alike. Each drop enters from above the top
// edge, is staggered in time, and gets its own constant speed from a wide
// range — giving a continuous stream instead of a synchronized "batch, gap,
// batch".
interface Drop { left: string; size: number; dur: number; delay: number; spin: number }

// Size tiers with probabilities — a rare "blocks the lens" giant, down to
// tiny crumbs. Weights sum to 1.
const SIZE_TIERS = [
    { p: 0.05, min: 340, max: 420 }, // 挡住镜头级
    { p: 0.10, min: 150, max: 220 }, // 大
    { p: 0.20, min: 95, max: 150 },  // 中大
    { p: 0.30, min: 60, max: 95 },   // 中
    { p: 0.25, min: 38, max: 60 },   // 小
    { p: 0.10, min: 22, max: 38 },   // 迷你
];

function pickSize(rnd: () => number): number {
    const x = rnd();
    let acc = 0;
    for (const t of SIZE_TIERS) {
        acc += t.p;
        if (x < acc) return Math.round(t.min + rnd() * (t.max - t.min));
    }
    return 60;
}

function makeRain(): Drop[] {
    const count = 12 + Math.floor(Math.random() * 4); // 12–15 drops (~10% over the live 11–14)
    return Array.from({ length: count }, () => {
        const size = pickSize(Math.random);
        const giant = size > 300;
        // Constant speed per drop, but a WIDE range so the drops never fall as
        // one synchronized wall; giants are the slow, heavy ones.
        const dur = giant ? 7 + Math.random() * 5 : 3.2 + Math.random() * 6.8;
        return {
            // Giants hug the left half so most of them stays inside the card
            left: `${Math.round(Math.random() * (giant ? 30 : 92))}%`,
            size,
            dur,
            // Staggered entry from above the top edge, spread wide enough that
            // as the first drops leave the bottom, later ones are still coming
            // in — a continuous stream, no batch-then-gap. Never negative, so
            // nothing ever pops in mid-air.
            delay: Math.random() * 2.2,
            // Half spin clockwise, half counter-clockwise; giants barely tumble
            spin: (Math.random() < 0.5 ? -1 : 1) * Math.round(giant ? 30 + Math.random() * 50 : 120 + Math.random() * 260),
        };
    });
}

export function commitSnackPageChange(
    focusTarget: Pick<HTMLElement, 'focus'> | null,
    scrollTarget: Pick<HTMLElement, 'scrollIntoView'> | null,
) {
    scrollTarget?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    focusTarget?.focus({ preventScroll: true });
}

export default function SnackGrid({ snacks, isAdmin }: { snacks: Snack[]; isAdmin?: boolean }) {
    const wrapRef = useRef<HTMLDivElement>(null);
    const pendingPageChangeRef = useRef(false);
    const [width, setWidth] = useState(0);
    const [hoverId, setHoverId] = useState<number | null>(null);
    // Fresh random rain per hover — recomputed only when the hovered card
    // changes, so it stays stable while you hover one card but differs every
    // time you hover (in/out counts as a change since hoverId passes null).
    const rain = useMemo(() => (hoverId == null ? [] : makeRain()), [hoverId]);
    const [selByRow, setSelByRow] = useState<Record<number, number>>({}); // per-row sticky focus (snack id) after a click
    const SLIDE_STEP = 18; // how far the row slides per card when the focus jumps (px)
    const [page, setPage] = useState(1);
    const { pageItems, currentPage, totalPages } = useMemo(
        () => paginateSnackItems(snacks, page),
        [snacks, page],
    );

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

    useEffect(() => {
        // Pagination state is intentionally reset when the category's snack list changes.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setPage(1);
        setHoverId(null);
        setSelByRow({});
    }, [snacks]);

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

    const goToPage = useCallback((requestedPage: number) => {
        const nextPage = Math.min(totalPages, Math.max(1, requestedPage));
        if (nextPage === currentPage) return;

        pendingPageChangeRef.current = true;
        setPage(nextPage);
        setHoverId(null);
        setSelByRow({});
    }, [currentPage, totalPages]);

    useEffect(() => {
        if (!pendingPageChangeRef.current) return;

        pendingPageChangeRef.current = false;
        commitSnackPageChange(
            wrapRef.current,
            document.getElementById('sec-snacks'),
        );
    }, [currentPage]);

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

    const rows = chunk(pageItems, SNACKS_PER_ROW);
    const slot = width > 0 ? width / SNACKS_PER_ROW : 0;
    const CARD = Math.min(slot * 1.6, 432);    // +20% again — heavier overlap, bigger cards
    const peakScale = 1.1;
    // rowH fits the peak card exactly; the gap-8 between rows keeps peaks apart,
    // so bigger cards never cause different rows to overlap.
    const rowH = CARD * peakScale;

    return (
        <>
            {/* Full content width; overflow visible so scaled cards are never clipped */}
            <div
                ref={wrapRef}
                tabIndex={-1}
                aria-label={`第 ${currentPage} 页零食列表，共 ${totalPages} 页`}
                className="w-full flex flex-col gap-8 outline-none"
            >
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
                                            {/* Snack rain — endless falling copies of this snack on a pretty backdrop */}
                                            {isFocus && cover && (
                                                <div
                                                    className="absolute inset-0"
                                                    style={{ background: RAIN_BG[snack.id % RAIN_BG.length] }}
                                                >
                                                    {rain.map((d, i) => (
                                                        cover.has_cutout ? (
                                                            // Real background-removed PNG
                                                            <img
                                                                key={i}
                                                                src={`/api/images/${cover.id}?cutout=1`}
                                                                alt=""
                                                                aria-hidden
                                                                className="absolute object-contain"
                                                                style={{
                                                                    left: d.left,
                                                                    // Start fully above the card so drops glide
                                                                    // into view instead of popping in mid-air
                                                                    top: -(d.size + 24),
                                                                    width: d.size,
                                                                    height: d.size,
                                                                    filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.25))',
                                                                    animationName: 'snack-rain',
                                                                    animationDuration: `${d.dur}s`,
                                                                    animationTimingFunction: 'linear',
                                                                    animationIterationCount: 'infinite',
                                                                    animationDelay: `${d.delay}s`,
                                                                    '--spin': `${d.spin}deg`,
                                                                    '--fall': `${d.size + 500}px`,
                                                                } as React.CSSProperties}
                                                            />
                                                        ) : (
                                                            // Fallback: circular "sticker" crop
                                                            <div
                                                                key={i}
                                                                aria-hidden
                                                                className="absolute"
                                                                style={{
                                                                    left: d.left,
                                                                    // Start fully above the card so drops glide
                                                                    // into view instead of popping in mid-air
                                                                    top: -(d.size + 24),
                                                                    width: d.size,
                                                                    height: d.size,
                                                                    borderRadius: '50%',
                                                                    backgroundImage: `url(${getImageUrl(cover)})`,
                                                                    backgroundSize: '170%',
                                                                    backgroundPosition: 'center 42%',
                                                                    border: '2px solid rgba(255,255,255,0.9)',
                                                                    boxShadow: '0 4px 10px rgba(0,0,0,0.18)',
                                                                    animationName: 'snack-rain',
                                                                    animationDuration: `${d.dur}s`,
                                                                    animationTimingFunction: 'linear',
                                                                    animationIterationCount: 'infinite',
                                                                    animationDelay: `${d.delay}s`,
                                                                    '--spin': `${d.spin}deg`,
                                                                    '--fall': `${d.size + 500}px`,
                                                                } as React.CSSProperties}
                                                            />
                                                        )
                                                    ))}
                                                </div>
                                            )}
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

            {totalPages > 1 && (
                <nav aria-label="零食分页" className="mt-8 flex flex-wrap items-center justify-center gap-2">
                    <button
                        type="button"
                        onClick={() => goToPage(currentPage - 1)}
                        disabled={currentPage === 1}
                        className="rounded-full border border-gray-300 px-4 py-2 text-sm font-bold text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                        上一页
                    </button>
                    {Array.from({ length: totalPages }, (_, index) => index + 1).map((pageNumber) => (
                        <button
                            key={pageNumber}
                            type="button"
                            onClick={() => goToPage(pageNumber)}
                            aria-current={pageNumber === currentPage ? 'page' : undefined}
                            aria-label={'第 ' + pageNumber + ' 页'}
                            className={pageNumber === currentPage
                                ? 'h-10 min-w-10 rounded-full bg-gray-900 px-3 text-sm font-black text-white'
                                : 'h-10 min-w-10 rounded-full border border-gray-300 px-3 text-sm font-bold text-gray-700 transition hover:bg-gray-100'}
                        >
                            {pageNumber}
                        </button>
                    ))}
                    <button
                        type="button"
                        onClick={() => goToPage(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        className="rounded-full border border-gray-300 px-4 py-2 text-sm font-bold text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                        下一页
                    </button>
                </nav>
            )}

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
