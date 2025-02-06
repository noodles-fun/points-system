DROP TABLE IF EXISTS daily_points;
CREATE TABLE daily_points (
    day TIMESTAMPTZ NOT NULL,
    user_address TEXT NOT NULL,
    points FLOAT NOT NULL,
    merkle_root TEXT NOT NULL,
    merkle_proofs JSONB NOT NULL,
    CONSTRAINT unique_day_user UNIQUE (day, user_address)
);
INSERT INTO daily_points (
        day,
        user_address,
        points,
        merkle_root,
        merkle_proofs
    )
VALUES (
        ('2025-02-25' AT TIME ZONE 'UTC')::DATE,
        '0xA1B2C3D4E5F67890123456789ABCDEF123456789',
        42.5,
        '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        '[
        "0xabc123...",
        "0xdef456...",
        "0xghi789..."
    ]'::jsonb
    );