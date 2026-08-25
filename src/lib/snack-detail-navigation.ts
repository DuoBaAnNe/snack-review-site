export type SnackDetailNavigationTarget =
    | { kind: 'category'; category: string | null }
    | { kind: 'section'; id: 'sec-map' | 'sec-news' | 'sec-ing' }
    | { kind: 'search' };

export function getSnackDetailNavigationHref(target: SnackDetailNavigationTarget): string {
    if (target.kind === 'category') {
        return target.category ? `/?cat=${encodeURIComponent(target.category)}` : '/';
    }
    if (target.kind === 'section') {
        return `/#${target.id}`;
    }
    return '/search';
}
