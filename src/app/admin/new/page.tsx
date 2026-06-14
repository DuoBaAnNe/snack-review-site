import { requireAdmin } from '@/lib/admin-guard';
import SnackForm from '@/components/SnackForm';

export default async function NewSnackPage() {
    await requireAdmin();
    return (
        <div>
            <h1 className="text-xl font-bold text-gray-800 mb-6">Add New Snack</h1>
            <SnackForm mode="create" />
        </div>
    );
}
