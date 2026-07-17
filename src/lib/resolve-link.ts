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
        if (res.url && !isGoogleLink(res.url)) return res.url;
        // Otherwise the redirect target is embedded in the HTML shell
        const html = await res.text();
        const m = html.match(/data-n-au="([^"]+)"/)
            || html.match(/href="(https?:\/\/(?!news\.google|accounts\.google|policies\.google|support\.google|www\.google)[^"]+)"/);
        if (m && m[1]) {
            return m[1].replace(/&amp;/g, '&');
        }
    } catch { /* fall through to Baidu */ }
    return baiduFallback(title);
}
