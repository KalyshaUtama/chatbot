-- Chat history table
CREATE TABLE chat_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    user_message TEXT NOT NULL,
    assistant_message TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    user_id TEXT
);

-- Leads table
CREATE TABLE leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT UNIQUE NOT NULL,
    name TEXT,
    phone TEXT,
    email TEXT,
    interested_properties TEXT, -- JSON array
    lead_status TEXT DEFAULT 'new',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Properties cache (optional - for faster queries)
CREATE TABLE properties (
    id TEXT PRIMARY KEY,
    area TEXT,
    bedrooms INTEGER,
    bathrooms INTEGER,
    size REAL,
    price REAL,
    description TEXT,
    metadata TEXT, -- JSON
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_chat_session ON chat_history(session_id);
CREATE INDEX idx_chat_timestamp ON chat_history(timestamp);
CREATE INDEX idx_leads_user_id ON leads(user_id);
CREATE INDEX idx_properties_filters ON properties(area, bedrooms, bathrooms, price);