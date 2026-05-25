import Link from 'next/link';
import { getAllSnacks } from '@/lib/db';
import DeleteButton from '@/components/DeleteButton';

export default async function AdminDashboard() {
    const snacks = await getAllSnacks();

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
                <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-gray-100 bg-gray-50">
                                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Image</th>
                                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Brand</th>
                                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Product</th>
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
                                                src={`/uploads/${snack.images[0].filename}`}
                                                alt="thumb"
                                                className="w-12 h-12 rounded object-cover"
                                            />
                                        ) : (
                                            <div className="w-12 h-12 rounded bg-gray-100" />
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-700">{snack.brand_name}</td>
                                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{snack.product_name}</td>
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
        </div>
    );
}
