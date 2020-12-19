const Database = require('better-sqlite3');
const fs = require('fs');

const DB_FILENAME_DEFAULT = './data/orders.db';
const DB_SCHEMA_FILENAME = './src/db/schema.sql';

let db = null;

function createDatabase(dbFileName = DB_FILENAME_DEFAULT) {
    console.log(`Working with db file: ${dbFileName}`);
    db = new Database(dbFileName); //, { verbose: console.log });
    const migration = fs.readFileSync(DB_SCHEMA_FILENAME, 'utf8');
    db.exec(migration);
}

function isOrderInDb(orderId) {
    const row = db.prepare("SELECT count() as count1 FROM OSL_ORDER WHERE id=?").get([orderId]);
    return (row.count1 === 1);
}

function upsertOrder(order) {
    const stmt = db.prepare("REPLACE INTO OSL_ORDER (id, created, orderbody) VALUES (?, ?, ?)");
    stmt.run([order.id, order.created, JSON.stringify(order)]);
}

function getOrder(orderId) {
    const stmt = db.prepare("SELECT * FROM OSL_ORDER WHERE id=?");
    const result = stmt.get([orderId]);
    return result;
}

function setOrderAsProcessed(orderId) {
    const stmt = db.prepare("UPDATE OSL_ORDER SET processed=true, processedAt=DateTime('now') WHERE id=?");
    stmt.run([orderId]);
}

// TODO: do not removew if order is not processed and closed - attrs: closed, completed, status, processed
function removeOlderThan(days) {
    const stmt = db.prepare("SELECT * FROM OSL_ORDER WHERE created < date('now','-'||?||' days')"); //date('now','-4 days')"); 
    const cursor = stmt.iterate([days]);
    for (const row of cursor) {
        //console.log(row);
    }
}

function getNotProcessedOrders() {
    const stmt = db.prepare("SELECT * FROM OSL_ORDER WHERE processed = false ORDER BY created DESC");
    const orders = [];
    const cursor = stmt.iterate();
    for (const row of cursor) {
        orders.push(row);
    }
    return orders;
}

module.exports = {
    createDatabase, isOrderInDb, upsertOrder, getOrder, removeOlderThan, getNotProcessedOrders, setOrderAsProcessed
}

