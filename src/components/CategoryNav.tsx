'use client';

export const SNACK_CATEGORIES = [
    '全部',
    '膨化食品', '烘焙糕点', '糖果巧克力', '肉类零食',
    '坚果炒货', '果脯蜜饯', '豆制品类', '乳制品类',
    '水产海鲜', '果冻布丁', '冲调即食', '其他',
] as const;

interface Props {
    activeCategory: string | null;
    activeView: 'snacks' | 'news' | 'ingredients';
    onSelectCategory: (category: string | null) => void;
    onSelectNews: () => void;
    onSelectIngredients: () => void;
    onOpenSearch: () => void;
}

export default function CategoryNav({
    activeCategory, activeView,
    onSelectCategory, onSelectNews, onSelectIngredients, onOpenSearch,
}: Props) {
    const allItems = [
        ...SNACK_CATEGORIES.map((cat) => ({ type: 'category' as const, label: cat, value: cat })),
        { type: 'view' as const, label: '零食新闻', view: 'news' as const },
        { type: 'view' as const, label: '成分研究', view: 'ingredients' as const },
        { type: 'action' as const, label: '搜索' },
    ];

    return (
        <div className="flex flex-wrap">
            {allItems.map((item) => {
                let isActive = false;
                if (item.type === 'category') {
                    if (activeView === 'snacks') {
                        isActive = item.value === '全部' ? activeCategory === null : activeCategory === item.value;
                    }
                } else if (item.type === 'view') {
                    isActive = activeView === item.view;
                }

                const baseClass = 'flex-1 min-w-[80px] px-3 py-2.5 text-sm font-medium text-center transition-colors border-r border-white/30 last:border-r-0';

                const activeClass = isActive
                    ? 'bg-white/40 text-amber-900 font-bold shadow-sm'
                    : 'text-amber-900/60 hover:bg-white/20 hover:text-amber-900';

                if (item.type === 'view') {
                    return (
                        <button
                            key={item.label}
                            onClick={() => item.view === 'news' ? onSelectNews() : onSelectIngredients()}
                            className={`${baseClass} ${activeClass}`}
                        >
                            {item.label}
                        </button>
                    );
                }

                if (item.type === 'action') {
                    return (
                        <button
                            key={item.label}
                            onClick={onOpenSearch}
                            className={`${baseClass} ${activeClass}`}
                        >
                            🔍
                        </button>
                    );
                }

                return (
                    <button
                        key={item.label}
                        onClick={() => onSelectCategory(item.value === '全部' ? null : item.value)}
                        className={`${baseClass} ${activeClass}`}
                    >
                        {item.label}
                    </button>
                );
            })}
        </div>
    );
}
