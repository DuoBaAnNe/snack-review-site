export default function DateDisplay() {
    const formatted = new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });

    return (
        <div className="text-center py-4 text-gray-500 text-sm">
            {formatted}
        </div>
    );
}
