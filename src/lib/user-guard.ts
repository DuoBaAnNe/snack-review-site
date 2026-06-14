import { getSession } from '@/lib/auth';
import { getUserSession } from '@/lib/user-auth';
import { redirect } from 'next/navigation';

export async function requireAuth() {
    const adminSession = await getSession();
    if (adminSession) return { ...adminSession, isAdmin: true };
    const userSession = await getUserSession();
    if (userSession) return { ...userSession, isAdmin: false };
    redirect('/login');
}
