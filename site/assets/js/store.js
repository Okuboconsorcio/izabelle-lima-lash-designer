/* =========================================================
   Izabelle Lima — camada de dados
   Hoje salva no navegador (localStorage) para demonstração.
   Todas as funções são assíncronas para que, depois, seja
   simples trocar por um banco online (ex.: Supabase) sem
   mexer nas telas.
   ========================================================= */
(function () {
  const KEY = 'il_db_v1';

  /* ---------- utilidades de data/hora (sempre em horário local) ---------- */
  const pad = n => String(n).padStart(2, '0');
  const U = {
    pad,
    todayStr() { return U.dateStr(new Date()); },
    dateStr(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; },
    parseDate(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); },
    addDays(s, n) { const d = U.parseDate(s); d.setDate(d.getDate() + n); return U.dateStr(d); },
    toMin(t) { const [h, m] = t.split(':').map(Number); return h * 60 + m; },
    toTime(min) { return `${pad(Math.floor(min / 60))}:${pad(min % 60)}`; },
    nowMin() { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); },
    weekday(s) { return U.parseDate(s).getDay(); },
    money(v) { return (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); },
    dur(min) {
      const h = Math.floor(min / 60), m = min % 60;
      if (!h) return `${m} min`;
      return m ? `${h}h${pad(m)}` : `${h}h`;
    },
    WEEKDAYS: ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'],
    WEEKDAYS_SHORT: ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'],
    MONTHS: ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'],
    longDate(s) {
      const d = U.parseDate(s);
      return `${U.WEEKDAYS[d.getDay()]}, ${d.getDate()} de ${U.MONTHS[d.getMonth()]}`;
    },
    shortDate(s) { const d = U.parseDate(s); return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`; },
    uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); },
    onlyDigits(s) { return String(s || '').replace(/\D/g, ''); },
    phoneMask(s) {
      const d = U.onlyDigits(s).slice(0, 11);
      if (d.length <= 2) return d;
      if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
      return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
    },
    waLink(phone, text) {
      let d = U.onlyDigits(phone);
      if (d && !d.startsWith('55')) d = '55' + d;
      return `https://wa.me/${d}?text=${encodeURIComponent(text)}`;
    },
    esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); },
  };

  /* ---------- dados iniciais ---------- */
  const CATEGORIES = [
    { id: 'sobrancelha', name: 'Sobrancelha' },
    { id: 'buco', name: 'Buço' },
    { id: 'cilios', name: 'Cílios' },
  ];

  function defaultServices() {
    const s = [
      { cat: 'sobrancelha', name: 'Design de sobrancelha', price: 25, duration: 30 },
      { cat: 'sobrancelha', name: 'Design com henna', price: 45, duration: 45 },
      { cat: 'sobrancelha', name: 'Diagnose com tintura', price: 50, duration: 45 },
      { cat: 'buco', name: 'Depilação de buço', price: 10, duration: 15 },
    ];
    [['Brasileiro', 115, 70], ['Egípcio', 125, 75], ['Mega (Capping)', 130, 80], ['5D', 135, 85], ['Fox', 140, 90]]
      .forEach(([n, col, man]) => {
        s.push({ cat: 'cilios', name: `${n} — colocação`, price: col, duration: 120 });
        s.push({ cat: 'cilios', name: `${n} — manutenção`, price: man, duration: 90, note: 'Manutenção de 15 a 21 dias' });
      });
    return s.map((x, i) => ({ id: 'sv' + (i + 1), active: true, note: '', ...x }));
  }

  function defaultSettings() {
    const hours = {};
    for (let d = 0; d < 7; d++) hours[d] = { on: d >= 1 && d <= 6, open: '09:00', close: d === 6 ? '14:00' : '19:00' };
    return {
      studio: 'Izabelle Lima',
      subtitle: 'Lash Designer',
      whatsapp: '',
      address: '',
      instagram: '',
      hours,
      lunch: { on: true, start: '12:00', end: '13:00' },
      step: 30,             // de quanto em quanto tempo aparecem horários
      minNoticeHours: 2,    // antecedência mínima para agendar
      windowDays: 45,       // até quantos dias à frente pode agendar
      pin: '1234',
    };
  }

  function emptyDb() {
    return {
      version: 1,
      demo: false,
      settings: defaultSettings(),
      services: defaultServices(),
      appointments: [],
      blocks: [],
      materials: [],
      purchases: [],
      expenses: [],
    };
  }

  /* ---------- dados de exemplo (para visualizar o painel) ---------- */
  function demoData(db) {
    const today = U.todayStr();
    const names = ['Ana Clara', 'Beatriz Souza', 'Camila Rocha', 'Daniela Alves', 'Eduarda Lima', 'Fernanda Costa', 'Gabriela Dias', 'Helena Martins', 'Isabela Nunes', 'Júlia Ramos', 'Larissa Prado', 'Mariana Teles', 'Natália Pires', 'Paula Gomes', 'Rafaela Melo', 'Sabrina Lopes', 'Tainá Ribeiro', 'Vitória Cunha'];
    const pays = ['pix', 'pix', 'pix', 'dinheiro', 'debito', 'credito'];
    let seed = 7;
    const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
    const pick = a => a[Math.floor(rnd() * a.length)];
    const svcs = db.services;
    const appts = [];

    for (let off = -150; off <= 14; off++) {
      const date = U.addDays(today, off);
      const wd = U.weekday(date);
      const h = db.settings.hours[wd];
      if (!h.on) continue;
      const count = off < 0 ? 2 + Math.floor(rnd() * 3) : Math.floor(rnd() * 3);
      let t = U.toMin(h.open);
      for (let i = 0; i < count; i++) {
        const sv = pick(svcs);
        if (t + sv.duration > U.toMin(h.close)) break;
        if (db.settings.lunch.on && t < U.toMin(db.settings.lunch.end) && t + sv.duration > U.toMin(db.settings.lunch.start)) t = U.toMin(db.settings.lunch.end);
        if (t + sv.duration > U.toMin(h.close)) break;
        const past = off < 0 || (off === 0 && t + sv.duration < U.nowMin());
        let status = 'agendado';
        if (past) { const r = rnd(); status = r < 0.86 ? 'concluido' : r < 0.94 ? 'cancelado' : 'faltou'; }
        const name = pick(names);
        appts.push({
          id: U.uid() + i, demo: true,
          serviceId: sv.id, serviceName: sv.name, cat: sv.cat,
          price: sv.price, duration: sv.duration,
          date, time: U.toTime(t),
          client: name, phone: '(11) 9' + Math.floor(1000 + rnd() * 8999) + '-' + Math.floor(1000 + rnd() * 8999),
          notes: '', status,
          paid: status === 'concluido' ? sv.price : 0,
          payment: status === 'concluido' ? pick(pays) : '',
          createdAt: Date.now(), source: rnd() < 0.7 ? 'site' : 'painel',
        });
        t += sv.duration + (rnd() < 0.5 ? 30 : 60);
      }
    }

    const mats = [
      ['Cola para cílios', 'Cílios', 'frasco', 2, 1, 89.9],
      ['Fios 5D (caixa)', 'Cílios', 'caixa', 4, 2, 42],
      ['Fios Brasileiro (caixa)', 'Cílios', 'caixa', 1, 2, 38],
      ['Primer', 'Cílios', 'frasco', 1, 1, 35],
      ['Removedor de cola', 'Cílios', 'frasco', 1, 1, 32],
      ['Henna (castanho)', 'Sobrancelha', 'unidade', 3, 1, 28],
      ['Tintura para sobrancelha', 'Sobrancelha', 'unidade', 0, 1, 24],
      ['Cera depilatória', 'Buço', 'pote', 2, 1, 22],
      ['Escovinhas descartáveis', 'Descartáveis', 'pacote', 3, 2, 15],
      ['Microbrush', 'Descartáveis', 'pacote', 1, 2, 12],
      ['Fita micropore', 'Descartáveis', 'rolo', 5, 2, 9.5],
      ['Luvas', 'Descartáveis', 'caixa', 1, 1, 29.9],
    ].map(([name, cat, unit, stock, min, price], i) => ({ id: 'mt' + (i + 1), name, cat, unit, stock, min, lastPrice: price, demo: true }));

    const purchases = [];
    for (let off = -150; off <= 0; off += 9 + Math.floor(rnd() * 8)) {
      const m = pick(mats);
      const qty = 1 + Math.floor(rnd() * 3);
      purchases.push({ id: U.uid(), demo: true, materialId: m.id, materialName: m.name, date: U.addDays(today, off), qty, total: +(qty * m.lastPrice).toFixed(2), supplier: pick(['Loja Beauty', 'Distribuidora Lash', 'Mercado Livre', 'Shopee']) });
    }

    const expenses = [];
    for (let k = 5; k >= 0; k--) {
      const d = U.parseDate(today); d.setMonth(d.getMonth() - k); d.setDate(5);
      expenses.push({ id: U.uid(), demo: true, date: U.dateStr(d), desc: 'Aluguel da sala', cat: 'Aluguel', value: 350 });
      d.setDate(12);
      expenses.push({ id: U.uid(), demo: true, date: U.dateStr(d), desc: 'Energia / internet', cat: 'Contas', value: 90 + Math.round(rnd() * 40) });
    }

    const keep = k => (db[k] || []).filter(x => !x.demo);
    db.appointments = keep('appointments').concat(appts);
    db.materials = keep('materials').concat(mats);
    db.purchases = keep('purchases').concat(purchases);
    db.expenses = keep('expenses').concat(expenses);
    db.demo = true;
    return db;
  }

  /* ---------- modo: banco online (Supabase) ou demonstração (navegador) ---------- */
  const CFG = window.IL_CONFIG || {};
  // com banco configurado, nunca cai para o modo demonstração (os dados ficariam só neste navegador)
  const REMOTE = !!(CFG.supabaseUrl && CFG.supabaseKey);
  const sb = REMOTE && window.supabase ? window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseKey, { db: { schema: CFG.schema || 'izabelle' } }) : null;
  const OFFLINE_MSG = 'Não foi possível conectar à agenda online. Confira a internet (ou desative bloqueadores de anúncio) e recarregue a página.';
  const need = () => { if (!sb) throw new Error(OFFLINE_MSG); };
  let cache = null;

  // nomes no JavaScript (camelCase) ↔ colunas do banco (snake_case)
  const RENAME = { start: 'start_time', end: 'end_time', min: 'min_stock', desc: 'description' };
  const BACK = Object.fromEntries(Object.entries(RENAME).map(([a, b]) => [b, a]));
  const toCol = k => RENAME[k] || k.replace(/[A-Z]/g, c => '_' + c.toLowerCase());
  const toKey = k => BACK[k] || k.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
  const toDb = o => {
    const r = {};
    for (const [k, v] of Object.entries(o)) if (v !== undefined && !['id', 'createdAt', 'demo'].includes(k)) r[toCol(k)] = v;
    return r;
  };
  const fromDb = o => Object.fromEntries(Object.entries(o).map(([k, v]) => [toKey(k), v]));

  function check(error) {
    if (!error) return;
    console.error(error);
    let msg = error.message || 'Algo deu errado. Tente de novo.';
    if (error.code === '42501' || error.code === 'PGRST301') msg = 'Sem permissão. Entre de novo no painel.';
    else if (/fetch|network|Failed/i.test(msg)) msg = 'Sem conexão com a internet. Tente de novo.';
    throw new Error(msg);
  }

  async function fetchAll(table, order = 'created_at') {
    let out = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await sb.from(table).select('*').order(order).range(from, from + 999);
      check(error);
      out = out.concat(data.map(fromDb));
      if (data.length < 1000) return out;
    }
  }

  /* ---------- leitura / gravação ---------- */
  function loadLocal() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const db = JSON.parse(raw);
        db.settings = { ...defaultSettings(), ...db.settings };
        return db;
      }
    } catch (e) { console.warn('Não foi possível ler os dados', e); }
    const db = demoData(emptyDb());
    save(db);
    return db;
  }
  function load() {
    if (!REMOTE) return loadLocal();
    if (!cache) throw new Error('Dados ainda não carregados.');
    return cache;
  }
  function save(db) {
    if (REMOTE) return;
    try { localStorage.setItem(KEY, JSON.stringify(db)); }
    catch (e) { alert('Não foi possível salvar os dados neste navegador.'); throw e; }
  }

  /* operações genéricas: gravam no banco (se online) e atualizam a cópia local */
  async function ins(table, row) {
    if (REMOTE) {
      const { data, error } = await sb.from(table).insert(toDb(row)).select().single();
      check(error);
      row = fromDb(data);
    } else row = { ...row, id: row.id || U.uid() };
    const db = load();
    db[table].push(row);
    save(db);
    return row;
  }
  async function upd(table, id, patch) {
    if (REMOTE) {
      const { data, error } = await sb.from(table).update(toDb(patch)).eq('id', id).select().single();
      check(error);
      patch = fromDb(data);
    }
    const db = load();
    const item = db[table].find(x => x.id === id);
    if (item) Object.assign(item, patch);
    save(db);
    return item;
  }
  async function del(table, id) {
    if (REMOTE) { const { error } = await sb.from(table).delete().eq('id', id); check(error); }
    const db = load();
    db[table] = db[table].filter(x => x.id !== id);
    save(db);
  }

  async function refreshBusy() {
    const today = U.todayStr();
    const { data, error } = await sb.rpc('busy_ranges', { p_from: today, p_to: U.addDays(today, cache.settings.windowDays) });
    check(error);
    cache.busy = data.map(r => ({ date: r.date, start: r.start_min, end: r.end_min }));
  }

  /* ---------- regras de agenda ---------- */
  function busyRanges(db, date, excludeId) {
    let r;
    if (db.busy) r = db.busy.filter(b => b.date === date).map(b => [b.start, b.end]);
    else {
      r = db.appointments
        .filter(a => a.date === date && a.status !== 'cancelado' && a.id !== excludeId)
        .map(a => [U.toMin(a.time), U.toMin(a.time) + a.duration]);
      db.blocks.filter(b => b.date === date).forEach(b => r.push([U.toMin(b.start), U.toMin(b.end)]));
    }
    if (db.settings.lunch.on) r.push([U.toMin(db.settings.lunch.start), U.toMin(db.settings.lunch.end)]);
    return r;
  }

  function slotsFor(db, date, duration, opts = {}) {
    const st = db.settings;
    const h = st.hours[U.weekday(date)];
    if (!h || !h.on) return [];
    const today = U.todayStr();
    if (date < today && !opts.admin) return [];
    if (!opts.admin) {
      const last = U.addDays(today, st.windowDays);
      if (date > last) return [];
    }
    const busy = busyRanges(db, date, opts.excludeId);
    const open = U.toMin(h.open), close = U.toMin(h.close);
    const minStart = date === today && !opts.admin ? U.nowMin() + st.minNoticeHours * 60 : -1;
    const out = [];
    for (let t = open; t + duration <= close; t += Number(st.step) || 30) {
      if (t < minStart) continue;
      const clash = busy.some(([s, e]) => t < e && t + duration > s);
      if (!clash) out.push(U.toTime(t));
    }
    return out;
  }

  function isFree(db, date, time, duration, excludeId) {
    const t = U.toMin(time);
    return !busyRanges(db, date, excludeId).some(([s, e]) => t < e && t + duration > s);
  }

  /* ---------- API pública ---------- */
  const listeners = [];
  const notify = () => listeners.forEach(fn => fn());
  if (!REMOTE) window.addEventListener('storage', e => { if (e.key === KEY) notify(); });

  let realtimeOn = false, rtTimer;
  function watchAppointments() {
    if (realtimeOn) return;
    realtimeOn = true;
    sb.channel('il-agenda')
      .on('postgres_changes', { event: '*', schema: CFG.schema || 'izabelle', table: 'appointments' }, () => {
        clearTimeout(rtTimer);
        rtTimer = setTimeout(async () => {
          try { cache.appointments = await fetchAll('appointments'); notify(); } catch (e) { console.warn(e); }
        }, 800);
      })
      .subscribe();
  }

  const localOnly = () => { if (REMOTE) throw new Error('Disponível só na versão de demonstração.'); };

  const Store = {
    U,
    CATEGORIES,
    remote: REMOTE,
    PAYMENTS: { pix: 'Pix', dinheiro: 'Dinheiro', debito: 'Cartão de débito', credito: 'Cartão de crédito' },
    STATUS: { agendado: 'Agendado', concluido: 'Realizado', cancelado: 'Cancelado', faltou: 'Não compareceu' },
    onChange(fn) { listeners.push(fn); },

    /* carrega os dados. Site: ajustes, serviços e horários ocupados. Painel: tudo. */
    async init({ admin = false } = {}) {
      if (!REMOTE) return;
      need();
      const [st, sv] = await Promise.all([
        sb.from('settings').select('data').eq('id', 1).single(),
        sb.from('services').select('*').order('position'),
      ]);
      check(st.error); check(sv.error);
      cache = { demo: false, settings: { ...defaultSettings(), ...st.data.data }, services: sv.data.map(fromDb), appointments: [], blocks: [], materials: [], purchases: [], expenses: [] };
      if (admin) {
        const [a, b, m, p, e] = await Promise.all(['appointments', 'blocks', 'materials', 'purchases', 'expenses'].map(t => fetchAll(t)));
        Object.assign(cache, { appointments: a, blocks: b, materials: m, purchases: p, expenses: e });
        watchAppointments();
      } else await refreshBusy();
    },
    /* atualiza os horários ocupados (site) */
    async refresh() { if (REMOTE && cache && cache.busy) await refreshBusy(); },

    async get() { return load(); },
    async settings() { return load().settings; },
    async saveSettings(patch) {
      const db = load();
      const next = { ...db.settings, ...patch };
      if (REMOTE) {
        const { pin, ...data } = next;
        const { error } = await sb.from('settings').update({ data, updated_at: new Date().toISOString() }).eq('id', 1);
        check(error);
      }
      db.settings = next;
      save(db);
      return db.settings;
    },

    /* serviços */
    async services({ all = false } = {}) {
      const s = load().services.slice().sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
      return all ? s : s.filter(x => x.active);
    },
    async saveService(sv) {
      if (sv.id) { const { id, ...patch } = sv; return upd('services', id, patch); }
      const pos = Math.max(0, ...load().services.map(x => x.position || 0)) + 1;
      return ins('services', { active: true, note: '', position: pos, ...sv, id: REMOTE ? undefined : 'sv' + U.uid() });
    },
    async removeService(id) { return del('services', id); },

    /* agenda */
    async slots(date, duration, opts) { return slotsFor(load(), date, duration, opts); },
    async dayHasSlots(date, duration) { return slotsFor(load(), date, duration).length > 0; },
    async appointments(filter = {}) {
      let a = load().appointments;
      if (filter.date) a = a.filter(x => x.date === filter.date);
      if (filter.from) a = a.filter(x => x.date >= filter.from);
      if (filter.to) a = a.filter(x => x.date <= filter.to);
      return a.slice().sort((x, y) => (x.date + x.time).localeCompare(y.date + y.time));
    },
    async book(data, { admin = false } = {}) {
      const db = load();
      const sv = db.services.find(s => s.id === data.serviceId);
      if (!sv) throw new Error('Serviço não encontrado.');
      const duration = Number(data.duration) || sv.duration;

      if (REMOTE && !admin) {
        const { data: row, error } = await sb.rpc('book_appointment', {
          p_service_id: sv.id, p_date: data.date, p_time: data.time,
          p_client: data.client.trim(), p_phone: data.phone, p_notes: data.notes || '',
        });
        if (error) { try { await refreshBusy(); } catch { } check(error); }
        const appt = fromDb(row);
        db.busy.push({ date: appt.date, start: U.toMin(appt.time), end: U.toMin(appt.time) + appt.duration });
        return appt;
      }

      const ok = admin ? isFree(db, data.date, data.time, duration) : slotsFor(db, data.date, duration).includes(data.time);
      if (!ok) throw new Error(admin ? 'Esse horário já está ocupado.' : 'Esse horário acabou de ser reservado por outra pessoa. Escolha outro, por favor.');
      return ins('appointments', {
        serviceId: sv.id, serviceName: sv.name, cat: sv.cat,
        price: Number(data.price ?? sv.price), duration,
        date: data.date, time: data.time,
        client: data.client.trim(), phone: data.phone || '', notes: data.notes || '',
        status: 'agendado', paid: 0, payment: '', createdAt: Date.now(), source: admin ? 'painel' : 'site',
      });
    },
    async reschedule(id, date, time) {
      const db = load();
      const a = db.appointments.find(x => x.id === id);
      if (!isFree(db, date, time, a.duration, id)) throw new Error('Esse horário já está ocupado.');
      return upd('appointments', id, { date, time, status: 'agendado' });
    },
    async updateAppointment(id, patch) { return upd('appointments', id, patch); },
    async removeAppointment(id) { return del('appointments', id); },

    /* bloqueios (folgas, compromissos) */
    async blocks(date) { const b = load().blocks; return date ? b.filter(x => x.date === date) : b; },
    async addBlock(b) { return ins('blocks', b); },
    async removeBlock(id) { return del('blocks', id); },

    /* materiais */
    async materials() { return load().materials.slice().sort((a, b) => a.name.localeCompare(b.name)); },
    async saveMaterial(m) {
      if (m.id) { const { id, ...patch } = m; return upd('materials', id, patch); }
      return ins('materials', { stock: 0, min: 1, lastPrice: 0, ...m, id: REMOTE ? undefined : 'mt' + U.uid() });
    },
    async removeMaterial(id) { return del('materials', id); },
    async adjustStock(id, delta) {
      const m = load().materials.find(x => x.id === id);
      return upd('materials', id, { stock: Math.max(0, (Number(m.stock) || 0) + delta) });
    },
    async purchases() { return load().purchases.slice().sort((a, b) => b.date.localeCompare(a.date)); },
    async addPurchase(p) {
      const m = load().materials.find(x => x.id === p.materialId);
      await ins('purchases', { ...p, materialName: m ? m.name : p.materialName });
      if (m) {
        const patch = { stock: (Number(m.stock) || 0) + Number(p.qty) };
        if (p.qty > 0) patch.lastPrice = +(p.total / p.qty).toFixed(2);
        await upd('materials', m.id, patch);
      }
    },
    async removePurchase(id) {
      const db = load();
      const p = db.purchases.find(x => x.id === id);
      const m = p && db.materials.find(x => x.id === p.materialId);
      await del('purchases', id);
      if (m) await upd('materials', m.id, { stock: Math.max(0, (Number(m.stock) || 0) - Number(p.qty)) });
    },

    /* outras despesas */
    async expenses() { return load().expenses.slice().sort((a, b) => b.date.localeCompare(a.date)); },
    async addExpense(e) { return ins('expenses', e); },
    async removeExpense(id) { return del('expenses', id); },

    /* manutenção */
    async exportJson() { return JSON.stringify(load(), null, 2); },
    async importJson(text) {
      localOnly();
      const db = JSON.parse(text);
      if (!db || !Array.isArray(db.appointments) || !Array.isArray(db.services)) throw new Error('Arquivo inválido.');
      save(db);
    },
    async clearDemo() {
      localOnly();
      const db = load();
      ['appointments', 'materials', 'purchases', 'expenses'].forEach(k => { db[k] = db[k].filter(x => !x.demo); });
      db.demo = false;
      save(db);
    },
    async loadDemo() { localOnly(); const db = load(); demoData(db); save(db); },
    async resetAll() { localOnly(); localStorage.removeItem(KEY); save(emptyDb()); },

    /* login do painel (só no modo online) */
    auth: {
      async session() { need(); const { data } = await sb.auth.getSession(); return data.session; },
      async signIn(email, password) {
        need();
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw new Error(/invalid/i.test(error.message) ? 'E-mail ou senha incorretos.' : /confirm/i.test(error.message) ? 'Confirme seu e-mail antes de entrar (veja sua caixa de entrada).' : error.message);
      },
      async signUp(email, password) {
        need();
        const { data, error } = await sb.auth.signUp({ email, password, options: { emailRedirectTo: location.origin + location.pathname } });
        const exists = 'Esse e-mail já tem conta (é o mesmo login dos outros sistemas da Okubo). Use "Entrar" com a senha de lá, ou cadastre outro e-mail.';
        if (error) throw new Error(/registered/i.test(error.message) ? exists : error.message);
        // e-mail já cadastrado: o Supabase responde "ok" sem criar nada e sem enviar e-mail
        if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) throw new Error(exists);
        return !!data.session;
      },
      async signOut() { await sb.auth.signOut(); },
      async isAdmin() { const { data, error } = await sb.rpc('claim_admin'); check(error); return data === true; },
      async updatePassword(password) { const { error } = await sb.auth.updateUser({ password }); if (error) throw new Error(error.message); },
      async resetPassword(email) {
        const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
        if (error) throw new Error(error.message);
      },
      onRecovery(fn) { if (sb) sb.auth.onAuthStateChange(ev => { if (ev === 'PASSWORD_RECOVERY') fn(); }); },
    },
  };

  window.Store = Store;
})();
