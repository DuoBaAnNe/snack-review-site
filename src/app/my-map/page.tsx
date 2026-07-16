import { requireAuth } from '@/lib/user-guard';
import { getSnacksByCreator } from '@/lib/db';
import MyMapClient from './MyMapClient';

export default async function MyMapPage() {
    const session = await requireAuth();
    const snacks = await getSnacksByCreator(session.username);

    if (snacks.length === 0) {
        return (
            <div className="max-w-6xl mx-auto px-4 py-8">
                <div className="flex items-baseline gap-2 mb-6">
                    <span className="text-2xl">🗺️</span>
                    <h1 className="text-2xl font-black text-gray-900">我的地图</h1>
                </div>
                <div className="text-center py-20 bg-white rounded-2xl border border-gray-100">
                    <div className="text-5xl mb-3">🗺️</div>
                    <p className="text-gray-400 mb-5">你还没有添加任何零食，地图会随你的足迹亮起来</p>
                    <a href="/add-snack" className="inline-block px-5 py-2 bg-gradient-to-r from-amber-400 to-orange-500 text-white font-semibold rounded-full hover:opacity-90 transition-opacity">
                        去添加零食
                    </a>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto px-4 py-8">
            <div className="flex items-baseline gap-2 mb-6">
                <span className="text-2xl">🗺️</span>
                <h1 className="text-2xl font-black text-gray-900">我的地图</h1>
            </div>
            <MyMapClient snacks={snacks} />
        </div>
    );
}
