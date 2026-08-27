export interface MapContainerRect {
    left: number;
    top: number;
    width: number;
}

export interface MapPanelPosition {
    position: 'absolute';
    left: number;
    top: number;
}

export const MAP_PANEL_WIDTH = 146;
const MAP_PANEL_EDGE_GAP = 12;

export function getMapPanelPosition(
    clientX: number,
    clientY: number,
    containerRect: MapContainerRect,
): MapPanelPosition {
    const preferredLeft = clientX - containerRect.left + 18;
    const rightmostLeft = Math.max(
        MAP_PANEL_EDGE_GAP,
        containerRect.width - MAP_PANEL_WIDTH - MAP_PANEL_EDGE_GAP,
    );

    return {
        position: 'absolute',
        left: Math.min(Math.max(preferredLeft, MAP_PANEL_EDGE_GAP), rightmostLeft),
        top: clientY - containerRect.top - 30,
    };
}
