// Сводка Research Crew: живые счётчики, модули стойки, демо исследования и пасхалки проекта.
(() => {
  const server = App.server;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const fmt = (n, d = 0) => n.toLocaleString('ru-RU', { minimumFractionDigits: d, maximumFractionDigits: d });
  const esc = (s) => String(s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);

  const nav = $('[data-nav]');
  const onScroll = () => nav?.classList.toggle('is-scrolled', scrollY > 40);
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  let fromIndex = false;
  try { fromIndex = sessionStorage.getItem('from-index') === '1'; } catch (e) {}
  $$('[data-back]').forEach((a) => a.addEventListener('click', (e) => {
    if (!fromIndex || history.length < 2) return;
    e.preventDefault();
    history.back();
  }));
  const root = App.root;
  if (root.classList.contains('is-wiping')) {
    const wipe = $('.wipe--page');
    const done = () => root.classList.remove('is-wiping');
    wipe.addEventListener('animationend', (e) => { if (e.target === wipe) done(); });
  }

  const tabs = $$('[role="tab"]');
  const panelOf = (t) => document.getElementById(t.getAttribute('aria-controls'));
  const show = (tab, focus = false) => {
    tabs.forEach((t) => {
      const on = t === tab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      panelOf(t).hidden = !on;
    });
    tab.classList.remove('has-news');
    if (focus) tab.focus();
  };
  const tabFor = (id) => tabs.find((t) => t.id === id);
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => show(t));
    t.addEventListener('keydown', (e) => {
      const d = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
      if (!d) return;
      e.preventDefault();
      show(tabs[(i + d + tabs.length) % tabs.length], true);
    });
  });

  const kpis = $('.kpis');
  const count = () => $$('[data-count]', kpis).forEach((b) => {
    const to = parseFloat(b.dataset.count);
    const d = +(b.dataset.decimals || 0);
    if (App.still) return;
    App.tween(1600, (k) => (b.textContent = fmt(to * k, d)));
  });
  if (kpis) {
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { io.disconnect(); setTimeout(count, 200); } }, { threshold: 0.4 });
    io.observe(kpis);
  }

  const stat = Object.fromEntries($$('[data-stat]').map((el) => [el.dataset.stat, el]));
  const bar = $('[data-stat-bar]');
  const initialRate = parseFloat($('.live-box')?.dataset.rate || '.92');
  const totals = { total: 0, closed: 0, human: 0 };
  const render = () => {
    stat.total.textContent = fmt(totals.total);
    stat.closed.textContent = fmt(totals.closed);
    stat.human.textContent = fmt(totals.human);
    const rate = totals.total ? totals.closed / totals.total : initialRate;
    stat.rate.textContent = totals.total ? `${Math.round(rate * 100)}%` : '—';
    bar.style.setProperty('--rate', rate.toFixed(3));
  };
  const tally = (resolved) => {
    totals.total++;
    resolved ? totals.closed++ : totals.human++;
    render();
  };

  const items = $$('[data-module]');
  const expand = (i) => items.forEach((b, k) => b.setAttribute('aria-expanded', String(k === i)));
  let current = -1;
  items.forEach((b, i) => {
    b.addEventListener('click', () => {
      const next = current === i ? -1 : i;
      if (server) server.select(next); else { current = next; expand(next); }
    });
    b.addEventListener('pointerenter', () => server?.hover(i));
    b.addEventListener('pointerleave', () => server?.hover(-1));
    b.addEventListener('focus', () => server?.hover(i));
    b.addEventListener('blur', () => server?.hover(-1));
  });
  setInterval(() => {
    if (current < 0 || !server) return;
    const el = $('[data-load]', items[current]);
    if (el) el.textContent = `${Math.round(server.load(current) * 100)}%`;
  }, 500);
  const flash = (i) => {
    const b = items[i];
    if (!b) return;
    b.classList.add('is-flash');
    setTimeout(() => b.classList.remove('is-flash'), 700);
  };

  const doorBtn = $('[data-door]');
  const resetBtn = $('[data-reset]');
  if (server) {
    server.on('select', (i) => {
      current = i;
      expand(i);
      if (i < 0) return;
      const flowTab = tabFor('tab-flow');
      if (pending) flowTab.classList.add('has-news');
      else if (flowTab.getAttribute('aria-selected') !== 'true') show(flowTab);
      requestAnimationFrame(() => items[i].scrollIntoView({ block: 'nearest', behavior: App.still ? 'auto' : 'smooth' }));
    });
    server.on('hover', (i) => items.forEach((b, k) => b.classList.toggle('is-hot', k === i)));
    server.on('door', (open) => {
      doorBtn.setAttribute('aria-pressed', String(open));
      doorBtn.textContent = open ? 'Дверца открыта' : 'Дверца закрыта';
    });
    server.on('done', ({ id, resolved, user }) => {
      tally(resolved);
      if (user && id === pending?.id) finish(resolved);
    });
    server.on('stage', ({ id, module }) => { if (id === pending?.id) { flash(module); trace(module); } });
    doorBtn.addEventListener('click', () => server.toggleDoor());
    resetBtn.addEventListener('click', () => server.reset());
    const breakBtn = $('[data-break]');
    const live = $('[data-live]');
    const liveText = $('[data-live-text]');
    const liveDefault = liveText.textContent;
    breakBtn?.addEventListener('click', () => server.breakServer());
    server.on('broken', () => {
      breakBtn.disabled = true;
      breakBtn.textContent = 'Уточка чинит…';
      live.classList.add('is-down');
      liveText.textContent = 'Сбой · уточка чинит';
      lock(true);
    });
    server.on('repaired', () => {
      breakBtn.disabled = false;
      breakBtn.textContent = breakBtn.dataset.breakLabel || 'Сломать сервер';
      live.classList.remove('is-down');
      liveText.textContent = liveDefault;
      if (!pending) lock(false);
    });
  }

  const TOPICS = [
    { re: /\bmcp\b|model context protocol/i, name: 'Протоколы агентов', found: 5,
      answer: 'MCP — открытый протокол, через который модель подключается к инструментам и данным. Он задаёт единый способ описывать ресурсы и вызывать функции: не нужно писать отдельную интеграцию для каждой модели.' },
    { re: /langgraph|crewai|сравн|отличи/i, name: 'Сравнение технологий', found: 7,
      answer: 'LangGraph лучше подходит для точного управления состоянием и маршрутами агента, CrewAI — для быстрого запуска команды ролевых специалистов. Для сложного продакшена чаще важнее контроль LangGraph, для прототипа — скорость CrewAI.' },
    { re: /\brag\b|векторн|эмбеддинг|поиск по базе/i, name: 'Поиск по знаниям', found: 6,
      answer: 'RAG дополняет ответ модели найденными фрагментами документов. Система нарезает базу на части, ищет подходящие по смыслу и ключевым словам, а затем передаёт их модели. Ссылки на источники снижают риск выдуманных фактов.' },
    { re: /агент|agentic|автоном/i, name: 'Агентные системы', found: 4,
      answer: 'ИИ-агент не просто пишет текст: он строит план, вызывает инструменты, проверяет результат и повторяет цикл до цели. В продакшене ему нужны ограничения прав, наблюдаемость и передача спорных решений человеку.' },
  ];
  const HUMAN = /человек|редактор|эксперт|вручную|проверь человеком/i;
  const URGENT = /срочн|сегодня|быстро|дедлайн/i;
  const classify = (q) => {
    if (/^(42|пасхалка|секрет)[!?.\s]*$/i.test(q.trim())) {
      return { topic: 'Секретное исследование', urgent: false, found: 1, escalate: false, decideAt: 2, why: '',
        answer: '42 — ответ на главный вопрос жизни, вселенной и всего такого по Дугласу Адаму. Источник проверен, пасхалка подтверждена.' };
    }
    const topic = TOPICS.find((t) => t.re.test(q));
    const human = HUMAN.test(q);
    return {
      topic: topic?.name || 'Открытое исследование', urgent: URGENT.test(q), found: topic ? topic.found : 3,
      answer: topic?.answer || 'Собран краткий отчёт: основные факты подтверждены несколькими источниками, спорных утверждений не найдено. В полной версии здесь появятся цитаты и ссылки на первоисточники.',
      escalate: human, decideAt: human ? 1 : 2,
      why: 'вы попросили редактора или исследование требует экспертной оценки',
    };
  };

  const form = $('[data-ask]');
  const input = $('#ask-input');
  const send = $('.ask__send', form);
  const presets = $$('[data-presets] .chip');
  const steps = $$('[data-steps] li');
  const question = $('[data-question]');
  const status = $('[data-status]');
  const answer = $('[data-answer]');
  const history = $('[data-history]');
  const historyList = $('[data-history-list]');
  const STEP_NAMES = steps.map((li) => li.textContent);
  let pending = null;
  let last = null;
  const swap = (el) => {
    if (!App.still) el.animate([{ opacity: 0, transform: 'translateY(.35rem)' }, { opacity: 1, transform: 'none' }], { duration: 320, easing: 'ease-out' });
  };
  const archive = () => {
    if (!last) return;
    const li = document.createElement('li');
    li.className = `history__item${last.human ? ' is-human' : ''}`;
    li.innerHTML = `<p class="history__q">${esc(last.q)}</p><p class="history__a">${esc(last.a)}</p><p class="history__meta">${esc(last.meta)}</p>`;
    historyList.prepend(li);
    while (historyList.children.length > 10) historyList.lastElementChild.remove();
    history.hidden = false;
    last = null;
  };
  const STEPS = [
    (c) => ['План', `разбил тему «${c.topic}» на направления поиска`],
    (c) => ['Поиск', `нашёл ${c.found} ${App.plural(c.found, ['источник', 'источника', 'источников'])}, приоритет ${c.urgent ? 'высокий' : 'обычный'}`],
    (c) => ['Факты', `извлёк тезисы и ссылки из ${c.found} ${App.plural(c.found, ['источника', 'источников', 'источников'])}`],
    () => ['Сверка', 'сопоставила факты, даты и первоисточники'],
    (c) => ['Отчёт', c.escalate ? 'подготовил черновик и список разногласий' : 'собрал выводы и добавил ссылки'],
    () => ['Редактор', 'получил отчёт, источники и спорные тезисы'],
  ];
  function trace(module) {
    if (!pending) return;
    const { c } = pending;
    const [who, what] = STEPS[module](c);
    const human = c.escalate && module >= c.decideAt;
    steps.forEach((li, k) => li.classList.toggle('is-now', k === module));
    steps[module].classList.add(human ? 'is-human' : 'is-done');
    pending.route.push(STEP_NAMES[module]);
    status.classList.toggle('is-human', human);
    status.innerHTML = `<i aria-hidden="true"></i><b>${who}:</b> ${esc(what)}`;
    swap(status);
  }
  function finish(resolved) {
    if (!pending) return;
    const { c, start } = pending;
    const sec = ((performance.now() - start) / 1000).toFixed(1).replace('.', ',');
    steps.forEach((li) => li.classList.remove('is-now'));
    if (resolved) steps[5].classList.add('is-skip');
    const meta = `${pending.route.join(' → ')} · ${sec} с`;
    status.className = 'run__status is-meta';
    status.textContent = meta;
    swap(status);
    const a = resolved ? c.answer : `Передано редактору: ${c.why}. Черновик отчёта, ссылки и спорные тезисы уже приложены.`;
    answer.classList.toggle('is-human', !resolved);
    answer.innerHTML = `<small>${resolved ? 'Краткий отчёт' : 'Нужен человек'}</small>${esc(a)}`;
    answer.hidden = false;
    last = { q: pending.q, a, meta, human: !resolved };
    pending = null;
    lock(false);
    const askTab = tabFor('tab-ask');
    if (askTab.getAttribute('aria-selected') !== 'true') askTab.classList.add('has-news');
  }
  const lock = (on) => {
    send.disabled = on;
    presets.forEach((p) => (p.disabled = on));
  };
  const ask = (q) => {
    q = q.trim();
    if (!q || pending || server?.broken) return;
    const c = classify(q);
    archive();
    steps.forEach((li) => (li.className = ''));
    question.textContent = q;
    question.hidden = false;
    swap(question);
    answer.hidden = true;
    status.className = 'run__status is-live';
    status.innerHTML = '<i aria-hidden="true"></i><b>Запущено</b> исследование…';
    lock(true);
    pending = { c, q, start: performance.now(), id: null, route: [] };
    if (server) {
      pending.id = server.send({ escalate: c.escalate, decideAt: c.decideAt });
      server.select(-1);
    } else {
      const lastStep = c.escalate ? 5 : 4;
      for (let i = 0; i <= lastStep; i++) setTimeout(() => { trace(i); if (i === lastStep) setTimeout(() => finish(!c.escalate), 600); }, 500 + i * 700);
    }
  };
  form.addEventListener('submit', (e) => { e.preventDefault(); ask(input.value); input.value = ''; });
  presets.forEach((p) => p.addEventListener('click', () => ask(p.textContent)));

  const celebrate = () => App.server?.celebrate();
  const researchScan = () => {
    celebrate();
    App.toast('Режим исследования: все факты подтверждены…');
    if (App.still) return;
    const scan = document.createElement('div');
    scan.className = 'review-scan';
    scan.setAttribute('aria-hidden', 'true');
    document.body.append(scan);
    setTimeout(() => scan.remove(), 2500);
  };
  let typed = '';
  const konami = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
  let konamiAt = 0;
  addEventListener('keydown', (e) => {
    if (e.target.closest?.('input, textarea, [contenteditable]')) return;
    if (e.key.length === 1) {
      typed = (typed + e.key.toLowerCase()).slice(-8);
      if (typed.endsWith('research') || typed.endsWith('ресерч')) { typed = ''; researchScan(); }
    }
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    konamiAt = key === konami[konamiAt] ? konamiAt + 1 : key === konami[0] ? 1 : 0;
    if (konamiAt !== konami.length) return;
    konamiAt = 0;
    celebrate();
    App.toast('Секретный источник подтверждён');
    if (App.still) return;
    const approval = document.createElement('div');
    approval.className = 'approval';
    approval.setAttribute('aria-hidden', 'true');
    approval.innerHTML = '<div class="approval__stamp"><b>FACTS</b><span>12 источников · всё сошлось</span></div>';
    for (let i = 0; i < 28; i++) {
      const bit = document.createElement('i');
      bit.style.setProperty('--x', `${Math.random() * 100}%`);
      bit.style.setProperty('--delay', `${Math.random() * 0.7}s`);
      bit.style.setProperty('--turn', `${Math.random() * 720 - 360}deg`);
      approval.append(bit);
    }
    document.body.append(approval);
    setTimeout(() => approval.remove(), 3400);
  });
  const title = $('[data-review-title]');
  let titleClicks = 0;
  let clickTimer;
  title.addEventListener('click', () => {
    clearTimeout(clickTimer);
    titleClicks++;
    clickTimer = setTimeout(() => (titleClicks = 0), 700);
    if (titleClicks < 3) return;
    titleClicks = 0;
    celebrate();
    App.toast('R3S34RCH CR3W: агенты на связи');
    title.textContent = 'R3S34RCH CR3W';
    title.classList.add('is-glitch');
    setTimeout(() => { title.textContent = 'Research Crew'; title.classList.remove('is-glitch'); }, 1800);
  });
  console.log('%c RESEARCH CREW %c 4 секрета: research, Konami code, три клика по названию и ответ на главный вопрос.', 'background:#ffed00;color:#181818;font-weight:800;padding:4px 8px;border-radius:4px', 'color:inherit;padding:4px');
})();
