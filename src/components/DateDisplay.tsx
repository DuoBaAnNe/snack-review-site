const PALETTE = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
    '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
    '#BB8FCE', '#85C1E9', '#F8C471', '#82E0AA',
    '#F1948A', '#AED6F1', '#D7BDE2', '#A3E4D7',
];

export default function DateDisplay({ dateStr }: { dateStr?: string }) {
    const d = dateStr ? new Date(dateStr + 'T00:00:00') : new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');

    const dateNum = year * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
    const colorIdx = dateNum % PALETTE.length;
    const bg = PALETTE[colorIdx];

    return (
        <div
            className="rounded-2xl px-5 py-3 text-center shadow-md"
            style={{ backgroundColor: bg }}
        >
            <div className="text-xl md:text-2xl font-black tracking-wider text-white drop-shadow-md leading-tight">
                {year}
            </div>
            <div className="text-base md:text-lg font-bold tracking-[0.2em] text-white/90 leading-tight">
                {month}/{day}
            </div>
        </div>
    );
}
