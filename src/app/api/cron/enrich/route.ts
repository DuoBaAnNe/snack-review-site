import { NextResponse } from 'next/server';
import { getDb, getAllNews } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { aiIntro } from '@/lib/ai-intro';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Backfills AI intros for news items that were published with the thin
// "N 家媒体报道…" format only. Admin-triggered; processes a batch per call
// to stay inside the function time limit — visit repeatedly until done=0.
const BATCH = 12;
const CONCURRENCY = 4;

function needsIntro(content: string): boolean {
    const t = content.trim();
    // Thin items start directly with the source line or the old plain text
    return t.startsWith('📰') || t.startsWith('�') || /^\d+\s*家媒体报道/.test(t);
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
        const thin = all.filter((n) => !n.title.startsWith('【环球美食】') && needsIntro(n.content));
        const batch = thin.slice(0, BATCH);

        const db = await getDb();
        let done = 0;
        const failed: string[] = [];

        for (let i = 0; i < batch.length; i += CONCURRENCY) {
            const group = batch.slice(i, i + CONCURRENCY);
            await Promise.all(group.map(async (item) => {
                const cleanTitle = item.title.replace(/^【[^】]*】\s*/, '');
                const intro = await aiIntro(cleanTitle);
                if (!intro) { failed.push(cleanTitle.slice(0, 20)); return; }
                const srcLine = (item.content.match(/📰[^\n]*/) || [])[0]
                    || item.content.split('\n')[0];
                const content = `${intro}\n\n${srcLine}\n—— 导读由 AI 辅助撰写，点击"阅读原文"查看完整报道`;
                await db.execute('UPDATE news SET content = ? WHERE id = ?', [content, item.id]);
                done++;
            }));
        }

        return NextResponse.json({
            ok: true,
            enriched: done,
            remaining: thin.length - batch.length + failed.length,
            failed,
            tip: thin.length - batch.length + failed.length > 0
                ? '还有未处理的，请再访问一次这个链接'
                : '全部补完',
        });
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error('[enrich]', msg);
        return NextResponse.json({ ok: false, error: msg }, { status: 500 });
    }
}
