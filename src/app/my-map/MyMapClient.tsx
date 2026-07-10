'use client';

import dynamic from 'next/dynamic';
import type { Snack } from '@/types';

const SnackMapView = dynamic(() => import('@/components/SnackMapView'), {
    loading: () => (
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-4">
            <h2 className="text-lg font-bold text-gray-800 mb-2 text-center">我的地图</h2>
            <div className="animate-pulse h-[500px] bg-gray-100 rounded-lg flex items-center justify-center">
                <span className="text-gray-400">加载中...</span>
            </div>
        </div>
    ),
    ssr: false,
});

export default function MyMapClient({ snacks }: { snacks: Snack[] }) {
    return <SnackMapView snacks={snacks} />;
}
