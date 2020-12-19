    CREATE TABLE IF NOT EXISTS OSL_ORDER (
        id VARCHAR(34) PRIMARY KEY,
        created DATE,
        status TEXT,
        completed BOOLEAN,
        closed BOOLEAN,
        processed BOOLEAN DEFAULT FALSE,
        processedAt DATE,
        orderbody TEXT
    ); 
    CREATE INDEX IF NOT EXISTS order_date_idx_desc ON OSL_ORDER (created DESC);
