-- Migration number: 0003 	 2025-09-10T16:26:26.120Z
-- migrations/1660000000000_properties-schema.sql

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
    available BOOLEAN NOT NULL,
    description TEXT
);
