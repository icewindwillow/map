/** Test-only D1-shaped adapter over local SQLite. Never imported by production routes. */
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
export function testDB(path=':memory:') {
 const db=new DatabaseSync(path);db.exec(readFileSync(new URL('../migrations/0001_reviews.sql',import.meta.url),'utf8'));
 return {raw:db,prepare(sql){const stmt=db.prepare(sql);let values=[];return {bind(...args){values=args;return this;},async first(){return stmt.get(...values)||null;},async all(){return {results:stmt.all(...values)};},async run(){return {meta:stmt.run(...values)};}};}};
}
