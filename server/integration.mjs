import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { randomBytes, createHmac } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import pg from 'pg';

const database = new URL(process.env.TEST_DATABASE_URL);
assert.ok(['localhost', '127.0.0.1'].includes(database.hostname));
assert.equal(database.pathname, '/butterfly_test');
const pool = new pg.Pool({connectionString: database.href});
const origin = 'http://127.0.0.1:3195';
const secret = randomBytes(32).toString('hex');
let server;
try {
  const empty = await pool.query("SELECT to_regclass('public.users') AS users");
  assert.equal(empty.rows[0].users, null, 'Use a fresh disposable butterfly_test database');
  server = spawn(process.execPath, ['index.mjs'], {
    cwd: new URL('.', import.meta.url),
    env: {PATH: process.env.PATH, DATABASE_URL: database.href, PORT: '3195', PUBLIC_ORIGIN: origin, SESSION_SECRET: secret},
    stdio: 'inherit'
  });
  let healthy = false;
  for (let attempt = 0; attempt < 80 && !healthy && server.exitCode === null; attempt++) {
    healthy = await fetch(origin + '/api/health').then(r => r.ok).catch(() => false);
    if (!healthy) await delay(100);
  }
  assert.ok(healthy, 'Test API started');
  const require = createRequire(import.meta.url);
  const sessionSchema = join(dirname(require.resolve('connect-pg-simple')), 'table.sql');
  await pool.query(await readFile(sessionSchema, 'utf8'));
  const fixture = await pool.query(
    "INSERT INTO users(google_id,email) VALUES ('fixture-a','a@example.test'), ('fixture-b','b@example.test') RETURNING id"
  );
  const cookie = async (id) => {
    // Emulate the stored session Google creates, only in this disposable database.
    const sid = randomBytes(24).toString('hex');
    await pool.query('INSERT INTO session(sid,sess,expire) VALUES($1,$2,now()+interval \'1 day\')', [
      sid, {cookie: {}, passport: {user: Number(id)}}
    ]);
    const signature = createHmac('sha256', secret).update(sid).digest('base64').replace(/=+$/, '');
    return 'butterfly.sid=' + encodeURIComponent('s:' + sid + '.' + signature);
  };
  const [a, b] = await Promise.all(fixture.rows.map(row => cookie(row.id)));
  const request = async (path, {method = 'GET', session = '', body, status = 200, requestOrigin = origin} = {}) => {
    const r = await fetch(origin + '/api' + path, {
      method, headers: {Origin: requestOrigin, Cookie: session, 'Content-Type': 'application/json'},
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    assert.equal(r.status, status, method + ' ' + path + ': ' + (r.status === status ? '' : await r.clone().text()));
    return r;
  };
  const json = async (...args) => (await request(...args)).json();
  const update = (path, session, body, status) => json(path, {method:'PUT', session, body, status});
  const create = (session, body, status) => json('/nodes', {method:'POST', session, body, status});
  const byId = async id => (await json('/nodes')).find(node => node.id === id);
  await pool.query("INSERT INTO nodes(id,data) VALUES (0,'{}'), (1,'{}'), (2,'{}')");
  assert.equal(await byId(0), undefined);
  const legacy = await pool.query('INSERT INTO nodes(author_id,data) VALUES($1,$2) RETURNING id',
    [fixture.rows[0].id, {title:'Existing artwork'}]);
  await pool.query('INSERT INTO ripples VALUES (0,1), (1,$1)', [legacy.rows[0].id]);
  assert.deepEqual((await byId(1)).parents, [0]);
  assert.equal((await byId(Number(legacy.rows[0].id))).title, 'Existing artwork');

  const artwork = {title:'A paper trail', medium:'Writing', text:'One fold, then another.', parents:[1000001, 1000002]};
  const artist = {displayName:' Paper Fox ', bio:' I make tiny paper worlds. ', links:{instagram:'instagram.com/paperfox?igsh=tracking', youtube:''}};
  await request('/profile', {status:401});
  await request('/private', {status:401});
  await create('', artwork, 401);
  await request('/profile', {method:'PUT', session:a, body:artist, requestOrigin:'http://other.test', status:403});
  await update('/profile', a, {...artist, userId:fixture.rows[1].id}, 400);
  await update('/profile', a, {...artist, bio:'x'.repeat(281)}, 400);
  await update('/profile', a, {...artist, links:{instagram:'https://instagram.com.example.org/paperfox'}}, 400);
  await update('/profile', a, artist, 200);
  assert.deepEqual(await json('/profile', {session:b}), {displayName:'', bio:'', links:{}});
  const normalized = {displayName:'Paper Fox', bio:'I make tiny paper worlds.', links:{instagram:'https://www.instagram.com/paperfox'}};
  assert.deepEqual(await json('/profile', {session:a}), normalized);
  await update('/draft', a, artwork, 200);
  assert.equal((await json('/private', {session:b})).draft, null);
  await create(a, {...artwork, parents:[999999]}, 400);
  const first = await create(a, artwork, 201);
  assert.equal((await json('/private', {session:a})).draft, null);
  assert.equal((await byId(first.id)).artist, null);
  await update('/nodes/' + first.id + '/credit', b, {showArtist:true}, 404);
  await update('/nodes/' + first.id + '/credit', a, {showArtist:true}, 200);
  assert.deepEqual((await byId(first.id)).artist, normalized);
  await update('/bookmarks/' + first.id, b, {saved:true}, 200);
  assert.deepEqual((await json('/private', {session:a})).saved, []);
  assert.deepEqual((await json('/private', {session:b})).saved, [first.id]);
  const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aLl0AAAAASUVORK5CYII=';
  const image = {...artwork, medium:'Visual art', text:'', mime:'image/png', showArtist:true};
  await create(a, {...image, url:'data:image/png;base64,dGVzdA=='}, 400);
  const second = await create(a, {...image, url:'data:image/png;base64,' + png}, 201);
  const uploaded = await byId(second.id);
  assert.deepEqual(uploaded.parents, [1000001, 1000002]);
  assert.deepEqual(uploaded.artist, normalized);
  assert.deepEqual(Object.keys(uploaded.artist).sort(), ['bio','displayName','links']);
  assert.equal(uploaded.author_id, undefined);
  assert.equal(uploaded.showArtist, undefined);
  const media = await request(uploaded.url.slice('/api'.length));
  assert.equal(media.headers.get('content-type'), 'image/png');
  assert.equal(Buffer.from(await media.arrayBuffer()).toString('base64'), png);
  await update('/profile', a, {...artist, displayName:'Paper Crane'}, 200);
  assert.equal((await byId(second.id)).artist.displayName, 'Paper Crane');
  await update('/profile', a, {displayName:'Paper Crane', bio: normalized.bio}, 200);
  assert.deepEqual((await byId(second.id)).artist.links, normalized.links);
  await update('/profile', a, {...normalized, links:{}}, 200);
  assert.deepEqual((await byId(second.id)).artist.links, {});
  await update('/profile', a, {displayName:'', bio:''}, 200);
  await update('/profile', a, artist, 200);
  assert.equal((await byId(first.id)).artist, null);
  assert.equal((await byId(second.id)).artist, null);
  await request('/logout', {session:a, method:'POST', body:{}});
  await request('/profile', {session:a, status:401});
  console.log('PASS: profile privacy and ownership, credit, drafts, bookmarks, publishing, upload round trip, and logout');
} finally {
  if (server?.exitCode === null) {
    server.kill();
    await once(server, 'exit');
  }
  await pool.end();
}
