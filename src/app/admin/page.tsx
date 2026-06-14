import Link from 'next/link';
import { getAllSnacks, getAllNews } from '@/lib/db';
import { getImageUrl } from '@/lib/image-url';
import { requireAdmin } from '@/lib/admin-guard';
import DeleteButton from '@/components/DeleteButton';
import NewsManager from './NewsManager';

export const dynamic = 'force-dynamic';

export default async function AdminDashboard() {
    await requireAdmin();
    const snacks = await getAllSnacks();
    const news = await getAllNews();

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-xl font-bold text-gray-800">
                    Snack Reviews ({snacks.length})
                </h1>
                <Link
                    href="/admin/new"
                    className="px-4 py-2 bg-gradient-to-r from-amber-400 to-orange-500 text-white font-medium rounded-lg hover:opacity-90 transition-opacity text-sm"
                >
                    + Add New Snack
                </Link>
            </div>

            {snacks.length === 0 ? (
                <div className="text-center py-16 text-gray-400 bg-white rounded-xl border border-gray-100">
                    <p className="text-lg">No entries yet.</p>
                    <p className="text-sm mt-1">Click &quot;Add New Snack&quot; to create your first review.</p>
                </div>
            ) : (
                <div className="bg-white rounded-xl border border-gray-100 overflow-x-auto">
                    <table className="w-full min-w-[700px]">
                        <thead>
                            <tr className="border-b border-gray-100 bg-gray-50">
                                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Image</th>
                                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Brand</th>
                                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Product</th>
                                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Category</th>
                                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Review</th>
                                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Date</th>
                                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {snacks.map((snack) => (
                                <tr key={snack.id} className="border-b border-gray-50 hover:bg-gray-50">
                                    <td className="px-4 py-3">
                                        {snack.images[0] ? (
                                            <img
                                                src={getImageUrl(snack.images[0])}
                                                alt="thumb"
                                                className="w-12 h-12 rounded object-cover"
                                            />
                                        ) : (
                                            <div className="w-12 h-12 rounded bg-gray-100" />
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-700">{snack.brand_name}</td>
                                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{snack.product_name}</td>
                                    <td className="px-4 py-3 text-xs">
                                        <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{snack.category}</span>
                                    </td>
                                    <td className="px-4 py-3 text-xs text-gray-400 max-w-[200px] truncate">{snack.review_text || '—'}</td>
                                    <td className="px-4 py-3 text-sm text-gray-400">{snack.created_at.slice(0, 10)}</td>
                                    <td className="px-4 py-3 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <Link
                                                href={`/admin/${snack.id}/edit`}
                                                className="text-xs text-orange-600 hover:text-orange-800 font-medium"
                                            >
                                                Edit
                                            </Link>
                                            <DeleteButton snackId={snack.id} snackName={snack.product_name} />
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* News Management */}
            <div className="mt-12">
                <h2 className="text-xl font-bold text-gray-800 mb-6">
                    📰 News Management ({news.length})
                </h2>
                <NewsManager news={news} />
            </div>
        </div>
    );
}
