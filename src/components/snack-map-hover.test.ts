import assert from 'node:assert/strict';
import test from 'node:test';

import { shouldClearMapHoverPanel } from './snack-map-hover';

test('clears an unpinned hover panel when the pointer is over map blank space', () => {
    assert.equal(shouldClearMapHoverPanel({ hasRenderTarget: false, pinned: false }), true);
});

test('keeps a hover panel while the pointer is still over a rendered province', () => {
    assert.equal(shouldClearMapHoverPanel({ hasRenderTarget: true, pinned: false }), false);
});

test('keeps a clicked panel pinned even when the pointer moves over map blank space', () => {
    assert.equal(shouldClearMapHoverPanel({ hasRenderTarget: false, pinned: true }), false);
});
