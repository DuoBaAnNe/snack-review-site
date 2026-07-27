import type { Metadata } from 'next';
import { getAllSnacks } from '@/lib/db';
import BattleMap from '@/components/BattleMap';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
    title: '零食省份争霸战 - 七零十',
    description: '给你喜欢的省份零食点赞，助它的军队攻城略地。',
};

export default async function BattlePage() {
    const snacks = await getAllSnacks();
    return (
        <div className="max-w-6xl mx-auto px-4 py-6 md:py-10">
            <div className="mb-5">
                <h1 className="text-2xl md:text-3xl font-bold text-gray-900">🗺️ 零食省份争霸战</h1>
                <p className="text-sm text-gray-500 mt-1">
                    每个省份是一支军队，实力来自它的零食获得的点赞。给你支持的省份点赞助攻，
                    看它在地图上攻城略地、染色扩张。每周一季，占满全国或赛季结束即分胜负。
                </p>
            </div>
            <BattleMap snacks={snacks} />
        </div>
    );
}
