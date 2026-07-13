import { requireAdmin } from '@/lib/admin-guard';
import { getDeletedSnacks, getDeletedNews } from '@/lib/db';
import RecycleBin from './RecycleBin';

export default async function RecyclePage() {
    await requireAdmin();
    const snacks = await getDeletedSnacks();
    const news = await getDeletedNews();

    return (
        <div className="max-w-6xl mx-auto px-4 py-6">
            <h1 className="text-xl font-bold text-gray-800 mb-6">回收站</h1>
            <RecycleBin snacks={snacks} news={news} />
        </div>
    );
}
