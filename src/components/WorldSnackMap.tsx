'use client';

import dynamic from 'next/dynamic';
import type { Snack } from '@/types';

const SnackMapView = dynamic(() => import('./SnackMapView'), {
    loading: () => <div className="animate-pulse h-[500px] bg-gray-100 rounded-lg" />,
    ssr: false,
});

// The 3D globe experiment (GlobeMapView) is parked for now — the map view
// shows the plain China map, same as the version deployed on linglingqi.fun.
export default function WorldSnackMap({ snacks }: { snacks: Snack[] }) {
    return <SnackMapView snacks={snacks} />;
}
