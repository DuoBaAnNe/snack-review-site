import RatingBar from './RatingBar';
import type { Snack } from '@/types';

const RATINGS: { key: keyof Snack; label: string; icon: string }[] = [
    { key: 'rating_taste_health', label: '口感与味道', icon: '👅' },
    { key: 'rating_ingredients_health', label: '配料与健康', icon: '🌿' },
    { key: 'rating_packaging_portability', label: '包装与便携', icon: '📦' },
    { key: 'rating_use_case', label: '适用场景', icon: '🎯' },
    { key: 'rating_value', label: '性价比', icon: '💰' },
];

export default function RatingBlock({ snack }: { snack: Snack }) {
    return (
        <div className="p-4 space-y-2">
            <h3 className="font-semibold text-gray-800 mb-3 text-sm">Ratings</h3>
            {RATINGS.map(({ key, label, icon }) => (
                <RatingBar key={key} label={label} icon={icon} value={snack[key] as number} />
            ))}
        </div>
    );
}
