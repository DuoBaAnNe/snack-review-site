import { getAllSnacks, getAllNews } from '@/lib/db';
import HomePageContent from '@/components/HomePageContent';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
    const [snacks, news] = await Promise.all([getAllSnacks(), getAllNews()]);

    return (
        <div className="max-w-7xl mx-auto px-4 pt-0 pb-6">
            <HomePageContent snacks={snacks} news={news} />
        </div>
    );
}
