export interface MapContainerRect {
    left: number;
    top: number;
}

export interface MapPanelPosition {
    position: 'absolute';
    left: number;
    top: number;
}

export function getMapPanelPosition(
    clientX: number,
    clientY: number,
    containerRect: MapContainerRect,
): MapPanelPosition {
    return {
        position: 'absolute',
        left: clientX - containerRect.left + 18,
        top: clientY - containerRect.top - 30,
    };
}
