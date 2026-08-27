import test from 'node:test';
import assert from 'node:assert/strict';
import {
    getStaggeredRainDelay,
    RAIN_DELAY_OPTIONS_MS,
    isSnackRainReady,
} from './snack-rain-timing';

test('local comparison offers both 1.5-second and 2-second rain delays', () => {
    assert.deepEqual(RAIN_DELAY_OPTIONS_MS, [1500, 2000]);
});

test('rain stays hidden until the selected delay has fully elapsed', () => {
    assert.equal(isSnackRainReady(1499, 1500), false);
    assert.equal(isSnackRainReady(1500, 1500), true);
    assert.equal(isSnackRainReady(1999, 2000), false);
    assert.equal(isSnackRainReady(2000, 2000), true);
});

test('the first desktop rain drop enters immediately while later drops stay staggered', () => {
    assert.equal(getStaggeredRainDelay(0, 1.7), 0);
    assert.equal(getStaggeredRainDelay(1, 1.7), 1.7);
});
