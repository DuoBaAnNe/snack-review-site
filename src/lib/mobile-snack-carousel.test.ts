import test from 'node:test';
import assert from 'node:assert/strict';
import {
    chunkMobileSnackRows,
    getCircularCardDistance,
    getMobileStackScale,
    getMobileRainStartTop,
    getReleasedCarouselIndex,
    isCarouselDrag,
    isMobileSnackRainReady,
} from './mobile-snack-carousel';

test('mobile rows keep ten unique snacks together before starting another row', () => {
    const rows = chunkMobileSnackRows(Array.from({ length: 21 }, (_, index) => index + 1));

    assert.deepEqual(rows, [
        [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
        [11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
        [21],
    ]);
});

test('circular distance places the last card immediately left of the first card', () => {
    assert.equal(getCircularCardDistance(9, 0, 10), -1);
    assert.equal(getCircularCardDistance(0, 9, 10), 1);
});

test('releasing a left swipe advances and wraps the focused card', () => {
    assert.equal(getReleasedCarouselIndex(9, -0.6, 10), 0);
    assert.equal(getReleasedCarouselIndex(0, -1.6, 10), 2);
});

test('releasing a right swipe moves backward and wraps the focused card', () => {
    assert.equal(getReleasedCarouselIndex(0, 0.6, 10), 9);
    assert.equal(getReleasedCarouselIndex(1, 1.6, 10), 9);
});

test('mobile stack keeps the centre card largest and progressively shrinks both sides', () => {
    assert.equal(getMobileStackScale(0), 1.1);
    assert.ok(getMobileStackScale(0) > getMobileStackScale(1));
    assert.ok(getMobileStackScale(1) > getMobileStackScale(2));
    assert.equal(getMobileStackScale(-2), getMobileStackScale(2));
    assert.equal(getMobileStackScale(99), 0.68);
});

test('small finger movement remains a tap while a deliberate swipe suppresses the card click', () => {
    assert.equal(isCarouselDrag(7), false);
    assert.equal(isCarouselDrag(8), true);
    assert.equal(isCarouselDrag(-24), true);
});

test('focused mobile snack starts raining only after three idle seconds', () => {
    assert.equal(isMobileSnackRainReady(2999, false), false);
    assert.equal(isMobileSnackRainReady(3000, false), true);
    assert.equal(isMobileSnackRainReady(5000, true), false);
});

test('every mobile rain drop starts completely above the card edge', () => {
    assert.equal(getMobileRainStartTop(72), -84);
    assert.equal(getMobileRainStartTop(24), -36);
});
