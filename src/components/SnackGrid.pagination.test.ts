import { createElement, type ComponentType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Snack } from '@/types';
import * as snackGridModule from './SnackGrid';

let passed = 0;
let failed = 0;

function equal(actual: unknown, expected: unknown, name: string) {
    if (JSON.stringify(actual) === JSON.stringify(expected)) {
        passed++;
        console.log('  ✓ ' + name);
    } else {
        failed++;
        console.error('  ✗ ' + name + ': expected ' + JSON.stringify(expected) + ', got ' + JSON.stringify(actual));
    }
}

function snack(id: number): Snack {
    return {
        id,
        brand_name: 'Brand ' + id,
        product_name: 'Snack ' + id,
        manufacturer_name: 'Maker',
        manufacturer_address: 'Address',
        brand_company: 'Company',
        ingredients: 'Ingredient',
        category: 'Category',
        review_text: 'Review',
        rating_taste_health: 5,
        rating_ingredients_health: 5,
        rating_packaging_portability: 5,
        rating_use_case: 5,
        rating_value: 5,
        created_by: 'Tester',
        created_at: '2026-08-17T00:00:00.000Z',
        updated_at: '2026-08-17T00:00:00.000Z',
        images: [],
    };
}

const SnackGrid = snackGridModule.default as ComponentType<{ snacks: Snack[] }>;
const html = renderToStaticMarkup(createElement(SnackGrid, {
    snacks: Array.from({ length: 41 }, (_, index) => snack(index + 1)),
}));

equal(html.includes('aria-label="零食分页"'), true, 'more than 40 snacks render the pagination navigation');
equal(html.includes('aria-current="page" aria-label="第 1 页"'), true, 'the initial page is exposed as the current page');
equal(html.includes('aria-label="第 1 页零食列表，共 2 页"'), true, 'the rendered snack grid is a labelled focus target');
equal(html.includes('tabindex="-1"'), true, 'the snack grid can receive programmatic focus without joining tab order');
equal(
    html.includes('aria-label="手机端第 1 排零食卡片，10 款，可无限循环"'),
    true,
    'the mobile layout exposes ten snacks as one infinite carousel row',
);
equal(
    html.includes('aria-label="手机端第 4 排零食卡片，10 款，可无限循环"'),
    true,
    'forty snacks render as four mobile carousel rows',
);
equal(
    html.includes('aria-label="手机端第 5 排零食卡片'),
    false,
    'the first forty-snack page does not create a fifth mobile row',
);

type CommitPageChange = (
    focusTarget: { focus(options: FocusOptions): void } | null,
    scrollTarget: { scrollIntoView(options: ScrollIntoViewOptions): void } | null,
) => void;

const commitPageChange = (
    snackGridModule as unknown as Record<string, unknown>
).commitSnackPageChange;

equal(typeof commitPageChange, 'function', 'page changes expose the commit-time focus and scroll behavior');

if (typeof commitPageChange === 'function') {
    let focusOptions: FocusOptions | undefined;
    let scrollOptions: ScrollIntoViewOptions | undefined;

    (commitPageChange as CommitPageChange)(
        { focus: (options) => { focusOptions = options; } },
        { scrollIntoView: (options) => { scrollOptions = options; } },
    );

    equal(focusOptions, { preventScroll: true }, 'page change moves focus without a second browser jump');
    equal(scrollOptions, { behavior: 'smooth', block: 'start' }, 'page change keeps smooth section scrolling');
}

console.log(passed + ' passed, ' + failed + ' failed');
if (failed > 0) process.exit(1);
