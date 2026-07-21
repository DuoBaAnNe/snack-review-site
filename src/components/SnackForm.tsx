'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { Snack, SnackImage, CreateSnackInput, AnalysisResult } from '@/types';
import ImageUploader from './ImageUploader';

const CATEGORIES = [
    '膨化食品', '烘焙糕点', '糖果巧克力', '肉类零食',
    '坚果炒货', '果脯蜜饯', '豆制品类', '乳制品类',
    '水产海鲜', '果冻布丁', '冲调即食', '其他',
] as const;

const RATING_FIELDS: { key: keyof CreateSnackInput; label: string }[] = [
    { key: 'rating_taste_health', label: '口感与味道' },
    { key: 'rating_ingredients_health', label: '配料与健康' },
    { key: 'rating_packaging_portability', label: '包装与便携' },
    { key: 'rating_use_case', label: '适用场景' },
    { key: 'rating_value', label: '性价比' },
];

function defaultInput(): CreateSnackInput {
    return {
        brand_name: '',
        product_name: '',
        manufacturer_name: '',
        manufacturer_address: '',
        brand_company: '',
        ingredients: '',
        category: '',
        review_text: '',
        rating_taste_health: 5,
        rating_ingredients_health: 5,
        rating_packaging_portability: 5,
        rating_use_case: 5,
        rating_value: 5,
        image_ids: [],
    };
}

interface Props {
    mode: 'create' | 'edit';
    initialData?: Snack;
    redirectTo?: string;
}

export default function SnackForm({ mode, initialData, redirectTo }: Props) {
    const router = useRouter();
    const [input, setInput] = useState<CreateSnackInput>(() => {
        if (initialData) {
            return {
                brand_name: initialData.brand_name,
                product_name: initialData.product_name,
                manufacturer_name: initialData.manufacturer_name,
                manufacturer_address: initialData.manufacturer_address,
                brand_company: initialData.brand_company,
                ingredients: initialData.ingredients,
                category: initialData.category,
                review_text: initialData.review_text,
                rating_taste_health: initialData.rating_taste_health,
                rating_ingredients_health: initialData.rating_ingredients_health,
                rating_packaging_portability: initialData.rating_packaging_portability,
                rating_use_case: initialData.rating_use_case,
                rating_value: initialData.rating_value,
                image_ids: initialData.images.map((img) => img.id),
            };
        }
        return defaultInput();
    });
    const [uploadedImages, setUploadedImages] = useState<SnackImage[]>(
        initialData?.images || []
    );
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState('');
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    // AI auto-fill for the brand-holder fields: which field is currently
    // loading, the last message, and a cache so clicking both buttons on the
    // same image only calls the AI once.
    const [aiField, setAiField] = useState<'manufacturer_name' | 'manufacturer_address' | null>(null);
    const [aiError, setAiError] = useState('');
    const aiCache = useRef<{ imageId: number; result: AnalysisResult } | null>(null);

    function updateField(key: keyof CreateSnackInput, value: string | number) {
        setInput((prev) => ({ ...prev, [key]: value }));
        setFieldErrors((prev) => ({ ...prev, [key]: '' }));
    }

    function handleImagesChange(images: SnackImage[], _files: File[]) {
        setUploadedImages(images);
        setInput((prev) => ({ ...prev, image_ids: images.map((img) => img.id) }));
        setFieldErrors((prev) => ({ ...prev, images: '' }));
    }

    function validate(): boolean {
        const errors: Record<string, string> = {};
        if (uploadedImages.length === 0) errors.images = '请至少上传一张图片';
        if (!input.brand_name.trim()) errors.brand_name = '请输入品牌';
        if (!input.product_name.trim()) errors.product_name = '请输入品名';
        if (!input.category.trim()) errors.category = '请选择分类';
        setFieldErrors(errors);
        return Object.keys(errors).length === 0;
    }

    async function handleSave() {
        if (!validate()) return;
        setSaving(true);
        setSaveError('');

        const url = mode === 'create' ? '/api/snacks' : `/api/snacks/${initialData!.id}`;
        const method = mode === 'create' ? 'POST' : 'PUT';

        try {
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(input),
            });
            if (res.ok) {
                // Full-page nav: client-side router.push silently no-ops on this
                // site, which left the user stuck on the form after a successful
                // save and looking like it had failed. A hard redirect also loads
                // fresh data at the destination, so router.refresh isn't needed.
                window.location.href = redirectTo || '/admin';
                return;
            } else {
                const text = await res.text();
                let message = `Server error (${res.status})`;
                try {
                    const data = JSON.parse(text);
                    message = data.error || message;
                } catch {
                    message = text || message;
                }
                setSaveError(message);
            }
        } catch (e: any) {
            setSaveError(e.message || 'Network error. Please try again.');
        }
        setSaving(false);
    }

    function blobToBase64(blob: Blob): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const s = (reader.result as string) || '';
                resolve(s.split(',')[1] || ''); // strip the "data:...;base64," prefix
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }

    // Ask the AI to read the first uploaded photo and fill one brand-holder
    // field. The result is cached per image so filling both fields costs one call.
    async function runAI(field: 'manufacturer_name' | 'manufacturer_address') {
        setAiError('');
        const first = uploadedImages[0];
        if (!first) { setAiError('请先上传零食图片，再点 AI 识别'); return; }
        setAiField(field);
        try {
            let result = aiCache.current?.imageId === first.id ? aiCache.current.result : null;
            if (!result) {
                const imgRes = await fetch(`/api/images/${first.id}`);
                if (!imgRes.ok) throw new Error('读取图片失败');
                const blob = await imgRes.blob();
                const base64Data = await blobToBase64(blob);
                const res = await fetch('/api/analyze', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ base64Data, mimeType: blob.type || 'image/webp' }),
                });
                if (!res.ok) {
                    const d = await res.json().catch(() => ({}));
                    throw new Error(d.error || 'AI 识别失败，请重试');
                }
                result = await res.json() as AnalysisResult;
                aiCache.current = { imageId: first.id, result };
            }
            const value = field === 'manufacturer_name' ? result.manufacturer_name : result.manufacturer_address;
            if (value) {
                updateField(field, value);
            } else {
                setAiError(field === 'manufacturer_name'
                    ? 'AI 没能从图片识别出品牌持有方，请手动填写'
                    : 'AI 没能从图片识别出地址，请手动填写');
            }
        } catch (e: any) {
            setAiError(e.message || 'AI 识别失败，请重试');
        }
        setAiField(null);
    }

    return (
        <div className="space-y-6 max-w-2xl mx-auto">
            {/* Image Upload */}
            <section className="bg-white rounded-xl border border-gray-100 p-6">
                <h2 className="font-semibold text-gray-800 mb-4">第 1 步 · 上传图片 <span className="text-red-400">*</span></h2>
                <ImageUploader onImagesChange={handleImagesChange} initialImages={initialData?.images} />
                {fieldErrors.images && <p className="text-red-400 text-xs mt-1">{fieldErrors.images}</p>}
            </section>

            {/* Product Info */}
            <section className="bg-white rounded-xl border border-gray-100 p-6">
                <h2 className="font-semibold text-gray-800 mb-4">第 2 步 · 品牌与产品信息</h2>
                <div className="space-y-3">
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">品牌 <span className="text-gray-400 font-normal">Brand</span> <span className="text-red-400">*</span></label>
                        <input
                            type="text"
                            value={input.brand_name}
                            onChange={(e) => updateField('brand_name', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-400 focus:border-transparent outline-none"
                            required
                        />
                        {fieldErrors.brand_name && <p className="text-red-400 text-xs mt-1">{fieldErrors.brand_name}</p>}
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">品名 <span className="text-gray-400 font-normal">Product</span> <span className="text-red-400">*</span></label>
                        <input
                            type="text"
                            value={input.product_name}
                            onChange={(e) => updateField('product_name', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-400 focus:border-transparent outline-none"
                            required
                        />
                        {fieldErrors.product_name && <p className="text-red-400 text-xs mt-1">{fieldErrors.product_name}</p>}
                    </div>
                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <label className="text-xs font-medium text-gray-500">品牌持有方公司 <span className="text-gray-400 font-normal">Brand Holder</span></label>
                            <button
                                type="button"
                                onClick={() => runAI('manufacturer_name')}
                                disabled={aiField !== null || uploadedImages.length === 0}
                                className="text-xs px-2 py-0.5 rounded-md border border-orange-300 text-orange-600 hover:bg-orange-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            >
                                {aiField === 'manufacturer_name' ? '识别中…' : '✨ AI 识别'}
                            </button>
                        </div>
                        <input
                            type="text"
                            value={input.manufacturer_name}
                            onChange={(e) => updateField('manufacturer_name', e.target.value)}
                            placeholder="品牌所属公司，如 上海融氏"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-400 focus:border-transparent outline-none"
                        />
                    </div>
                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <label className="text-xs font-medium text-gray-500">品牌持有方公司地址 <span className="text-gray-400 font-normal">Address</span></label>
                            <button
                                type="button"
                                onClick={() => runAI('manufacturer_address')}
                                disabled={aiField !== null || uploadedImages.length === 0}
                                className="text-xs px-2 py-0.5 rounded-md border border-orange-300 text-orange-600 hover:bg-orange-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            >
                                {aiField === 'manufacturer_address' ? '识别中…' : '✨ AI 识别'}
                            </button>
                        </div>
                        <input
                            type="text"
                            value={input.manufacturer_address}
                            onChange={(e) => updateField('manufacturer_address', e.target.value)}
                            placeholder="决定地图所属省份，如 上海市松江区…"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-400 focus:border-transparent outline-none"
                        />
                    </div>
                    {aiError && <p className="text-amber-600 text-xs">{aiError}</p>}
                    {uploadedImages.length === 0 && (
                        <p className="text-gray-400 text-xs">提示：先在上方上传零食图片，才能用「AI 识别」自动填写</p>
                    )}
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">配料表 <span className="text-gray-400 font-normal">Ingredients</span></label>
                        <textarea
                            rows={4}
                            value={input.ingredients}
                            onChange={(e) => updateField('ingredients', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-400 focus:border-transparent outline-none resize-y"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">分类 <span className="text-gray-400 font-normal">Category</span> <span className="text-red-400">*</span></label>
                        <select
                            value={input.category}
                            onChange={(e) => updateField('category', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-400 focus:border-transparent outline-none"
                        >
                            <option value="">请选择分类</option>
                            {CATEGORIES.map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                            ))}
                        </select>
                        {fieldErrors.category && <p className="text-red-400 text-xs mt-1">{fieldErrors.category}</p>}
                    </div>
                </div>
            </section>

            {/* Review Text */}
            <section className="bg-white rounded-xl border border-gray-100 p-6">
                <h2 className="font-semibold text-gray-800 mb-4">第 3 步 · 评测文字</h2>
                <textarea
                    rows={6}
                    value={input.review_text}
                    onChange={(e) => updateField('review_text', e.target.value)}
                    placeholder="写下你对这款零食的评价..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-400 focus:border-transparent outline-none resize-y"
                />
            </section>

            {/* Ratings */}
            <section className="bg-white rounded-xl border border-gray-100 p-6">
                <h2 className="font-semibold text-gray-800 mb-4">第 4 步 · 评分</h2>
                <div className="space-y-4">
                    {RATING_FIELDS.map(({ key, label }) => (
                        <div key={key} className="flex items-center gap-3">
                            <label className="w-28 md:w-48 text-xs text-gray-500 shrink-0">{label}</label>
                            <input
                                type="range"
                                min={1}
                                max={10}
                                value={input[key] as number}
                                onChange={(e) => updateField(key, parseInt(e.target.value))}
                                className="flex-1 accent-orange-500"
                            />
                            <span className="w-8 text-center text-sm font-semibold text-gray-700">
                                {input[key] as number}
                            </span>
                        </div>
                    ))}
                </div>
            </section>

            {/* Save */}
            <div className="flex items-center gap-4">
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-6 py-2.5 bg-gradient-to-r from-amber-400 to-orange-500 text-white font-semibold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                    {saving ? '保存中…' : '保存零食'}
                </button>
                <button
                    type="button"
                    onClick={() => router.back()}
                    className="px-4 py-2 text-gray-500 hover:text-gray-700 text-sm"
                >
                    取消
                </button>
                {saveError && <p className="text-red-500 text-sm">{saveError}</p>}
            </div>
        </div>
    );
}
