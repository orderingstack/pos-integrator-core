const Database = require('better-sqlite3');
const fs = require('fs');

const DB_FILENAME_DEFAULT = './data/orders.db';
const DB_SCHEMA_FILENAME = require.resolve('./schema.sql');

function createDatabase(dbFileName = DB_FILENAME_DEFAULT) {
    //console.log(`Working with db file: ${dbFileName}`);
    db = new Database(dbFileName); //, { verbose: console.log });
    const migration = fs.readFileSync(DB_SCHEMA_FILENAME, 'utf8');
    db.exec(migration);
    return db;
}

function isOrderInDb(db, orderId) {
    const row = db.prepare("SELECT count() as count1 FROM OSL_ORDER WHERE id=?").get([orderId]);
    return (row.count1 === 1);
}

function upsertOrder(db, order) {
    const addColumnNames = ['processedLocally', 'processedCentrally, task'];
    let additionalColumns = '';
    let additionalParams = '';
    let vals = [order.id, order.source, order.created, JSON.stringify(order)];
    for (const col of addColumnNames) {
        if (order.hasOwnProperty(col)) {
            additionalColumns += `, ${col}`;
            additionalParams += ', ?';
            vals.push(order[col]);
        }
    }
    const sql = `REPLACE INTO OSL_ORDER (id, source, created, orderbody ${additionalColumns}) VALUES (?, ?, ?, ? ${additionalParams})`;
    const stmt = db.prepare(sql);
    stmt.run(vals);
}

function getOrder(db, orderId) {
    const stmt = db.prepare("SELECT * FROM OSL_ORDER WHERE id=?");
    const result = stmt.get([orderId]);
    return result;
}

function setOrderAsProcessedLocally(db, orderId) {
    const stmt = db.prepare("UPDATE OSL_ORDER SET processedLocally=true, processedLocallyAt=DateTime('now') WHERE id=?");
    stmt.run([orderId]);
}

function setOrderAsProcessedCentrally(db, orderId) {
    const stmt = db.prepare("UPDATE OSL_ORDER SET processedCentrally=true, processedCentrallyAt=DateTime('now') WHERE id=?");
    stmt.run([orderId]);
}

function setOrderProcessedLocally(db, orderId, processed) {
    if (processed) {
        const stmt = db.prepare("UPDATE OSL_ORDER SET processedLocally=true, processedLocallyAt=DateTime('now') WHERE id=?");
        stmt.run([orderId]);
    } else {
        const stmt = db.prepare("UPDATE OSL_ORDER SET processedLocally=false WHERE id=?");
        stmt.run([orderId]);
    }
}


function setOrderProcessedCentrally(db, orderId, processed) {
    if (processed) {
        const stmt = db.prepare("UPDATE OSL_ORDER SET processedCentrally=true, processedCentrallyAt=DateTime('now') WHERE id=?");
        stmt.run([orderId]);
    } else {
        const stmt = db.prepare("UPDATE OSL_ORDER SET processedCentrally=false WHERE id=?");
        stmt.run([orderId]);
    }
}


// TODO: do not removew if order is not processed and closed - attrs: closed, completed, status, processed
function removeOlderThan(db, days) {
    const stmt = db.prepare("SELECT * FROM OSL_ORDER WHERE created < date('now','-'||?||' days')"); //date('now','-4 days')"); 
    const cursor = stmt.iterate([days]);
    for (const row of cursor) {
        //console.log(row);
    }
}

function getOrdersNotYetLocallyProcessed(db) {
    const stmt = db.prepare("SELECT * FROM OSL_ORDER WHERE processedLocally = false ORDER BY created DESC");
    const orders = [];
    const cursor = stmt.iterate();
    for (const row of cursor) {
        orders.push(row);
    }
    return orders;
}

function getOrdersNotYetCentrallyProcessed(db) {
    const stmt = db.prepare("SELECT * FROM OSL_ORDER WHERE processedLocally=true AND processedCentrally = false ORDER BY created DESC");
    const orders = [];
    const cursor = stmt.iterate();
    for (const row of cursor) {
        orders.push(row);
    }
    return orders;
}

function getOrdersNotYetProcessed(db, { locally, centrally }) {
    const stmt = db.prepare(`SELECT * FROM OSL_ORDER WHERE processedLocally=${locally ? true : false} AND processedCentrally = ${centrally ? true : false} ORDER BY created DESC`);
    const orders = [];
    const cursor = stmt.iterate();
    for (const row of cursor) {
        orders.push(row);
    }
    return orders;
}

module.exports = {
    createDatabase,
    isOrderInDb,
    upsertOrder,
    getOrder,
    removeOlderThan,
    getOrdersNotYetLocallyProcessed,
    getOrdersNotYetCentrallyProcessed,
    getOrdersNotYetProcessed,
    setOrderAsProcessedLocally,
    setOrderAsProcessedCentrally,
    setOrderProcessedLocally,
    setOrderProcessedCentrally
}

