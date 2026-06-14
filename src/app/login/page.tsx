'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Tab = 'user' | 'admin';

export default function LoginPage() {
    const router = useRouter();

    // Tab state
    const [tab, setTab] = useState<Tab>('user');

    // User auth state
    const [isRegister, setIsRegister] = useState(false);
    const [email, setEmail] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    // Admin auth state
    const [adminUsername, setAdminUsername] = useState('');
    const [adminPassword, setAdminPassword] = useState('');
    const [adminError, setAdminError] = useState('');
    const [adminLoading, setAdminLoading] = useState(false);

    async function handleUserSubmit(e: React.FormEvent) {
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

    async function handleAdminSubmit(e: React.FormEvent) {
        e.preventDefault();
        setAdminError('');
        setAdminLoading(true);

        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: adminUsername, password: adminPassword }),
        });

        const data = await res.json();
        setAdminLoading(false);

        if (data.success) {
            router.push('/admin');
        } else {
            setAdminError(data.error || 'Login failed');
        }
    }

    return (
        <div className="min-h-[60vh] flex items-center justify-center">
            <div className="bg-white rounded-xl shadow-md p-8 w-full max-w-sm">
                {/* Tabs */}
                <div className="flex mb-6 bg-gray-100 rounded-lg p-1">
                    <button
                        onClick={() => setTab('user')}
                        className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${
                            tab === 'user' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'
                        }`}
                    >
                        用户
                    </button>
                    <button
                        onClick={() => setTab('admin')}
                        className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${
                            tab === 'admin' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'
                        }`}
                    >
                        管理员
                    </button>
                </div>

                {/* User Auth Form */}
                {tab === 'user' && (
                    <>
                        <h1 className="text-xl font-bold text-center text-gray-800 mb-6">
                            {isRegister ? '注册' : '登录'}
                        </h1>
                        <form onSubmit={handleUserSubmit} className="space-y-4">
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
                    </>
                )}

                {/* Admin Auth Form */}
                {tab === 'admin' && (
                    <>
                        <h1 className="text-xl font-bold text-center text-gray-800 mb-6">管理员登录</h1>
                        <form onSubmit={handleAdminSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-600 mb-1">Username</label>
                                <input
                                    type="text"
                                    value={adminUsername}
                                    onChange={(e) => setAdminUsername(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-400 focus:border-transparent outline-none"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-600 mb-1">Password</label>
                                <input
                                    type="password"
                                    value={adminPassword}
                                    onChange={(e) => setAdminPassword(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-400 focus:border-transparent outline-none"
                                    required
                                />
                            </div>
                            {adminError && <p className="text-red-500 text-sm">{adminError}</p>}
                            <button
                                type="submit"
                                disabled={adminLoading}
                                className="w-full py-2 bg-gradient-to-r from-amber-400 to-orange-500 text-white font-semibold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
                            >
                                {adminLoading ? 'Logging in...' : 'Login'}
                            </button>
                        </form>
                    </>
                )}
            </div>
        </div>
    );
}
