import assert from 'node:assert/strict';
import test from 'node:test';
import { getMapPanelPosition } from './snack-map-panel-position';

test('anchors the panel to the clicked point inside the map container', () => {
    assert.deepEqual(
        getMapPanelPosition(450, 360, { left: 100, top: 200 }),
        { position: 'absolute', left: 368, top: 130 },
    );
});
