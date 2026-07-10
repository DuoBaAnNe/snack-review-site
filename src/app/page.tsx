import { Suspense } from 'react';
import { getAllSnacks, getAllNews } from '@/lib/db';
import HomePageContent from '@/components/HomePageContent';

export const dynamic = 'force-dynamic';

async function SnackData() {
    const [snacks, news] = await Promise.all([getAllSnacks(), getAllNews()]);
    return <HomePageContent snacks={snacks} news={news} />;
}

export default function HomePage() {
    return (
        <div className="max-w-7xl mx-auto px-4 pt-0 pb-6">
            <Suspense fallback={
                <div className="animate-pulse space-y-4 mt-4">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="h-48 bg-gray-100 rounded-xl" />
                    ))}
                </div>
            }>
                <SnackData />
            </Suspense>
        </div>
    );
}
