import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSnackById, getAllSnacks } from '@/lib/db';
import SnackDetail from './SnackDetail';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
    const { id } = await params;
    const snack = await getSnackById(parseInt(id));
    if (!snack) return { title: '未找到 - 零食奇计划' };
    return {
        title: `${snack.product_name} - 零食奇计划`,
        description: `${snack.brand_name} ${snack.product_name} 的详细评测`,
    };
}

export default async function SnackDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const snack = await getSnackById(parseInt(id));
    if (!snack) notFound();

    const allSnacks = await getAllSnacks();
    const related = allSnacks
        .filter((s) => s.category === snack.category && s.id !== snack.id)
        .slice(0, 3);

    return (
        <div className="max-w-4xl mx-auto px-4 py-6 md:py-10">
            <Link href="/" className="text-sm text-orange-500 hover:text-orange-600 mb-6 inline-block">
                ← 返回首页
            </Link>
            <SnackDetail snack={snack} related={related} />
        </div>
    );
}
