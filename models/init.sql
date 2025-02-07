DROP TABLE IF EXISTS user_claimable_points;
DROP TABLE IF EXISTS claimable_points;
CREATE TABLE claimable_points (
    id SERIAL PRIMARY KEY,
    merkle_root TEXT,
    day TIMESTAMP WITH TIME ZONE NOT NULL UNIQUE,
    decimals INTEGER NOT NULL,
    total_points NUMERIC(78, 18) NOT NULL,
    effective_points NUMERIC(78, 18) NOT NULL
);
CREATE TABLE user_claimable_points (
    id SERIAL PRIMARY KEY,
    claimable_points_id INTEGER NOT NULL REFERENCES claimable_points(id) ON DELETE CASCADE,
    user_address TEXT NOT NULL,
    points NUMERIC(78, 18) NOT NULL,
    merkle_proof TEXT [],
    UNIQUE (claimable_points_id, user_address)
);
CREATE INDEX idx_claimable_points_day ON claimable_points(day);
CREATE INDEX idx_user_claimable_points_user ON user_claimable_points(user_address);
CREATE INDEX idx_user_claimable_points_claimable ON user_claimable_points(claimable_points_id);