import { requireAuth } from '@/lib/user-guard';
import { getSnacksByCreator } from '@/lib/db';
import SnackCard from '@/components/SnackCard';
import Link from 'next/link';

export default async function MySnacksPage() {
    const session = await requireAuth();
    const snacks = await getSnacksByCreator(session.username);

    return (
        <div className="max-w-6xl mx-auto px-4 py-6">
            <h1 className="text-xl font-bold text-gray-800 mb-6">我的零食</h1>
            {snacks.length === 0 ? (
                <div className="text-center py-16">
                    <p className="text-gray-400 mb-4">你还没有上传任何零食</p>
                    <Link
                        href="/add-snack"
                        className="inline-block px-4 py-2 bg-gradient-to-r from-amber-400 to-orange-500 text-white rounded-lg hover:opacity-90 transition-opacity"
                    >
                        去添加零食
                    </Link>
                </div>
            ) : (
                <div className="space-y-4">
                    {snacks.map((snack) => (
                        <SnackCard key={snack.id} snack={snack} />
                    ))}
                </div>
            )}
        </div>
    );
}
