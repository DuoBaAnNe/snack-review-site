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

// AI intro writer — same API credentials as the snack image analyzer
const AI_BASE = process.env.ANTHROPIC_BASE_URL || 'https://api.deepseek.com';
const AI_TOKEN = process.env.ANTHROPIC_AUTH_TOKEN || '';
const AI_MODEL = process.env.ANTHROPIC_MODEL || 'deepseek-v4-pro';

async function aiEnrich(titles: string[]): Promise<string[] | null> {
    if (!AI_TOKEN || titles.length === 0) return null;
    const prompt = `你是零食测评网站"七零十"的新闻编辑。下面是今天采集到的食品行业新闻标题列表。请为每条新闻写一段80~140字的中文导读：用通俗的语言说明这条新闻大概讲什么、相关背景、以及它对消费者或行业的意义。要求：客观中立；绝对不要编造标题中没有的具体数字、日期、人名和结论；把握不准的信息用宽泛表述。

标题列表：
${titles.map((t, i) => `${i + 1}. ${t}`).join('\n')}

只返回一个 JSON 字符串数组（长度 ${titles.length}，顺序与标题一一对应），不要任何其他文字。`;
    try {
        const res = await fetch(`${AI_BASE}/v1/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${AI_TOKEN}`,
            },
            body: JSON.stringify({
                model: AI_MODEL,
                max_tokens: 3000,
                messages: [{ role: 'user', content: prompt }],
            }),
            signal: AbortSignal.timeout(30000),
        });
        if (!res.ok) return null;
        const data = await res.json();
        let text: string = data?.choices?.[0]?.message?.content || '';
        text = text.replace(/```json/gi, '').replace(/```/g, '').trim();
        const start = text.indexOf('[');
        const end = text.lastIndexOf(']');
        if (start === -1 || end === -1) return null;
        const arr = JSON.parse(text.slice(start, end + 1));
        if (!Array.isArray(arr) || arr.length !== titles.length) return null;
        return arr.map((s) => String(s));
    } catch (e: any) {
        console.error('[ai-enrich]', e?.message || e);
        return null;
    }
}

const QUERIES = ['零食 新品', '食品 创新 科技', '食品 研究', '食品产业 市场', '食品 标准 法规'];
const MAX_PUBLISH = 10;
const MAX_SAFETY = 2;
const MAX_AGE_HOURS = 48;

const RELEVANT = /零食|食品|糖果|饼干|坚果|巧克力|薯片|辣条|乳业|牛奶|酸奶|饮料|方便面|烘焙|果冻|冰淇淋|雪糕|添加剂|代糖|蛋白|风味|膨化|休闲食品/;

// Category rules — checked in order, first hit wins
const CATEGORY_RULES: [string, RegExp][] = [
    ['安全', /抽检|不合格|召回|下架|中毒|超标|违规|查处|曝光|315|变质|异物|投诉|处罚/],
    ['法规', /法规|新规|国标|标准|条例|监管|政策|征求意见|管理办法|禁止|禁用|限量/],
    ['研究', /研究|学术|论文|期刊|科学家|实验|发现|大学|科研|临床|营养学|队列/],
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

    // 4. Editorial mix: innovation/research/industry/regulation first;
    //    safety-incident stories capped at MAX_SAFETY per day
    const safetyClusters = verified.filter((c) => classify(c[0].title) === '安全');
    const otherClusters = verified.filter((c) => classify(c[0].title) !== '安全');
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
        const srcLine = `📰 ${sources.length} 家媒体报道（${sources.slice(0, 4).join('、')}${sources.length > 4 ? ' 等' : ''}），信息经多来源交叉核验。`;
        const intro = intros?.[i]?.trim();
        const content = intro
            ? `${intro}\n\n${srcLine}\n—— 导读由 AI 辅助撰写，点击"阅读原文"查看完整报道`
            : `${srcLine}\n\n—— 本条由系统每日自动采集发布，点击"阅读原文"查看报道`;

        await createNews(`【${cat}】${rep.title}`, content, rep.link);
        publishedTitles.push(rep.title);
        published++;
    }

    // 6. World specialty food feature — Mondays & Thursdays (UTC)
    let foodPublished = '';
    const weekday = new Date().getUTCDay();
    if (weekday === 1 || weekday === 4 || force) {
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

    return NextResponse.json({
        ok: true,
        collected: all.length,
        fresh: fresh.length,
        verifiedClusters: verified.length,
        published,
        worldFood: foodPublished || null,
        titles: publishedTitles,
    });
}
