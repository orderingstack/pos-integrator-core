import BetterSqlLite, { Database } from 'better-sqlite3';
import { IOrderRecord } from '../types';
import fs from 'fs';

import path from 'path';

const DB_FILENAME_DEFAULT = './data/orders.db';
const DB_SCHEMA_FILENAME = path.join(__dirname, './schema.sql'); //require.resolve('./schema.sql');

function createDatabase(dbFileName = DB_FILENAME_DEFAULT): Database {
  //console.log(`Working with db file: ${dbFileName}`);
  const dir = path.dirname(dbFileName);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const db = new BetterSqlLite(dbFileName); //, { verbose: console.log });
  const migration = fs.readFileSync(DB_SCHEMA_FILENAME, 'utf8');
  db.exec(migration);
  return db;
}

function isOrderInDb(db: Database, orderId: string) {
  const row = db
    .prepare('SELECT count() as count1 FROM OSL_ORDER WHERE id=?')
    .get([orderId]) as any;
  return row.count1 === 1;
}

function isOrderWithCheckSeqInDb(db: Database, checkSeq: string | undefined) {
  if (!checkSeq) return false;
  const row = db
    .prepare('SELECT count() as count1 FROM OSL_ORDER WHERE checkSeq=?')
    .get([checkSeq]) as any;
  return row.count1 === 1;
}

function upsertOrder(db: Database, order: IOrderRecord) {
  const addColumnNames = ['extraData', 'orderStatus', 'stage', 'checkSeq'];
  let additionalColumns = '';
  let additionalParams = '';
  let vals: any[] = [
    order.id,
    order.isCreatedCentrally,
    order.created,
    order.orderbody,
  ];
  for (const col of addColumnNames) {
    if (order.hasOwnProperty(col)) {
      additionalColumns += `, ${col}`;
      additionalParams += ', ?';
      vals.push(order[col as keyof IOrderRecord]);
    }
  }
  const sql = `REPLACE INTO OSL_ORDER (id, isCreatedCentrally, created, orderbody ${additionalColumns}) VALUES (?, ?, ?, ? ${additionalParams})`;
  //console.log(`${sql}  - VALS: ${vals}`);
  const stmt = db.prepare(sql);
  stmt.run(vals);
}

function updateOrderBody(db: Database, order: IOrderRecord) {
  const sql = `UPDATE OSL_ORDER SET orderbody=?, orderStatus=? WHERE id=?`;
  const stmt = db.prepare(sql);
  stmt.run([order.orderbody, order.orderStatus, order.id]);
}

/**
 * updates orderRecord extraData
 * @param db
 * @param {string} orderId
 * @param {string} extraData
 */
function updateOrderExtraData(
  db: Database,
  orderId: string,
  extraData: string,
) {
  const sql = `UPDATE OSL_ORDER SET extraData=? WHERE id=?`;
  const stmt = db.prepare(sql);
  stmt.run([extraData, orderId]);
}

function getOrder(db: Database, orderId: string) {
  const stmt = db.prepare('SELECT * FROM OSL_ORDER WHERE id=?');
  const result = stmt.get([orderId]);
  return result as IOrderRecord | undefined;
}

function setOrderStage(db: Database, orderId: string, stage: string) {
  const stmt = db.prepare(
    "UPDATE OSL_ORDER SET stage=?, stageUpdatedAt=DateTime('now'), nextStageRunAt=DateTime('now', '+3 seconds') WHERE id=?",
  );
  stmt.run([stage, orderId]);
}

// TODO: do not removew if order is not processed and closed - attrs: closed, completed, status, processed
function removeOlderThan(db: Database, days: number) {
  const stmt = db.prepare(
    "DELETE FROM OSL_ORDER WHERE created < date('now','-'||?||' days')",
  ); //date('now','-4 days')");
  stmt.run([days]);
}

function removeClosedOrdersOrAbandoned(db: Database) {
  const stmt = db.prepare(
    "DELETE FROM OSL_ORDER WHERE orderStatus='CLOSED' OR orderStatus='ABANDONED'",
  );
  stmt.run();
}

function getOrdersNotDone(db: Database) {
  const stmt = db.prepare(
    "SELECT * FROM OSL_ORDER WHERE stage<>'DONE' AND orderStatus<>'CLOSED' AND orderStatus<>'ABANDONED' AND nextStageRunAt<CURRENT_TIMESTAMP ORDER BY created DESC",
  );
  const orders: IOrderRecord[] = [];
  const cursor = stmt.iterate();
  for (const row of cursor) {
    orders.push(row as IOrderRecord);
  }
  return orders;
}

function getOrdersInStage(db: Database, stage: string) {
  const stmt = db.prepare(
    "SELECT * FROM OSL_ORDER WHERE stage=? AND orderStatus<>'CLOSED' AND orderStatus<>'ABANDONED' ORDER BY created DESC",
  );
  const orders: IOrderRecord[] = [];
  const cursor = stmt.iterate(stage);
  for (const row of cursor) {
    orders.push(row as IOrderRecord);
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

function getStats(db: Database) {
  const stmt = db.prepare('SELECT count(1) as cnt from OSL_ORDER');
  const r1 = stmt.get([]) as any;
  const stmt2 = db.prepare(
    'SELECT stage, count(1) as cnt from OSL_ORDER GROUP BY stage',
  );
  const r2 = stmt2.get([]);
  const stmt3 = db.prepare('SELECT min(created) as minCreated from OSL_ORDER');
  const r3 = stmt3.get([]) as any;

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
  updateOrderExtraData,
  getOrder,
  getOrdersNotDone,
  removeOlderThan,
  removeClosedOrdersOrAbandoned,
  setOrderStage,
  getOrdersInStage,
  getStats,
  isOrderWithCheckSeqInDb,
};
