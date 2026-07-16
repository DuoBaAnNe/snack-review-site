'use client';

import { SNACK_CATEGORIES } from './CategoryNav';

const EMOJI: Record<string, string> = {
    '全部': '🍿', '膨化食品': '🍟', '烘焙糕点': '🍩', '糖果巧克力': '🍬',
    '肉类零食': '🍖', '坚果炒货': '🥜', '果脯蜜饯': '🍑', '豆制品类': '🥢',
    '乳制品类': '🧀', '水产海鲜': '🦐', '果冻布丁': '🍮', '冲调即食': '☕', '其他': '🍪',
};

const SECTIONS: [string, string, string][] = [
    ['sec-map', '🗺️', '零食地图'],
    ['sec-news', '📰', '食品资讯'],
    ['sec-ing', '🔬', '成分科普'],
];

interface Props {
    open: boolean;
    onClose: () => void;
    activeCategory: string | null;
    onSelectCategory: (category: string | null) => void;
    onGoSection: (id: string) => void;
    onOpenSearch: () => void;
}

export default function HomeSidebar({
    open, onClose, activeCategory, onSelectCategory, onGoSection, onOpenSearch,
}: Props) {
    const isActive = (c: string) => (c === '全部' ? activeCategory === null : activeCategory === c);

    return (
        // Always mounted; overlay + panel animate via opacity / translate.
        // pointer-events toggle so the closed drawer never blocks clicks.
        <div className={`fixed inset-0 top-14 z-40 ${open ? '' : 'pointer-events-none'}`}>
            {/* Scrim */}
            <div
                onClick={onClose}
                className={`absolute inset-0 bg-black/35 transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0'}`}
            />
            {/* Sliding panel */}
            <aside
                className={`relative w-64 max-w-[82%] bg-white h-full overflow-y-auto shadow-2xl border-r border-gray-100 p-3 will-change-transform transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${open ? 'translate-x-0' : '-translate-x-full'}`}
            >
                <nav className="flex flex-col gap-0.5">
                    <p className="px-3 pt-1 pb-1.5 text-[11px] font-semibold tracking-wider text-gray-400 uppercase">零食分类</p>
                    {SNACK_CATEGORIES.map((c) => (
                        <button
                            key={c}
                            onClick={() => { onSelectCategory(c === '全部' ? null : c); onClose(); }}
                            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-left transition-colors ${
                                isActive(c)
                                    ? 'bg-orange-500 text-white font-semibold shadow-sm'
                                    : 'text-gray-600 hover:bg-amber-50 hover:text-amber-900'
                            }`}
                        >
                            <span className="text-base w-5 text-center">{EMOJI[c]}</span>
                            {c}
                        </button>
                    ))}

                    <div className="h-px bg-gray-200/70 my-2 mx-3" />
                    <p className="px-3 pb-1.5 text-[11px] font-semibold tracking-wider text-gray-400 uppercase">浏览</p>
                    {SECTIONS.map(([id, icon, label]) => (
                        <button
                            key={id}
                            onClick={() => { onGoSection(id); onClose(); }}
                            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-left text-gray-600 hover:bg-amber-50 hover:text-amber-900 transition-colors"
                        >
                            <span className="text-base w-5 text-center">{icon}</span>
                            {label}
                        </button>
                    ))}
                    <button
                        onClick={() => { onOpenSearch(); onClose(); }}
                        className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-left text-gray-600 hover:bg-amber-50 hover:text-amber-900 transition-colors"
                    >
                        <span className="text-base w-5 text-center">🔍</span>
                        搜索
                    </button>
                </nav>
            </aside>
        </div>
    );
}
