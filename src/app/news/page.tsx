import type { Metadata } from 'next';
import { getAllNews } from '@/lib/db';
import NewsList from '@/components/NewsList';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
    title: '零食新闻 - 零食奇计划',
    description: '零食行业最新资讯',
};

export default async function NewsPage() {
    const news = await getAllNews();

    return (
        <div className="max-w-3xl mx-auto px-4 py-12">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">📰 零食新闻</h1>
            <p className="text-gray-500 text-sm mb-8">零食行业最新资讯与动态</p>
            <NewsList news={news} />
        </div>
    );
}
