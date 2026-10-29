(() => {
  const ROLE = window.CP_ROLE, S = JSON.parse(sessionStorage.getItem('cp_session') || 'null');
  if (!S || S.role !== ROLE) { location.replace('/'); return; }
  const esc = s => String(s).replace(/[&<>"']/g, c => '&#' + c.charCodeAt(0) + ';');
  const _set = Storage.prototype.setItem;  // chặn đồng bộ chéo tab cùng máy, mọi thứ đi qua máy chủ
  Storage.prototype.setItem = function (k, v) { if (/^CHINH_PHUC/.test(k)) return; return _set.call(this, k, v); };
  const send = m => fetch('/api/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: S.code, token: S.token, msg: m }) }).catch(() => {});

  class NetChannel {  // giả lập BroadcastChannel cho code gốc
    constructor() { NetChannel.inst = this; this._q = []; this._f = null; }
    postMessage(m) { send(m); }
    close() {}
    set onmessage(f) { this._f = f; this._q.splice(0).forEach(d => f({ data: d })); }
    get onmessage() { return this._f; }
    _in(d) { this._f ? this._f({ data: d }) : this._q.push(d); }
  }
  window.BroadcastChannel = NetChannel;

  let info = { players: [] }, online = false, teams = [], open = false;
  const bar = document.createElement('div');
  bar.style.cssText = 'position:fixed;z-index:9999;font:12px "Be Vietnam Pro",sans-serif;color:#fde68a;' + (ROLE === 'host' ? 'right:12px;bottom:12px' : 'left:10px;bottom:10px');
  const box = (css, h) => `<div style="background:rgba(6,10,23,.95);border:1px solid #D4AF37;border-radius:12px;padding:${css};box-shadow:0 4px 20px #000a">${h}</div>`;

  function render() {
    const on = info.players.filter(p => p.online).length;
    if (ROLE === 'host') {
      let h = `<button data-a="tg" style="display:block;margin-left:auto;background:#D4AF37;color:#000;font-weight:800;border-radius:12px;padding:8px 14px">🌐 Phòng ${S.code} · ${on}/${info.players.length} online</button>`;
      if (open) h = box('12px;width:290px;margin-bottom:8px;max-height:70vh;overflow:auto',
        `<div style="font-weight:800;color:#FFD700;margin-bottom:6px">MÃ TRẬN: ${S.code}</div>
         <div>Mật khẩu: <b id="cp-pw">••••••</b> <a data-a="pw" style="cursor:pointer;color:#60a5fa">hiện/ẩn</a></div>
         <button data-a="cp" style="margin:8px 0;padding:6px 10px;border-radius:8px;background:#f59e0b33;border:1px solid #f59e0b;width:100%">📋 Sao chép link mời (mã + mật khẩu nhập tay)</button>
         <label style="display:block;margin-bottom:8px"><input type="checkbox" data-a="lk" ${info.locked ? 'checked' : ''}> Khóa phòng (không nhận thêm người)</label>
         <div style="font-weight:700;margin-bottom:4px">Người chơi (${info.players.length})</div>` +
        (info.players.map(p => { const t = teams.find(x => x.id == p.teamId); return `<div style="display:flex;justify-content:space-between;gap:6px;padding:3px 0;border-top:1px solid #fff2"><span>${p.online ? '🟢' : '⚪'} ${esc(p.name)} <i style="color:#9ca3af">${t ? esc(t.name) : '—'}</i></span><a data-a="kick" data-id="${p.id}" style="cursor:pointer;color:#f87171">đuổi</a></div>`; }).join('') || '<i style="color:#9ca3af">Chưa có ai vào.</i>')) + h;
      bar.innerHTML = h;
    } else {
      const me = S.name ? ' · ' + esc(S.name) : '';
      bar.innerHTML = box('6px 10px', `${online ? (info.hostOnline === false ? '🟠 MC đang offline' : '🟢') : '🔴 Mất kết nối...'} Phòng ${S.code}${me}`) +
        (teams.length ? box('6px 10px;margin-top:6px', teams.map(t => `<span style="margin-right:10px"><b style="color:${esc(t.color)}">●</b> ${esc(t.name)}: <b>${t.score}</b></span>`).join('')) : '');
    }
  }
  bar.onclick = e => {
    const a = e.target.dataset.a; if (!a) return;
    if (a === 'tg') open = !open;
    if (a === 'pw') { const el = document.getElementById('cp-pw'); el.textContent = el.textContent === '••••••' ? S.password : '••••••'; return; }
    if (a === 'cp') { navigator.clipboard.writeText(`${location.origin}/?room=${S.code}`).then(() => alert('Đã chép link. Gửi kèm mật khẩu cho thí sinh.')); return; }
    if (a === 'lk') send({ type: 'LOCK', locked: e.target.checked });
    if (a === 'kick' && confirm('Đuổi người chơi này?')) send({ type: 'KICK', id: e.target.dataset.id });
    render();
  };

  function applyTeams(ts) {  // thí sinh: đồng bộ danh sách đội từ MC
    teams = ts; render();
    if (ROLE !== 'player' || typeof TEAMS === 'undefined' || !ts.length) return;
    TEAMS.splice(0, TEAMS.length, ...ts);
    const sel = document.getElementById('team-select'), cur = sel.value || sessionStorage.getItem('cp_team');
    sel.innerHTML = '';
    ts.forEach(t => { const o = document.createElement('option'); o.value = t.id; o.textContent = t.name; sel.appendChild(o); });
    sel.value = ts.some(t => t.id == cur) ? cur : ts[0].id;
    window.changeActiveTeam(sel.value);
  }

  function handle(m) {
    if (m.type === 'ROOM_INFO') { info = m; return render(); }
    if (m.type === 'KICKED') { sessionStorage.removeItem('cp_session'); alert('Bạn đã bị MC mời ra khỏi phòng.'); return location.replace('/'); }
    if (m.type === 'REPLACED') { es.close(); return alert('MC đã mở phòng này ở tab/thiết bị khác. Tab này ngừng đồng bộ.'); }
    if (m.type === 'TEAMS_STATE') return applyTeams(m.teams);
    NetChannel.inst && NetChannel.inst._in(m);
  }

  let es;
  function connect() {
    es = new EventSource(`/api/stream?code=${S.code}&token=${S.token}&role=${ROLE}`);
    es.onmessage = e => handle(JSON.parse(e.data));
    es.onopen = () => { online = true; render(); };
    es.onerror = () => { online = false; render(); fetch(`/api/ping?code=${S.code}&token=${S.token}`).then(r => { if (r.status === 401) { sessionStorage.removeItem('cp_session'); alert('Phòng không còn tồn tại hoặc phiên đã hết hạn.'); location.replace('/'); } }).catch(() => {}); };
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.body.appendChild(bar); render();
    if (ROLE === 'player') { bar.style.pointerEvents = 'none'; document.body.style.paddingBottom = '78px'; }
    if (ROLE === 'player') {
      const o = window.changeActiveTeam;
      window.changeActiveTeam = id => { o(id); sessionStorage.setItem('cp_team', id); send({ type: 'SET_TEAM', teamId: +id }); };
    } else {
      let last = '';
      setInterval(() => { try { const t = appState.teams.map(({ id, name, score, color }) => ({ id, name, score, color })), g = JSON.stringify(t); if (g !== last) { last = g; teams = t; send({ type: 'TEAMS_STATE', teams: t }); render(); } } catch (e) {} }, 1000);
    }
    connect();
  });
})();
