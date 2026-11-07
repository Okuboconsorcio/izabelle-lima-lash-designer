/* Painel de gestão — Izabelle Lima */
(async function () {
  const { U } = Store;
  const { $, $$ } = UI;
  const I = UI.icons;
  const PAY = Store.PAYMENTS;
  const CAT_NAME = Object.fromEntries(Store.CATEGORIES.map(c => [c.id, c.name]));
  const SERIES = { in: '#c2477a', out: '#2b7bd0' }; // validado para daltonismo

  // qualquer erro inesperado (internet, permissão) aparece como aviso na tela
  window.addEventListener('unhandledrejection', e => UI.toast((e.reason && e.reason.message) || 'Algo deu errado. Tente de novo.', 'error'));

  /* ---------- sessão ---------- */
  const AUTH = 'il_auth';
  const session = {
    ok() { try { return sessionStorage.getItem(AUTH) === '1'; } catch { return false; } },
    set() { try { sessionStorage.setItem(AUTH, '1'); } catch { } },
    end() { try { sessionStorage.removeItem(AUTH); } catch { } },
  };

  const VIEWS = [
    ['inicio', 'Início', I.home, vInicio],
    ['agenda', 'Agenda', I.cal, vAgenda],
    ['financeiro', 'Financeiro', I.money, vFinanceiro],
    ['materiais', 'Materiais', I.box, vMateriais],
    ['servicos', 'Serviços', I.list, vServicos],
    ['ajustes', 'Ajustes', I.gear, vAjustes],
  ];

  const st = {
    date: U.todayStr(),
    showCancelled: false,
    search: '',
    fin: { period: 'mes', from: '', to: '', cat: '', pay: '' },
    finAll: false,
    matTab: 'estoque',
    buyPeriod: '3m',
  };
  let apptIndex = {};

  /* ---------- utilidades ---------- */
  const today = () => U.todayStr();
  const sum = (arr, f) => arr.reduce((s, x) => s + (Number(f(x)) || 0), 0);
  const firstName = s => String(s || '').trim().split(/\s+/)[0];
  const monthStart = d => d.slice(0, 8) + '01';
  const monthEnd = d => { const x = U.parseDate(monthStart(d)); x.setMonth(x.getMonth() + 1); x.setDate(0); return U.dateStr(x); };
  const shiftMonth = (d, n) => { const x = U.parseDate(monthStart(d)); x.setMonth(x.getMonth() + n); return U.dateStr(x); };
  const parseMoney = s => {
    let t = String(s ?? '').replace(/[^\d,.-]/g, '');
    if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
    return Number(t) || 0;
  };
  const daysBetween = (a, b) => Math.round((U.parseDate(b) - U.parseDate(a)) / 864e5) + 1;
  const MONTH_ABBR = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

  function kpi(label, value, help = '', cls = '', extra = '', href = '') {
    const tag = href ? 'a' : 'div';
    return `<${tag} class="kpi ${cls}" ${href ? `href="${href}"` : ''}>
      <span class="kpi-label">${label}</span>
      <span class="kpi-value">${value}</span>
      ${extra}
      ${help ? `<span class="kpi-help">${help}</span>` : ''}
    </${tag}>`;
  }
  function delta(cur, prev, label = 'que no período anterior', lowerIsBetter = false) {
    if (!prev) return '';
    const p = Math.round(((cur - prev) / prev) * 100);
    if (p === 0) return `<span class="kpi-delta">= igual ${label}</span>`;
    const good = lowerIsBetter ? p < 0 : p > 0;
    return `<span class="kpi-delta ${good ? 'up' : 'down'}">${p > 0 ? '▲' : '▼'} ${Math.abs(p)}% ${p > 0 ? 'a mais' : 'a menos'} ${label}</span>`;
  }

  /* ---------- entrada ---------- */
  let inApp = false;
  let signupMode = false;

  async function boot() {
    if (Store.remote) return bootRemote();
    const s = await Store.settings();
    $$('[data-studio]').forEach(el => el.textContent = s.studio);
    if (session.ok()) showApp(); else showLogin();
  }

  /* login com e-mail e senha (banco online) */
  async function bootRemote() {
    $$('.remote-only').forEach(el => el.classList.remove('hidden'));
    const pin = $('#pin');
    pin.classList.remove('pin');
    pin.removeAttribute('inputmode');
    pin.placeholder = 'Sua senha';
    // veio pelo link "esqueci a senha": depois de entrar, abre a tela de nova senha
    let recovering = /type=recovery/.test(location.hash);
    const askNewPassword = () => { if (recovering) { recovering = false; setTimeout(newPasswordModal, 300); } };
    Store.auth.onRecovery(() => { recovering = true; if (inApp) askNewPassword(); });
    showLogin();
    try {
      if (await Store.auth.session() && await enterRemote()) askNewPassword();
      else if (recovering) UI.toast('O link para criar nova senha expirou ou já foi usado. Peça outro em "Esqueci a senha".', 'error');
    } catch (err) { UI.toast(err.message, 'error'); }
  }
  async function enterRemote() {
    try {
      if (!await Store.auth.isAdmin()) {
        await Store.auth.signOut();
        UI.toast('Esta conta não tem acesso ao painel.', 'error');
        return false;
      }
      await Store.init({ admin: true });
      const s = await Store.settings();
      $$('[data-studio]').forEach(el => el.textContent = s.studio);
      showApp();
      return true;
    } catch (err) { UI.toast(err.message, 'error'); return false; }
  }
  function setSignup(on) {
    signupMode = on;
    $('#login-btn').textContent = on ? 'Criar minha conta' : 'Entrar';
    $('#to-signup').textContent = on ? 'Já tenho conta. Entrar' : 'Primeiro acesso? Criar conta';
    $('#pin').autocomplete = on ? 'new-password' : 'current-password';
    $('#pin').placeholder = on ? 'Mínimo 8 caracteres' : 'Sua senha';
  }
  $('#to-signup').onclick = () => setSignup(!signupMode);
  $('#forgot').onclick = async () => {
    const email = $('#email').value.trim();
    if (!email) { UI.toast('Digite seu e-mail primeiro.', 'error'); $('#email').focus(); return; }
    try { await Store.auth.resetPassword(email); UI.toast('Enviamos um link para criar uma nova senha no seu e-mail.'); }
    catch (err) { UI.toast(err.message, 'error'); }
  };
  function newPasswordModal() {
    UI.modal('Criar nova senha', 'Digite a senha que você vai usar daqui pra frente.', (body, close) => {
      body.innerHTML = `<div class="field"><label for="np">Nova senha</label><input class="input" id="np" type="password" autocomplete="new-password" placeholder="Mínimo 8 caracteres"></div>
        <div class="modal-actions"><button class="btn btn-primary" id="np-ok">Salvar senha</button></div>`;
      $('#np-ok', body).onclick = async () => {
        const pw = $('#np', body).value;
        if (pw.length < 8) return UI.toast('A senha precisa ter pelo menos 8 caracteres.', 'error');
        try { await Store.auth.updatePassword(pw); close(); UI.toast('Senha alterada!'); }
        catch (err) { UI.toast(err.message, 'error'); }
      };
    });
  }

  function showLogin() {
    inApp = false;
    $('#app').classList.add('hidden');
    $('#login').classList.remove('hidden');
    $('#pin').value = '';
    setTimeout(() => (Store.remote && !$('#email').value ? $('#email') : $('#pin')).focus(), 50);
  }
  $('#login-form').addEventListener('submit', async e => {
    e.preventDefault();
    if (Store.remote) {
      const email = $('#email').value.trim(), pw = $('#pin').value;
      if (!email || !pw) return UI.toast('Preencha e-mail e senha.', 'error');
      const btn = $('#login-btn');
      btn.disabled = true;
      try {
        if (signupMode) {
          if (pw.length < 8) throw new Error('A senha precisa ter pelo menos 8 caracteres.');
          const logged = await Store.auth.signUp(email, pw);
          if (!logged) { UI.toast('Conta criada! Confirme pelo link que enviamos para seu e-mail e depois entre aqui.'); setSignup(false); return; }
        } else await Store.auth.signIn(email, pw);
        await enterRemote();
      } catch (err) { UI.toast(err.message, 'error'); }
      finally { btn.disabled = false; }
      return;
    }
    const s = await Store.settings();
    if ($('#pin').value === String(s.pin)) { session.set(); showApp(); }
    else { UI.toast('Senha incorreta.', 'error'); $('#pin').select(); }
  });
  $('#logout').innerHTML = `${I.out} Sair`;
  $('#logout').onclick = async () => {
    if (Store.remote) await Store.auth.signOut(); else session.end();
    showLogin();
  };

  function showApp() {
    inApp = true;
    $('#login').classList.add('hidden');
    $('#app').classList.remove('hidden');
    render();
  }

  /* ---------- navegação ---------- */
  window.addEventListener('hashchange', () => { window.scrollTo(0, 0); if (inApp) render(); });
  Store.onChange(() => { if (inApp) render(); });
  let resizeT;
  window.addEventListener('resize', () => { clearTimeout(resizeT); resizeT = setTimeout(() => $$('[data-chart]').forEach(el => el._draw && el._draw()), 150); });

  async function render() {
    const name = (location.hash.slice(1) || 'inicio').split('?')[0];
    const view = VIEWS.find(v => v[0] === name) || VIEWS[0];
    const todayCount = (await Store.appointments({ date: today() })).filter(a => a.status === 'agendado').length;
    $('#nav').innerHTML = VIEWS.map(([id, label, icon]) =>
      `<a href="#${id}" class="${id === view[0] ? 'active' : ''}">${icon}<span>${label}</span>${id === 'agenda' && todayCount ? `<span class="badge">${todayCount}</span>` : ''}</a>`).join('');
    const db = await Store.get();
    const banner = $('#demo-banner');
    banner.classList.toggle('hidden', !db.demo);
    if (db.demo) {
      banner.innerHTML = `${I.alert}<span>Você está vendo <strong>dados de exemplo</strong> para conhecer o painel. Quando for usar de verdade, apague-os.</span><button class="btn btn-sm" id="clear-demo">Apagar exemplos</button>`;
      $('#clear-demo').onclick = clearDemo;
    }
    await view[3]();
  }

  async function clearDemo() {
    if (!await UI.confirm('Apagar dados de exemplo?', 'Os agendamentos, materiais e despesas de exemplo serão removidos. Seus serviços e ajustes continuam.', 'Apagar exemplos', true)) return;
    await Store.clearDemo();
    UI.toast('Exemplos apagados. Tudo pronto para começar!');
    render();
  }

  /* =========================================================
     Cartão de agendamento + ações
     ========================================================= */
  function apptCard(a, { showDate = false } = {}) {
    apptIndex[a.id] = a;
    const end = U.toTime(U.toMin(a.time) + a.duration);
    const wa = U.waLink(a.phone, `Olá, ${firstName(a.client)}! Passando para confirmar seu horário de ${a.serviceName} ${U.longDate(a.date).toLowerCase()} às ${a.time}. Até lá!`);
    let actions = '';
    if (a.status === 'agendado') {
      actions = `
        <button class="btn btn-ok btn-sm" data-act="done" data-id="${a.id}">${I.check} Concluir</button>
        <button class="btn btn-sm" data-act="move" data-id="${a.id}">${I.move} Reagendar</button>
        <button class="btn btn-sm btn-danger" data-act="cancel" data-id="${a.id}">${I.x} Cancelar</button>
        <a class="btn btn-sm btn-ghost" href="${wa}" target="_blank" rel="noopener" title="Mandar mensagem">${I.wa} WhatsApp</a>
        <button class="btn btn-sm btn-ghost" data-act="noshow" data-id="${a.id}" title="Marcar que a cliente não veio">Não veio</button>`;
    } else if (a.status === 'concluido') {
      actions = `<span class="tiny muted" style="align-self:center">Recebido ${U.money(a.paid)} · ${PAY[a.payment] || '—'}</span>
        <button class="btn btn-sm btn-ghost" data-act="undo" data-id="${a.id}">Desfazer</button>`;
    } else {
      actions = `<button class="btn btn-sm" data-act="move" data-id="${a.id}">${I.move} Reagendar</button>
        <button class="btn btn-sm btn-ghost btn-danger" data-act="delete" data-id="${a.id}">${I.trash} Excluir</button>`;
    }
    return `<div class="appt ${a.status}">
      <div class="appt-time">${showDate ? `<span class="appt-date">${U.shortDate(a.date)}</span><br>` : ''}${a.time}<small>até ${end}</small></div>
      <div>
        <div class="appt-who">${U.esc(a.client)}</div>
        <div class="appt-what">${U.esc(a.serviceName)}</div>
        <div class="appt-meta"><span>${U.esc(a.phone)}</span>${a.source === 'site' ? '<span>Agendou pelo site</span>' : ''}${a.notes ? `<span>“${U.esc(a.notes)}”</span>` : ''}</div>
      </div>
      <div class="appt-side"><span class="appt-price">${U.money(a.status === 'concluido' ? a.paid : a.price)}</span><span class="tag ${a.status}">${Store.STATUS[a.status]}</span></div>
      <div class="appt-actions">${actions}</div>
    </div>`;
  }

  function blockCard(b) {
    const whole = b.start === '00:00' && b.end >= '23:59';
    return `<div class="appt block">
      <div class="appt-time">${whole ? 'Dia todo' : b.start}${whole ? '' : `<small>até ${b.end}</small>`}</div>
      <div><div class="appt-who">${I.ban} Horário bloqueado</div><div class="appt-what">${U.esc(b.reason || 'Sem motivo informado')}</div></div>
      <div class="appt-side"><button class="btn btn-sm btn-ghost" data-act="unblock" data-id="${b.id}">Liberar</button></div>
    </div>`;
  }

  document.addEventListener('click', async e => {
    const btn = e.target.closest('[data-act]');
    if (!btn || !$('#view').contains(btn)) return;
    const id = btn.dataset.id;
    const a = apptIndex[id];
    switch (btn.dataset.act) {
      case 'done': return doneModal(a);
      case 'move': return moveModal(a);
      case 'cancel': return cancelModal(a);
      case 'noshow':
        await Store.updateAppointment(id, { status: 'faltou' });
        UI.toast('Marcado como “não compareceu”.'); return render();
      case 'undo':
        await Store.updateAppointment(id, { status: 'agendado', paid: 0, payment: '' });
        UI.toast('Voltou para “agendado”.'); return render();
      case 'delete':
        if (!await UI.confirm('Excluir agendamento?', 'Ele some da agenda e dos relatórios.', 'Excluir', true)) return;
        await Store.removeAppointment(id); UI.toast('Agendamento excluído.'); return render();
      case 'unblock':
        await Store.removeBlock(id); UI.toast('Horário liberado.'); return render();
    }
  });

  function choiceGroup(root, onPick) {
    $$('.choice', root).forEach(c => c.onclick = () => {
      $$('.choice', root).forEach(x => x.classList.remove('on'));
      c.classList.add('on');
      onPick(c.dataset.v);
    });
  }

  function doneModal(a) {
    UI.modal('Concluir atendimento', `${a.client} · ${a.serviceName}`, (body, close) => {
      let pay = 'pix';
      body.innerHTML = `
        <div class="field"><label for="m-val">Valor recebido (R$)</label>
          <input class="input" id="m-val" inputmode="decimal" value="${String(a.price).replace('.', ',')}">
          <span class="hint">Pode mudar se deu desconto ou cobrou a mais.</span></div>
        <div class="field"><label>Como a cliente pagou?</label>
          <div class="choices">${Object.entries(PAY).map(([k, v]) => `<button type="button" class="choice ${k === pay ? 'on' : ''}" data-v="${k}">${v}</button>`).join('')}</div></div>
        <div class="modal-actions"><button class="btn btn-ghost" data-x>Voltar</button><button class="btn btn-ok" id="m-ok">${I.check} Confirmar recebimento</button></div>`;
      choiceGroup(body, v => pay = v);
      $('[data-x]', body).onclick = close;
      $('#m-ok', body).onclick = async () => {
        await Store.updateAppointment(a.id, { status: 'concluido', paid: parseMoney($('#m-val', body).value), payment: pay });
        close(); UI.toast('Atendimento concluído e valor registrado!'); render();
      };
    });
  }

  function cancelModal(a) {
    UI.modal('Cancelar agendamento?', `${a.client} · ${a.serviceName} · ${U.shortDate(a.date)} às ${a.time}`, (body, close) => {
      body.innerHTML = `
        <p class="muted" style="margin-top:0">O horário fica livre de novo para outras clientes agendarem.</p>
        <label class="toggle-line"><input type="checkbox" id="m-wa" ${a.phone ? 'checked' : ''}> Abrir WhatsApp para avisar a cliente</label>
        <div class="modal-actions"><button class="btn btn-ghost" data-x>Voltar</button><button class="btn btn-danger" id="m-ok">${I.x} Cancelar agendamento</button></div>`;
      $('[data-x]', body).onclick = close;
      $('#m-ok', body).onclick = async () => {
        await Store.updateAppointment(a.id, { status: 'cancelado' });
        if ($('#m-wa', body).checked) window.open(U.waLink(a.phone, `Olá, ${firstName(a.client)}! Seu horário de ${a.serviceName} em ${U.longDate(a.date).toLowerCase()} às ${a.time} foi cancelado. Quer marcar outro dia?`), '_blank');
        close(); UI.toast('Agendamento cancelado. Horário liberado.'); render();
      };
    });
  }

  function slotChips(slots, selected) {
    if (!slots.length) return '<p class="empty">Nenhum horário livre neste dia.</p>';
    return `<div class="slots">${slots.map(t => `<button type="button" class="slot ${t === selected ? 'selected' : ''}" data-t="${t}">${t}</button>`).join('')}</div>`;
  }
  async function adminSlots(date, duration, excludeId) {
    let s = await Store.slots(date, duration, { admin: true, excludeId });
    if (date === today()) { const now = U.nowMin(); s = s.filter(t => U.toMin(t) >= now); }
    if (date < today()) s = [];
    return s;
  }

  function moveModal(a) {
    UI.modal('Reagendar', `${a.client} · ${a.serviceName} (${U.dur(a.duration)})`, async (body, close) => {
      const sel = { date: null, time: null };
      body.innerHTML = `
        <div id="m-cal"></div>
        <h4 id="m-day" style="margin:1.25rem 0 .75rem;font-weight:500"></h4>
        <div id="m-slots"></div>
        <label class="toggle-line" style="margin-top:1rem"><input type="checkbox" id="m-wa" ${a.phone ? 'checked' : ''}> Abrir WhatsApp para avisar a cliente</label>
        <div class="modal-actions"><button class="btn btn-ghost" data-x>Voltar</button><button class="btn btn-primary" id="m-ok" disabled>Salvar novo horário</button></div>`;
      const ok = $('#m-ok', body);
      $('[data-x]', body).onclick = close;
      const pick = async d => {
        sel.date = d; sel.time = null; ok.disabled = true;
        $('#m-day', body).textContent = U.longDate(d);
        $('#m-slots', body).innerHTML = slotChips(await adminSlots(d, a.duration, a.id));
        $$('.slot', body).forEach(b => b.onclick = () => {
          $$('.slot', body).forEach(x => x.classList.remove('selected'));
          b.classList.add('selected'); sel.time = b.dataset.t; ok.disabled = false;
        });
      };
      const start = a.date >= today() ? a.date : today();
      await UI.calendar($('#m-cal', body), {
        selected: start, minMonth: today(),
        enabled: async d => (await adminSlots(d, a.duration, a.id)).length > 0,
        onSelect: pick,
      });
      pick(start);
      ok.onclick = async () => {
        try {
          await Store.reschedule(a.id, sel.date, sel.time);
          if ($('#m-wa', body).checked) window.open(U.waLink(a.phone, `Olá, ${firstName(a.client)}! Seu horário de ${a.serviceName} foi remarcado para ${U.longDate(sel.date).toLowerCase()} às ${sel.time}. Qualquer coisa é só chamar!`), '_blank');
          close(); UI.toast('Horário remarcado!'); st.date = sel.date; render();
        } catch (err) { UI.toast(err.message, 'error'); }
      };
    });
  }

  async function newApptModal(date = st.date) {
    const services = await Store.services({ all: true });
    UI.modal('Novo agendamento', 'Para quando a cliente marcar por telefone, WhatsApp ou pessoalmente.', (body, close) => {
      const sel = { time: null };
      body.innerHTML = `
        <div class="field"><label for="n-svc">Serviço</label>
          <select class="input" id="n-svc">${Store.CATEGORIES.map(c => `<optgroup label="${c.name}">${services.filter(s => s.cat === c.id).map(s => `<option value="${s.id}">${U.esc(s.name)} — ${U.money(s.price)}</option>`).join('')}</optgroup>`).join('')}</select></div>
        <div class="row">
          <div class="field"><label for="n-date">Dia</label><input class="input" type="date" id="n-date" value="${date < today() ? today() : date}"></div>
          <div class="field"><label for="n-price">Valor (R$)</label><input class="input" id="n-price" inputmode="decimal"></div>
        </div>
        <div class="field"><label>Horário livre</label><div id="n-slots"></div>
          <span class="hint">Ou digite outro horário: <input type="time" id="n-time" class="input" style="width:auto;display:inline-block;padding:.3rem .5rem"></span></div>
        <div class="field"><label for="n-name">Nome da cliente</label><input class="input" id="n-name"></div>
        <div class="field"><label for="n-phone">WhatsApp</label><input class="input" id="n-phone" inputmode="tel" placeholder="(00) 00000-0000"></div>
        <div class="field"><label for="n-notes">Observação</label><input class="input" id="n-notes"></div>
        <div class="modal-actions"><button class="btn btn-ghost" data-x>Voltar</button><button class="btn btn-primary" id="n-ok">Agendar</button></div>`;
      const svc = () => services.find(s => s.id === $('#n-svc', body).value);
      const refresh = async () => {
        $('#n-price', body).value = String(svc().price).replace('.', ',');
        sel.time = null;
        const slots = await adminSlots($('#n-date', body).value, svc().duration);
        $('#n-slots', body).innerHTML = slotChips(slots);
        $$('#n-slots .slot', body).forEach(b => b.onclick = () => {
          $$('#n-slots .slot', body).forEach(x => x.classList.remove('selected'));
          b.classList.add('selected'); sel.time = b.dataset.t; $('#n-time', body).value = '';
        });
      };
      $('#n-svc', body).onchange = refresh;
      $('#n-date', body).onchange = refresh;
      $('#n-time', body).oninput = () => { sel.time = null; $$('#n-slots .slot', body).forEach(x => x.classList.remove('selected')); };
      $('#n-phone', body).oninput = e => e.target.value = U.phoneMask(e.target.value);
      $('[data-x]', body).onclick = close;
      refresh();
      $('#n-ok', body).onclick = async () => {
        const time = sel.time || $('#n-time', body).value;
        const client = $('#n-name', body).value.trim();
        if (!time) return UI.toast('Escolha um horário.', 'error');
        if (!client) return UI.toast('Digite o nome da cliente.', 'error');
        try {
          const appt = await Store.book({
            serviceId: svc().id, date: $('#n-date', body).value, time, client,
            phone: $('#n-phone', body).value, notes: $('#n-notes', body).value, price: parseMoney($('#n-price', body).value),
          }, { admin: true });
          close(); UI.toast('Agendado!'); st.date = appt.date; render();
        } catch (err) { UI.toast(err.message, 'error'); }
      };
    });
  }

  function blockModal(date = st.date) {
    UI.modal('Bloquear horário', 'Para folgas, compromissos ou cursos. Ninguém consegue agendar nesse período.', (body, close) => {
      body.innerHTML = `
        <div class="field"><label for="b-date">Dia</label><input class="input" type="date" id="b-date" value="${date < today() ? today() : date}"></div>
        <label class="toggle-line" style="margin-bottom:1rem"><input type="checkbox" id="b-all"> Bloquear o dia inteiro</label>
        <div class="row" id="b-times">
          <div class="field"><label for="b-start">Das</label><input class="input" type="time" id="b-start" value="12:00"></div>
          <div class="field"><label for="b-end">Até</label><input class="input" type="time" id="b-end" value="14:00"></div>
        </div>
        <div class="field"><label for="b-reason">Motivo (só você vê)</label><input class="input" id="b-reason" placeholder="Ex.: médico, folga, curso"></div>
        <div class="modal-actions"><button class="btn btn-ghost" data-x>Voltar</button><button class="btn btn-primary" id="b-ok">${I.ban} Bloquear</button></div>`;
      $('#b-all', body).onchange = e => $('#b-times', body).classList.toggle('hidden', e.target.checked);
      $('[data-x]', body).onclick = close;
      $('#b-ok', body).onclick = async () => {
        const all = $('#b-all', body).checked;
        const start = all ? '00:00' : $('#b-start', body).value;
        const end = all ? '23:59' : $('#b-end', body).value;
        if (!all && (!start || !end || end <= start)) return UI.toast('Confira os horários.', 'error');
        await Store.addBlock({ date: $('#b-date', body).value, start, end, reason: $('#b-reason', body).value.trim() });
        close(); UI.toast('Horário bloqueado.'); st.date = $('#b-date', body).value; render();
      };
    });
  }

  /* =========================================================
     INÍCIO
     ========================================================= */
  async function vInicio() {
    const t = today();
    const s = await Store.settings();
    const all = await Store.appointments();
    const mStart = monthStart(t);
    const monthDone = all.filter(a => a.date >= mStart && a.date <= t && a.status === 'concluido');
    const prevStart = shiftMonth(t, -1);
    const sameDayPrev = U.addDays(prevStart, Number(t.slice(8)) - 1);
    const prevDone = all.filter(a => a.date >= prevStart && a.date <= sameDayPrev && a.status === 'concluido');
    const todays = all.filter(a => a.date === t && a.status !== 'cancelado');
    const next7 = all.filter(a => a.date > t && a.date <= U.addDays(t, 7) && a.status === 'agendado');
    const upcoming = all.filter(a => a.date > t && a.status === 'agendado').slice(0, 6);
    const mats = await Store.materials();
    const low = mats.filter(m => Number(m.stock) <= Number(m.min));
    const h = new Date().getHours();
    const hello = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
    const rev = sum(monthDone, a => a.paid);

    $('#view').innerHTML = `
      <div class="head">
        <div><span class="script">${hello},</span><h1>${U.esc(firstName(s.studio))}</h1><p>${U.longDate(t)}</p></div>
        <div class="head-actions">
          <button class="btn btn-primary" id="q-new">${I.plus} Novo agendamento</button>
        </div>
      </div>
      <div class="kpis">
        ${kpi('Faturamento do mês', U.money(rev), 'Soma dos atendimentos já realizados', 'hero-kpi', delta(rev, sum(prevDone, a => a.paid), 'que no mesmo período do mês passado'))}
        ${kpi('Atendimentos hoje', todays.length, todays.length ? `Previsto: ${U.money(sum(todays, a => a.status === 'concluido' ? a.paid : a.price))}` : 'Dia livre')}
        ${kpi('Próximos 7 dias', next7.length, `${U.money(sum(next7, a => a.price))} para receber`)}
        ${kpi('Materiais acabando', low.length, low.length ? 'Toque para ver a lista' : 'Estoque em dia', low.length ? 'warn' : '', '', '#materiais')}
      </div>
      <div class="quick">
        <button class="btn btn-sm" id="q-block">${I.ban} Bloquear horário</button>
        <button class="btn btn-sm" id="q-buy">${I.box} Registrar compra</button>
        <a class="btn btn-sm" href="#financeiro">${I.money} Ver financeiro</a>
      </div>

      <h2 class="section-title">Agenda de hoje <a href="#agenda">Abrir agenda ›</a></h2>
      <div class="appts">${todays.length ? todays.map(a => apptCard(a)).join('') : '<div class="card empty">Nenhum atendimento marcado para hoje.</div>'}</div>

      <h2 class="section-title">Próximos agendamentos</h2>
      <div class="appts">${upcoming.length ? upcoming.map(a => apptCard(a, { showDate: true })).join('') : '<div class="card empty">Nenhum agendamento futuro ainda.</div>'}</div>`;

    $('#q-new').onclick = () => newApptModal(t);
    $('#q-block').onclick = () => blockModal(t);
    $('#q-buy').onclick = () => purchaseModal();
  }

  /* =========================================================
     AGENDA
     ========================================================= */
  async function vAgenda() {
    const d = st.date;
    const dow = (U.weekday(d) + 6) % 7; // segunda = 0
    const weekStart = U.addDays(d, -dow);
    const s = await Store.settings();
    const weekAppts = await Store.appointments({ from: weekStart, to: U.addDays(weekStart, 6) });
    const dayAppts = weekAppts.filter(a => a.date === d && (st.showCancelled || a.status !== 'cancelado'));
    const blocks = await Store.blocks(d);
    const active = dayAppts.filter(a => a.status !== 'cancelado' && a.status !== 'faltou');
    const free = await adminSlots(d, Number(s.step) || 30);
    const wk = U.parseDate(weekStart);

    const items = [...dayAppts.map(a => ({ t: a.time, html: apptCard(a) })), ...blocks.map(b => ({ t: b.start, html: blockCard(b) }))]
      .sort((x, y) => x.t.localeCompare(y.t));
    const hours = s.hours[U.weekday(d)];

    $('#view').innerHTML = `
      <div class="head">
        <div><h1>Agenda</h1><p>Toque em um dia para ver os atendimentos.</p></div>
        <div class="head-actions">
          <button class="btn" id="a-block">${I.ban} Bloquear horário</button>
          <button class="btn btn-primary" id="a-new">${I.plus} Novo agendamento</button>
        </div>
      </div>
      <div class="week-nav">
        <button class="btn btn-sm" data-w="-7" aria-label="Semana anterior">‹</button>
        <button class="btn btn-sm" data-w="0">Hoje</button>
        <button class="btn btn-sm" data-w="7" aria-label="Próxima semana">›</button>
        <span class="label">${U.MONTHS[wk.getMonth()]} ${wk.getFullYear()}</span>
        <input type="date" class="input" id="a-jump" value="${d}" style="width:auto;padding:.35rem .6rem;font-size:.85rem" aria-label="Ir para a data">
        <div class="search" style="margin-left:auto"><input class="input" id="a-search" placeholder="Buscar cliente…" value="${U.esc(st.search)}"></div>
      </div>
      <div id="a-results"></div>
      <div id="a-day">
        <div class="week">${Array.from({ length: 7 }, (_, i) => {
          const ds = U.addDays(weekStart, i);
          const n = weekAppts.filter(a => a.date === ds && a.status !== 'cancelado' && a.status !== 'faltou').length;
          const closed = !s.hours[U.weekday(ds)].on;
          return `<button class="wd ${ds === d ? 'sel' : ''} ${ds === today() ? 'today' : ''} ${closed ? 'closed' : ''}" data-d="${ds}">
            <small>${U.WEEKDAYS_SHORT[U.weekday(ds)]}</small><strong>${Number(ds.slice(8))}</strong>
            <span class="count">${closed ? 'fechado' : n ? `${n} ${n > 1 ? 'clientes' : 'cliente'}` : ''}</span></button>`;
        }).join('')}</div>
        <div class="day-info">
          <div><h2>${U.longDate(d)}</h2>
            <span class="tiny muted">${hours.on ? `Atendimento das ${hours.open} às ${hours.close}` : 'Dia sem atendimento'} · ${active.length} ${active.length === 1 ? 'atendimento' : 'atendimentos'} · ${U.money(sum(active, a => a.status === 'concluido' ? a.paid : a.status === 'agendado' ? a.price : 0))}${hours.on && d >= today() ? ` · ${free.length} horários livres` : ''}</span></div>
          <label class="toggle-line"><input type="checkbox" id="a-cancel" ${st.showCancelled ? 'checked' : ''}> Mostrar cancelados</label>
        </div>
        <div class="appts">${items.length ? items.map(x => x.html).join('') : `<div class="card empty">Nenhum atendimento neste dia.<br><br><button class="btn btn-sm btn-primary" id="a-new2">${I.plus} Agendar alguém</button></div>`}</div>
      </div>`;

    $$('[data-w]').forEach(b => b.onclick = () => { st.date = b.dataset.w === '0' ? today() : U.addDays(st.date, Number(b.dataset.w)); render(); });
    $$('.wd').forEach(b => b.onclick = () => { st.date = b.dataset.d; render(); });
    $('#a-jump').onchange = e => { if (e.target.value) { st.date = e.target.value; render(); } };
    $('#a-cancel').onchange = e => { st.showCancelled = e.target.checked; render(); };
    $('#a-new').onclick = () => newApptModal(d);
    $('#a-block').onclick = () => blockModal(d);
    if ($('#a-new2')) $('#a-new2').onclick = () => newApptModal(d);
    const search = $('#a-search');
    search.oninput = () => { st.search = search.value; renderSearch(); };
    renderSearch();
  }

  async function renderSearch() {
    const q = st.search.trim().toLowerCase();
    const box = $('#a-results'), day = $('#a-day');
    if (!q) { box.innerHTML = ''; day.classList.remove('hidden'); return; }
    day.classList.add('hidden');
    const qd = U.onlyDigits(q);
    const res = (await Store.appointments())
      .filter(a => a.client.toLowerCase().includes(q) || (qd.length >= 3 && U.onlyDigits(a.phone).includes(qd)))
      .reverse().slice(0, 30);
    box.innerHTML = `<h2 class="section-title" style="margin-top:0">${res.length} resultado${res.length === 1 ? '' : 's'} para “${U.esc(st.search)}”</h2>
      <div class="appts">${res.map(a => apptCard(a, { showDate: true })).join('') || '<div class="card empty">Nenhuma cliente encontrada.</div>'}</div>`;
  }

  /* =========================================================
     FINANCEIRO
     ========================================================= */
  function periodRange() {
    const t = today(), f = st.fin;
    const y = t.slice(0, 4);
    switch (f.period) {
      case 'mes': { const p = shiftMonth(t, -1); const end = U.addDays(p, Number(t.slice(8)) - 1); return [monthStart(t), monthEnd(t), [p, end > monthEnd(p) ? monthEnd(p) : end], 'que no mesmo período do mês passado']; }
      case 'mespassado': { const p = shiftMonth(t, -1); const pp = shiftMonth(t, -2); return [p, monthEnd(p), [pp, monthEnd(pp)]]; }
      case '3m': return [shiftMonth(t, -2), monthEnd(t), [shiftMonth(t, -5), monthEnd(shiftMonth(t, -3))]];
      case 'ano': return [`${y}-01-01`, `${y}-12-31`, [`${y - 1}-01-01`, `${y - 1}` + t.slice(4)], 'que no mesmo período do ano passado'];
      case 'custom': {
        const from = f.from || monthStart(t), to = f.to || t;
        const len = daysBetween(from, to);
        return [from, to, [U.addDays(from, -len), U.addDays(from, -1)]];
      }
    }
  }

  async function finData(from, to) {
    const f = st.fin;
    const appts = (await Store.appointments({ from, to })).filter(a => (!f.cat || a.cat === f.cat));
    const done = appts.filter(a => a.status === 'concluido' && (!f.pay || a.payment === f.pay));
    const purchases = (await Store.purchases()).filter(p => p.date >= from && p.date <= to);
    const expenses = (await Store.expenses()).filter(e => e.date >= from && e.date <= to);
    const income = sum(done, a => a.paid);
    const out = sum(purchases, p => p.total) + sum(expenses, e => e.value);
    const past = appts.filter(a => a.date <= today() && a.status !== 'agendado');
    const lost = past.filter(a => a.status === 'cancelado' || a.status === 'faltou');
    const future = appts.filter(a => a.status === 'agendado' && a.date >= today());
    return { appts, done, purchases, expenses, income, out, profit: income - out, past, lost, future };
  }

  async function vFinanceiro() {
    const [from, to, [pFrom, pTo], cmp = 'que no período anterior'] = periodRange();
    const d = await finData(from, to);
    const p = await finData(pFrom, pTo);
    const f = st.fin;
    const ticket = d.done.length ? d.income / d.done.length : 0;
    const lostRate = d.past.length ? Math.round(d.lost.length / d.past.length * 100) : 0;
    const filtered = f.cat || f.pay;

    const chips = [['mes', 'Este mês'], ['mespassado', 'Mês passado'], ['3m', 'Últimos 3 meses'], ['ano', 'Este ano'], ['custom', 'Escolher datas']];
    $('#view').innerHTML = `
      <div class="head">
        <div><h1>Financeiro</h1><p>${U.shortDate(from)}/${from.slice(0, 4)} a ${U.shortDate(to)}/${to.slice(0, 4)}</p></div>
        <div class="head-actions">
          <button class="btn" id="f-csv">Baixar planilha</button>
          <button class="btn btn-primary" id="f-exp">${I.plus} Lançar despesa</button>
        </div>
      </div>
      <div class="filters">
        <div class="chips">${chips.map(([k, v]) => `<button class="chip ${f.period === k ? 'on' : ''}" data-p="${k}">${v}</button>`).join('')}</div>
        <div class="custom ${f.period === 'custom' ? '' : 'hidden'}">
          <input type="date" class="input" id="f-from" value="${from}"> até <input type="date" class="input" id="f-to" value="${to}">
        </div>
        <select class="input" id="f-cat"><option value="">Todos os serviços</option>${Store.CATEGORIES.map(c => `<option value="${c.id}" ${f.cat === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}</select>
        <select class="input" id="f-pay"><option value="">Todas as formas de pagamento</option>${Object.entries(PAY).map(([k, v]) => `<option value="${k}" ${f.pay === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
      </div>
      ${filtered ? '<p class="filter-note">Os filtros de serviço e pagamento valem para as entradas. As saídas (compras e despesas) aparecem sempre completas.</p>' : ''}

      <div class="kpis">
        ${kpi('Entrou', U.money(d.income), 'Dinheiro recebido dos atendimentos', 'hero-kpi', delta(d.income, p.income, cmp))}
        ${kpi('Saiu', U.money(d.out), 'Compras de material e outras despesas', '', delta(d.out, p.out, cmp, true))}
        ${kpi(d.profit >= 0 ? `${I.check} Sobrou (lucro)` : `${I.alert} Faltou (prejuízo)`, U.money(d.profit), 'Entrou menos o que saiu', d.profit >= 0 ? 'good' : 'bad')}
        ${kpi('Atendimentos realizados', d.done.length, `Cada cliente gastou em média ${U.money(ticket)}`, '', delta(d.done.length, p.done.length, cmp))}
        ${kpi('Ainda vai entrar', U.money(sum(d.future, a => a.price)), `${d.future.length} agendamento${d.future.length === 1 ? '' : 's'} marcado${d.future.length === 1 ? '' : 's'} no período`)}
        ${kpi('Faltas e cancelamentos', `${lostRate}%`, `${d.lost.length} de ${d.past.length} horários marcados`, lostRate >= 20 ? 'warn' : '')}
      </div>

      <div class="charts">
        <div class="card chart-card">
          <h3>Entrou × saiu</h3>
          <p class="chart-sub">${daysBetween(from, to) <= 62 ? 'Por semana' : 'Por mês'} · passe o dedo ou o mouse nas barras</p>
          <div class="legend"><span><i style="background:${SERIES.in}"></i>Entrou</span><span><i style="background:${SERIES.out}"></i>Saiu</span></div>
          <div class="colchart" data-chart id="ch-flow"></div>
        </div>
        <div class="card chart-card">
          <h3>O que mais faturou</h3>
          <p class="chart-sub">Entradas por serviço</p>
          <div class="hbars" id="ch-svc"></div>
          <h3 style="margin-top:1.75rem">Como as clientes pagam</h3>
          <p class="chart-sub">Entradas por forma de pagamento</p>
          <div class="hbars" id="ch-pay"></div>
        </div>
      </div>

      <h2 class="section-title">Lançamentos <span class="tiny muted" id="f-count"></span></h2>
      <div class="table-wrap" id="f-table"></div>`;

    $$('[data-p]').forEach(b => b.onclick = () => { f.period = b.dataset.p; if (f.period === 'custom' && !f.from) { f.from = from; f.to = to; } render(); });
    $('#f-from').onchange = e => { f.from = e.target.value; render(); };
    $('#f-to').onchange = e => { f.to = e.target.value; render(); };
    $('#f-cat').onchange = e => { f.cat = e.target.value; render(); };
    $('#f-pay').onchange = e => { f.pay = e.target.value; render(); };
    $('#f-exp').onclick = () => expenseModal();

    /* gráfico de colunas */
    const buckets = makeBuckets(from, to);
    buckets.forEach(b => {
      b.in = sum(d.done.filter(a => a.date >= b.from && a.date <= b.to), a => a.paid);
      b.out = sum(d.purchases.filter(x => x.date >= b.from && x.date <= b.to), x => x.total) + sum(d.expenses.filter(x => x.date >= b.from && x.date <= b.to), x => x.value);
    });
    const el = $('#ch-flow');
    el._draw = () => drawColumns(el, buckets);
    el._draw();

    /* barras horizontais */
    const bySvc = {};
    d.done.forEach(a => { const k = a.serviceName; bySvc[k] = (bySvc[k] || 0) + Number(a.paid); });
    let svcRows = Object.entries(bySvc).sort((a, b) => b[1] - a[1]);
    if (svcRows.length > 9) { const rest = svcRows.slice(8); svcRows = svcRows.slice(0, 8).concat([['Outros', sum(rest, r => r[1])]]); }
    drawHBars($('#ch-svc'), svcRows);
    const byPay = {};
    d.done.forEach(a => { const k = PAY[a.payment] || 'Não informado'; byPay[k] = (byPay[k] || 0) + Number(a.paid); });
    drawHBars($('#ch-pay'), Object.entries(byPay).sort((a, b) => b[1] - a[1]));

    /* tabela de lançamentos */
    const rows = [
      ...d.done.map(a => ({ date: a.date, desc: `${a.serviceName} — ${a.client}`, kind: PAY[a.payment] || 'Atendimento', v: Number(a.paid) })),
      ...d.purchases.map(x => ({ date: x.date, desc: `Compra: ${x.materialName} (${x.qty})`, kind: 'Material', v: -Number(x.total), del: ['purchase', x.id] })),
      ...d.expenses.map(x => ({ date: x.date, desc: x.desc, kind: x.cat || 'Despesa', v: -Number(x.value), del: ['expense', x.id] })),
    ].sort((a, b) => b.date.localeCompare(a.date));
    const shown = st.finAll ? rows : rows.slice(0, 40);
    $('#f-count').textContent = `${rows.length} no período`;
    $('#f-table').innerHTML = rows.length ? `<table>
      <thead><tr><th>Data</th><th>Descrição</th><th>Tipo</th><th class="num">Valor</th><th></th></tr></thead>
      <tbody>${shown.map(r => `<tr>
        <td class="nowrap">${U.shortDate(r.date)}</td><td>${U.esc(r.desc)}</td><td class="muted">${U.esc(r.kind)}</td>
        <td class="num ${r.v >= 0 ? 'in' : 'out'}">${r.v >= 0 ? '+' : '−'} ${U.money(Math.abs(r.v))}</td>
        <td class="num">${r.del ? `<button class="btn btn-sm btn-ghost" data-del="${r.del[0]}" data-id="${r.del[1]}" aria-label="Excluir">${I.trash}</button>` : ''}</td></tr>`).join('')}
      </tbody></table>${rows.length > shown.length ? `<div style="padding:1rem;text-align:center"><button class="btn btn-sm" id="f-more">Mostrar todos (${rows.length})</button></div>` : ''}`
      : '<p class="empty">Nenhum lançamento neste período.</p>';
    if ($('#f-more')) $('#f-more').onclick = () => { st.finAll = true; render(); };
    $$('[data-del]').forEach(b => b.onclick = async () => {
      const isP = b.dataset.del === 'purchase';
      if (!await UI.confirm('Excluir lançamento?', isP ? 'A compra sai do financeiro e a quantidade é descontada do estoque.' : 'A despesa sai do financeiro.', 'Excluir', true)) return;
      if (isP) await Store.removePurchase(b.dataset.id); else await Store.removeExpense(b.dataset.id);
      UI.toast('Lançamento excluído.'); render();
    });

    $('#f-csv').onclick = () => {
      const csv = ['Data;Descrição;Tipo;Valor', ...rows.map(r => [r.date.split('-').reverse().join('/'), `"${r.desc.replace(/"/g, '""')}"`, r.kind, r.v.toFixed(2).replace('.', ',')].join(';'))].join('\r\n');
      download(`financeiro_${from}_a_${to}.csv`, '﻿' + csv, 'text/csv');
    };
  }

  function makeBuckets(from, to) {
    const out = [];
    if (daysBetween(from, to) <= 62) {
      for (let s = from; s <= to; s = U.addDays(s, 7)) {
        const e = U.addDays(s, 6) > to ? to : U.addDays(s, 6);
        out.push({ from: s, to: e, label: U.shortDate(s), title: `${U.shortDate(s)} a ${U.shortDate(e)}` });
      }
    } else {
      for (let s = monthStart(from); s <= to; s = shiftMonth(s, 1)) {
        const dt = U.parseDate(s);
        out.push({ from: s < from ? from : s, to: monthEnd(s) > to ? to : monthEnd(s), label: MONTH_ABBR[dt.getMonth()], title: `${U.MONTHS[dt.getMonth()]} de ${dt.getFullYear()}` });
      }
    }
    return out;
  }

  function niceMax(v) {
    if (v <= 0) return 100;
    const p = Math.pow(10, Math.floor(Math.log10(v)));
    return [1, 2, 2.5, 5, 10].map(m => m * p).find(x => x >= v);
  }
  const compact = v => v >= 1000 ? `${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil` : String(Math.round(v));

  function drawColumns(el, data) {
    const W = Math.max(280, el.clientWidth), H = 240;
    const m = { l: 48, r: 8, t: 12, b: 26 };
    const iw = W - m.l - m.r, ih = H - m.t - m.b;
    const max = niceMax(Math.max(...data.map(d => Math.max(d.in, d.out)), 0));
    const y = v => m.t + ih - (v / max) * ih;
    const band = iw / data.length;
    const bw = Math.max(4, Math.min(24, (band - 10) / 2));
    const bar = (x, v, color) => {
      const h = Math.max(0, (v / max) * ih);
      if (h < .5) return '';
      const r = Math.min(4, h, bw / 2), top = m.t + ih - h, base = m.t + ih;
      return `<path fill="${color}" d="M${x},${base} V${top + r} Q${x},${top} ${x + r},${top} H${x + bw - r} Q${x + bw},${top} ${x + bw},${top + r} V${base} Z"/>`;
    };
    const ticks = [0, .25, .5, .75, 1].map(f => f * max);
    const every = Math.ceil(data.length / Math.max(1, Math.floor(iw / 48)));
    let svg = `<svg width="${W}" height="${H}" role="img" aria-label="Entradas e saídas por período">
      <g class="grid">${ticks.map(t => `<line x1="${m.l}" x2="${W - m.r}" y1="${y(t)}" y2="${y(t)}"/><text x="${m.l - 8}" y="${y(t) + 4}" text-anchor="end">${compact(t)}</text>`).join('')}</g>`;
    data.forEach((d, i) => {
      const cx = m.l + band * i + band / 2;
      svg += bar(cx - bw - 1, d.in, SERIES.in) + bar(cx + 1, d.out, SERIES.out);
      if (i % every === 0) svg += `<text x="${cx}" y="${H - 6}" text-anchor="middle">${d.label}</text>`;
      svg += `<rect class="hit" data-i="${i}" x="${m.l + band * i}" y="${m.t}" width="${band}" height="${ih}"/>`;
    });
    svg += '</svg>';
    el.innerHTML = svg;
    const tip = $('#tip');
    $$('.hit', el).forEach(r => {
      const d = data[Number(r.dataset.i)];
      const show = e => {
        tip.innerHTML = `<strong>${d.title}</strong>
          <div><span><i style="background:${SERIES.in}"></i>Entrou</span><span>${U.money(d.in)}</span></div>
          <div><span><i style="background:${SERIES.out}"></i>Saiu</span><span>${U.money(d.out)}</span></div>
          <div style="border-top:1px solid var(--line);margin-top:.3rem;padding-top:.3rem"><span>Sobrou</span><strong style="margin:0">${U.money(d.in - d.out)}</strong></div>`;
        tip.classList.remove('hidden');
        const x = Math.min(e.clientX + 14, window.innerWidth - tip.offsetWidth - 8);
        tip.style.left = x + 'px';
        tip.style.top = (e.clientY - tip.offsetHeight - 12) + 'px';
      };
      r.addEventListener('mousemove', show);
      r.addEventListener('mouseleave', () => tip.classList.add('hidden'));
    });
  }

  function drawHBars(el, rows) {
    if (!rows.length) { el.innerHTML = '<p class="empty" style="padding:.5rem">Sem entradas no período.</p>'; return; }
    const max = Math.max(...rows.map(r => r[1]));
    const total = sum(rows, r => r[1]);
    el.innerHTML = rows.map(([label, v]) => `
      <div class="hbar" title="${U.esc(label)}: ${U.money(v)} (${Math.round(v / total * 100)}%)">
        <span class="hbar-label">${U.esc(label)}</span>
        <span class="hbar-track"><span class="hbar-fill" style="width:${Math.max(1, v / max * 72)}%"></span><span class="hbar-val">${U.money(v)}</span></span>
      </div>`).join('');
  }

  function expenseModal() {
    UI.modal('Lançar despesa', 'Gastos que não são material: aluguel, contas, cursos, divulgação…', (body, close) => {
      body.innerHTML = `
        <div class="field"><label for="e-desc">Descrição</label><input class="input" id="e-desc" placeholder="Ex.: Aluguel da sala"></div>
        <div class="row">
          <div class="field"><label for="e-val">Valor (R$)</label><input class="input" id="e-val" inputmode="decimal" placeholder="0,00"></div>
          <div class="field"><label for="e-date">Data</label><input class="input" type="date" id="e-date" value="${today()}"></div>
        </div>
        <div class="field"><label for="e-cat">Tipo</label><select class="input" id="e-cat">${['Aluguel', 'Contas', 'Divulgação', 'Cursos', 'Equipamentos', 'Impostos', 'Outros'].map(c => `<option>${c}</option>`).join('')}</select></div>
        <div class="modal-actions"><button class="btn btn-ghost" data-x>Voltar</button><button class="btn btn-primary" id="e-ok">Salvar despesa</button></div>`;
      $('[data-x]', body).onclick = close;
      $('#e-ok', body).onclick = async () => {
        const desc = $('#e-desc', body).value.trim(), value = parseMoney($('#e-val', body).value);
        if (!desc || !value) return UI.toast('Preencha descrição e valor.', 'error');
        await Store.addExpense({ desc, value, date: $('#e-date', body).value, cat: $('#e-cat', body).value });
        close(); UI.toast('Despesa lançada.'); render();
      };
    });
  }

  function download(name, content, type) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([content], { type }));
    a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  /* =========================================================
     MATERIAIS
     ========================================================= */
  const stockLevel = m => Number(m.stock) <= 0 ? 'zero' : Number(m.stock) <= Number(m.min) ? 'low' : 'ok';
  const LEVEL_TXT = { zero: 'Acabou', low: 'Acabando', ok: 'Em dia' };

  async function vMateriais() {
    const mats = await Store.materials();
    const purchases = await Store.purchases();
    const t = today();
    const monthBuy = sum(purchases.filter(p => p.date >= monthStart(t)), p => p.total);
    const low = mats.filter(m => stockLevel(m) !== 'ok');
    const order = { zero: 0, low: 1, ok: 2 };
    const sorted = mats.slice().sort((a, b) => order[stockLevel(a)] - order[stockLevel(b)] || a.name.localeCompare(b.name));

    const since = { mes: monthStart(t), '3m': shiftMonth(t, -2), tudo: '0000' }[st.buyPeriod];
    const plist = purchases.filter(p => p.date >= since);

    $('#view').innerHTML = `
      <div class="head">
        <div><h1>Materiais</h1><p>O que você tem, o que está acabando e quanto gastou.</p></div>
        <div class="head-actions">
          <button class="btn" id="m-new">${I.plus} Novo material</button>
          <button class="btn btn-primary" id="m-buy">${I.box} Registrar compra</button>
        </div>
      </div>
      <div class="kpis">
        ${kpi('Materiais cadastrados', mats.length)}
        ${kpi('Precisa comprar', low.length, low.length ? 'Acabou ou está no mínimo' : 'Nada faltando', low.length ? 'warn' : '')}
        ${kpi('Gasto com materiais no mês', U.money(monthBuy))}
      </div>
      ${low.length ? `<div class="alert">${I.alert}<div><strong>Lista de compras:</strong> ${low.map(m => U.esc(m.name)).join(', ')}.</div></div>` : ''}
      <div class="tabs"><button class="${st.matTab === 'estoque' ? 'on' : ''}" data-tab="estoque">Estoque</button><button class="${st.matTab === 'compras' ? 'on' : ''}" data-tab="compras">Compras</button></div>
      <div id="m-body"></div>`;

    if (st.matTab === 'estoque') {
      $('#m-body').innerHTML = sorted.length ? `<div class="appts">${sorted.map(m => {
        const lv = stockLevel(m);
        return `<div class="mat ${lv}">
          <div><div class="mat-name">${U.esc(m.name)}</div><div class="mat-sub">${U.esc(m.cat || 'Sem categoria')} · avisar com ${m.min} ${U.esc(m.unit || 'un.')} · último preço ${U.money(m.lastPrice)}</div></div>
          <div class="mat-stock"><strong>${m.stock}</strong> <span class="tiny muted">${U.esc(m.unit || 'un.')}</span><br><span class="stock-tag ${lv}">${LEVEL_TXT[lv]}</span></div>
          <div class="mat-actions">
            <button class="btn btn-sm" data-use="${m.id}" title="Usei / acabou um">${I.minus} Usei</button>
            <button class="btn btn-sm" data-buy="${m.id}" title="Comprei mais">${I.plus} Comprei</button>
            <button class="btn btn-sm btn-ghost" data-edit="${m.id}" aria-label="Editar">${I.edit}</button>
          </div></div>`;
      }).join('')}</div>` : `<div class="card empty">Nenhum material cadastrado ainda.<br><br><button class="btn btn-sm btn-primary" id="m-new2">${I.plus} Cadastrar o primeiro</button></div>`;
      $$('[data-use]').forEach(b => b.onclick = async () => { await Store.adjustStock(b.dataset.use, -1); render(); });
      $$('[data-buy]').forEach(b => b.onclick = () => purchaseModal(b.dataset.buy));
      $$('[data-edit]').forEach(b => b.onclick = () => materialModal(mats.find(m => m.id === b.dataset.edit)));
      if ($('#m-new2')) $('#m-new2').onclick = () => materialModal();
    } else {
      $('#m-body').innerHTML = `
        <div class="filters"><div class="chips">${[['mes', 'Este mês'], ['3m', 'Últimos 3 meses'], ['tudo', 'Tudo']].map(([k, v]) => `<button class="chip ${st.buyPeriod === k ? 'on' : ''}" data-bp="${k}">${v}</button>`).join('')}</div>
          <span style="margin-left:auto" class="muted">Total: <strong>${U.money(sum(plist, p => p.total))}</strong></span></div>
        <div class="table-wrap">${plist.length ? `<table><thead><tr><th>Data</th><th>Material</th><th class="num">Qtd.</th><th class="num">Valor</th><th>Onde comprou</th><th></th></tr></thead>
          <tbody>${plist.map(p => `<tr><td class="nowrap">${U.shortDate(p.date)}</td><td>${U.esc(p.materialName)}</td><td class="num">${p.qty}</td><td class="num">${U.money(p.total)}</td><td class="muted">${U.esc(p.supplier || '—')}</td>
          <td class="num"><button class="btn btn-sm btn-ghost" data-delp="${p.id}" aria-label="Excluir">${I.trash}</button></td></tr>`).join('')}</tbody></table>`
          : '<p class="empty">Nenhuma compra neste período.</p>'}</div>`;
      $$('[data-bp]').forEach(b => b.onclick = () => { st.buyPeriod = b.dataset.bp; render(); });
      $$('[data-delp]').forEach(b => b.onclick = async () => {
        if (!await UI.confirm('Excluir compra?', 'A quantidade comprada também é descontada do estoque.', 'Excluir', true)) return;
        await Store.removePurchase(b.dataset.delp); UI.toast('Compra excluída.'); render();
      });
    }
    $$('[data-tab]').forEach(b => b.onclick = () => { st.matTab = b.dataset.tab; render(); });
    $('#m-new').onclick = () => materialModal();
    $('#m-buy').onclick = () => purchaseModal();
  }

  async function materialModal(m = null) {
    const mats = await Store.materials();
    const cats = [...new Set(['Cílios', 'Sobrancelha', 'Buço', 'Descartáveis', 'Higiene', ...mats.map(x => x.cat).filter(Boolean)])];
    UI.modal(m ? 'Editar material' : 'Novo material', m ? '' : 'Cadastre uma vez e depois é só registrar as compras.', (body, close) => {
      body.innerHTML = `
        <div class="field"><label for="mm-name">Nome</label><input class="input" id="mm-name" value="${U.esc(m?.name || '')}" placeholder="Ex.: Cola para cílios"></div>
        <div class="row">
          <div class="field"><label for="mm-cat">Categoria</label><input class="input" id="mm-cat" list="mm-cats" value="${U.esc(m?.cat || '')}"><datalist id="mm-cats">${cats.map(c => `<option value="${U.esc(c)}">`).join('')}</datalist></div>
          <div class="field"><label for="mm-unit">Unidade</label><select class="input" id="mm-unit">${['unidade', 'frasco', 'caixa', 'pacote', 'pote', 'rolo', 'par', 'tubo'].map(u => `<option ${m?.unit === u ? 'selected' : ''}>${u}</option>`).join('')}</select></div>
        </div>
        <div class="row">
          <div class="field"><label for="mm-stock">Quantos tem agora</label><input class="input" id="mm-stock" type="number" min="0" step="1" value="${m?.stock ?? 0}"></div>
          <div class="field"><label for="mm-min">Me avisar quando tiver</label><input class="input" id="mm-min" type="number" min="0" step="1" value="${m?.min ?? 1}"><span class="hint">Quando chegar nesse número, entra na lista de compras.</span></div>
        </div>
        <div class="modal-actions">
          ${m ? `<button class="btn btn-danger" id="mm-del" style="margin-right:auto">${I.trash} Excluir</button>` : ''}
          <button class="btn btn-ghost" data-x>Voltar</button><button class="btn btn-primary" id="mm-ok">Salvar</button></div>`;
      $('[data-x]', body).onclick = close;
      if (m) $('#mm-del', body).onclick = async () => {
        if (!await UI.confirm('Excluir material?', 'As compras já registradas continuam no financeiro.', 'Excluir', true)) return;
        await Store.removeMaterial(m.id); close(); UI.toast('Material excluído.'); render();
      };
      $('#mm-ok', body).onclick = async () => {
        const name = $('#mm-name', body).value.trim();
        if (!name) return UI.toast('Digite o nome do material.', 'error');
        await Store.saveMaterial({ id: m?.id, name, cat: $('#mm-cat', body).value.trim(), unit: $('#mm-unit', body).value, stock: Number($('#mm-stock', body).value) || 0, min: Number($('#mm-min', body).value) || 0 });
        close(); UI.toast('Material salvo.'); render();
      };
    });
  }

  async function purchaseModal(materialId = '') {
    const mats = await Store.materials();
    if (!mats.length) { UI.toast('Cadastre um material primeiro.'); return materialModal(); }
    UI.modal('Registrar compra', 'A quantidade entra no estoque e o valor vai para o financeiro.', (body, close) => {
      body.innerHTML = `
        <div class="field"><label for="p-mat">O que comprou</label><select class="input" id="p-mat">${mats.map(m => `<option value="${m.id}" ${m.id === materialId ? 'selected' : ''}>${U.esc(m.name)}</option>`).join('')}</select></div>
        <div class="row">
          <div class="field"><label for="p-qty">Quantidade</label><input class="input" id="p-qty" type="number" min="1" step="1" value="1"></div>
          <div class="field"><label for="p-total">Valor total pago (R$)</label><input class="input" id="p-total" inputmode="decimal" placeholder="0,00"></div>
        </div>
        <div class="row">
          <div class="field"><label for="p-date">Data</label><input class="input" type="date" id="p-date" value="${today()}"></div>
          <div class="field"><label for="p-sup">Onde comprou <span class="muted">(opcional)</span></label><input class="input" id="p-sup"></div>
        </div>
        <div class="modal-actions"><button class="btn btn-ghost" data-x>Voltar</button><button class="btn btn-primary" id="p-ok">Salvar compra</button></div>`;
      const fill = () => { const m = mats.find(x => x.id === $('#p-mat', body).value); if (m?.lastPrice) $('#p-total', body).placeholder = `Último: ${U.money(m.lastPrice * (Number($('#p-qty', body).value) || 1))}`; };
      $('#p-mat', body).onchange = fill; $('#p-qty', body).oninput = fill; fill();
      $('[data-x]', body).onclick = close;
      $('#p-ok', body).onclick = async () => {
        const qty = Number($('#p-qty', body).value), total = parseMoney($('#p-total', body).value);
        if (!qty || qty < 1) return UI.toast('Informe a quantidade.', 'error');
        if (!total) return UI.toast('Informe quanto pagou.', 'error');
        await Store.addPurchase({ materialId: $('#p-mat', body).value, qty, total, date: $('#p-date', body).value, supplier: $('#p-sup', body).value.trim() });
        close(); UI.toast('Compra registrada e estoque atualizado.'); render();
      };
    });
  }

  /* =========================================================
     SERVIÇOS
     ========================================================= */
  async function vServicos() {
    const services = await Store.services({ all: true });
    $('#view').innerHTML = `
      <div class="head">
        <div><h1>Serviços e preços</h1><p>O que aparece no site para as clientes agendarem.</p></div>
        <div class="head-actions"><button class="btn btn-primary" id="s-new">${I.plus} Novo serviço</button></div>
      </div>
      ${Store.CATEGORIES.map(c => {
        const list = services.filter(s => s.cat === c.id);
        return `<h2 class="section-title">${c.name}</h2>
        <div class="card" style="padding:0">${list.length ? list.map(s => `
          <div class="svc ${s.active ? '' : 'inactive'}">
            <div><div class="svc-name">${U.esc(s.name)}</div>${s.note ? `<div class="tiny muted">${U.esc(s.note)}</div>` : ''}</div>
            <span class="svc-dur">${I.clock} ${U.dur(s.duration)}</span>
            <span class="svc-price">${U.money(s.price)}</span>
            <div style="display:flex;gap:.5rem;align-items:center">
              <label class="switch" title="${s.active ? 'Aparece no site' : 'Escondido do site'}"><input type="checkbox" data-toggle="${s.id}" ${s.active ? 'checked' : ''}><span></span></label>
              <button class="btn btn-sm btn-ghost" data-edit="${s.id}" aria-label="Editar">${I.edit}</button>
            </div>
          </div>`).join('') : '<p class="empty">Nenhum serviço nesta categoria.</p>'}</div>`;
      }).join('')}
      <p class="tiny muted" style="margin-top:1rem">O interruptor rosa significa que o serviço aparece no site. Desligue para esconder sem apagar.</p>`;
    $('#s-new').onclick = () => serviceModal();
    $$('[data-edit]').forEach(b => b.onclick = () => serviceModal(services.find(s => s.id === b.dataset.edit)));
    $$('[data-toggle]').forEach(c => c.onchange = async () => {
      await Store.saveService({ id: c.dataset.toggle, active: c.checked });
      UI.toast(c.checked ? 'Serviço visível no site.' : 'Serviço escondido do site.'); render();
    });
  }

  function serviceModal(s = null) {
    const durs = [15, 30, 45, 60, 75, 90, 105, 120, 150, 180, 210, 240];
    UI.modal(s ? 'Editar serviço' : 'Novo serviço', '', (body, close) => {
      body.innerHTML = `
        <div class="field"><label for="sv-name">Nome</label><input class="input" id="sv-name" value="${U.esc(s?.name || '')}"></div>
        <div class="field"><label for="sv-cat">Categoria</label><select class="input" id="sv-cat">${Store.CATEGORIES.map(c => `<option value="${c.id}" ${s?.cat === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}</select></div>
        <div class="row">
          <div class="field"><label for="sv-price">Preço (R$)</label><input class="input" id="sv-price" inputmode="decimal" value="${s ? String(s.price).replace('.', ',') : ''}"></div>
          <div class="field"><label for="sv-dur">Quanto tempo leva</label><select class="input" id="sv-dur">${durs.map(d => `<option value="${d}" ${(s?.duration || 60) === d ? 'selected' : ''}>${U.dur(d)}</option>`).join('')}</select></div>
        </div>
        <div class="field"><label for="sv-note">Observação para a cliente <span class="muted">(opcional)</span></label><input class="input" id="sv-note" value="${U.esc(s?.note || '')}" placeholder="Ex.: manutenção de 15 a 21 dias"></div>
        <div class="modal-actions">
          ${s ? `<button class="btn btn-danger" id="sv-del" style="margin-right:auto">${I.trash} Excluir</button>` : ''}
          <button class="btn btn-ghost" data-x>Voltar</button><button class="btn btn-primary" id="sv-ok">Salvar</button></div>`;
      $('[data-x]', body).onclick = close;
      if (s) $('#sv-del', body).onclick = async () => {
        if (!await UI.confirm('Excluir serviço?', 'Os agendamentos antigos continuam guardados. Se quiser só esconder do site, use o interruptor.', 'Excluir', true)) return;
        await Store.removeService(s.id); close(); UI.toast('Serviço excluído.'); render();
      };
      $('#sv-ok', body).onclick = async () => {
        const name = $('#sv-name', body).value.trim(), price = parseMoney($('#sv-price', body).value);
        if (!name) return UI.toast('Digite o nome do serviço.', 'error');
        await Store.saveService({ id: s?.id, name, cat: $('#sv-cat', body).value, price, duration: Number($('#sv-dur', body).value), note: $('#sv-note', body).value.trim() });
        close(); UI.toast('Serviço salvo.'); render();
      };
    });
  }

  /* =========================================================
     AJUSTES
     ========================================================= */
  async function vAjustes() {
    const s = await Store.settings();
    const db = await Store.get();
    const order = [1, 2, 3, 4, 5, 6, 0];
    $('#view').innerHTML = `
      <div class="head"><div><h1>Ajustes</h1><p>Seus dados, horários de atendimento e segurança.</p></div></div>
      <div class="settings-grid">
        <form class="card" id="cfg-studio">
          <h3>Seus dados</h3>
          <div class="field"><label for="c-studio">Nome do estúdio</label><input class="input" id="c-studio" value="${U.esc(s.studio)}"></div>
          <div class="field"><label for="c-sub">Frase abaixo do nome</label><input class="input" id="c-sub" value="${U.esc(s.subtitle)}"></div>
          <div class="field"><label for="c-wa">Seu WhatsApp</label><input class="input" id="c-wa" inputmode="tel" value="${U.esc(s.whatsapp)}" placeholder="(00) 00000-0000"><span class="hint">As clientes usam para te avisar depois de agendar.</span></div>
          <div class="field"><label for="c-addr">Endereço</label><input class="input" id="c-addr" value="${U.esc(s.address)}"></div>
          <div class="field"><label for="c-ig">Instagram</label><input class="input" id="c-ig" value="${U.esc(s.instagram)}" placeholder="@seuperfil"></div>
          <button class="btn btn-primary">Salvar dados</button>
        </form>

        <form class="card" id="cfg-hours">
          <h3>Dias e horários de atendimento</h3>
          <div class="hours-row tiny muted"><span></span><span>Dia</span><span>Abre</span><span>Fecha</span></div>
          ${order.map(d => { const h = s.hours[d]; return `
            <div class="hours-row ${h.on ? '' : 'off'}" data-day="${d}">
              <label class="switch"><input type="checkbox" ${h.on ? 'checked' : ''} data-on><span></span></label>
              <span>${U.WEEKDAYS[d]}</span>
              <input class="input" type="time" value="${h.open}" data-open>
              <input class="input" type="time" value="${h.close}" data-close>
            </div>`; }).join('')}
          <div class="hours-row" style="margin-top:1rem">
            <label class="switch"><input type="checkbox" id="c-lunch" ${s.lunch.on ? 'checked' : ''}><span></span></label>
            <span>Almoço</span>
            <input class="input" type="time" id="c-lunch-s" value="${s.lunch.start}">
            <input class="input" type="time" id="c-lunch-e" value="${s.lunch.end}">
          </div>
          <div class="row" style="margin-top:1rem">
            <div class="field"><label for="c-step">Mostrar horários a cada</label><select class="input" id="c-step">${[15, 30, 60].map(v => `<option value="${v}" ${Number(s.step) === v ? 'selected' : ''}>${v} minutos</option>`).join('')}</select></div>
            <div class="field"><label for="c-notice">Antecedência mínima</label><select class="input" id="c-notice">${[0, 1, 2, 3, 6, 12, 24].map(v => `<option value="${v}" ${Number(s.minNoticeHours) === v ? 'selected' : ''}>${v ? `${v} hora${v > 1 ? 's' : ''}` : 'Nenhuma'}</option>`).join('')}</select></div>
          </div>
          <div class="field"><label for="c-window">Clientes podem agendar até</label><select class="input" id="c-window">${[14, 30, 45, 60, 90].map(v => `<option value="${v}" ${Number(s.windowDays) === v ? 'selected' : ''}>${v} dias à frente</option>`).join('')}</select></div>
          <button class="btn btn-primary">Salvar horários</button>
        </form>

        <div class="stack" style="gap:.9rem">
          <form class="card" id="cfg-pin" style="width:100%">
            <h3>Senha do painel</h3>
            <div class="field"><label for="c-pin">Nova senha</label>${Store.remote
              ? '<input class="input" id="c-pin" type="password" autocomplete="new-password" placeholder="Mínimo 8 caracteres">'
              : '<input class="input" id="c-pin" type="password" inputmode="numeric" placeholder="Mínimo 4 números">'}</div>
            <button class="btn btn-primary">Trocar senha</button>
          </form>

          <div class="card" style="width:100%">
            <h3>Cópia de segurança</h3>
            <p class="tiny muted" style="margin-top:-.5rem">${Store.remote ? 'Seus dados ficam guardados online. Se quiser, baixe uma cópia para guardar com você.' : 'Os dados ficam guardados neste aparelho. Baixe uma cópia de vez em quando.'}</p>
            <div class="stack">
              <button class="btn" id="c-backup">Baixar cópia dos dados</button>
              ${Store.remote ? '' : '<label class="btn">Restaurar uma cópia<input type="file" accept=".json,application/json" id="c-restore" hidden></label>'}
            </div>
          </div>

          <div class="card ${Store.remote ? 'hidden' : ''}" style="width:100%">
            <h3>Dados de exemplo</h3>
            <div class="stack">
              ${db.demo ? '<button class="btn" id="c-clear">Apagar dados de exemplo</button>' : '<button class="btn" id="c-demo">Carregar dados de exemplo</button>'}
              <button class="btn btn-danger" id="c-reset">${I.trash} Apagar tudo e começar do zero</button>
            </div>
          </div>
        </div>
      </div>`;

    $('#c-wa').oninput = e => e.target.value = U.phoneMask(e.target.value);
    $('#cfg-studio').onsubmit = async e => {
      e.preventDefault();
      await Store.saveSettings({ studio: $('#c-studio').value.trim() || 'Izabelle Lima', subtitle: $('#c-sub').value.trim(), whatsapp: $('#c-wa').value.trim(), address: $('#c-addr').value.trim(), instagram: $('#c-ig').value.trim() });
      $$('[data-studio]').forEach(el => el.textContent = $('#c-studio').value.trim());
      UI.toast('Dados salvos.');
    };
    $$('#cfg-hours [data-on]').forEach(c => c.onchange = () => c.closest('.hours-row').classList.toggle('off', !c.checked));
    $('#cfg-hours').onsubmit = async e => {
      e.preventDefault();
      const hours = {};
      $$('#cfg-hours [data-day]').forEach(r => { hours[r.dataset.day] = { on: $('[data-on]', r).checked, open: $('[data-open]', r).value, close: $('[data-close]', r).value }; });
      if (Object.values(hours).some(h => h.on && h.close <= h.open)) return UI.toast('O horário de fechar precisa ser depois do de abrir.', 'error');
      await Store.saveSettings({
        hours, lunch: { on: $('#c-lunch').checked, start: $('#c-lunch-s').value, end: $('#c-lunch-e').value },
        step: Number($('#c-step').value), minNoticeHours: Number($('#c-notice').value), windowDays: Number($('#c-window').value),
      });
      UI.toast('Horários salvos. O site já mostra a nova agenda.');
    };
    $('#cfg-pin').onsubmit = async e => {
      e.preventDefault();
      const pin = $('#c-pin').value.trim();
      try {
        if (Store.remote) {
          if (pin.length < 8) return UI.toast('A senha precisa ter pelo menos 8 caracteres.', 'error');
          await Store.auth.updatePassword(pin);
        } else {
          if (pin.length < 4) return UI.toast('A senha precisa ter pelo menos 4 dígitos.', 'error');
          await Store.saveSettings({ pin });
        }
        $('#c-pin').value = '';
        UI.toast('Senha trocada.');
      } catch (err) { UI.toast(err.message, 'error'); }
    };
    $('#c-backup').onclick = async () => download(`backup_izabelle_${today()}.json`, await Store.exportJson(), 'application/json');
    if ($('#c-restore')) $('#c-restore').onchange = async e => {
      const file = e.target.files[0];
      if (!file) return;
      if (!await UI.confirm('Restaurar cópia?', 'Os dados atuais serão trocados pelos dados do arquivo.', 'Restaurar', true)) return;
      try { await Store.importJson(await file.text()); UI.toast('Cópia restaurada!'); render(); }
      catch (err) { UI.toast(err.message || 'Arquivo inválido.', 'error'); }
    };
    if ($('#c-clear')) $('#c-clear').onclick = clearDemo;
    if ($('#c-demo')) $('#c-demo').onclick = async () => { await Store.loadDemo(); UI.toast('Exemplos carregados.'); render(); };
    $('#c-reset').onclick = async () => {
      if (!await UI.confirm('Apagar tudo?', 'Agendamentos, materiais, despesas e ajustes voltam ao início. Isso não pode ser desfeito — baixe uma cópia antes se quiser guardar.', 'Apagar tudo', true)) return;
      await Store.resetAll(); session.end(); UI.toast('Tudo apagado. A senha voltou a ser 1234.'); showLogin();
    };
  }

  boot();
})();
