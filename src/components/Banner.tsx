const SNACKS = ['🍪', '🍫', '🍬', '🍩', '🍿', '🍭', '🧁', '🍘', '🍯', '🥜', '🍟', '🧋', '🍡', '🍮', '🧃'];
const MOBILE_SNACKS = SNACKS.slice(0, 8);

function FallingSnack({ emoji, idx }: { emoji: string; idx: number }) {
    const left = ((idx * 7.3 + 2.1) % 96) + 2;
    const delay = (idx * 0.37) % 3;
    const duration = 3.5 + (idx * 0.43) % 4.5;
    const size = 1.2 + (idx % 3) * 0.4;
    const drift = (idx % 2 === 0 ? 1 : -1) * (20 + (idx * 7) % 40);
    // Spread emojis vertically across the banner so they don't cluster at top
    const top = ((idx * 13.7 + 5.3) % 90);

    return (
        <span
            className="absolute select-none pointer-events-none"
            style={{
                left: `${left}%`,
                top: `${top}%`,
                fontSize: `${size}rem`,
                animation: `fallToButtons ${duration}s ${delay}s linear infinite backwards`,
                '--drift': `${drift}px`,
            } as React.CSSProperties}
        >
            {emoji}
        </span>
    );
}

export default function Banner() {
    return (
        <div className="relative w-full overflow-hidden bg-gradient-to-b from-amber-100 via-orange-50 to-rose-100 py-4 md:py-6" style={{ containerType: 'inline-size' }}>
            {/* Falling emojis */}
            <div className="hidden md:block absolute inset-0">
                {SNACKS.map((emoji, i) => (
                    <FallingSnack key={i} emoji={emoji} idx={i} />
                ))}
            </div>
            <div className="md:hidden absolute inset-0">
                {MOBILE_SNACKS.map((emoji, i) => (
                    <FallingSnack key={i} emoji={emoji} idx={i} />
                ))}
            </div>

            {/* Header: Title (center) */}
            <div className="relative z-10 flex flex-col items-center justify-center text-center px-4">
                <h1
                    className="text-2xl md:text-4xl font-black tracking-widest leading-tight"
                    style={{
                        background: 'linear-gradient(135deg, #f97316 0%, #ec4899 100%)',
                        backgroundClip: 'text',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                    }}
                >
                    欢迎来到七零十
                </h1>
                <p className="mt-1 md:mt-2 text-sm md:text-lg font-bold text-orange-500 tracking-wider drop-shadow-sm">
                    属于所有人的零食测评网站
                </p>
            </div>
        </div>
    );
}
