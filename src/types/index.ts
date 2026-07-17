export interface SnackImage {
    id: number;
    filename: string;
    original_name: string;
    data: string;
    mime_type: string;
    sort_order: number;
    has_cutout?: boolean;
}

export interface Snack {
    id: number;
    brand_name: string;
    product_name: string;
    manufacturer_name: string;
    manufacturer_address: string;
    brand_company: string;
    ingredients: string;
    category: string;
    review_text: string;
    rating_taste_health: number;
    rating_ingredients_health: number;
    rating_packaging_portability: number;
    rating_use_case: number;
    rating_value: number;
    created_by: string;
    created_at: string;
    updated_at: string;
    images: SnackImage[];
    review_count?: number;
}

export interface AnalysisResult {
    brand_name: string;
    product_name: string;
    manufacturer_name: string;
    manufacturer_address: string;
    brand_company: string;
    ingredients: string;
}

export interface CreateSnackInput {
    brand_name: string;
    product_name: string;
    manufacturer_name: string;
    manufacturer_address: string;
    brand_company: string;
    ingredients: string;
    category: string;
    review_text: string;
    rating_taste_health: number;
    rating_ingredients_health: number;
    rating_packaging_portability: number;
    rating_use_case: number;
    rating_value: number;
    created_by?: string;
    image_ids: number[];
}

export interface User {
    id: number;
    email: string;
    username: string;
    created_at: string;
}

export interface Review {
    id: number;
    user_id: number;
    snack_id: number;
    rating_taste_health: number;
    rating_ingredients_health: number;
    rating_packaging_portability: number;
    rating_use_case: number;
    rating_value: number;
    review_text: string;
    created_at: string;
    username?: string;
}

export interface NewsItem {
    id: number;
    title: string;
    content: string;
    source_url: string;
    created_at: string;
}
