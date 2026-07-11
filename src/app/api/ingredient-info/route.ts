import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getDb } from '@/lib/db';

interface InfoResult {
    title: string;
    summary: string;
    url: string;
    source: string;
    matched: string;
    cached: boolean;
}

// Small built-in supplement — guaranteed correct entries that the JSON KB
// does not cover yet. Checked before everything else.
const EXTRA_KB: Record<string, string> = {
    '固体玉米糖浆': '固体玉米糖浆（Corn syrup solids），是玉米糖浆经喷雾干燥脱水制成的白色粉末状产品，主要成分为葡萄糖、麦芽糖和低聚糖。相比液体糖浆更便于干混配料和运输储存，常用于植脂末、奶精、固体饮料、烘焙预拌粉中，提供甜味、改善溶解性和口感。属于添加糖，过量摄入与肥胖、龋齿风险相关，WHO建议成人每日游离糖摄入控制在25-50克以内。',
    '玉米糖浆': '玉米糖浆（Corn syrup），以玉米淀粉为原料经酸法或酶法水解制成的糖浆，主要成分为葡萄糖、麦芽糖和低聚糖（注意与"果葡糖浆/高果糖玉米糖浆"不同，后者经过异构化含大量果糖）。在糖果中防止蔗糖结晶、在烘焙食品中保湿并促进上色，用途广泛。属于添加糖，过量摄入与肥胖、血糖波动相关。',
    '糖浆': '糖浆（Syrup），糖类的浓缩水溶液的统称，按原料和工艺分为葡萄糖浆、麦芽糖浆、玉米糖浆、果葡糖浆、转化糖浆等。在食品工业中提供甜味、保湿、防结晶和增稠等功能，是糖果、烘焙、饮料的基础配料。营养学上均属于添加糖，建议控制摄入量。',
};

// Load built-in knowledge base (ships with the code)
let localKB: Record<string, string> | null = null;
function getLocalKB(): Record<string, string> {
    if (!localKB) {
        try {
            const file = fs.readFileSync(
                path.join(process.cwd(), 'src/lib/ingredient-kb.json'), 'utf-8'
            );
            localKB = { ...JSON.parse(file), ...EXTRA_KB };
        } catch {
            localKB = { ...EXTRA_KB };
        }
    }
    return localKB || {};
}

// --- Candidate name generation ---
// Chinese ingredient names put the head word LAST (固体玉米糖浆 -> 糖浆 is
// the substance, 固体 is just a modifier). So we: 1) strip known modifier
// prefixes, 2) fall back to suffixes, longest first. We never match by
// prefix — that is what wrongly matched 固体玉米糖浆 to 固体.
const MODIFIER_PREFIX = /^(固体|液体|食用|精制|精炼|浓缩|脱水|脱脂|全脂|低脂|无水|结晶|天然|复合|进口|新鲜|优质|特级|一级|二级)/;

function candidateNames(name: string): string[] {
    const list: string[] = [name];
    let core = name;
    for (;;) {
        const m = core.match(MODIFIER_PREFIX);
        if (!m) break;
        const next = core.slice(m[0].length);
        if (next.length < 2) break;
        core = next;
        if (!list.includes(core)) list.push(core);
    }
    for (let start = 1; start <= core.length - 2; start++) {
        const sub = core.slice(start);
        if (!list.includes(sub)) list.push(sub);
    }
    return list;
}

// --- Database-backed knowledge base (grows automatically) ---
// v2: table renamed to discard bad entries cached by earlier versions.
const KB_TABLE = 'ingredient_kb_v2';
let kbTableReady = false;
async function ensureKbTable(db: Awaited<ReturnType<typeof getDb>>) {
    if (kbTableReady) return;
    await db.execute(`CREATE TABLE IF NOT EXISTS ${KB_TABLE} (
        name TEXT PRIMARY KEY,
        summary TEXT NOT NULL,
        url TEXT DEFAULT '',
        source TEXT DEFAULT '',
        created_at TEXT DEFAULT (datetime('now'))
    )`);
    kbTableReady = true;
}

async function saveToKb(name: string, matched: string, summary: string, url: string, source: string) {
    try {
        const db = await getDb();
        await ensureKbTable(db);
        await db.execute(
            `INSERT OR REPLACE INTO ${KB_TABLE} (name, summary, url, source) VALUES (?, ?, ?, ?)`,
            [name, summary, url, source]
        );
        if (matched !== name) {
            await db.execute(
                `INSERT OR REPLACE INTO ${KB_TABLE} (name, summary, url, source) VALUES (?, ?, ?, ?)`,
                [matched, summary, url, source]
            );
        }
    } catch (e: any) {
        console.error('[kb-save]', e?.message || e);
    }
}

function decodeHtml(text: string): string {
    return text
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"').replace(/&#x27;/g, "'")
        .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
        .replace(/&nbsp;/g, ' ').replace(/&mdash;/g, '—').replace(/&ndash;/g, '–')
        .replace(/&ldquo;/g, '"').replace(/&rdquo;/g, '"')
        .replace(/&lsquo;/g, "'").replace(/&rsquo;/g, "'")
        .replace(/&hellip;/g, '…').replace(/&middot;/g, '·');
}

function stripHtml(text: string): string {
    return text.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

async function fetchBaiduBaike(query: string): Promise<string | null> {
    try {
        const url = `https://baike.baidu.com/item/${encodeURIComponent(query)}`;
        const res = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SnackReviewBot/1.0)' },
            signal: AbortSignal.timeout(5000),
        });
        if (!res.ok) return null;
        const html = await res.text();

        // Guard against Baidu redirecting to an unrelated page: the page
        // title must contain the query text, otherwise reject the result.
        const titleMatch = html.match(/<title>([^<]*)<\/title>/i);
        const pageTitle = titleMatch?.[1] || '';
        if (!pageTitle.includes(query)) return null;

        const descMatch = html.match(/<meta[^>]*name="description"[^>]*content="([^"]*)"/i);
        let summary = descMatch?.[1]?.trim() || '';
        summary = decodeHtml(summary);

        if (!summary || summary.length < 20 || summary.includes('请确认输入的关键词')) return null;

        const bodyMatch = html.match(/<div[^>]*class="[^"]*para[^"]*"[^>]*>([\s\S]*?)<\/div>/gi);
        let extra = '';
        if (bodyMatch) {
            for (const m of bodyMatch.slice(0, 3)) {
                const text = stripHtml(decodeHtml(m));
                if (text.length > 20 && /食品|食用|调味|营养|添加|防腐|加工/.test(text)) {
                    extra += text.slice(0, 150) + '。';
                }
            }
        }
        return (summary + (extra ? ' ' + extra : '')).slice(0, 800);
    } catch {
        return null;
    }
}

async function fetchWikipedia(query: string): Promise<{ title: string; summary: string; url: string } | null> {
    try {
        const url = `https://zh.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`;
        const res = await fetch(url, {
            // Ask for Simplified Chinese explicitly
            headers: { 'Accept-Language': 'zh-CN' },
            signal: AbortSignal.timeout(5000),
        });
        if (!res.ok) return null;
        const data = await res.json();
        if (data.type === 'disambiguation' || !data.extract) return null;
        const summary = data.extract?.slice(0, 800) || '';
        if (!summary) return null;
        return {
            title: data.title,
            summary,
            url: data.content_urls?.desktop?.page || '',
        };
    } catch {
        return null;
    }
}

export async function GET(request: Request) {
    const name = new URL(request.url).searchParams.get('name');
    if (!name) return NextResponse.json({ error: 'Missing name' }, { status: 400 });

    const candidates = candidateNames(name);

    // 1. Built-in knowledge base (instant)
    const kb = getLocalKB();
    for (const c of candidates) {
        if (kb[c]) {
            return NextResponse.json({
                title: name,
                summary: kb[c],
                url: `https://baike.baidu.com/item/${encodeURIComponent(c)}`,
                source: '内置知识库',
                matched: c,
                cached: true,
            });
        }
    }

    // 2. Database knowledge base (grows automatically as new names are looked up)
    try {
        const db = await getDb();
        await ensureKbTable(db);
        const placeholders = candidates.map(() => '?').join(',');
        const rows = await db.execute(
            `SELECT name, summary, url, source FROM ${KB_TABLE} WHERE name IN (${placeholders})`,
            candidates
        );
        const byName = new Map(rows.rows.map((r: any) => [r.name as string, r]));
        for (const c of candidates) {
            const row: any = byName.get(c);
            if (row) {
                return NextResponse.json({
                    title: name,
                    summary: row.summary as string,
                    url: (row.url as string) || `https://baike.baidu.com/item/${encodeURIComponent(c)}`,
                    source: '本地知识库',
                    matched: c,
                    cached: true,
                });
            }
        }
    } catch (e: any) {
        console.error('[kb-lookup]', e?.message || e);
    }

    // 3. Baidu Baike (server-side fetch; result is saved for next time)
    for (const q of candidates.slice(0, 5)) {
        const summary = await fetchBaiduBaike(q);
        if (summary) {
            const url = `https://baike.baidu.com/item/${encodeURIComponent(q)}`;
            await saveToKb(name, q, summary, url, '百度百科');
            return NextResponse.json({
                title: q,
                summary,
                url,
                source: '百度百科',
                matched: q,
                cached: false,
            });
        }
    }

    // 4. Last resort: Wikipedia (also saved for next time)
    for (const q of candidates.slice(0, 5)) {
        const result = await fetchWikipedia(q);
        if (result) {
            await saveToKb(name, q, result.summary, result.url, '维基百科');
            return NextResponse.json({
                title: result.title,
                summary: result.summary,
                url: result.url,
                source: '维基百科',
                matched: q,
                cached: false,
            });
        }
    }

    return NextResponse.json(null);
}