export default function Loading() {
    return (
        <div className="max-w-7xl mx-auto px-4 py-12">
            <div className="animate-pulse space-y-4">
                <div className="h-8 bg-gray-200 rounded w-48" />
                <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="h-48 bg-gray-100 rounded-xl" />
                    ))}
                </div>
            </div>
        </div>
    );
}
