export default function RatingBar({ label, value }: { label: string; value: number }) {
    const pct = (value / 10) * 100;
    const color =
        value <= 3 ? 'bg-red-500'
            : value <= 6 ? 'bg-yellow-500'
                : 'bg-green-500';

    return (
        <div className="flex items-center gap-2 text-sm">
            <span className="w-24 text-gray-600 shrink-0 text-xs">{label}</span>
            <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                    className={`h-full rounded-full transition-all ${color}`}
                    style={{ width: `${pct}%` }}
                />
            </div>
            <span className="w-6 text-right font-semibold text-xs text-gray-700">{value}</span>
        </div>
    );
}
