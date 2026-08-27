import assert from 'node:assert/strict';
import test from 'node:test';
import { getMapPanelPosition } from './snack-map-panel-position';

test('anchors the panel to the clicked point inside the map container', () => {
    assert.deepEqual(
        getMapPanelPosition(450, 360, { left: 100, top: 200, width: 800 }),
        { position: 'absolute', left: 368, top: 130 },
    );
});

test('keeps the panel inside the right edge of a mobile map container', () => {
    assert.deepEqual(
        getMapPanelPosition(285, 620, { left: 5, top: 400, width: 366 }),
        { position: 'absolute', left: 208, top: 190 },
    );
});
