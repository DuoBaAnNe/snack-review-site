import { requireAuth } from '@/lib/user-guard';
import { getSnacksByCreator } from '@/lib/db';
import MyMapClient from './MyMapClient';

export default async function MyMapPage() {
    const session = await requireAuth();
    const snacks = await getSnacksByCreator(session.username);

    if (snacks.length === 0) {
        return (
            <div className="max-w-6xl mx-auto px-4 py-6">
                <div className="text-center py-16">
                    <p className="text-gray-400 mb-4">你还没有添加任何零食</p>
                    <a href="/add-snack" className="inline-block px-4 py-2 bg-gradient-to-r from-amber-400 to-orange-500 text-white rounded-lg hover:opacity-90 transition-opacity">
                        去添加零食
                    </a>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto px-4 py-6">
            <MyMapClient snacks={snacks} />
        </div>
    );
}
