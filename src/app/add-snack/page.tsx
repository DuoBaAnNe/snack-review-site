import { requireAuth } from '@/lib/user-guard';
import SnackForm from '@/components/SnackForm';

export default async function AddSnackPage() {
    await requireAuth();

    return (
        <div className="max-w-3xl mx-auto px-4 py-8">
            <div className="flex items-baseline gap-2 mb-6">
                <span className="text-2xl">➕</span>
                <h1 className="text-2xl font-black text-gray-900">添加零食</h1>
            </div>
            <SnackForm mode="create" redirectTo="/" />
        </div>
    );
}
