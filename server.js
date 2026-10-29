// Chinh Phục Online - máy chủ không phụ thuộc thư viện ngoài (chỉ cần Node 18+)
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const PORT = process.env.PORT || 3000, PUB = path.join(__dirname, 'public');
const rooms = new Map(), fails = new Map();
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg', '.mpeg': 'audio/mpeg', '.wav': 'audio/wav', '.ico': 'image/x-icon' };
const HOST_T = new Set(['BOARD_STATE', 'SHOW_QUESTION', 'HIDE_QUESTION', 'HOST_OPEN_BUZZER', 'HOST_RESET_ALL', 'HOST_CORRECT_ANSWER', 'TEAMS_STATE']);

const rnd = n => crypto.randomBytes(n).toString('hex');
const hash = (p, s) => crypto.scryptSync(p, s, 32).toString('hex');
const okPass = (r, p) => { const a = Buffer.from(hash(String(p), r.salt)), b = Buffer.from(r.hash); return a.length === b.length && crypto.timingSafeEqual(a, b); };
const json = (res, c, o) => { res.writeHead(c, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
const readBody = req => new Promise(ok => { let d = ''; req.on('data', c => { d += c; if (d.length > 3e5) req.destroy(); }); req.on('end', () => { try { ok(JSON.parse(d || '{}')); } catch { ok({}); } }); });
const sse = (c, o) => { try { c.res.write('data: ' + JSON.stringify(o) + '\n\n'); } catch {} };
const clean = c => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
const info = r => ({ type: 'ROOM_INFO', code: r.code, locked: r.locked, hostOnline: !!r.host, players: [...r.players.values()].map(p => ({ id: p.id, name: p.name, teamId: p.teamId, online: p.conns.size > 0 })) });
const bcast = (r, o, skip) => { if (r.host && r.host !== skip) sse(r.host, o); r.players.forEach(p => p.conns.forEach(c => c !== skip && sse(c, o))); };
const limited = (req, code) => { const k = req.socket.remoteAddress + code, f = fails.get(k); return f && f.n >= 8 && Date.now() - f.t < 60000; };
const fail = (req, code) => { const k = req.socket.remoteAddress + code, f = fails.get(k); fails.set(k, { n: f && Date.now() - f.t < 60000 ? f.n + 1 : 1, t: Date.now() }); };
const who = (r, token) => token === r.hostToken ? { host: true } : { p: [...r.players.values()].find(p => p.token === token) };

async function api(req, res, u) {
  const q = u.searchParams, route = u.pathname;
  if (route === '/api/rooms' && req.method === 'POST') {
    const b = await readBody(req);
    if (String(b.password || '').length < 4) return json(res, 400, { error: 'Mật khẩu tối thiểu 4 ký tự.' });
    let code = clean(b.code);
    if (b.code && code.length < 4) return json(res, 400, { error: 'Mã trận cần 4–10 ký tự chữ/số.' });
    if (code && rooms.has(code)) return json(res, 409, { error: 'Mã trận này đã được dùng.' });
    while (!code || rooms.has(code)) code = Array.from({ length: 6 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[crypto.randomInt(32)]).join('');
    const salt = rnd(8), r = { code, salt, hash: hash(String(b.password), salt), hostToken: rnd(24), locked: false, players: new Map(), host: null, teams: [], board: null, question: null, buzz: { status: 'WAITING' }, last: Date.now() };
    rooms.set(code, r);
    return json(res, 200, { code, token: r.hostToken });
  }
  if (route === '/api/join' && req.method === 'POST') {
    const b = await readBody(req), code = clean(b.code), r = rooms.get(code);
    if (limited(req, code)) return json(res, 429, { error: 'Thử sai quá nhiều lần, đợi 1 phút.' });
    if (!r || !okPass(r, b.password)) { fail(req, code); return json(res, 401, { error: 'Sai mã trận hoặc mật khẩu.' }); }
    if (r.locked) return json(res, 403, { error: 'Phòng đã khóa, MC không nhận thêm người.' });
    const name = String(b.name || '').trim().slice(0, 24);
    if (!name) return json(res, 400, { error: 'Hãy nhập tên hiển thị.' });
    if (r.players.size >= 300) return json(res, 403, { error: 'Phòng đã đầy.' });
    const p = { id: rnd(4), token: rnd(24), name, teamId: null, conns: new Set() };
    r.players.set(p.id, p); r.last = Date.now(); bcast(r, info(r));
    return json(res, 200, { token: p.token });
  }
  const sb = route === '/api/send' && req.method === 'POST' ? await readBody(req) : null;
  const r = rooms.get(clean(sb ? sb.code : q.get('code')));
  if (route === '/api/ping') { const w = r && who(r, q.get('token')); return json(res, w && (w.host || w.p) ? 200 : 401, {}); }
  if (!r) return json(res, 401, { error: 'Phòng không tồn tại.' });

  if (route === '/api/stream') {
    const w = who(r, q.get('token'));
    if (!w.host && !w.p) return json(res, 401, {});
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
    const c = { res }; r.last = Date.now(); res.write(': ok\n\n');
    const hb = setInterval(() => { try { res.write(': hb\n\n'); } catch {} }, 20000);
    if (w.host) {
      if (r.host) { sse(r.host, { type: 'REPLACED' }); r.host.res.end(); }
      r.host = c; bcast(r, info(r));
    } else {
      w.p.conns.add(c);
      if (r.teams.length) sse(c, { type: 'TEAMS_STATE', teams: r.teams });
      if (r.board) sse(c, r.board);
      if (r.question) sse(c, { type: 'SHOW_QUESTION', question: r.question });
      if (r.buzz.status === 'OPEN') sse(c, { type: 'HOST_OPEN_BUZZER' });
      if (r.buzz.status === 'ANSWERING') sse(c, r.buzz.winner);
      bcast(r, info(r));
    }
    req.on('close', () => { clearInterval(hb); if (w.host) { if (r.host === c) r.host = null; } else w.p.conns.delete(c); bcast(r, info(r)); });
    return;
  }

  if (route === '/api/send' && req.method === 'POST') {
    const b = sb, m = b.msg || {}, w = who(r, b.token), t = m.type;
    if (!w.host && !w.p) return json(res, 401, {});
    r.last = Date.now();
    if (w.host) {
      if (t === 'LOCK') { r.locked = !!m.locked; bcast(r, info(r)); }
      else if (t === 'KICK') { const p = r.players.get(m.id); if (p) { p.conns.forEach(c => { sse(c, { type: 'KICKED' }); c.res.end(); }); r.players.delete(p.id); bcast(r, info(r)); } }
      else if (HOST_T.has(t)) {
        if (t === 'TEAMS_STATE') r.teams = m.teams || [];
        if (t === 'BOARD_STATE') r.board = m;
        if (t === 'SHOW_QUESTION') r.question = m.question;
        if (t === 'HOST_OPEN_BUZZER') r.buzz = { status: 'OPEN' };
        if (t === 'HIDE_QUESTION' || t === 'HOST_RESET_ALL' || t === 'HOST_CORRECT_ANSWER') { r.buzz = { status: 'WAITING' }; if (t === 'HIDE_QUESTION') r.question = null; }
        bcast(r, m, r.host);
        if (t === 'HIDE_QUESTION') bcast(r, { type: 'HOST_RESET_ALL' }, r.host);
      }
    } else {
      const p = w.p;
      if (t === 'REQUEST_BOARD') { p.conns.forEach(c => r.board && sse(c, r.board)); }
      else if (t === 'SET_TEAM') { p.teamId = m.teamId; bcast(r, info(r)); }
      else if (t === 'BUZZER_PRESSED' && r.buzz.status === 'OPEN') {  // ai đến máy chủ trước thì thắng
        const team = r.teams.find(x => x.id == m.teamId);
        const win = { type: 'BUZZER_PRESSED', teamId: m.teamId, teamName: team ? team.name : String(m.teamName || ''), playerName: p.name, timestamp: Date.now() };
        r.buzz = { status: 'ANSWERING', winner: win }; bcast(r, win);
      }
    }
    return json(res, 200, {});
  }
  json(res, 404, {});
}

http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname.startsWith('/api/')) return api(req, res, u).catch(() => json(res, 500, {}));
  let p = decodeURIComponent(u.pathname); if (p === '/') p = '/index.html'; else if (p === '/host') p = '/host.html'; else if (p === '/play') p = '/play.html';
  const f = path.join(PUB, p);
  if (!f.startsWith(PUB) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('Not found'); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
}).listen(PORT, () => console.log('Chinh Phuc Online chay tai http://localhost:' + PORT));

setInterval(() => rooms.forEach((r, k) => { const idle = !r.host && ![...r.players.values()].some(p => p.conns.size); if ((idle && Date.now() - r.last > 3 * 36e5) || Date.now() - r.last > 24 * 36e5) rooms.delete(k); }), 6e5);
