// Google News RSS links point at news.google.com redirect pages, which are
// unreachable from mainland China. Resolve them server-side to the real
// publisher URL; if that fails, fall back to a Baidu search for the headline
// (always reachable and finds the article).

export function isGoogleLink(url: string): boolean {
    return /news\.google\./.test(url || '');
}

export function baiduFallback(title: string): string {
    return `https://www.baidu.com/s?wd=${encodeURIComponent(title)}`;
}

export async function resolveRealUrl(url: string, title: string): Promise<string> {
    if (!url) return baiduFallback(title);
    if (!isGoogleLink(url)) return url;
    try {
        const res = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36',
            },
            redirect: 'follow',
            signal: AbortSignal.timeout(8000),
        });
        // Followed all the way to the publisher?
        if (res.url && !isGoogleLink(res.url) && isArticleUrl(res.url)) return res.url;
        // Otherwise the redirect target is embedded in the HTML shell.
        const html = await res.text();
        const au = html.match(/data-n-au="([^"]+)"/);
        if (au && au[1] && isArticleUrl(au[1])) return au[1].replace(/&amp;/g, '&');
        // Scan every href and take the first that looks like a real article —
        // NOT an image/asset (the old code grabbed a googleusercontent avatar,
        // so "阅读原文" opened a tiny image instead of the story).
        for (const mm of html.matchAll(/href="(https?:\/\/[^"]+)"/g)) {
            const u = mm[1].replace(/&amp;/g, '&');
            if (isArticleUrl(u)) return u;
        }
    } catch { /* fall through to Baidu */ }
    return baiduFallback(title);
}

// A usable article link: not Google infrastructure, not an image/style/script
// asset, and not a sized-thumbnail URL (…=w16).
const NON_ARTICLE_HOST = /(news|accounts|policies|support|www)\.google\.|googleusercontent|gstatic|ggpht|google-analytics|doubleclick|fonts\.google/i;
const ASSET_URL = /\.(png|jpe?g|gif|svg|webp|ico|css|js|woff2?)(\?|#|$)|=w\d+(-h\d+)?(-[a-z]+)?$/i;

export function isArticleUrl(url: string): boolean {
    if (!url || !/^https?:\/\//.test(url)) return false;
    if (NON_ARTICLE_HOST.test(url)) return false;
    if (ASSET_URL.test(url)) return false;
    return true;
}
