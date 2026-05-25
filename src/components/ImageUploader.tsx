'use client';

import { useState, useRef, useCallback } from 'react';
import type { SnackImage } from '@/types';

interface UploadEntry {
    image: SnackImage;
    file: File;
    previewUrl: string;
}

interface Props {
    onImagesChange: (images: SnackImage[], files: File[]) => void;
}

export default function ImageUploader({ onImagesChange }: Props) {
    const [entries, setEntries] = useState<UploadEntry[]>([]);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState('');
    const [dragOver, setDragOver] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const notifyParent = useCallback((newEntries: UploadEntry[]) => {
        setEntries(newEntries);
        onImagesChange(
            newEntries.map((e) => e.image),
            newEntries.map((e) => e.file)
        );
    }, [onImagesChange]);

    async function resizeImage(file: File): Promise<File> {
        const MAX_PX = 2048;
        const MAX_BYTES = 8 * 1024 * 1024;
        if (file.size <= MAX_BYTES) return file;

        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                let { width, height } = img;
                if (width > MAX_PX) { height = Math.round(height * MAX_PX / width); width = MAX_PX; }
                if (height > MAX_PX) { width = Math.round(width * MAX_PX / height); height = MAX_PX; }

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d')!;
                ctx.drawImage(img, 0, 0, width, height);
                canvas.toBlob((blob) => {
                    resolve(new File([blob!], file.name, { type: 'image/jpeg' }));
                }, 'image/jpeg', 0.92);
            };
            img.src = URL.createObjectURL(file);
        });
    }

    async function uploadFiles(files: FileList) {
        setUploading(true);
        setError('');

        const fileArray = Array.from(files);
        const resizedFiles = await Promise.all(fileArray.map(resizeImage));

        const formData = new FormData();
        for (const f of resizedFiles) {
            formData.append('images', f);
        }

        try {
            const res = await fetch('/api/upload', { method: 'POST', body: formData });
            const data = await res.json();
            if (res.ok && data.images) {
                const newEntries: UploadEntry[] = data.images.map((img: SnackImage, i: number) => ({
                    image: img,
                    file: resizedFiles[i],
                    previewUrl: URL.createObjectURL(resizedFiles[i]),
                }));
                const updated = [...entries, ...newEntries];
                notifyParent(updated);
            } else {
                setError(data.error || 'Upload failed');
            }
        } catch {
            setError('Upload failed. Check your connection.');
        }
        setUploading(false);
    }

    function removeImage(id: number) {
        const entry = entries.find((e) => e.image.id === id);
        if (entry) URL.revokeObjectURL(entry.previewUrl);
        notifyParent(entries.filter((e) => e.image.id !== id));
    }

    function handleDrop(e: React.DragEvent) {
        e.preventDefault();
        setDragOver(false);
        if (e.dataTransfer.files.length > 0) uploadFiles(e.dataTransfer.files);
    }

    return (
        <div>
            <div
                className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${dragOver ? 'border-orange-400 bg-orange-50' : 'border-gray-300 hover:border-gray-400'
                    }`}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
            >
                <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) => e.target.files && uploadFiles(e.target.files)}
                />
                {uploading ? (
                    <p className="text-gray-400">Uploading...</p>
                ) : (
                    <>
                        <svg className="w-10 h-10 mx-auto text-gray-300 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                                d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                        </svg>
                        <p className="text-sm text-gray-500">Drop images here or click to browse</p>
                        <p className="text-xs text-gray-400 mt-1">JPEG, PNG, WebP · Max 10MB each (auto-resized)</p>
                    </>
                )}
            </div>
            {error && <p className="text-red-500 text-sm mt-2">{error}</p>}

            {entries.length > 0 && (
                <div className="flex gap-2 mt-3 flex-wrap">
                    {entries.map((entry) => (
                        <div key={entry.image.id} className="relative group">
                            <img
                                src={entry.previewUrl}
                                alt={entry.image.original_name}
                                className="w-20 h-20 object-cover rounded-lg border border-gray-200"
                            />
                            <button
                                onClick={(e) => { e.stopPropagation(); removeImage(entry.image.id); }}
                                className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                            >
                                &times;
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
