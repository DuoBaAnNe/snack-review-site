import type { Metadata } from 'next';
import Link from 'next/link';
import { getAllSnacks } from '@/lib/db';
import { getImageUrl } from '@/lib/image-url';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
    title: '搜索 - 零食奇计划',
    description: '搜索零食评测',
};

export default async function SearchPage({
    searchParams,
}: {
    searchParams: Promise<{ q?: string }>;
}) {
    const { q } = await searchParams;
    const query = q?.trim() || '';

    let results: Awaited<ReturnType<typeof getAllSnacks>> = [];
    if (query) {
        const all = await getAllSnacks();
        const qLower = query.toLowerCase();
        results = all.filter(
            (s) =>
                s.product_name.toLowerCase().includes(qLower) ||
                s.brand_name.toLowerCase().includes(qLower) ||
                s.ingredients.toLowerCase().includes(qLower)
        );
    }

    return (
        <div className="max-w-2xl mx-auto px-4 py-12">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">🔍 搜索零食</h1>
            <p className="text-gray-500 text-sm mb-8">按品牌、产品名称或配料搜索零食评测</p>

            <div className="bg-white rounded-xl border border-gray-100 p-6 md:p-8 mb-8">
                <form action="/search" method="GET" className="flex flex-col sm:flex-row gap-3">
                    <input
                        type="text"
                        name="q"
                        defaultValue={query}
                        placeholder="输入品牌、产品或配料关键词..."
                        className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-400 focus:border-transparent outline-none"
                    />
                    <button
                        type="submit"
                        className="px-6 py-2.5 bg-gradient-to-r from-amber-400 to-orange-500 text-white font-semibold rounded-lg hover:opacity-90 transition-opacity"
                    >
                        搜索
                    </button>
                </form>
            </div>

            {/* Results */}
            {query ? (
                <div>
                    <p className="text-sm text-gray-500 mb-4">
                        搜索「{query}」：找到 {results.length} 个结果
                    </p>
                    {results.length === 0 ? (
                        <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
                            <p className="text-gray-400">没有找到匹配的零食</p>
                            <p className="text-xs text-gray-300 mt-1">试试其他关键词</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {results.map((snack) => (
                                <Link
                                    key={snack.id}
                                    href={`/snacks/${snack.id}`}
                                    className="flex items-center gap-4 p-4 bg-white rounded-xl border border-gray-100 hover:border-amber-200 hover:shadow-sm transition-all"
                                >
                                    {snack.images[0] ? (
                                        <img
                                            src={getImageUrl(snack.images[0])}
                                            alt={snack.product_name}
                                            className="w-16 h-16 rounded-lg object-cover shrink-0"
                                        />
                                    ) : (
                                        <div className="w-16 h-16 rounded-lg bg-gray-100 shrink-0" />
                                    )}
                                    <div className="min-w-0 flex-1">
                                        <h3 className="text-sm font-semibold text-gray-900 truncate">
                                            {snack.product_name}
                                        </h3>
                                        <p className="text-xs text-orange-500 mt-0.5">{snack.brand_name}</p>
                                        <p className="text-xs text-gray-400 mt-1 truncate">
                                            {snack.ingredients.slice(0, 80)}
                                        </p>
                                    </div>
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 shrink-0">
                                        {snack.category}
                                    </span>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
            ) : (
                <div className="text-center">
                    <p className="text-sm text-gray-400">输入关键词开始搜索</p>
                    <p className="text-xs text-gray-300 mt-2">
                        也可以点击首页导航栏中的「搜索」按钮快速搜索
                    </p>
                </div>
            )}

            <div className="mt-8 text-center">
                <Link href="/" className="text-sm text-orange-500 hover:text-orange-600">
                    ← 返回首页
                </Link>
            </div>
        </div>
    );
}
