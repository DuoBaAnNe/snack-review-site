// Shared AI intro writer — DeepSeek via its Anthropic-compatible gateway.
// Used by the daily news cron and the backfill endpoint.

const AI_BASE = process.env.ANTHROPIC_BASE_URL || 'https://api.deepseek.com/anthropic';
const AI_TOKEN = process.env.ANTHROPIC_AUTH_TOKEN || '';
const AI_MODEL = process.env.ANTHROPIC_MODEL || 'deepseek-v4-pro';

function messagesUrl(): string {
    const root = AI_BASE.replace(/\/+$/, '');
    return (root.endsWith('/anthropic') ? root : root + '/anthropic') + '/v1/messages';
}

export function aiAvailable(): boolean {
    return !!AI_TOKEN;
}

export async function aiIntro(title: string): Promise<string | null> {
    if (!AI_TOKEN) return null;
    const prompt = `你是零食测评网站"七零十"的资讯编辑。请为下面这条食品行业新闻标题写一段中文导读，帮读者快速理解：这条新闻大概讲什么、相关背景、以及它对消费者或行业的意义。要求：120~180字；分成两小段更易读；客观中立；绝对不要编造标题中没有的具体数字、日期、人名和结论，把握不准的信息用宽泛表述；不要重复标题原文，不要加"导读："之类前缀。

新闻标题：${title}`;
    try {
        const res = await fetch(messagesUrl(), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': AI_TOKEN,
                'anthropic-version': '2023-06-01',
                'Authorization': `Bearer ${AI_TOKEN}`,
            },
            body: JSON.stringify({
                model: AI_MODEL,
                max_tokens: 800,
                // deepseek-v4-pro is a reasoning model; without this it spends
                // the whole budget "thinking" and never emits the answer
                thinking: { type: 'disabled' },
                messages: [{ role: 'user', content: prompt }],
            }),
            signal: AbortSignal.timeout(40000),
        });
        if (!res.ok) return null;
        const data = await res.json();
        const block = Array.isArray(data?.content)
            ? data.content.find((c: { type: string; text?: string }) => c.type === 'text')
            : null;
        const text = (block?.text || '').trim();
        return text || null;
    } catch (e) {
        console.error('[ai-intro]', e instanceof Error ? e.message : e);
        return null;
    }
}
