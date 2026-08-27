export const RAIN_DELAY_OPTIONS_MS = [1500, 2000] as const;
export type SnackRainDelayMs = (typeof RAIN_DELAY_OPTIONS_MS)[number];

export const DEFAULT_SNACK_RAIN_DELAY_MS: SnackRainDelayMs = 1500;

export function isSnackRainReady(elapsedMs: number, delayMs: number): boolean {
    return elapsedMs >= delayMs;
}

export function getStaggeredRainDelay(index: number, randomDelaySeconds: number): number {
    return index === 0 ? 0 : randomDelaySeconds;
}
