'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { Snack, SnackImage, CreateSnackInput } from '@/types';
import ImageUploader from './ImageUploader';

const RATING_FIELDS: { key: keyof CreateSnackInput; label: string }[] = [
    { key: 'rating_packaging_quality', label: '包装质量 Packaging Quality' },
    { key: 'rating_packaging_design', label: '包装设计 Packaging Design' },
    { key: 'rating_appearance', label: '零食外观 Appearance' },
    { key: 'rating_smell', label: '零食气味 Smell' },
    { key: 'rating_taste', label: '口味 Taste' },
    { key: 'rating_satiety', label: '饱腹度 Satiety' },
    { key: 'rating_nutrition', label: '营养水平 Nutrition' },
];

function defaultInput(): CreateSnackInput {
    return {
        brand_name: '',
        product_name: '',
        manufacturer_name: '',
        manufacturer_address: '',
        manufacturer_contact: '',
        ingredients: '',
        rating_packaging_quality: 5,
        rating_packaging_design: 5,
        rating_appearance: 5,
        rating_smell: 5,
        rating_taste: 5,
        rating_satiety: 5,
        rating_nutrition: 5,
        image_ids: [],
    };
}

interface Props {
    mode: 'create' | 'edit';
    initialData?: Snack;
}

export default function SnackForm({ mode, initialData }: Props) {
    const router = useRouter();
    const [input, setInput] = useState<CreateSnackInput>(() => {
        if (initialData) {
            return {
                brand_name: initialData.brand_name,
                product_name: initialData.product_name,
                manufacturer_name: initialData.manufacturer_name,
                manufacturer_address: initialData.manufacturer_address,
                manufacturer_contact: initialData.manufacturer_contact,
                ingredients: initialData.ingredients,
                rating_packaging_quality: initialData.rating_packaging_quality,
                rating_packaging_design: initialData.rating_packaging_design,
                rating_appearance: initialData.rating_appearance,
                rating_smell: initialData.rating_smell,
                rating_taste: initialData.rating_taste,
                rating_satiety: initialData.rating_satiety,
                rating_nutrition: initialData.rating_nutrition,
                image_ids: initialData.images.map((img) => img.id),
            };
        }
        return defaultInput();
    });
    const [uploadedImages, setUploadedImages] = useState<SnackImage[]>(
        initialData?.images || []
    );
    const filesRef = useRef<File[]>(initialData?.images.map(() => new File([], '')) || []);
    const [analyzing, setAnalyzing] = useState(false);
    const [analyzeError, setAnalyzeError] = useState('');
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState('');

    function updateField(key: keyof CreateSnackInput, value: string | number) {
        setInput((prev) => ({ ...prev, [key]: value }));
    }

    function handleImagesChange(images: SnackImage[], files: File[]) {
        setUploadedImages(images);
        filesRef.current = files;
        setInput((prev) => ({ ...prev, image_ids: images.map((img) => img.id) }));
    }

    function readFileAsBase64(file: File): Promise<{ base64Data: string; mimeType: string }> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const result = reader.result as string;
                // result is "data:mime/type;base64,xxxxx"
                const commaIdx = result.indexOf(',');
                resolve({
                    base64Data: result.slice(commaIdx + 1),
                    mimeType: file.type || result.slice(5, commaIdx).replace(/;.*/, '') || 'image/jpeg',
                });
            };
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsDataURL(file);
        });
    }

    async function handleAnalyze() {
        const files = filesRef.current;
        if (files.length === 0) {
            setAnalyzeError('Please upload an image first');
            return;
        }
        const latestFile = files[files.length - 1];
        if (!latestFile || latestFile.size === 0) {
            setAnalyzeError('No valid image to analyze');
            return;
        }

        setAnalyzing(true);
        setAnalyzeError('');
        try {
            const { base64Data, mimeType } = await readFileAsBase64(latestFile);
            const res = await fetch('/api/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ base64Data, mimeType }),
            });
            const data = await res.json();
            if (res.ok) {
                setInput((prev) => ({
                    ...prev,
                    brand_name: data.brand_name || prev.brand_name,
                    product_name: data.product_name || prev.product_name,
                    manufacturer_name: data.manufacturer_name || prev.manufacturer_name,
                    manufacturer_address: data.manufacturer_address || prev.manufacturer_address,
                    manufacturer_contact: data.manufacturer_contact || prev.manufacturer_contact,
                    ingredients: data.ingredients || prev.ingredients,
                }));
            } else {
                setAnalyzeError(data.error || 'AI analysis failed');
            }
        } catch {
            setAnalyzeError('AI service unavailable. Fill in fields manually.');
        }
        setAnalyzing(false);
    }

    async function handleSave() {
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
                router.push('/admin');
                router.refresh();
            } else {
                const data = await res.json();
                setSaveError(data.error || 'Save failed');
            }
        } catch {
            setSaveError('Network error. Please try again.');
        }
        setSaving(false);
    }

    return (
        <div className="space-y-6 max-w-2xl mx-auto">
            {/* Image Upload */}
            <section className="bg-white rounded-xl border border-gray-100 p-6">
                <h2 className="font-semibold text-gray-800 mb-4">Step 1: Upload Images</h2>
                <ImageUploader onImagesChange={handleImagesChange} />
                {input.image_ids.length > 0 && (
                    <button
                        type="button"
                        onClick={handleAnalyze}
                        disabled={analyzing}
                        className="mt-3 px-4 py-2 bg-purple-500 text-white text-sm rounded-lg hover:bg-purple-600 transition-colors disabled:opacity-50"
                    >
                        {analyzing ? 'Analyzing...' : 'Analyze with AI'}
                    </button>
                )}
                {analyzeError && <p className="text-yellow-600 text-sm mt-2">{analyzeError}</p>}
            </section>

            {/* Product Info */}
            <section className="bg-white rounded-xl border border-gray-100 p-6">
                <h2 className="font-semibold text-gray-800 mb-4">Step 2: Product Info</h2>
                <div className="space-y-3">
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Brand Name 品牌</label>
                        <input
                            type="text"
                            value={input.brand_name}
                            onChange={(e) => updateField('brand_name', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-400 focus:border-transparent outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Product Name 品名</label>
                        <input
                            type="text"
                            value={input.product_name}
                            onChange={(e) => updateField('product_name', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-400 focus:border-transparent outline-none"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Manufacturer 制造商</label>
                        <input
                            type="text"
                            value={input.manufacturer_name}
                            onChange={(e) => updateField('manufacturer_name', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-400 focus:border-transparent outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Address 地址</label>
                        <input
                            type="text"
                            value={input.manufacturer_address}
                            onChange={(e) => updateField('manufacturer_address', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-400 focus:border-transparent outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Contact 联系方式</label>
                        <input
                            type="text"
                            value={input.manufacturer_contact}
                            onChange={(e) => updateField('manufacturer_contact', e.target.value)}
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
                </div>
            </section>

            {/* Ratings */}
            <section className="bg-white rounded-xl border border-gray-100 p-6">
                <h2 className="font-semibold text-gray-800 mb-4">Step 3: Ratings</h2>
                <div className="space-y-4">
                    {RATING_FIELDS.map(({ key, label }) => (
                        <div key={key} className="flex items-center gap-3">
                            <label className="w-48 text-xs text-gray-500 shrink-0">{label}</label>
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
