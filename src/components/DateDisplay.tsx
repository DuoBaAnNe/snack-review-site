export default function DateDisplay({ dateStr }: { dateStr?: string }) {
    const d = dateStr ? new Date(dateStr + 'T00:00:00') : new Date();
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const day = d.getDate();

    return (
        <div className="flex items-center gap-3">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-400 shrink-0" />
            <span className="text-sm font-semibold text-gray-500 tracking-wide shrink-0">
                {year}年{month}月{day}日
            </span>
            <span className="flex-1 h-px bg-gray-200" />
        </div>
    );
}
