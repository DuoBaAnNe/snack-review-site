CREATE TABLE IF NOT EXISTS admin_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS snacks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    brand_name TEXT NOT NULL DEFAULT '',
    product_name TEXT NOT NULL DEFAULT 'Untitled Snack',
    manufacturer_name TEXT DEFAULT '',
    manufacturer_address TEXT DEFAULT '',
    manufacturer_contact TEXT DEFAULT '',
    ingredients TEXT DEFAULT '',

    rating_packaging_quality INTEGER DEFAULT 5
        CHECK(rating_packaging_quality >= 1 AND rating_packaging_quality <= 10),
    rating_packaging_design  INTEGER DEFAULT 5
        CHECK(rating_packaging_design >= 1 AND rating_packaging_design <= 10),
    rating_appearance        INTEGER DEFAULT 5
        CHECK(rating_appearance >= 1 AND rating_appearance <= 10),
    rating_smell             INTEGER DEFAULT 5
        CHECK(rating_smell >= 1 AND rating_smell <= 10),
    rating_taste             INTEGER DEFAULT 5
        CHECK(rating_taste >= 1 AND rating_taste <= 10),
    rating_satiety           INTEGER DEFAULT 5
        CHECK(rating_satiety >= 1 AND rating_satiety <= 10),
    rating_nutrition         INTEGER DEFAULT 5
        CHECK(rating_nutrition >= 1 AND rating_nutrition <= 10),

    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS snack_images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    snack_id INTEGER REFERENCES snacks(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    original_name TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
);
