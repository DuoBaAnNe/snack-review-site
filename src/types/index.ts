export interface SnackImage {
    id: number;
    filename: string;
    original_name: string;
    data: string;
    mime_type: string;
    sort_order: number;
}

export interface Snack {
    id: number;
    brand_name: string;
    product_name: string;
    manufacturer_name: string;
    manufacturer_address: string;
    manufacturer_contact: string;
    ingredients: string;
    rating_packaging_quality: number;
    rating_packaging_design: number;
    rating_appearance: number;
    rating_smell: number;
    rating_taste: number;
    rating_satiety: number;
    rating_nutrition: number;
    created_at: string;
    updated_at: string;
    images: SnackImage[];
}

export interface AnalysisResult {
    brand_name: string;
    product_name: string;
    manufacturer_name: string;
    manufacturer_address: string;
    manufacturer_contact: string;
    ingredients: string;
}

export interface CreateSnackInput {
    brand_name: string;
    product_name: string;
    manufacturer_name: string;
    manufacturer_address: string;
    manufacturer_contact: string;
    ingredients: string;
    rating_packaging_quality: number;
    rating_packaging_design: number;
    rating_appearance: number;
    rating_smell: number;
    rating_taste: number;
    rating_satiety: number;
    rating_nutrition: number;
    image_ids: number[];
}
