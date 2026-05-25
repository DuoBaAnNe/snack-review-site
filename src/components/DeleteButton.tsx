'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function DeleteButton({ snackId, snackName }: { snackId: number; snackName: string }) {
    const router = useRouter();
    const [confirming, setConfirming] = useState(false);
    const [deleting, setDeleting] = useState(false);

    async function handleDelete() {
        setDeleting(true);
        const res = await fetch(`/api/snacks/${snackId}`, { method: 'DELETE' });
        if (res.ok) {
            router.refresh();
        } else {
            alert('Delete failed');
        }
        setDeleting(false);
        setConfirming(false);
    }

    if (!confirming) {
        return (
            <button
                onClick={() => setConfirming(true)}
                className="text-xs text-red-400 hover:text-red-600 font-medium"
            >
                Delete
            </button>
        );
    }

    return (
        <span className="flex items-center gap-1 text-xs">
            <span className="text-gray-400">Sure?</span>
            <button
                onClick={handleDelete}
                disabled={deleting}
                className="text-red-600 font-semibold hover:text-red-800"
            >
                {deleting ? '...' : 'Yes'}
            </button>
            <button
                onClick={() => setConfirming(false)}
                className="text-gray-400 hover:text-gray-600"
            >
                No
            </button>
        </span>
    );
}
