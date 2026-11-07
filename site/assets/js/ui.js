/* Componentes de tela usados no site e no painel */
(function () {
  const { U } = Store;

  const UI = {
    $(sel, root = document) { return root.querySelector(sel); },
    $$(sel, root = document) { return [...root.querySelectorAll(sel)]; },

    toast(msg, type = '') {
      document.querySelectorAll('.toast').forEach(t => t.remove());
      const el = document.createElement('div');
      el.className = 'toast ' + type;
      el.textContent = msg;
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 3200);
    },

    /* Abre uma janela. `build(body, close)` monta o conteúdo. */
    modal(title, sub, build) {
      const bg = document.createElement('div');
      bg.className = 'modal-bg';
      bg.innerHTML = `<div class="modal" role="dialog" aria-modal="true"><h3></h3><div class="sub"></div><div class="body"></div></div>`;
      bg.querySelector('h3').textContent = title;
      const subEl = bg.querySelector('.sub');
      if (sub) subEl.textContent = sub; else subEl.remove();
      const close = () => { bg.remove(); document.removeEventListener('keydown', esc); };
      const esc = e => { if (e.key === 'Escape') close(); };
      document.addEventListener('keydown', esc);
      bg.addEventListener('mousedown', e => { if (e.target === bg) close(); });
      document.body.appendChild(bg);
      build(bg.querySelector('.body'), close);
      const first = bg.querySelector('input, select, textarea');
      if (first && window.innerWidth > 640) first.focus();
      return close;
    },

    confirm(title, text, okLabel = 'Confirmar', danger = false) {
      return new Promise(resolve => {
        UI.modal(title, text, (body, close) => {
          body.innerHTML = `<div class="modal-actions">
            <button class="btn btn-ghost" data-no>Voltar</button>
            <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-yes></button></div>`;
          body.querySelector('[data-yes]').textContent = okLabel;
          body.querySelector('[data-no]').onclick = () => { close(); resolve(false); };
          body.querySelector('[data-yes]').onclick = () => { close(); resolve(true); };
        });
      });
    },

    /* Calendário mensal. enabled(dateStr) => Promise<bool> */
    async calendar(el, { selected, enabled, onSelect, minMonth }) {
      let base = U.parseDate(selected || U.todayStr());
      base.setDate(1);
      const minM = minMonth ? U.parseDate(minMonth) : null;

      const draw = async () => {
        const y = base.getFullYear(), m = base.getMonth();
        const first = new Date(y, m, 1).getDay();
        const days = new Date(y, m + 1, 0).getDate();
        const today = U.todayStr();
        const canPrev = !minM || new Date(y, m, 1) > new Date(minM.getFullYear(), minM.getMonth(), 1);

        const cells = [];
        for (let i = 0; i < first; i++) cells.push('<span></span>');
        const checks = [];
        for (let d = 1; d <= days; d++) {
          const ds = `${y}-${U.pad(m + 1)}-${U.pad(d)}`;
          checks.push(enabled(ds).then(ok => [ds, ok]));
        }
        const res = await Promise.all(checks);
        res.forEach(([ds, ok]) => {
          const d = Number(ds.slice(8));
          const cls = ['cal-day', ok ? 'on' : 'off', ds === today ? 'today' : '', ds === selected ? 'sel' : ''].join(' ');
          cells.push(`<button type="button" class="${cls}" data-d="${ds}" ${ok ? '' : 'disabled'} aria-label="${U.longDate(ds)}">${d}</button>`);
        });

        el.innerHTML = `
          <div class="cal-head">
            <button type="button" class="cal-nav" data-nav="-1" ${canPrev ? '' : 'disabled'} aria-label="Mês anterior">‹</button>
            <strong>${U.MONTHS[m]} <span class="muted">${y}</span></strong>
            <button type="button" class="cal-nav" data-nav="1" aria-label="Próximo mês">›</button>
          </div>
          <div class="cal-grid cal-wd">${U.WEEKDAYS_SHORT.map(w => `<span>${w}</span>`).join('')}</div>
          <div class="cal-grid">${cells.join('')}</div>`;
        el.querySelectorAll('[data-nav]').forEach(b => b.onclick = () => { base.setMonth(base.getMonth() + Number(b.dataset.nav)); draw(); });
        el.querySelectorAll('.cal-day.on').forEach(b => b.onclick = () => { selected = b.dataset.d; draw(); onSelect(selected); });
      };
      await draw();
    },

    icons: {
      check: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
      x: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
      clock: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
      cal: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
      move: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 4v5h-5"/></svg>',
      wa: '<svg class="icon" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3Z"/></svg>',
      plus: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
      minus: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 12h14"/></svg>',
      edit: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16v4Z"/></svg>',
      trash: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
      home: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m3 11 9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-9Z"/></svg>',
      box: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8 12 3 3 8v8l9 5 9-5V8Z"/><path d="m3 8 9 5 9-5M12 13v8"/></svg>',
      money: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/></svg>',
      list: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M9 6h12M9 12h12M9 18h12M4 6h.01M4 12h.01M4 18h.01"/></svg>',
      gear: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/></svg>',
      lock: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>',
      alert: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 3 2 20h20L12 3Z"/><path d="M12 10v4M12 17h.01"/></svg>',
      ban: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="m5.7 5.7 12.6 12.6"/></svg>',
      out: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3"/></svg>',
    },
  };

  window.UI = UI;
})();
