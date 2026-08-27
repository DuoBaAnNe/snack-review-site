export const MOBILE_SNACKS_PER_ROW = 10;
export const MOBILE_VISIBLE_CARD_SLOTS = 4.3;
export const MOBILE_DRAG_THRESHOLD_PX = 8;
export const MOBILE_SNACK_RAIN_DELAY_MS = 3000;

export function chunkMobileSnackRows<T>(items: T[]): T[][] {
    const rows: T[][] = [];
    for (let index = 0; index < items.length; index += MOBILE_SNACKS_PER_ROW) {
        rows.push(items.slice(index, index + MOBILE_SNACKS_PER_ROW));
    }
    return rows;
}

export function normalizeCarouselIndex(index: number, itemCount: number): number {
    if (itemCount <= 0) return 0;
    return ((index % itemCount) + itemCount) % itemCount;
}

export function getCircularCardDistance(
    cardIndex: number,
    activeIndex: number,
    itemCount: number,
): number {
    if (itemCount <= 1) return 0;

    let distance = normalizeCarouselIndex(cardIndex - activeIndex, itemCount);
    if (distance > itemCount / 2) distance -= itemCount;
    return distance;
}

export function getReleasedCarouselIndex(
    activeIndex: number,
    dragInSlots: number,
    itemCount: number,
): number {
    const travelledCards = Math.round(-dragInSlots);
    return normalizeCarouselIndex(activeIndex + travelledCards, itemCount);
}

export function getMobileStackScale(distance: number): number {
    return Math.max(0.68, 1.1 - Math.abs(distance) * 0.09);
}

export function isCarouselDrag(distancePx: number): boolean {
    return Math.abs(distancePx) >= MOBILE_DRAG_THRESHOLD_PX;
}

export function isMobileSnackRainReady(elapsedMs: number, isDragging: boolean): boolean {
    return !isDragging && elapsedMs >= MOBILE_SNACK_RAIN_DELAY_MS;
}

export function getMobileRainStartTop(dropSize: number): number {
    return -(dropSize + 12);
}
