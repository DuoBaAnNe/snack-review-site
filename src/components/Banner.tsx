'use client';

import { useEffect, useState } from 'react';

// 建站日 2026-05-21；百年纪念日 2126-05-21。
const FOUNDED = new Date('2026-05-21T00:00:00+08:00').getTime();
const CENTENNIAL = new Date('2126-05-21T00:00:00+08:00').getTime();

function breakdown(ms: number) {
    const s = Math.max(0, Math.floor(ms / 1000));
    const YEAR = 31556952; // average Gregorian year in seconds
    const years = Math.floor(s / YEAR);
    let rem = s - years * YEAR;
    const days = Math.floor(rem / 86400); rem -= days * 86400;
    const h = Math.floor(rem / 3600); rem -= h * 3600;
    const m = Math.floor(rem / 60);
    const sec = rem - m * 60;
    const pad = (n: number) => String(n).padStart(2, '0');
    return { years, days, time: `${pad(h)}:${pad(m)}:${pad(sec)}` };
}

export default function Banner() {
    const [now, setNow] = useState<number | null>(null);

    useEffect(() => {
        setNow(Date.now());
        const t = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(t);
    }, []);

    // The dial shows time REMAINING to the centennial — it slowly depletes
    // over the century, ticking down live like a countdown clock.
    const remainFrac = now
        ? Math.min(1, Math.max(0, (CENTENNIAL - now) / (CENTENNIAL - FOUNDED)))
        : 1;
    const c = breakdown(now ? CENTENNIAL - now : 0);

    const R = 13;
    const CIRC = 2 * Math.PI * R;

    return (
        <div className="flex items-center gap-2.5 min-w-0">
            {/* Wordmark doubles as the home link — available on every page */}
            <a
                href="/"
                title="返回首页"
                className="text-[22px] md:text-2xl font-black text-gray-900 tracking-tight shrink-0 hover:text-orange-500 transition-colors"
            >
                七零十
            </a>

            {/* Centennial countdown dial */}
            <div className="hidden sm:flex items-center gap-2 shrink-0 pl-2.5 border-l border-gray-200">
                <div className="relative w-[34px] h-[34px] shrink-0">
                    <svg width="34" height="34" viewBox="0 0 34 34" className="-rotate-90">
                        <circle cx="17" cy="17" r={R} fill="none" stroke="#f3e8db" strokeWidth="4" />
                        <circle
                            cx="17" cy="17" r={R} fill="none"
                            stroke="#f97316" strokeWidth="4" strokeLinecap="round"
                            strokeDasharray={CIRC}
                            strokeDashoffset={CIRC * (1 - remainFrac)}
                        />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-[9px] font-black text-orange-500">
                        100
                    </span>
                </div>
                <div className="leading-tight">
                    <div className="text-[10px] text-gray-400">距离百年零食测评网还差</div>
                    <div className="text-xs font-bold text-gray-800 tabular-nums">
                        {now ? `${c.years} 年 ${c.days} 天 ${c.time}` : '——'}
                    </div>
                </div>
            </div>
        </div>
    );
}
