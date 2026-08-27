import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldShowBackToTop } from './back-to-top';

test('back-to-top control appears only after the page has been scrolled 600 pixels', () => {
    assert.equal(shouldShowBackToTop(599), false);
    assert.equal(shouldShowBackToTop(600), true);
    assert.equal(shouldShowBackToTop(1600), true);
});
