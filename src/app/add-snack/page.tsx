import { requireAuth } from '@/lib/user-guard';
import SnackForm from '@/components/SnackForm';

export default async function AddSnackPage() {
    await requireAuth();

    return (
        <div className="max-w-3xl mx-auto px-4 py-6">
            <h1 className="text-xl font-bold text-gray-800 mb-6">添加零食</h1>
            <SnackForm mode="create" redirectTo="/" />
        </div>
    );
}
