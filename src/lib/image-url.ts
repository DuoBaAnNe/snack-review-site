import type { SnackImage } from '@/types';

export function getImageUrl(img: SnackImage): string {
    return `/api/images/${img.id}`;
}
