import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import AdminNav from '@/components/AdminNav';

const SECRET = new TextEncoder().encode(
    process.env.SESSION_SECRET || 'fallback-dev-secret-change-me'
);

async function checkAuth() {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('snack_admin_session')?.value;
        if (!token) return false;
        await jwtVerify(token, SECRET);
        return true;
    } catch {
        return false;
    }
}

export default async function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const authenticated = await checkAuth();
    if (!authenticated) {
        redirect('/login');
    }

    return (
        <div className="max-w-7xl mx-auto px-4 py-4">
            <AdminNav />
            <div className="mt-6">{children}</div>
        </div>
    );
}
