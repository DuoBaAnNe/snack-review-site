import type { AnalysisResult } from '@/types';

const API_BASE = process.env.ANTHROPIC_BASE_URL || 'https://api.deepseek.com/anthropic';
const API_TOKEN = process.env.ANTHROPIC_AUTH_TOKEN || '';
const MODEL = process.env.ANTHROPIC_MODEL || 'deepseek-v4-pro';

const ANALYSIS_PROMPT = `Analyze this image of a snack product's packaging. Extract the following information from any visible text on the package. Return ONLY a valid JSON object with these exact keys. Use empty strings for any information you cannot find:

{
  "brand_name": "the brand or company name of the snack",
  "product_name": "the specific product name of this snack item",
  "manufacturer_name": "the name of the company that manufactured this product",
  "manufacturer_address": "the manufacturer's physical address if shown",
  "manufacturer_contact": "phone number, website, email, or other contact info if shown",
  "ingredients": "the complete ingredients list exactly as printed on the package. Include all items in order"
}

Rules:
- Read text in any language visible on the package (Chinese, English, Japanese, Korean, etc.)
- Preserve the original language of the ingredients list -- do not translate
- If information spans multiple lines, combine it into a single string
- Do NOT invent or guess information that is not visible on the package
- Return ONLY the JSON object, no other text before or after`;

export async function analyzeSnackImage(imageUrl: string): Promise<AnalysisResult> {
    // Handle relative paths (local dev) - prepend the origin
    const url = imageUrl.startsWith('http')
        ? imageUrl
        : `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}${imageUrl}`;

    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status}`);
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    const base64 = buffer.toString('base64');

    // Determine mime type from URL extension or response
    const contentType = response.headers.get('content-type') || '';
    const mimeType = contentType.startsWith('image/') ? contentType : 'image/jpeg';

    const apiResponse = await fetch(`${API_BASE}/v1/messages`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': API_TOKEN,
            'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
            model: MODEL,
            max_tokens: 1024,
            messages: [{
                role: 'user',
                content: [
                    {
                        type: 'image',
                        source: {
                            type: 'base64',
                            media_type: mimeType,
                            data: base64,
                        }
                    },
                    { type: 'text', text: ANALYSIS_PROMPT }
                ]
            }]
        })
    });

    if (!apiResponse.ok) {
        throw new Error(`AI API error: ${apiResponse.status} ${apiResponse.statusText}`);
    }

    const json = await apiResponse.json();
    const text: string = json.content?.[0]?.text || '';

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
            manufacturer_contact: result.manufacturer_contact || '',
            ingredients: result.ingredients || '',
        };
    } catch {
        return {
            brand_name: '',
            product_name: '',
            manufacturer_name: '',
            manufacturer_address: '',
            manufacturer_contact: '',
            ingredients: '',
        };
    }
}
