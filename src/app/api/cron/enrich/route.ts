import { NextResponse } from 'next/server';
import { getDb, getAllNews } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { aiIntro } from '@/lib/ai-intro';
import { isGoogleLink, resolveRealUrl } from '@/lib/resolve-link';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Fixes up already-published news items:
//   1. adds an AI intro to items published with the thin format only
//   2. rewrites news.google.com redirect links (unreachable from mainland
//      China) to the real publisher URL, or a Baidu search fallback
// Admin-triggered; processes a batch per call to stay inside the function
// time limit — visit repeatedly until remaining=0.
const BATCH = 10;
const CONCURRENCY = 4;

function needsIntro(content: string): boolean {
    const t = content.trim();
    return t.startsWith('📰') || /^\d+\s*家媒体报道/.test(t);
}

export async function GET(request: Request) {
    const secret = process.env.CRON_SECRET;
    const auth = request.headers.get('authorization') || '';
    const ua = request.headers.get('user-agent') || '';
    const isCron = ua.includes('vercel-cron') || (!!secret && auth === `Bearer ${secret}`);
    const isAdmin = !isCron && !!(await getSession());
    if (!isCron && !isAdmin) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const all = await getAllNews();
        const pending = all.filter((n) =>
            !n.title.startsWith('【环球美食】')
            && (needsIntro(n.content) || isGoogleLink(n.source_url))
        );
        const batch = pending.slice(0, BATCH);

        const db = await getDb();
        let introsAdded = 0;
        let linksFixed = 0;
        const failed: string[] = [];

        for (let i = 0; i < batch.length; i += CONCURRENCY) {
            const group = batch.slice(i, i + CONCURRENCY);
            await Promise.all(group.map(async (item) => {
                const cleanTitle = item.title.replace(/^【[^】]*】\s*/, '');

                // New intro if the content is still the thin format
                let newContent = item.content;
                if (needsIntro(item.content)) {
                    const intro = await aiIntro(cleanTitle);
                    if (intro) {
                        const srcLine = (item.content.match(/📰[^\n]*/) || [])[0]
                            || item.content.split('\n')[0];
                        newContent = `${intro}\n\n${srcLine}\n—— 导读由 AI 辅助撰写，点击"阅读原文"查看完整报道`;
                        introsAdded++;
                    } else {
                        failed.push(cleanTitle.slice(0, 20));
                    }
                }

                // Real publisher URL if the link still goes through Google
                let newUrl = item.source_url;
                if (isGoogleLink(item.source_url)) {
                    newUrl = await resolveRealUrl(item.source_url, cleanTitle);
                    if (newUrl !== item.source_url) linksFixed++;
                }

                if (newContent !== item.content || newUrl !== item.source_url) {
                    await db.execute(
                        'UPDATE news SET content = ?, source_url = ? WHERE id = ?',
                        [newContent, newUrl, item.id]
                    );
                }
            }));
        }

        const remaining = Math.max(0, pending.length - batch.length) + failed.length;
        return NextResponse.json({
            ok: true,
            introsAdded,
            linksFixed,
            remaining,
            failed,
            tip: remaining > 0 ? '还有未处理的，请再访问一次这个链接' : '全部处理完毕',
        });
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error('[enrich]', msg);
        return NextResponse.json({ ok: false, error: msg }, { status: 500 });
    }
}
