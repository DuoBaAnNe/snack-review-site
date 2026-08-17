export const SNACKS_PER_ROW = 5;
export const MAX_SNACK_ROWS_PER_PAGE = 8;
export const SNACKS_PER_PAGE = SNACKS_PER_ROW * MAX_SNACK_ROWS_PER_PAGE;

export interface SnackPage<T> {
    pageItems: T[];
    currentPage: number;
    totalPages: number;
}

export function paginateSnackItems<T>(
    items: readonly T[],
    requestedPage: number,
): SnackPage<T> {
    const totalPages = Math.max(1, Math.ceil(items.length / SNACKS_PER_PAGE));
    const safeRequest = Number.isFinite(requestedPage) ? Math.trunc(requestedPage) : 1;
    const currentPage = Math.min(totalPages, Math.max(1, safeRequest));
    const start = (currentPage - 1) * SNACKS_PER_PAGE;

    return {
        pageItems: items.slice(start, start + SNACKS_PER_PAGE),
        currentPage,
        totalPages,
    };
}
