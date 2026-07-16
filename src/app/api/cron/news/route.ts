import { NextResponse } from 'next/server';
import { getDb, createNews, getAllNews } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { WORLD_FOODS } from '@/lib/world-foods';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Daily automated news collection for the 零食新闻 board.
// Trigger: Vercel Cron at 00:00 UTC (= 08:00 Beijing), see vercel.json.
// Editorial policy:
//   - Focus on innovation / research / industry / regulation stories,
//     domestic and international.
//   - Food-safety incident stories are capped at 2 per day.
//   - A world specialty food feature is published on Mondays and Thursdays.
// Cross-verification: a story is only published if at least TWO different
// media outlets report it (clustered by title similarity).

// One intro per title. Parallel calls; each is independent so a single
// failure only drops that one card's intro.
import { aiIntro, aiAvailable } from '@/lib/ai-intro';

async function aiEnrich(titles: string[]): Promise<(string | null)[] | null> {
    if (!aiAvailable() || titles.length === 0) return null;
    return Promise.all(titles.map((t) => aiIntro(t)));
}

// NOTE: the `when:Nd` operator is essential — without it Google News
// sorts by relevance and returns months-old evergreen articles. It caps
// results to the last N days at the source. Verified 2026-07-13.
const QUERIES = [
    '食品 新品 上市 when:7d',
    '食品 研发 创新 when:7d',
    '食品 营养 研究 when:7d',
    '食品 产业 投资 when:7d',
    '食品 标准 法规 when:7d',
    '零食 when:5d',
    '食品 when:3d',
];
const MAX_PUBLISH = 10;
const MAX_SAFETY = 2;
const MAX_AGE_HOURS = 168; // 7 days, matches the widest when: window

const RELEVANT = /零食|食品|糖果|饼干|坚果|巧克力|薯片|辣条|乳业|牛奶|酸奶|饮料|方便面|烘焙|果冻|冰淇淋|雪糕|添加剂|代糖|蛋白|风味|膨化|休闲食品/;

// Category rules — checked in order, first hit wins
const CATEGORY_RULES: [string, RegExp][] = [
    ['食品安全', /抽检|不合格|召回|下架|中毒|超标|违规|查处|曝光|315|变质|异物|投诉|处罚/],
    ['法规', /法规|新规|国标|标准|条例|监管|政策|征求意见|管理办法|禁止|禁用|限量/],
    ['科研', /研究|学术|论文|期刊|科学家|实验|发现|大学|科研|临床|营养学|队列/],
    ['创新', /创新|新品|新技术|首款|首发|研发|推出|专利|升级|黑科技|新口味|新工艺|人造肉|细胞培养/],
    ['产业', /产业|市场|营收|财报|增长|出口|进口|工厂|投产|投资|并购|品牌|销量|供应链|上市|IPO|渠道|电商/],
];

function classify(title: string): string {
    for (const [cat, re] of CATEGORY_RULES) {
        if (re.test(title)) return cat;
    }
    return '资讯';
}

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
// The day is marked only AFTER a successful run, so a crashed or timed-out
// run does not burn the day (the next trigger can retry).
function todayKey(): string {
    return new Date().toISOString().slice(0, 10);
}

async function ensureCronTable() {
    const db = await getDb();
    await db.execute(`CREATE TABLE IF NOT EXISTS cron_log (
        job TEXT NOT NULL,
        day TEXT NOT NULL,
        PRIMARY KEY (job, day)
    )`);
    return db;
}

async function ranToday(): Promise<boolean> {
    const db = await ensureCronTable();
    const result = await db.execute(
        'SELECT 1 FROM cron_log WHERE job = ? AND day = ?',
        ['news', todayKey()]
    );
    return result.rows.length > 0;
}

async function markRanToday(): Promise<void> {
    const db = await ensureCronTable();
    await db.execute(
        'INSERT OR IGNORE INTO cron_log (job, day) VALUES (?, ?)',
        ['news', todayKey()]
    );
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

    try {
    if (!force && await ranToday()) {
        return NextResponse.json({ ok: true, skipped: '今天已经发布过了' });
    }

    // 1. Collect from all feeds — in parallel to stay well within the
    //    function time limit
    const feedResults = await Promise.all(QUERIES.map((q) => fetchFeed(q)));
    const all: FeedItem[] = feedResults.flat();

    // 2. Keep fresh + relevant items.
    //    - Items with an unparseable/missing date are kept (benefit of doubt)
    //    - Google already scopes results to our queries, so if the strict
    //      keyword filter wipes everything out, fall back to the fresh set
    const cutoff = Date.now() - MAX_AGE_HOURS * 3600 * 1000;
    const freshOnly = all.filter((it) => !(it.pubDate > 0) || it.pubDate >= cutoff);
    const relevantFresh = freshOnly.filter((it) => RELEVANT.test(it.title));
    const fresh = relevantFresh.length > 0 ? relevantFresh : freshOnly;

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
    // Trusted outlets — a story from one of these passes verification even
    // as a single source (Google News already merges duplicate coverage,
    // so requiring 2+ domains alone filters out almost everything)
    const TRUSTED = /新华|人民网|人民日报|央视|CCTV|中新社|中国新闻网|澎湃|界面|第一财经|每日经济|21世纪经济|经济观察|北京商报|新京报|环球网|中国网|光明网|工人日报|南方都市报|南方周末|红星新闻|封面新闻|极目新闻|上观|解放日报|财新|证券时报|券商中国|食品伙伴网|FoodTalks|Foodaily|中国食品报|消费日报|中国经济网|经济日报|36氪|虎嗅|钛媒体|路透|Reuters|BBC|FT中文|联合早报|zaobao|新浪|搜狐|网易|腾讯|凤凰/i;

    const verified = clusters.filter((c) => {
        const domains = new Set(c.map((i) => i.sourceDomain || i.sourceName));
        if (domains.size >= 2) return true;
        return c.some((i) => TRUSTED.test(i.sourceName) || TRUSTED.test(i.sourceDomain));
    });
    // Most-reported stories first
    verified.sort((a, b) => b.length - a.length);

    // 4. Editorial mix: innovation/research/industry/regulation first;
    //    safety-incident stories capped at MAX_SAFETY per day
    const safetyClusters = verified.filter((c) => classify(c[0].title) === '食品安全');
    const otherClusters = verified.filter((c) => classify(c[0].title) !== '食品安全');
    const ordered = [...otherClusters, ...safetyClusters.slice(0, MAX_SAFETY)];

    // 5. Skip stories already on the news board; pick the final list
    const existing = await getAllNews();
    const existingTitles = existing.slice(0, 150).map((n) => n.title.replace(/^【[^】]*】\s*/, ''));

    const chosen: { rep: FeedItem; cat: string; sources: string[] }[] = [];
    for (const cluster of ordered) {
        if (chosen.length >= MAX_PUBLISH) break;
        const rep = cluster[0];
        if (existingTitles.some((t) => similarity(rep.title, t) >= 0.6)) continue;
        if (chosen.some((c) => similarity(rep.title, c.rep.title) >= 0.6)) continue;
        const sources = [...new Set(cluster.map((i) => i.sourceName).filter(Boolean))];
        chosen.push({ rep, cat: classify(rep.title), sources });
    }

    // 5b. AI-written intros (falls back to the plain format if the call fails)
    const intros = await aiEnrich(chosen.map((c) => c.rep.title));

    let published = 0;
    const publishedTitles: string[] = [];
    for (let i = 0; i < chosen.length; i++) {
        const { rep, cat, sources } = chosen[i];
        const srcLine = sources.length >= 2
            ? `📰 ${sources.length} 家媒体报道（${sources.slice(0, 4).join('、')}${sources.length > 4 ? ' 等' : ''}），信息经多来源交叉核验。`
            : `📰 来源：${sources[0] || '媒体报道'}（权威媒体）。`;
        const intro = intros?.[i]?.trim();
        const content = intro
            ? `${intro}\n\n${srcLine}\n—— 导读由 AI 辅助撰写，点击"阅读原文"查看完整报道`
            : `${srcLine}\n\n—— 本条由系统每日自动采集发布，点击"阅读原文"查看报道`;

        await createNews(`【${cat}】${rep.title}`, content, rep.link);
        publishedTitles.push(rep.title);
        published++;
    }

    // 6. World specialty food feature — Mondays & Thursdays (UTC).
    //    Skip if one was already posted in the last 48h (e.g. repeated
    //    force runs while testing), so the board doesn't flood with foods.
    let foodPublished = '';
    const weekday = new Date().getUTCDay();
    const recentFood = existing.some((n) =>
        n.title.startsWith('【环球美食】')
        && Date.now() - Date.parse(n.created_at.replace(' ', 'T') + 'Z') < 48 * 3600 * 1000
    );
    if ((weekday === 1 || weekday === 4 || force) && !recentFood) {
        const nextFood = WORLD_FOODS.find(
            (f) => !existing.some((n) => n.title.includes(f.name))
        );
        if (nextFood) {
            await createNews(
                `【环球美食】${nextFood.name} · ${nextFood.region}`,
                `${nextFood.intro}\n\n—— 环球特色美食栏目 · 每周一、周四更新`,
                ''
            );
            foodPublished = nextFood.name;
        }
    }

    // Mark the day only after everything succeeded (force runs don't count)
    if (!force) await markRanToday();

    return NextResponse.json({
        ok: true,
        collected: all.length,
        freshOnly: freshOnly.length,
        relevantFresh: relevantFresh.length,
        fresh: fresh.length,
        verifiedClusters: verified.length,
        published,
        worldFood: foodPublished || null,
        titles: publishedTitles,
        // Diagnostic sample: first 3 items with their parsed dates
        sample: all.slice(0, 3).map((i) => ({
            title: i.title.slice(0, 40),
            source: i.sourceName,
            date: i.pubDate > 0 ? new Date(i.pubDate).toISOString() : `raw:${i.pubDate}`,
        })),
    });
    } catch (e: any) {
        console.error('[cron-news]', e?.message || e);
        return NextResponse.json(
            { ok: false, error: String(e?.message || e) },
            { status: 500 }
        );
    }
}
