export const BACK_TO_TOP_THRESHOLD_PX = 600;

export function shouldShowBackToTop(scrollY: number): boolean {
    return scrollY >= BACK_TO_TOP_THRESHOLD_PX;
}
