interface MapHoverClearState {
    hasRenderTarget: boolean;
    pinned: boolean;
}

export function shouldClearMapHoverPanel({ hasRenderTarget, pinned }: MapHoverClearState) {
    return !hasRenderTarget && !pinned;
}
