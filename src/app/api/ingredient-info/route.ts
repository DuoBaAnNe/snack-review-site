import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

interface InfoResult {
    title: string;
    summary: string;
    url: string;
    source: string;
    matched: string;
    cached: boolean;
}

// Load local knowledge base
let localKB: Record<string, string> | null = null;
function getLocalKB(): Record<string, string> {
    if (!localKB) {
        try {
            const file = fs.readFileSync(
                path.join(process.cwd(), 'src/lib/ingredient-kb.json'), 'utf-8'
            );
            localKB = JSON.parse(file);
        } catch {
            localKB = {};
        }
    }
    return localKB || {};
}

function fuzzyMatch(name: string): { summary: string; matched: string } | null {
    const kb = getLocalKB();
    // Exact match
    if (kb[name]) return { summary: kb[name], matched: name };
    // Try removing trailing chars
    for (let len = name.length - 1; len >= 2; len--) {
        const sub = name.slice(0, len);
        if (kb[sub]) return { summary: kb[sub], matched: sub };
    }
    // Try removing leading chars
    for (let start = 1; start < name.length - 1; start++) {
        const sub = name.slice(start);
        if (sub.length >= 2 && kb[sub]) return { summary: kb[sub], matched: sub };
    }
    return null;
}

function fuzzyQueries(name: string): string[] {
    const queries = [name];
    for (let len = name.length - 1; len >= 2; len--) queries.push(name.slice(0, len));
    for (let start = 1; start < name.length - 1; start++) {
        const sub = name.slice(start);
        if (sub.length >= 2 && !queries.includes(sub)) queries.push(sub);
    }
    return queries;
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

        const descMatch = html.match(/<meta[^>]*name="description"[^>]*content="([^"]*)"/i);
        let summary = descMatch?.[1]?.trim() || '';
        summary = decodeHtml(summary);

        if (!summary || summary.length < 20 || summary.includes('请确认输入的关键词')) return null;

        // Add food-related context from body
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
        const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
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

    // 1. Check local knowledge base (instant)
    const local = fuzzyMatch(name);
    if (local) {
        return NextResponse.json({
            title: name,
            summary: local.summary,
            url: `https://baike.baidu.com/item/${encodeURIComponent(name)}`,
            source: '内置知识库',
            matched: local.matched === name ? name : local.matched,
            cached: true,
        });
    }

    // 2. Fallback: fetch from Baidu Baike (slower, server-side)
    const queries = fuzzyQueries(name);
    for (const q of queries) {
        const summary = await fetchBaiduBaike(q);
        if (summary) {
            return NextResponse.json({
                title: q,
                summary,
                url: `https://baike.baidu.com/item/${encodeURIComponent(q)}`,
                source: '百度百科',
                matched: q === name ? name : q,
                cached: false,
            });
        }
    }

    // 3. Last resort: Wikipedia
    for (const q of queries) {
        const result = await fetchWikipedia(q);
        if (result) {
            return NextResponse.json({
                title: result.title,
                summary: result.summary,
                url: result.url,
                source: '维基百科',
                matched: q === name ? name : q,
                cached: false,
            });
        }
    }

    return NextResponse.json(null);
}
