import {
    MAX_SNACK_ROWS_PER_PAGE,
    SNACKS_PER_PAGE,
    SNACKS_PER_ROW,
    paginateSnackItems,
} from './snack-pagination';

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

const items = (count: number) => Array.from({ length: count }, (_, id) => ({ id }));

equal(SNACKS_PER_ROW, 5, 'five snacks per row');
equal(MAX_SNACK_ROWS_PER_PAGE, 8, 'eight rows per page');
equal(SNACKS_PER_PAGE, 40, 'forty snacks per page');
equal(paginateSnackItems(items(40), 1), {
    pageItems: items(40), currentPage: 1, totalPages: 1,
}, '40 items fit on one page');

const fortyOnePageTwo = paginateSnackItems(items(41), 2);
equal(fortyOnePageTwo.pageItems.map((item) => item.id), [40], '41st item is on page 2');
equal(fortyOnePageTwo.totalPages, 2, '41 items create two pages');
equal(paginateSnackItems(items(80), 2).pageItems.length, 40, '80 items fill page 2');
equal(paginateSnackItems(items(81), 3).pageItems.map((item) => item.id), [80], '81st item is on page 3');
equal(paginateSnackItems(items(41), 99).currentPage, 2, 'page clamps to final page');
equal(paginateSnackItems(items(41), 0).currentPage, 1, 'page clamps to first page');
equal(paginateSnackItems(items(0), 1).totalPages, 1, 'empty list has a stable page');

console.log(passed + ' passed, ' + failed + ' failed');
if (failed > 0) process.exit(1);
