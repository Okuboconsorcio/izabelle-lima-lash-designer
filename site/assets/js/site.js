/* Site de agendamento — fluxo da cliente */
(async function () {
  const { U } = Store;
  const { $, $$ } = UI;

  const state = { service: null, date: null, time: null };
  try { await Store.init(); }
  catch (err) {
    $('#service-list').innerHTML = '<p class="empty">Não conseguimos carregar a agenda agora. Confira sua internet e recarregue a página.</p>';
    return;
  }
  let settings = await Store.settings();

  /* ---------- marca e rodapé ---------- */
  function applyBrand() {
    $$('[data-studio]').forEach(el => el.textContent = settings.studio);
    $$('[data-subtitle]').forEach(el => el.textContent = settings.subtitle);
    document.title = `${settings.studio} · Agendamento`;
    const info = [];
    if (settings.address) info.push(`<span>${U.esc(settings.address)}</span>`);
    if (settings.whatsapp) info.push(`<a href="${U.waLink(settings.whatsapp, 'Olá! Vim pelo site.')}" target="_blank" rel="noopener">WhatsApp ${U.esc(settings.whatsapp)}</a>`);
    if (settings.instagram) info.push(`<a href="https://instagram.com/${U.esc(settings.instagram.replace('@', ''))}" target="_blank" rel="noopener">@${U.esc(settings.instagram.replace('@', ''))}</a>`);
    $('#foot-info').innerHTML = info.join('');
  }
  applyBrand();

  /* ---------- navegação entre etapas ---------- */
  function go(step) {
    $$('[data-panel]').forEach(p => p.classList.toggle('hidden', p.dataset.panel !== String(step)));
    $$('.steps li').forEach(li => {
      const n = Number(li.dataset.step);
      li.classList.toggle('active', n === step);
      li.classList.toggle('done', n < step);
    });
    $('.steps').classList.toggle('hidden', step === 4);
    const top = $('#agendar').getBoundingClientRect().top + window.scrollY - 80;
    if (window.scrollY > top) window.scrollTo({ top, behavior: 'smooth' });
  }
  $$('[data-back]').forEach(b => b.onclick = () => go(Number(b.dataset.back)));

  /* ---------- 1. serviços ---------- */
  async function renderServices() {
    const services = await Store.services();
    const html = Store.CATEGORIES.map(cat => {
      const items = services.filter(s => s.cat === cat.id);
      if (!items.length) return '';
      const notes = [...new Set(items.map(i => i.note).filter(Boolean))];
      return `<div class="pt-cat">
        <h3>${cat.name}</h3>
        ${notes.map(n => `<p class="pt-note">* ${U.esc(n)}</p>`).join('')}
        ${items.map(s => `
          <button class="pt-item" data-id="${s.id}">
            <span class="pt-name">${U.esc(s.name)}</span>
            <span class="pt-price">${U.money(s.price)}</span>
            <span class="pt-dur">${UI.icons.clock} ${U.dur(s.duration)}</span>
            <span class="pt-go">Agendar ›</span>
          </button>`).join('')}
      </div>`;
    }).join('');
    $('#service-list').innerHTML = html || '<p class="empty">Nenhum serviço disponível no momento.</p>';
    $$('.pt-item').forEach(b => b.onclick = () => {
      state.service = services.find(s => s.id === b.dataset.id);
      state.date = null; state.time = null;
      openWhen();
    });
  }

  /* ---------- 2. dia e horário ---------- */
  async function openWhen() {
    const s = state.service;
    $('#chosen-service').innerHTML = `
      <div><strong>${U.esc(s.name)}</strong><div class="tiny muted">${U.dur(s.duration)}</div></div>
      <strong>${U.money(s.price)}</strong>`;
    $('#slots').innerHTML = '<p class="empty">Selecione um dia no calendário.</p>';
    $('#slots-title').textContent = 'Escolha o horário';
    $('#to-3').disabled = true;
    go(2);
    try { await Store.refresh(); } catch { /* segue com o que já tem; o banco confere de novo ao agendar */ }
    const today = U.todayStr();
    // abre no primeiro dia com horário livre
    let first = null;
    for (let i = 0; i <= settings.windowDays && !first; i++) {
      const d = U.addDays(today, i);
      if (await Store.dayHasSlots(d, s.duration)) first = d;
    }
    await UI.calendar($('#calendar'), {
      selected: first || today,
      minMonth: today,
      enabled: d => Store.dayHasSlots(d, s.duration),
      onSelect: pickDate,
    });
    if (first) pickDate(first);
    else $('#slots').innerHTML = '<p class="empty">Não há horários livres nos próximos dias. Fale com a gente pelo WhatsApp.</p>';
  }

  async function pickDate(date) {
    state.date = date; state.time = null;
    $('#to-3').disabled = true;
    $('#slots-title').textContent = U.longDate(date);
    const slots = await Store.slots(date, state.service.duration);
    if (!slots.length) { $('#slots').innerHTML = '<p class="empty">Esse dia não tem mais horários livres.</p>'; return; }
    const groups = [['Manhã', t => t < '12:00'], ['Tarde', t => t >= '12:00' && t < '18:00'], ['Noite', t => t >= '18:00']];
    $('#slots').innerHTML = groups.map(([label, f]) => {
      const g = slots.filter(f);
      return g.length ? `<div class="period">${label}</div><div class="slots">${g.map(t => `<button class="slot" data-t="${t}">${t}</button>`).join('')}</div>` : '';
    }).join('');
    $$('#slots .slot').forEach(b => b.onclick = () => {
      $$('#slots .slot').forEach(x => x.classList.remove('selected'));
      b.classList.add('selected');
      state.time = b.dataset.t;
      $('#to-3').disabled = false;
      if (window.innerWidth < 680) $('#to-3').scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }

  $('#to-3').onclick = () => {
    $('#summary').innerHTML = summaryHtml();
    go(3);
  };

  function summaryHtml() {
    const s = state.service;
    const end = U.toTime(U.toMin(state.time) + s.duration);
    return `
      <div><span>Serviço</span><span>${U.esc(s.name)}</span></div>
      <div><span>Dia</span><span>${U.longDate(state.date)}</span></div>
      <div><span>Horário</span><span>${state.time} às ${end}</span></div>
      <div><span>Valor</span><span>${U.money(s.price)}</span></div>`;
  }

  /* ---------- 3. dados e confirmação ---------- */
  const phone = $('#f-phone');
  phone.addEventListener('input', () => { phone.value = U.phoneMask(phone.value); });

  $('#form').addEventListener('submit', async e => {
    e.preventDefault();
    const name = $('#f-name').value.trim();
    const tel = phone.value.trim();
    if (name.length < 2) { UI.toast('Digite seu nome, por favor.', 'error'); $('#f-name').focus(); return; }
    if (U.onlyDigits(tel).length < 10) { UI.toast('Digite um WhatsApp válido com DDD.', 'error'); phone.focus(); return; }
    const btn = e.submitter || $('#form [type=submit]');
    btn.disabled = true;
    try {
      const appt = await Store.book({
        serviceId: state.service.id, date: state.date, time: state.time,
        client: name, phone: tel, notes: $('#f-notes').value.trim(),
      });
      showDone(appt);
    } catch (err) {
      UI.toast(err.message, 'error');
      openWhen();
    } finally { btn.disabled = false; }
  });

  /* ---------- 4. pronto ---------- */
  function showDone(appt) {
    $('#done-summary').innerHTML = summaryHtml();
    const wa = $('#wa-confirm');
    if (settings.whatsapp) {
      const msg = `Olá! Acabei de agendar pelo site:\n• ${appt.serviceName}\n• ${U.longDate(appt.date)} às ${appt.time}\nNome: ${appt.client}`;
      wa.href = U.waLink(settings.whatsapp, msg);
      wa.innerHTML = `${UI.icons.wa} Avisar pelo WhatsApp`;
      wa.classList.remove('hidden');
    } else wa.classList.add('hidden');

    const start = appt.date.replace(/-/g, '') + 'T' + appt.time.replace(':', '') + '00';
    const endMin = U.toMin(appt.time) + appt.duration;
    const end = appt.date.replace(/-/g, '') + 'T' + U.toTime(endMin).replace(':', '') + '00';
    const g = $('#gcal');
    g.href = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(appt.serviceName + ' · ' + settings.studio)}&dates=${start}/${end}&details=${encodeURIComponent('Agendado pelo site')}&location=${encodeURIComponent(settings.address || '')}`;
    g.innerHTML = `${UI.icons.cal} Salvar na minha agenda`;
    $('#form').reset();
    go(4);
  }
  $('#again').onclick = () => { state.service = null; go(1); };

  /* se alguém agendar em outra aba, atualiza a disponibilidade */
  Store.onChange(async () => {
    settings = await Store.settings();
    applyBrand();
    renderServices();
    if (state.service && state.date && !$('[data-panel="2"]').classList.contains('hidden')) pickDate(state.date);
  });

  renderServices();
})();
