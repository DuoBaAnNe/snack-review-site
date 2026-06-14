const SNACKS = ['🍪', '🍫', '🍬', '🍩', '🍿', '🍭', '🧁', '🍘', '🍯', '🥜', '🍟', '🧋', '🍡', '🍮', '🧃'];
const MOBILE_SNACKS = SNACKS.slice(0, 8);

function FallingSnack({ emoji, idx }: { emoji: string; idx: number }) {
    const left = ((idx * 7.3 + 2.1) % 96) + 2;
    const delay = (idx * 0.37) % 3;
    const duration = 3.5 + (idx * 0.43) % 4.5;
    const size = 1.2 + (idx % 3) * 0.4;
    const drift = (idx % 2 === 0 ? 1 : -1) * (20 + (idx * 7) % 40);

    return (
        <span
            className="absolute top-0 select-none pointer-events-none"
            style={{
                left: `${left}%`,
                fontSize: `${size}rem`,
                animation: `fall ${duration}s ${delay}s linear infinite`,
                '--drift': `${drift}px`,
            } as React.CSSProperties}
        >
            {emoji}
        </span>
    );
}

export default function Banner() {
    return (
        <div className="relative w-full overflow-hidden bg-gradient-to-b from-amber-100 via-orange-50 to-rose-100 pt-6 md:pt-12 pb-3">
            {/* Falling emojis */}
            <div className="hidden md:block">
                {SNACKS.map((emoji, i) => (
                    <FallingSnack key={i} emoji={emoji} idx={i} />
                ))}
            </div>
            <div className="md:hidden">
                {MOBILE_SNACKS.map((emoji, i) => (
                    <FallingSnack key={i} emoji={emoji} idx={i} />
                ))}
            </div>

            {/* Header: Title (center) */}
            <div className="relative z-10 text-center px-4">
                    <h1
                        className="text-2xl md:text-5xl font-black tracking-widest leading-tight"
                        style={{
                            background: 'linear-gradient(135deg, #f97316 0%, #ef4444 40%, #ec4899 70%, #f97316 100%)',
                            backgroundClip: 'text',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            filter: 'drop-shadow(2px 3px 4px rgba(251, 146, 60, 0.4))',
                        }}
                    >
                        欢迎来到零食奇计划
                    </h1>
                    <p className="mt-1 md:mt-2 text-sm md:text-xl font-bold text-orange-500 tracking-wider drop-shadow-sm">
                        挑战测评10000款零食
                    </p>
            </div>
        </div>
    );
}
