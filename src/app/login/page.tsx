'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function LoginForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const isRegisterParam = searchParams.get('register') === 'true';

    const [isRegister, setIsRegister] = useState(isRegisterParam);
    const [email, setEmail] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError('');
        setLoading(true);

        const endpoint = isRegister ? '/api/auth/user/register' : '/api/auth/user/login';
        const body = isRegister
            ? { email, username, password }
            : { email, password };

        const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        const data = await res.json();
        setLoading(false);

        if (res.ok) {
            router.push('/');
            router.refresh();
        } else {
            setError(data.error || '操作失败');
        }
    }

    return (
        <div className="min-h-[60vh] flex items-center justify-center">
            <div className="bg-white rounded-xl shadow-md p-8 w-full max-w-sm">
                <h1 className="text-xl font-bold text-center text-gray-800 mb-6">
                    {isRegister ? '注册' : '登录'}
                </h1>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">邮箱</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-400 focus:border-transparent outline-none"
                            required
                        />
                    </div>
                    {isRegister && (
                        <div>
                            <label className="block text-sm font-medium text-gray-600 mb-1">用户名</label>
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-400 focus:border-transparent outline-none"
                                required
                            />
                        </div>
                    )}
                    <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">密码</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-400 focus:border-transparent outline-none"
                            required
                        />
                    </div>
                    {error && <p className="text-red-500 text-sm">{error}</p>}
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-2 bg-gradient-to-r from-amber-400 to-orange-500 text-white font-semibold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                        {loading ? '请稍候...' : isRegister ? '注册' : '登录'}
                    </button>
                    <p className="text-center text-sm text-gray-400">
                        {isRegister ? '已有账号？' : '没有账号？'}
                        <button
                            type="button"
                            onClick={() => { setIsRegister(!isRegister); setError(''); }}
                            className="text-orange-500 hover:text-orange-600 ml-1"
                        >
                            {isRegister ? '去登录' : '去注册'}
                        </button>
                    </p>
                </form>
            </div>
        </div>
    );
}

export default function LoginPage() {
    return (
        <Suspense fallback={<div className="min-h-[60vh] flex items-center justify-center"><p className="text-gray-400">加载中...</p></div>}>
            <LoginForm />
        </Suspense>
    );
}
