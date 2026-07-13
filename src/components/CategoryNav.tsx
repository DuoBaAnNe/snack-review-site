'use client';

export const SNACK_CATEGORIES = [
    '全部',
    '膨化食品', '烘焙糕点', '糖果巧克力', '肉类零食',
    '坚果炒货', '果脯蜜饯', '豆制品类', '乳制品类',
    '水产海鲜', '果冻布丁', '冲调即食', '其他',
] as const;

const CATEGORY_EMOJIS: Record<string, string> = {
    '全部': '🍿',
    '膨化食品': '🍿',
    '烘焙糕点': '🍩',
    '糖果巧克力': '🍬',
    '肉类零食': '🍖',
    '坚果炒货': '🥜',
    '果脯蜜饯': '🍑',
    '豆制品类': '🥢',
    '乳制品类': '🧀',
    '水产海鲜': '🦐',
    '果冻布丁': '🍮',
    '冲调即食': '☕',
    '其他': '🍪',
};

interface Props {
    activeCategory: string | null;
    activeView: 'snacks' | 'news' | 'ingredients' | 'map';
    onSelectCategory: (category: string | null) => void;
    onSelectNews: () => void;
    onSelectIngredients: () => void;
    onSelectMap: () => void;
    onOpenSearch: () => void;
}

export default function CategoryNav({
    activeCategory, activeView,
    onSelectCategory, onSelectNews, onSelectIngredients, onSelectMap, onOpenSearch,
}: Props) {
    return (
        <div className="flex flex-wrap">
            {SNACK_CATEGORIES.map((cat) => {
                const isActive = activeView === 'snacks'
                    ? (cat === '全部' ? activeCategory === null : activeCategory === cat)
                    : false;

                const baseClass = 'flex-1 min-w-[80px] px-3 py-2.5 text-sm font-medium text-center transition-all border-r border-white/30 last:border-r-0';
                const activeClass = isActive
                    ? 'bg-white/50 text-amber-900 font-bold shadow-sm'
                    : 'text-amber-900/60 hover:bg-white/20 hover:text-amber-900';

                return (
                    <button
                        key={cat}
                        onClick={() => onSelectCategory(cat === '全部' ? null : cat)}
                        className={`${baseClass} ${activeClass} group relative`}
                        style={isActive ? { animation: 'catchPulse 0.4s ease-out' } : undefined}
                    >
                        <span className="relative z-10">
                            <span className="text-xs mr-1 opacity-60 group-hover:opacity-100 transition-opacity">
                                {CATEGORY_EMOJIS[cat]}
                            </span>
                            {(() => {
                                if (cat.length <= 2) return cat;
                                return <span className="inline-block text-left">{cat.slice(0, 2)}<br/>{cat.slice(2)}</span>;
                            })()}
                        </span>
                    </button>
                );
            })}

            {/* Separator before 零食地图/零食新闻/成分研究 */}
            <span className="w-px bg-amber-300/40 mx-1 self-stretch" />

            {([
                ['零食地图', 'map'],
                ['食品资讯', 'news'],
                ['成分科普', 'ingredients'],
            ] as const).map(([label, view]) => {
                const isActive = activeView === view;
                const baseClass = 'flex-1 min-w-[80px] px-3 py-2.5 text-sm font-medium text-center transition-colors border-r border-white/30 last:border-r-0';
                const activeClass = isActive
                    ? 'bg-white/50 text-amber-900 font-bold shadow-sm'
                    : 'text-amber-900/60 hover:bg-white/20 hover:text-amber-900';

                return (
                    <button
                        key={label}
                        onClick={() => {
                            if (view === 'map') onSelectMap();
                            else if (view === 'news') onSelectNews();
                            else onSelectIngredients();
                        }}
                        className={`${baseClass} ${activeClass}`}
                    >
                        {(() => {
                            if (label.length <= 2) return label;
                            return <span className="inline-block text-left">{label.slice(0, 2)}<br/>{label.slice(2)}</span>;
                        })()}
                    </button>
                );
            })}


            <button
                onClick={onOpenSearch}
                className="flex-1 min-w-[80px] px-3 py-2.5 text-sm font-medium text-center transition-colors text-amber-900/60 hover:bg-white/20 hover:text-amber-900"
            >
                🔍
            </button>
        </div>
    );
}
