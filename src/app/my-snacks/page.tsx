import { requireAuth } from '@/lib/user-guard';
import { getSnacksByCreator } from '@/lib/db';
import SnackCard from '@/components/SnackCard';
import Link from 'next/link';

export default async function MySnacksPage() {
    const session = await requireAuth();
    const snacks = await getSnacksByCreator(session.username);

    return (
        <div className="max-w-6xl mx-auto px-4 py-8">
            <div className="flex items-baseline gap-2 mb-6">
                <span className="text-2xl">🍿</span>
                <h1 className="text-2xl font-black text-gray-900">我的零食</h1>
                <span className="text-xs text-gray-400">{snacks.length} 款</span>
            </div>
            {snacks.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-2xl border border-gray-100">
                    <div className="text-5xl mb-3">🍪</div>
                    <p className="text-gray-400 mb-5">你还没有上传任何零食</p>
                    <Link
                        href="/add-snack"
                        className="inline-block px-5 py-2 bg-gradient-to-r from-amber-400 to-orange-500 text-white font-semibold rounded-full hover:opacity-90 transition-opacity"
                    >
                        去添加零食
                    </Link>
                </div>
            ) : (
                <div className="space-y-5">
                    {snacks.map((snack) => (
                        <SnackCard key={snack.id} snack={snack} />
                    ))}
                </div>
            )}
        </div>
    );
}
