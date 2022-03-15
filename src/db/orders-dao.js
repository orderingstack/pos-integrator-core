const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const DB_FILENAME_DEFAULT = './data/orders.db';
const DB_SCHEMA_FILENAME = path.join(__dirname, './schema.sql'); //require.resolve('./schema.sql');

function createDatabase(dbFileName = DB_FILENAME_DEFAULT) {
    //console.log(`Working with db file: ${dbFileName}`);  
    //TODO: for file db we shoud ensure that dir exists (good example with fs-extra): 
    //TODO: const fs = require('fs-extra'); const dir = '/tmp/this/path/does/not/exist'; fs.ensureDirSync(dir);
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
    const addColumnNames = ['extraData', 'orderStatus', 'stage'];
    let additionalColumns = '';
    let additionalParams = '';
    let vals = [order.id, order.isCreatedCentrally, order.created, order.orderbody];
    for (const col of addColumnNames) {
        if (order.hasOwnProperty(col)) {
            additionalColumns += `, ${col}`;
            additionalParams += ', ?';
            vals.push(order[col]);
        }
    }
    const sql = `REPLACE INTO OSL_ORDER (id, isCreatedCentrally, created, orderbody ${additionalColumns}) VALUES (?, ?, ?, ? ${additionalParams})`;
    //console.log(`${sql}  - VALS: ${vals}`);
    const stmt = db.prepare(sql);
    stmt.run(vals);
}

function updateOrderBody(db, order) {
    const sql = `UPDATE OSL_ORDER SET orderbody=?, orderStatus=? WHERE id=?`;
    const stmt = db.prepare(sql);
    stmt.run([order.orderbody, order.orderStatus, order.id]);    
}

function getOrder(db, orderId) {
    const stmt = db.prepare("SELECT * FROM OSL_ORDER WHERE id=?");
    const result = stmt.get([orderId]);
    return result;
}

function setOrderStage(db, orderId, stage) {
    const stmt = db.prepare("UPDATE OSL_ORDER SET stage=?, stageUpdatedAt=DateTime('now'), nextStageRunAt=DateTime('now', '+3 seconds') WHERE id=?");
    stmt.run([stage, orderId]);
}

// TODO: do not removew if order is not processed and closed - attrs: closed, completed, status, processed
function removeOlderThan(db, days) {
    const stmt = db.prepare("DELETE FROM OSL_ORDER WHERE created < date('now','-'||?||' days')"); //date('now','-4 days')"); 
    stmt.run([days]);
}

function removeClosedOrdersOrAbandoned(db) {
    const stmt = db.prepare("DELETE FROM OSL_ORDER WHERE orderStatus='CLOSED' OR orderStatus='ABANDONED'"); 
    stmt.run();
}



 function getOrdersNotDone(db) {
     const stmt = db.prepare("SELECT * FROM OSL_ORDER WHERE stage<>'DONE' AND orderStatus<>'CLOSED' AND orderStatus<>'ABANDONED' AND nextStageRunAt<CURRENT_TIMESTAMP ORDER BY created DESC");
     const orders = [];
     const cursor = stmt.iterate();
     for (const row of cursor) {
         orders.push(row);
     }
     return orders;
 }

function getOrdersInStage(db, stage) {
    const stmt = db.prepare("SELECT * FROM OSL_ORDER WHERE stage=? AND orderStatus<>'CLOSED' AND orderStatus<>'ABANDONED' ORDER BY created DESC");
    const orders = [];
    const cursor = stmt.iterate(stage);
    for (const row of cursor) {
        orders.push(row);
    }
    return orders;
}

// //TODO: AND NOT orderStatus in ('CLOSED', 'ABANDONED')
// function getOrdersNotYetProcessed(db, { locally, centrally }) {
//     const stmt = db.prepare(`SELECT * FROM OSL_ORDER WHERE processedLocally=${locally ? 1 : 0} AND processedCentrally = ${centrally ? 1: 0} AND orderStatus<>'CLOSED' AND orderStatus<>'ABANDONED' ORDER BY created DESC`);
//     const orders = [];
//     const cursor = stmt.iterate();
//     for (const row of cursor) {
//         orders.push(row);
//     }
//     return orders;
// }

function getStats(db) {
    const stmt = db.prepare("SELECT count(1) as cnt from OSL_ORDER");
    const r1 = stmt.get([]);
    const stmt2 = db.prepare("SELECT stage, count(1) as cnt from OSL_ORDER GROUP BY stage");
    const r2 = stmt2.get([]);
    const stmt3 = db.prepare("SELECT min(created) as minCreated from OSL_ORDER");
    const r3 = stmt3.get([]);

    return {
        totalOrders: r1.cnt,
        groupByStages: r2,
        oldestOrderCreatedAt: r3.minCreated,
    };
}

module.exports = {
    createDatabase,
    isOrderInDb,
    upsertOrder,
    updateOrderBody,
    getOrder,
    getOrdersNotDone,
    removeOlderThan,
    removeClosedOrdersOrAbandoned,
    setOrderStage,
    getOrdersInStage,
    getStats,
}
