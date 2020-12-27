const Database = require('better-sqlite3');
const fs = require('fs');

const DB_FILENAME_DEFAULT = './data/task.db';
const DB_SCHEMA_FILENAME = require.resolve( './task.sql');

function createDatabase(dbFileName = DB_FILENAME_DEFAULT) {
    const db = new Database(dbFileName); //, { verbose: console.log });
    const migration = fs.readFileSync(DB_SCHEMA_FILENAME, 'utf8');
    db.exec(migration);
    return db;
}

/**
 * Add task to database
 * @param {*} task 
 * @returns task_id of added task
 */
function insertTask(db, task) {
    const stmt = db.prepare("INSERT INTO OSL_TASK (id, taskName, payload) VALUES (null, ?, ?)");  
    stmt.run([task.name, JSON.stringify(task.payload)]);
    const stmt2 = db.prepare("select last_insert_rowid() as newTaskId");
    const result2 = stmt2.get([]);
    return result2.newTaskId;
}

function setTaskAsProcessed(db, taskId) {
    const stmt = db.prepare("UPDATE OSL_TASK SET processed=true, processedAt=DateTime('now') WHERE id=?");
    stmt.run([taskId]);
}

// TODO: do not removew if order is not processed and closed - attrs: closed, completed, status, processed
function removeOlderThan(db, days) {
    const stmt = db.prepare("SELECT * FROM OSL_TASK WHERE created < date('now','-'||?||' days')"); //date('now','-4 days')"); 
    const cursor = stmt.iterate([days]);
    for (const row of cursor) {
        //console.log(row);
    }
}

function getNotProcessedTasks(db) {
    const stmt = db.prepare("SELECT * FROM OSL_TASK WHERE processed = false ORDER BY created DESC");
    const tasks = [];
    const cursor = stmt.iterate();
    for (const row of cursor) {
        tasks.push(row);
    }
    return tasks;
}

module.exports = {
    createDatabase, 
    insertTask, 
    setTaskAsProcessed, 
    removeOlderThan, 
    getNotProcessedTasks
}

