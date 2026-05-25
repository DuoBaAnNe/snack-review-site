import SnackForm from '@/components/SnackForm';

export default function NewSnackPage() {
    return (
        <div>
            <h1 className="text-xl font-bold text-gray-800 mb-6">Add New Snack</h1>
            <SnackForm mode="create" />
        </div>
    );
}
