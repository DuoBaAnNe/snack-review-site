import type { Snack } from '@/types';
import SnackCard from './SnackCard';
import DateDisplay from './DateDisplay';

export default function SnackGrid({ snacks }: { snacks: Snack[] }) {
    if (snacks.length === 0) {
        return (
            <div className="text-center py-20 text-gray-400">
                <svg className="w-16 h-16 mx-auto mb-4 text-gray-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
                        d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m8.25 3v6.75m0 0l-3-3m3 3l3-3M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                </svg>
                <p className="text-lg">还没有零食评测，敬请期待！</p>
            </div>
        );
    }

    // Group snacks by date (created_at YYYY-MM-DD)
    const groups = new Map<string, Snack[]>();
    for (const snack of snacks) {
        const dateKey = snack.created_at.slice(0, 10);
        if (!groups.has(dateKey)) groups.set(dateKey, []);
        groups.get(dateKey)!.push(snack);
    }

    return (
        <div className="flex flex-col gap-8">
            {Array.from(groups.entries()).map(([dateKey, groupSnacks]) => (
                <div key={dateKey}>
                    <div className="mb-4">
                        <DateDisplay dateStr={dateKey} />
                    </div>
                    <div className="flex flex-col gap-6">
                        {groupSnacks.map((snack) => (
                            <SnackCard key={snack.id} snack={snack} />
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}
