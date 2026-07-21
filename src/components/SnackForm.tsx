'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Snack, SnackImage, CreateSnackInput } from '@/types';
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
                router.push(redirectTo || '/admin');
                router.refresh();
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

    return (
        <div className="space-y-6 max-w-2xl mx-auto">
            {/* Image Upload */}
            <section className="bg-white rounded-xl border border-gray-100 p-6">
                <h2 className="font-semibold text-gray-800 mb-4">Step 1: Upload Images <span className="text-red-400">*</span></h2>
                <ImageUploader onImagesChange={handleImagesChange} initialImages={initialData?.images} />
                {fieldErrors.images && <p className="text-red-400 text-xs mt-1">{fieldErrors.images}</p>}
            </section>

            {/* Product Info */}
            <section className="bg-white rounded-xl border border-gray-100 p-6">
                <h2 className="font-semibold text-gray-800 mb-4">Step 2: Product Info</h2>
                <div className="space-y-3">
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Brand Name 品牌 <span className="text-red-400">*</span></label>
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
                        <label className="block text-xs font-medium text-gray-500 mb-1">Product Name 品名 <span className="text-red-400">*</span></label>
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
                        <label className="block text-xs font-medium text-gray-500 mb-1">品牌持有方公司 Brand Holder <span className="text-gray-400">（品牌所属公司，如 上海融氏）</span></label>
                        <input
                            type="text"
                            value={input.manufacturer_name}
                            onChange={(e) => updateField('manufacturer_name', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-400 focus:border-transparent outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">公司所在地 省/市 <span className="text-gray-400">（决定地图省份，如 上海）</span></label>
                        <input
                            type="text"
                            value={input.manufacturer_address}
                            onChange={(e) => updateField('manufacturer_address', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-400 focus:border-transparent outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Ingredients 配料表</label>
                        <textarea
                            rows={4}
                            value={input.ingredients}
                            onChange={(e) => updateField('ingredients', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-400 focus:border-transparent outline-none resize-y"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Category 分类 <span className="text-red-400">*</span></label>
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
                <h2 className="font-semibold text-gray-800 mb-4">Step 3: Review Text 评测文字</h2>
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
                <h2 className="font-semibold text-gray-800 mb-4">Step 4: Ratings</h2>
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
                    {saving ? 'Saving...' : 'Save Snack'}
                </button>
                <button
                    type="button"
                    onClick={() => router.back()}
                    className="px-4 py-2 text-gray-500 hover:text-gray-700 text-sm"
                >
                    Cancel
                </button>
                {saveError && <p className="text-red-500 text-sm">{saveError}</p>}
            </div>
        </div>
    );
}
