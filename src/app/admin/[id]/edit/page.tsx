import { notFound } from 'next/navigation';
import { getSnackById } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-guard';
import SnackForm from '@/components/SnackForm';

export default async function EditSnackPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    await requireAdmin();
    const { id } = await params;
    const snack = await getSnackById(parseInt(id));

    if (!snack) {
        notFound();
    }

    return (
        <div>
            <h1 className="text-xl font-bold text-gray-800 mb-6">
                Edit: {snack.product_name}
            </h1>
            <SnackForm mode="edit" initialData={snack} />
        </div>
    );
}
