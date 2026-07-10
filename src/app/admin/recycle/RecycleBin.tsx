'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Snack } from '@/types';

export default function RecycleBin({ snacks: initialSnacks }: { snacks: Snack[] }) {
    const router = useRouter();
    const [snacks, setSnacks] = useState(initialSnacks);
    const [message, setMessage] = useState('');

    async function handleRestore(id: number, name: string) {
        if (!confirm(`恢复「${name}」？`)) return;
        const res = await fetch(`/api/snacks/${id}`, { method: 'PATCH' });
        if (res.ok) {
            setSnacks(prev => prev.filter(s => s.id !== id));
            setMessage(`已恢复「${name}」`);
            router.refresh();
        }
    }

    if (snacks.length === 0) {
        return <p className="text-gray-400 text-center py-10">回收站为空</p>;
    }

    return (
        <div>
            {message && <p className="text-green-500 text-sm mb-3">{message}</p>}
            <div className="space-y-2">
                {snacks.map(snack => (
                    <div key={snack.id} className="flex items-center justify-between bg-white rounded-lg border border-gray-100 p-3">
                        <div>
                            <span className="font-medium text-gray-700">{snack.brand_name}</span>
                            <span className="text-gray-400 mx-2">|</span>
                            <span className="text-gray-600">{snack.product_name}</span>
                            <span className="text-gray-400 ml-2 text-xs">{snack.created_at?.slice(0, 10)}</span>
                        </div>
                        <button
                            onClick={() => handleRestore(snack.id, snack.product_name)}
                            className="px-3 py-1 text-xs text-green-600 hover:bg-green-50 rounded transition-colors"
                        >
                            恢复
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}
