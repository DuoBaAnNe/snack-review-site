import RatingBar from './RatingBar';
import type { Snack } from '@/types';

const RATINGS: { key: keyof Snack; label: string }[] = [
    { key: 'rating_packaging_quality', label: '包装质量 Packaging' },
    { key: 'rating_packaging_design', label: '包装设计 Design' },
    { key: 'rating_appearance', label: '零食外观 Appearance' },
    { key: 'rating_smell', label: '零食气味 Smell' },
    { key: 'rating_taste', label: '口味 Taste' },
    { key: 'rating_satiety', label: '饱腹度 Satiety' },
    { key: 'rating_nutrition', label: '营养水平 Nutrition' },
];

export default function RatingBlock({ snack }: { snack: Snack }) {
    return (
        <div className="p-4 space-y-2">
            <h3 className="font-semibold text-gray-800 mb-3 text-sm">Ratings</h3>
            {RATINGS.map(({ key, label }) => (
                <RatingBar key={key} label={label} value={snack[key] as number} />
            ))}
        </div>
    );
}
