import type { AnalysisResult } from '@/types';

const API_BASE = process.env.ANTHROPIC_BASE_URL || 'https://api.deepseek.com';
const API_TOKEN = process.env.ANTHROPIC_AUTH_TOKEN || '';
const MODEL = process.env.ANTHROPIC_MODEL || 'deepseek-v4-pro';

const ANALYSIS_PROMPT = `Analyze this image of a snack product's packaging. Extract the following information from any visible text on the package. Return ONLY a valid JSON object with these exact keys. Use empty strings for any information you cannot find:

{
  "brand_name": "the brand or company name of the snack",
  "product_name": "the specific product name of this snack item",
  "manufacturer_name": "the company that OWNS the brand (品牌方 / 品牌持有方 / 委托方 / 商标持有人). If the package separates a brand owner from the factory that produced it, put the BRAND OWNER here, never the factory",
  "manufacturer_address": "the brand owner's location -- prefer its province and city (e.g. 上海市). If only a factory address is printed, use that",
  "brand_company": "",
  "ingredients": "the complete ingredients list exactly as printed on the package. Include all items in order"
}

Rules:
- Read text in any language visible on the package (Chinese, English, Japanese, Korean, etc.)
- Preserve the original language of the ingredients list -- do not translate
- If information spans multiple lines, combine it into a single string
- IMPORTANT: Chinese packages often show BOTH a brand owner (委托方) and a contract factory (受托方 / 被委托方 / 生产商 / 制造商). manufacturer_name and manufacturer_address must describe the BRAND OWNER (委托方), because we use them to place the snack on a province map by who owns the brand -- not where it was made
- Leave brand_company as an empty string
- Do NOT invent or guess information that is not visible on the package
- Return ONLY the JSON object, no other text before or after`;

export async function analyzeSnackImage(base64Data: string, mimeType: string): Promise<AnalysisResult> {
    const apiResponse = await fetch(`${API_BASE}/v1/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${API_TOKEN}`,
        },
        body: JSON.stringify({
            model: MODEL,
            max_tokens: 1024,
            messages: [{
                role: 'user',
                content: [
                    {
                        type: 'image_url',
                        image_url: {
                            url: `data:${mimeType};base64,${base64Data}`,
                        }
                    },
                    { type: 'text', text: ANALYSIS_PROMPT }
                ]
            }]
        })
    });

    if (!apiResponse.ok) {
        const errorText = await apiResponse.text().catch(() => '');
        throw new Error(`AI API error: ${apiResponse.status} ${errorText}`);
    }

    const json = await apiResponse.json();
    const text: string = json.choices?.[0]?.message?.content || '';

    let cleaned = text.trim();
    if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
    if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
    if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);
    cleaned = cleaned.trim();

    try {
        const result: AnalysisResult = JSON.parse(cleaned);
        return {
            brand_name: result.brand_name || '',
            product_name: result.product_name || '',
            manufacturer_name: result.manufacturer_name || '',
            manufacturer_address: result.manufacturer_address || '',
            brand_company: result.brand_company || '',
            ingredients: result.ingredients || '',
        };
    } catch {
        return {
            brand_name: '',
            product_name: '',
            manufacturer_name: '',
            manufacturer_address: '',
            brand_company: '',
            ingredients: '',
        };
    }
}
