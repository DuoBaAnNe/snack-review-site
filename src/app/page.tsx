import { getAllSnacks } from '@/lib/db';
import DateDisplay from '@/components/DateDisplay';
import SnackGrid from '@/components/SnackGrid';

export default async function HomePage() {
    const snacks = await getAllSnacks();

    return (
        <div className="max-w-7xl mx-auto px-4 py-6">
            <DateDisplay />
            <SnackGrid snacks={snacks} />
        </div>
    );
}
