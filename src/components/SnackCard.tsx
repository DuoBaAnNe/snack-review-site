import type { Snack } from '@/types';
import ImageCarousel from './ImageCarousel';
import RatingBlock from './RatingBlock';
import ManufacturerBlock from './ManufacturerBlock';

export default function SnackCard({ snack }: { snack: Snack }) {
    return (
        <div className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-100 hover:shadow-lg transition-shadow">
            <div className="grid grid-cols-2 grid-rows-[auto_1fr]">
                {/* Block 1: Image */}
                <div className="border-r border-b border-gray-100">
                    <ImageCarousel images={snack.images} />
                </div>
                {/* Block 2: Brand & Product */}
                <div className="border-b border-gray-100 p-4 flex flex-col justify-center">
                    <h2 className="text-lg font-bold text-gray-900 leading-tight">
                        {snack.product_name}
                    </h2>
                    <p className="text-sm text-orange-600 font-medium mt-1">
                        {snack.brand_name}
                    </p>
                </div>
                {/* Block 3: Manufacturer */}
                <div className="border-r border-gray-100">
                    <ManufacturerBlock snack={snack} />
                </div>
                {/* Block 4: Ratings */}
                <div>
                    <RatingBlock snack={snack} />
                </div>
            </div>
        </div>
    );
}
