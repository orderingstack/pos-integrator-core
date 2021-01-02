    CREATE TABLE IF NOT EXISTS OSL_TASK (
        id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
        created DATE DEFAULT now,
        processed BOOLEAN DEFAULT FALSE,
        processedAt DATE,
        failedAttempts NUMBER DEFAULT 0,
        lastFailedAttempt DATE,
        taskName VARCHAR(32),
        payload TEXT
    ); 
    CREATE INDEX IF NOT EXISTS task_idx_processed_created_desc ON OSL_TASK (processed, created DESC);
