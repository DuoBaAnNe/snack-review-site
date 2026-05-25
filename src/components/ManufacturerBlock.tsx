import type { Snack } from '@/types';

export default function ManufacturerBlock({ snack }: { snack: Snack }) {
    return (
        <div className="p-4 space-y-1 text-sm text-gray-700 overflow-auto">
            <h3 className="font-semibold text-gray-800 mb-2 text-sm">Manufacturer Info</h3>
            {snack.manufacturer_name && (
                <p><span className="text-gray-400">Manufacturer:</span> {snack.manufacturer_name}</p>
            )}
            {snack.manufacturer_address && (
                <p><span className="text-gray-400">Address:</span> {snack.manufacturer_address}</p>
            )}
            {snack.manufacturer_contact && (
                <p><span className="text-gray-400">Contact:</span> {snack.manufacturer_contact}</p>
            )}
            {snack.ingredients && (
                <div>
                    <span className="text-gray-400">Ingredients:</span>
                    <p className="mt-1 text-xs leading-relaxed text-gray-500 max-h-32 overflow-y-auto">
                        {snack.ingredients}
                    </p>
                </div>
            )}
            {!snack.manufacturer_name && !snack.ingredients && (
                <p className="text-gray-300 italic text-xs">No manufacturer info available</p>
            )}
        </div>
    );
}
