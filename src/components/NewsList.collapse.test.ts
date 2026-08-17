import * as newsListModule from './NewsList';

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

type ScrollToNewsSection = (listElement: HTMLElement | null) => void;
const scrollToNewsSection = (
    newsListModule as unknown as Record<string, unknown>
).scrollToNewsSection;

equal(typeof scrollToNewsSection, 'function', 'news collapse exposes its section-targeted scroll behavior');

if (typeof scrollToNewsSection === 'function') {
    const selectors: string[] = [];
    const scrollCalls: ScrollIntoViewOptions[] = [];
    const newsSection = {
        scrollIntoView: (options: ScrollIntoViewOptions) => { scrollCalls.push(options); },
    };
    const newsList = {
        closest: (selector: string) => {
            selectors.push(selector);
            return newsSection;
        },
        scrollIntoView: () => { throw new Error('the inner list must not be the primary scroll target'); },
    } as unknown as HTMLElement;

    (scrollToNewsSection as ScrollToNewsSection)(newsList);

    equal(selectors, ['#sec-news'], 'news collapse selects the nearest news section');
    equal(scrollCalls, [{ behavior: 'smooth', block: 'start' }], 'news collapse scrolls the section smoothly from its start');
}

console.log(passed + ' passed, ' + failed + ' failed');
if (failed > 0) process.exit(1);
