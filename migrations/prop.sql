DROP TABLE IF EXISTS properties;

CREATE TABLE properties (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    price INTEGER NOT NULL,
    area_sqm INTEGER NOT NULL,
    bedrooms INTEGER NOT NULL,
    bathrooms INTEGER NOT NULL,
    location TEXT NOT NULL,
    agent_id INTEGER NOT NULL,
    available INTEGER NOT NULL,
    description TEXT
);