'use client';

import { useState, useEffect } from 'react';

type Theme = 'light' | 'dark';

export default function ThemeToggle({ className }: { className?: string }) {
    const [theme, setTheme] = useState<Theme | null>(null);

    useEffect(() => {
        const attr = document.documentElement.getAttribute('data-theme');
        if (attr === 'dark' || attr === 'light') {
            setTheme(attr);
        } else {
            setTheme(window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
        }
    }, []);

    function toggle() {
        const next: Theme = theme === 'dark' ? 'light' : 'dark';
        setTheme(next);
        document.documentElement.setAttribute('data-theme', next);
        document.cookie = `llq-theme=${next}; path=/; max-age=31536000; samesite=lax`;
    }

    return (
        <button
            onClick={toggle}
            className={className}
            title={theme === 'dark' ? '切换为浅色模式' : '切换为深色模式'}
            aria-label="切换深浅色模式"
        >
            {theme === null ? '🌗' : theme === 'dark' ? '☀️' : '🌙'}
        </button>
    );
}
