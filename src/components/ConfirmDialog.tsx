'use client';

interface Props {
    message: string;
    confirmLabel?: string;
    onConfirm: () => void;
    onCancel: () => void;
}

export default function ConfirmDialog({ message, confirmLabel = '删除', onConfirm, onCancel }: Props) {
    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
            onClick={onCancel}
        >
            <div
                className="bg-white rounded-xl p-5 shadow-xl w-full max-w-xs"
                onClick={(e) => e.stopPropagation()}
            >
                <p className="text-sm text-gray-700 leading-relaxed">{message}</p>
                <div className="flex justify-end gap-2 mt-5">
                    <button
                        onClick={onCancel}
                        className="px-4 py-1.5 text-sm rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-100 transition-colors"
                    >
                        取消
                    </button>
                    <button
                        onClick={onConfirm}
                        className="px-4 py-1.5 text-sm rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors"
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}
