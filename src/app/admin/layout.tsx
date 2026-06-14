import AdminNav from '@/components/AdminNav';

export default async function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="max-w-7xl mx-auto px-4 py-4">
            <AdminNav />
            <div className="mt-6">{children}</div>
        </div>
    );
}
