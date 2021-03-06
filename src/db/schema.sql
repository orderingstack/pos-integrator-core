CREATE TABLE IF NOT EXISTS OSL_ORDER (
    id VARCHAR(34) NOT NULL PRIMARY KEY,
    isCreatedCentrally BOOLEAN DEFAULT 1,    
    created DATE,
    processedLocally BOOLEAN DEFAULT null,
    processedLocallyAt DATE,
    processLocallyNumOfFails NUMBER DEFAULT 0,
    processedCentrally BOOLEAN DEFAULT null,
    processedCentrallyAt DATE,
    processCentrallyNumOfFails NUMBER DEFAULT 0,
    orderbody TEXT,
    extraData TEXT
);
CREATE INDEX IF NOT EXISTS idx_order_date_desc ON OSL_ORDER (created DESC);
CREATE INDEX IF NOT EXISTS idx_order_processedlocally_created_desc ON OSL_ORDER (processedLocally, created DESC);
CREATE INDEX IF NOT EXISTS idx_order_processedcentrally_created_desc ON OSL_ORDER (processedCentrally, created DESC);