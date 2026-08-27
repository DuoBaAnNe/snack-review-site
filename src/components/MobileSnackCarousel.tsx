'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';
import type { Snack } from '@/types';
import { getImageUrl } from '@/lib/image-url';
import {
    getCircularCardDistance,
    getMobileRainStartTop,
    getMobileStackScale,
    getReleasedCarouselIndex,
    isCarouselDrag,
    MOBILE_SNACK_RAIN_DELAY_MS,
    MOBILE_VISIBLE_CARD_SLOTS,
    normalizeCarouselIndex,
} from '@/lib/mobile-snack-carousel';

interface Props {
    snacks: Snack[];
    rowIndex: number;
    onOpen: (snack: Snack) => void;
}

function scoreOf(snack: Snack) {
    return (
        snack.rating_taste_health +
        snack.rating_ingredients_health +
        snack.rating_packaging_portability +
        snack.rating_use_case +
        snack.rating_value
    ) / 5;
}

function scoreColor(value: number) {
    return value <= 3 ? '#ef4444' : value <= 6 ? '#f59e0b' : '#16a34a';
}

const MOBILE_RAIN_BACKGROUNDS = [
    'linear-gradient(160deg, #ffe9c7, #ffb26b)',
    'linear-gradient(160deg, #ffd6e8, #ff8fab)',
    'linear-gradient(160deg, #d9f7e8, #6fd6a3)',
    'linear-gradient(160deg, #dbeafe, #93c5fd)',
    'linear-gradient(160deg, #fef9c3, #fde047)',
    'linear-gradient(160deg, #ede9fe, #c4b5fd)',
];

interface MobileDrop {
    left: string;
    size: number;
    duration: number;
    delay: number;
    spin: number;
}

function makeMobileRain(): MobileDrop[] {
    return Array.from({ length: 10 }, (_, index) => {
        const size = index === 0 ? 72 : 24 + Math.round(Math.random() * 34);
        return {
            left: `${4 + Math.round(Math.random() * 82)}%`,
            size,
            duration: 3.6 + Math.random() * 3.8,
            delay: index === 0 ? 0 : Math.random() * 2.1,
            spin: (Math.random() < 0.5 ? -1 : 1) * (90 + Math.round(Math.random() * 240)),
        };
    });
}

export default function MobileSnackCarousel({ snacks, rowIndex, onOpen }: Props) {
    const viewportRef = useRef<HTMLDivElement>(null);
    const pointerIdRef = useRef<number | null>(null);
    const startPointRef = useRef({ x: 0, y: 0 });
    const horizontalGestureRef = useRef<boolean | null>(null);
    const suppressClickRef = useRef(false);
    const [width, setWidth] = useState(0);
    const [activeIndex, setActiveIndex] = useState(() => Math.floor(snacks.length / 2));
    const [dragOffset, setDragOffset] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const [rainForIndex, setRainForIndex] = useState<number | null>(null);

    const displaySnacks = useMemo(() => {
        if (snacks.length === 0) return [];
        const displayCount = Math.max(5, snacks.length);
        return Array.from({ length: displayCount }, (_, index) => snacks[index % snacks.length]);
    }, [snacks]);
    const rainDrops = useMemo(
        () => (rainForIndex == null ? [] : makeMobileRain()),
        [rainForIndex],
    );

    useEffect(() => {
        const viewport = viewportRef.current;
        if (!viewport) return;

        const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
        observer.observe(viewport);
        setWidth(viewport.clientWidth);
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        if (isDragging || displaySnacks.length === 0) return;
        const timer = window.setTimeout(
            () => setRainForIndex(activeIndex),
            MOBILE_SNACK_RAIN_DELAY_MS,
        );
        return () => window.clearTimeout(timer);
    }, [activeIndex, displaySnacks.length, isDragging]);

    if (displaySnacks.length === 0) return null;

    const viewportWidth = width || 390;
    const slot = viewportWidth / MOBILE_VISIBLE_CARD_SLOTS;
    const cardSize = Math.min(viewportWidth / 2.75, 150);
    const rowHeight = cardSize * 1.24;
    const visualDragInSlots = dragOffset / slot;

    const finishGesture = () => {
        if (pointerIdRef.current == null) return;

        if (horizontalGestureRef.current && isCarouselDrag(dragOffset)) {
            setRainForIndex(null);
            setActiveIndex((current) => getReleasedCarouselIndex(
                current,
                dragOffset / slot,
                displaySnacks.length,
            ));
            suppressClickRef.current = true;
        }

        pointerIdRef.current = null;
        horizontalGestureRef.current = null;
        setDragOffset(0);
        setIsDragging(false);
    };

    const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
        if (event.pointerType === 'mouse' && event.button !== 0) return;
        pointerIdRef.current = event.pointerId;
        startPointRef.current = { x: event.clientX, y: event.clientY };
        horizontalGestureRef.current = null;
        suppressClickRef.current = false;
        setDragOffset(0);
    };

    const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
        if (pointerIdRef.current !== event.pointerId) return;

        const deltaX = event.clientX - startPointRef.current.x;
        const deltaY = event.clientY - startPointRef.current.y;
        if (horizontalGestureRef.current == null && Math.max(Math.abs(deltaX), Math.abs(deltaY)) >= 4) {
            horizontalGestureRef.current = Math.abs(deltaX) > Math.abs(deltaY);
            if (horizontalGestureRef.current) setRainForIndex(null);
        }
        if (!horizontalGestureRef.current) return;

        event.currentTarget.setPointerCapture(event.pointerId);
        event.preventDefault();
        setIsDragging(true);
        setDragOffset(deltaX);
    };

    const moveFocus = (step: number) => {
        setRainForIndex(null);
        setActiveIndex((current) => normalizeCarouselIndex(current + step, displaySnacks.length));
    };

    return (
        <div
            ref={viewportRef}
            role="region"
            aria-roledescription="carousel"
            aria-label={`手机端第 ${rowIndex + 1} 排零食卡片，${snacks.length} 款，可无限循环`}
            className="relative w-full overflow-hidden select-none touch-pan-y"
            style={{ height: rowHeight }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={finishGesture}
            onPointerCancel={finishGesture}
            onKeyDown={(event) => {
                if (event.key === 'ArrowLeft') {
                    event.preventDefault();
                    moveFocus(-1);
                } else if (event.key === 'ArrowRight') {
                    event.preventDefault();
                    moveFocus(1);
                }
            }}
        >
            {displaySnacks.map((snack, index) => {
                const baseDistance = getCircularCardDistance(index, activeIndex, displaySnacks.length);
                const visualDistance = baseDistance + visualDragInSlots;
                const scale = getMobileStackScale(visualDistance);
                const score = scoreOf(snack);
                const cover = snack.images[0];
                const label = snack.brand_name || snack.product_name;
                const isFocused = Math.abs(visualDistance) < 0.5;
                const isRaining = isFocused && !isDragging && rainForIndex === activeIndex && index === activeIndex;
                const leftPercent = 50 + baseDistance * (100 / MOBILE_VISIBLE_CARD_SLOTS);

                return (
                    <button
                        key={`${snack.id}-${index}`}
                        type="button"
                        aria-current={isFocused ? 'true' : undefined}
                        aria-label={`查看 ${snack.product_name} 的测评`}
                        onClick={() => {
                            if (suppressClickRef.current) {
                                suppressClickRef.current = false;
                                return;
                            }
                            setRainForIndex(null);
                            setActiveIndex(index);
                            onOpen(snack);
                        }}
                        className="absolute top-1/2 overflow-hidden rounded-2xl bg-gray-100 text-left shadow-lg outline-none ring-orange-400 transition-[box-shadow,filter] focus-visible:ring-2"
                        style={{
                            width: cardSize,
                            height: cardSize,
                            left: `${leftPercent}%`,
                            zIndex: 40 - Math.round(Math.abs(visualDistance) * 4),
                            opacity: Math.abs(visualDistance) > 3.2 ? 0 : 1,
                            transform: `translate(calc(-50% + ${dragOffset}px), -50%) scale(${scale})`,
                            transitionProperty: isDragging ? 'none' : 'transform, left, opacity, box-shadow',
                            transitionDuration: isDragging ? '0ms' : '300ms',
                            transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
                            boxShadow: isFocused
                                ? '0 12px 24px -14px rgba(15, 23, 42, 0.26)'
                                : '0 6px 16px -12px rgba(15, 23, 42, 0.16)',
                        }}
                    >
                        {cover ? (
                            <img
                                src={getImageUrl(cover)}
                                alt=""
                                draggable={false}
                                className="absolute inset-0 h-full w-full object-cover pointer-events-none"
                            />
                        ) : (
                            <span className="absolute inset-0 grid place-items-center text-5xl bg-gray-100">🍪</span>
                        )}
                        <span className={`absolute inset-0 ${isFocused ? 'bg-black/15' : 'bg-black/32'}`} />
                        {isRaining && cover && (
                            <span
                                className="mobile-snack-rain-layer pointer-events-none absolute inset-0 z-[5] overflow-hidden"
                                aria-hidden="true"
                                style={{ background: MOBILE_RAIN_BACKGROUNDS[snack.id % MOBILE_RAIN_BACKGROUNDS.length] }}
                            >
                                {rainDrops.map((drop, dropIndex) => (
                                    cover.has_cutout ? (
                                        <img
                                            key={dropIndex}
                                            src={`/api/images/${cover.id}?cutout=1`}
                                            alt=""
                                            draggable={false}
                                            className="mobile-snack-rain-drop absolute object-contain"
                                            style={{
                                                left: drop.left,
                                                top: getMobileRainStartTop(drop.size),
                                                width: drop.size,
                                                height: drop.size,
                                                filter: 'drop-shadow(0 3px 5px rgba(0,0,0,0.24))',
                                                animationName: 'snack-rain',
                                                animationDuration: `${drop.duration}s`,
                                                animationTimingFunction: 'linear',
                                                animationIterationCount: 'infinite',
                                                animationDelay: `${drop.delay}s`,
                                                '--spin': `${drop.spin}deg`,
                                                '--fall': `${drop.size + cardSize + 24}px`,
                                            } as CSSProperties}
                                        />
                                    ) : (
                                        <span
                                            key={dropIndex}
                                            className="mobile-snack-rain-drop absolute rounded-full border border-white/90 shadow-md"
                                            style={{
                                                left: drop.left,
                                                top: getMobileRainStartTop(drop.size),
                                                width: drop.size,
                                                height: drop.size,
                                                backgroundImage: `url(${getImageUrl(cover)})`,
                                                backgroundPosition: 'center 42%',
                                                backgroundSize: '170%',
                                                animationName: 'snack-rain',
                                                animationDuration: `${drop.duration}s`,
                                                animationTimingFunction: 'linear',
                                                animationIterationCount: 'infinite',
                                                animationDelay: `${drop.delay}s`,
                                                '--spin': `${drop.spin}deg`,
                                                '--fall': `${drop.size + cardSize + 24}px`,
                                            } as CSSProperties}
                                        />
                                    )
                                ))}
                            </span>
                        )}
                        <span
                            className="absolute left-2 top-2 z-10 rounded-full bg-white/95 px-1.5 py-0.5 text-[10px] font-black shadow"
                            style={{ color: scoreColor(score) }}
                        >
                            {score.toFixed(1)}
                        </span>
                        <span className="absolute inset-x-2 bottom-3 z-10 line-clamp-2 text-center text-sm font-black leading-tight text-white drop-shadow-[0_2px_5px_rgba(0,0,0,0.75)]">
                            {label}
                        </span>
                    </button>
                );
            })}
            <div className="pointer-events-none absolute inset-y-0 left-0 z-50 w-5 bg-gradient-to-r from-white/75 to-transparent" />
            <div className="pointer-events-none absolute inset-y-0 right-0 z-50 w-5 bg-gradient-to-l from-white/75 to-transparent" />
        </div>
    );
}
