import { readFileSync } from 'node:fs';
import mysql from 'mysql2/promise';
const root = '/home/owenkdev/Projects/KTDOC';
for (const line of readFileSync(root + '/.env.local','utf8').split('\n')) {
  const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g,'');
}
const conn = await mysql.createConnection({
  host: process.env.DB_HOST, port: Number(process.env.DB_PORT||3306),
  user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME,
});
const sql = process.argv[2];
if (!/^\s*(select|show|describe|desc)\b/i.test(sql)) { console.error('읽기 전용만'); process.exit(1); }
const [rows] = await conn.query(sql);
console.log(JSON.stringify(rows, null, 2));
await conn.end();
