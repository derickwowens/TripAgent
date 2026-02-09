-- TripAgent PostgreSQL Schema
-- Railway Postgres with cube + earthdistance for spatial queries
-- Run this migration first to set up the database structure.

-- Enable extensions for spatial distance queries and fuzzy text search
CREATE EXTENSION IF NOT EXISTS cube;
CREATE EXTENSION IF NOT EXISTS earthdistance;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================
-- PARKS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS parks (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  park_code TEXT,
  state_code TEXT NOT NULL,
  state_name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('national', 'state', 'local')),
  park_type TEXT,
  designation TEXT,
  description TEXT,
  short_description TEXT,
  highlights TEXT[],
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  acres DOUBLE PRECISION,
  timezone TEXT,
  image_url TEXT,
  official_website TEXT,
  reservations_url TEXT,
  map_url TEXT,
  directions_url TEXT,
  phone TEXT,
  email TEXT,
  address_line1 TEXT,
  address_city TEXT,
  address_state TEXT,
  address_postal_code TEXT,
  weather_description TEXT,
  keywords TEXT[],
  data_source TEXT,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_parks_state_code ON parks(state_code);
CREATE INDEX IF NOT EXISTS idx_parks_category ON parks(category);
CREATE INDEX IF NOT EXISTS idx_parks_park_code ON parks(park_code);
CREATE INDEX IF NOT EXISTS idx_parks_lat_lng ON parks(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_parks_name_trgm ON parks USING GIN(name gin_trgm_ops);

-- ============================================
-- PARK FEES
-- ============================================
CREATE TABLE IF NOT EXISTS park_fees (
  id SERIAL PRIMARY KEY,
  park_id TEXT NOT NULL REFERENCES parks(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  cost TEXT NOT NULL,
  description TEXT
);

CREATE INDEX IF NOT EXISTS idx_park_fees_park_id ON park_fees(park_id);

-- ============================================
-- PARK IMAGES
-- ============================================
CREATE TABLE IF NOT EXISTS park_images (
  id TEXT PRIMARY KEY,
  park_id TEXT NOT NULL REFERENCES parks(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  title TEXT,
  caption TEXT,
  credit TEXT,
  is_primary BOOLEAN DEFAULT FALSE,
  sort_order INT DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_park_images_park_id ON park_images(park_id);

-- ============================================
-- PARK ACTIVITIES
-- ============================================
CREATE TABLE IF NOT EXISTS park_activities (
  id SERIAL PRIMARY KEY,
  park_id TEXT NOT NULL REFERENCES parks(id) ON DELETE CASCADE,
  activity_id TEXT NOT NULL,
  name TEXT NOT NULL,
  UNIQUE(park_id, activity_id)
);

CREATE INDEX IF NOT EXISTS idx_park_activities_park_id ON park_activities(park_id);

-- ============================================
-- TRAILS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS trails (
  id TEXT PRIMARY KEY,
  park_id TEXT NOT NULL,
  park_name TEXT NOT NULL,
  state_code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  length_miles DOUBLE PRECISION,
  difficulty TEXT,
  trail_type TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  geometry_json JSONB,
  official_url TEXT,
  alltrails_url TEXT,
  google_maps_url TEXT,
  data_source TEXT,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trails_park_id ON trails(park_id);
CREATE INDEX IF NOT EXISTS idx_trails_state_code ON trails(state_code);
CREATE INDEX IF NOT EXISTS idx_trails_difficulty ON trails(difficulty);
CREATE INDEX IF NOT EXISTS idx_trails_lat_lng ON trails(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_trails_name_trgm ON trails USING GIN(name gin_trgm_ops);

-- ============================================
-- CAMPGROUNDS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS campgrounds (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  state_code TEXT NOT NULL,
  park_name TEXT,
  description TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  total_sites INT,
  reservation_url TEXT,
  google_maps_url TEXT,
  data_source TEXT,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campgrounds_state_code ON campgrounds(state_code);
CREATE INDEX IF NOT EXISTS idx_campgrounds_lat_lng ON campgrounds(latitude, longitude);

-- ============================================
-- SPATIAL QUERY HELPERS
-- ============================================
-- Use earth_distance(ll_to_earth(lat1,lng1), ll_to_earth(lat2,lng2)) for distance in meters
-- Use (latitude BETWEEN min_lat AND max_lat) AND (longitude BETWEEN min_lng AND max_lng) for bounding box
