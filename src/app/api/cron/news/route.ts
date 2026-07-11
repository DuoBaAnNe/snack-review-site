import { NextResponse } from 'next/server';
import { getDb, createNews, getAllNews } from '@/lib/db';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Daily automated news collection for the 零食新闻 board.
// Trigger: Vercel Cron at 00:00 UTC (= 08:00 Beijing), see vercel.json.
// Cross-verification: a story is only published if at least TWO different
// media outlets report it (clustered by title similarity).

const QUERIES = ['零食', '食品安全', '休闲食品'];
const MAX_PUBLISH = 10;
const MAX_AGE_HOURS = 48;

const RELEVANT = /零食|食品|糖果|饼干|坚果|巧克力|薯片|辣条|乳业|牛奶|酸奶|饮料|方便面|烘焙|果冻|冰淇淋|雪糕|抽检|召回|添加剂|保质期|膨化|卫龙|三只松鼠|良品铺子|盐津铺子|奥利奥|乐事|旺旺/;

interface FeedItem {
    title: string;
    link: string;
    sourceName: string;
    sourceDomain: string;
    pubDate: number;
}

function decodeXml(text: string): string {
    return text
        .replace(/<!\[CDATA\[/g, '').replace(/\]\]>/g, '')
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
        .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
        .trim();
}

async function fetchFeed(query: string): Promise<FeedItem[]> {
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=zh-CN&gl=CN&ceid=CN:zh-Hans`;
    try {
        const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
        if (!res.ok) return [];
        const xml = await res.text();
        const items: FeedItem[] = [];
        const itemBlocks = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
        for (const block of itemBlocks) {
            const rawTitle = decodeXml(block.match(/<title>([\s\S]*?)<\/title>/)?.[1] || '');
            const link = decodeXml(block.match(/<link>([\s\S]*?)<\/link>/)?.[1] || '');
            const pub = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] || '';
            const srcMatch = block.match(/<source[^>]*url="([^"]*)"[^>]*>([\s\S]*?)<\/source>/);
            const sourceUrl = srcMatch?.[1] || '';
            const sourceName = decodeXml(srcMatch?.[2] || '');
            if (!rawTitle || !link) continue;
            // Google News titles end with " - 来源名"
            const title = rawTitle.replace(/\s*-\s*[^-]+$/, '').trim() || rawTitle;
            let sourceDomain = '';
            try { sourceDomain = new URL(sourceUrl).hostname; } catch { sourceDomain = sourceName; }
            const pubDate = pub ? Date.parse(pub) : 0;
            items.push({ title, link, sourceName, sourceDomain, pubDate });
        }
        return items;
    } catch {
        return [];
    }
}

// --- Title similarity (character bigram overlap) ---
function bigrams(s: string): Set<string> {
    const t = s.replace(/[^一-龥A-Za-z0-9]/g, '');
    const set = new Set<string>();
    for (let i = 0; i < t.length - 1; i++) set.add(t.slice(i, i + 2));
    return set;
}

function similarity(a: string, b: string): number {
    const sa = bigrams(a);
    const sb = bigrams(b);
    if (sa.size === 0 || sb.size === 0) return 0;
    let inter = 0;
    for (const x of sa) if (sb.has(x)) inter++;
    return inter / Math.min(sa.size, sb.size);
}

// --- Once-per-day guard ---
async function alreadyRanToday(force: boolean): Promise<boolean> {
    const db = await getDb();
    await db.execute(`CREATE TABLE IF NOT EXISTS cron_log (
        job TEXT NOT NULL,
        day TEXT NOT NULL,
        PRIMARY KEY (job, day)
    )`);
    if (force) return false;
    const day = new Date().toISOString().slice(0, 10);
    const result = await db.execute(
        'INSERT OR IGNORE INTO cron_log (job, day) VALUES (?, ?)',
        ['news', day]
    );
    return result.rowsAffected === 0;
}

export async function GET(request: Request) {
    // Allow: Vercel cron, a caller with CRON_SECRET, or a logged-in admin
    const secret = process.env.CRON_SECRET;
    const auth = request.headers.get('authorization') || '';
    const ua = request.headers.get('user-agent') || '';
    const isCron = ua.includes('vercel-cron') || (!!secret && auth === `Bearer ${secret}`);
    const isAdmin = !isCron && !!(await getSession());
    if (!isCron && !isAdmin) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const force = isAdmin && url.searchParams.get('force') === '1';

    if (await alreadyRanToday(force)) {
        return NextResponse.json({ ok: true, skipped: '今天已经发布过了' });
    }

    // 1. Collect from all feeds
    const all: FeedItem[] = [];
    for (const q of QUERIES) {
        all.push(...await fetchFeed(q));
    }

    // 2. Keep fresh + relevant items
    const cutoff = Date.now() - MAX_AGE_HOURS * 3600 * 1000;
    const fresh = all.filter((it) =>
        (it.pubDate === 0 || it.pubDate >= cutoff) && RELEVANT.test(it.title)
    );

    // 3. Cluster similar titles; a cluster is trustworthy only if at least
    //    two DIFFERENT outlets reported the same story (cross-verification)
    const clusters: FeedItem[][] = [];
    for (const item of fresh) {
        let placed = false;
        for (const cluster of clusters) {
            if (similarity(item.title, cluster[0].title) >= 0.5) {
                cluster.push(item);
                placed = true;
                break;
            }
        }
        if (!placed) clusters.push([item]);
    }
    const verified = clusters.filter((c) => {
        const domains = new Set(c.map((i) => i.sourceDomain || i.sourceName));
        return domains.size >= 2;
    });
    // Most-reported stories first
    verified.sort((a, b) => b.length - a.length);

    // 4. Skip stories already on the news board
    const existing = await getAllNews();
    const existingTitles = existing.slice(0, 100).map((n) => n.title);

    let published = 0;
    const publishedTitles: string[] = [];
    for (const cluster of verified) {
        if (published >= MAX_PUBLISH) break;
        const rep = cluster[0];
        if (existingTitles.some((t) => similarity(rep.title, t) >= 0.6)) continue;
        if (publishedTitles.some((t) => similarity(rep.title, t) >= 0.6)) continue;

        const sources = [...new Set(cluster.map((i) => i.sourceName).filter(Boolean))];
        const content = `${sources.length} 家媒体报道了这条新闻（${sources.slice(0, 4).join('、')}${sources.length > 4 ? ' 等' : ''}），信息经多来源交叉核验。点击下方链接阅读原文。\n\n—— 本条由系统每日自动采集发布`;

        await createNews(rep.title, content, rep.link);
        publishedTitles.push(rep.title);
        published++;
    }

    return NextResponse.json({
        ok: true,
        collected: all.length,
        fresh: fresh.length,
        verifiedClusters: verified.length,
        published,
        titles: publishedTitles,
    });
}
