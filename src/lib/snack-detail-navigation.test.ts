import assert from 'node:assert/strict';
import test from 'node:test';
import { getSnackDetailNavigationHref } from './snack-detail-navigation';

test('detail category menu targets the matching homepage filter', () => {
    assert.equal(getSnackDetailNavigationHref({ kind: 'category', category: null }), '/');
    assert.equal(
        getSnackDetailNavigationHref({ kind: 'category', category: '肉类零食' }),
        '/?cat=%E8%82%89%E7%B1%BB%E9%9B%B6%E9%A3%9F',
    );
});

test('detail browse menu targets each homepage section', () => {
    assert.equal(getSnackDetailNavigationHref({ kind: 'section', id: 'sec-map' }), '/#sec-map');
    assert.equal(getSnackDetailNavigationHref({ kind: 'section', id: 'sec-news' }), '/#sec-news');
    assert.equal(getSnackDetailNavigationHref({ kind: 'section', id: 'sec-ing' }), '/#sec-ing');
});

test('detail search menu targets the search page', () => {
    assert.equal(getSnackDetailNavigationHref({ kind: 'search' }), '/search');
});
