// Сводка на странице Support Agent: цифры, живые счётчики, список модулей и «задайте вопрос».
// Связана со стойкой через App.server; без WebGL работает сама, шаги просто идут по таймеру.
(() => {
  const server = App.server;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const fmt = (n, d = 0) => n.toLocaleString('ru-RU', { minimumFractionDigits: d, maximumFractionDigits: d });

  // ---------- Навигация: подложка после начала прокрутки, «назад» — к тому же месту главной ----------
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

  // Красная заливка уходит вверх и открывает страницу
  const root = App.root;
  if (root.classList.contains('is-wiping')) {
    const wipe = $('.wipe--page');
    const done = () => root.classList.remove('is-wiping');
    wipe.addEventListener('animationend', (e) => { if (e.target === wipe) done(); });
  }

  // ---------- Вкладки сводки ----------
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
    // Стрелки переключают вкладки, как в обычном переключателе
    t.addEventListener('keydown', (e) => {
      const d = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
      if (!d) return;
      e.preventDefault();
      show(tabs[(i + d + tabs.length) % tabs.length], true);
    });
  });

  // ---------- Метрики набегают при появлении ----------
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

  // ---------- Живые счётчики ----------
  const stat = Object.fromEntries($$('[data-stat]').map((el) => [el.dataset.stat, el]));
  const bar = $('[data-stat-bar]');
  const totals = { total: 0, closed: 0, human: 0 };
  const render = () => {
    stat.total.textContent = fmt(totals.total);
    stat.closed.textContent = fmt(totals.closed);
    stat.human.textContent = fmt(totals.human);
    const rate = totals.total ? totals.closed / totals.total : 0.7;
    stat.rate.textContent = totals.total ? `${Math.round(rate * 100)}%` : '—';
    bar.style.setProperty('--rate', rate.toFixed(3));
  };
  const tally = (resolved) => {
    totals.total++;
    resolved ? totals.closed++ : totals.human++;
    render();
  };

  // ---------- Модули: список ↔ стойка ----------
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

  // Нагрузка раскрытого модуля обновляется дважды в секунду
  setInterval(() => {
    if (current < 0 || !server) return;
    const el = $('[data-load]', items[current]);
    if (el) el.textContent = `${Math.round(server.load(current) * 100)}%`;
  }, 500);

  // Модуль, в который сейчас зашёл ваш пакет, подсвечивается и в списке
  const flash = (i) => {
    const b = items[i];
    if (!b) return;
    b.classList.add('is-flash');
    setTimeout(() => b.classList.remove('is-flash'), 700);
  };

  // ---------- Инструменты сцены ----------
  const doorBtn = $('[data-door]');
  const resetBtn = $('[data-reset]');

  if (server) {
    server.on('select', (i) => {
      current = i;
      expand(i);
      if (i < 0) return;
      // Клик по модулю в стойке открывает вкладку «Как устроен» на этом модуле.
      // Пока ваше обращение идёт по стойке, вкладку «Спросить» не уводим — только отмечаем точкой
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

    // Поломка: плашка статуса краснеет, вопросы ждут, пока уточка чинит стойку
    const breakBtn = $('[data-break]');
    const live = $('[data-live]');
    const liveText = $('[data-live-text]');
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
      breakBtn.textContent = 'Сломать сервер';
      live.classList.remove('is-down');
      liveText.textContent = 'В продакшене';
      if (!pending) lock(false);
    });
  }

  // ---------- Вопрос агенту ----------
  // Простой классификатор по ключевым словам: в демо он только выбирает маршрут и готовый ответ
  const TOPICS = [
    { re: /заказ|достав|курьер|трек|посылк|привез/i, name: 'Доставка', found: 3,
      answer: 'Заказ №48213 уже у курьера и приедет завтра с 10:00 до 14:00. Трек-номер отправил вам на почту.' },
    { re: /парол|войти|вход|аккаунт|логин|авториз/i, name: 'Аккаунт', found: 2,
      answer: 'Отправил ссылку для сброса пароля на почту, привязанную к аккаунту. Она действует 30 минут.' },
    { re: /оплат|списал|карт|сч[её]т|деньг|возврат|вернуть|чек/i, name: 'Оплата', found: 4,
      answer: 'Вижу двойное списание 12 ноября. Второй платёж отменён, деньги вернутся на карту за 1–3 рабочих дня.' },
    { re: /ошибк|не работает|баг|слома|вылета|завис|глюч/i, name: 'Техническая проблема', found: 2,
      answer: 'Это известная ошибка версии 2.3 — она исправлена в обновлении 2.3.1. Обновите приложение, и всё заработает.' },
  ];
  const HUMAN = /жалоб|суд|юрист|претенз|человек|оператор|живо|руковод|менеджер/i;
  const URGENT = /срочн|немедленн|сейчас же|!!|быстрее/i;

  const classify = (q) => {
    const topic = TOPICS.find((t) => t.re.test(q));
    const human = HUMAN.test(q);
    return {
      topic: topic?.name || 'Общий вопрос',
      urgent: URGENT.test(q),
      found: topic ? topic.found : 0,
      answer: topic?.answer,
      // Просит человека — уходит к оператору сразу после классификатора; ничего не нашлось — после поиска
      escalate: human || !topic,
      decideAt: human ? 1 : 2,
      why: human ? 'клиент просит человека или тема чувствительная' : 'в базе знаний нет ответа',
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
  let last = null; // прошлый вопрос с ответом — уйдёт в историю, когда зададут новый

  // Плавная смена содержимого: новый текст «выезжает» на месте старого
  const swap = (el) => {
    if (!App.still) el.animate([{ opacity: 0, transform: 'translateY(.35rem)' }, { opacity: 1, transform: 'none' }], { duration: 320, easing: 'ease-out' });
  };

  // Прошлая пара «вопрос — ответ» добавляется в начало истории, свежая сверху
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

  // Что сделал каждый модуль — строка статуса под вопросом, шаги сменяют друг друга
  const STEPS = [
    () => ['Шлюз', 'принял обращение и скрыл личные данные'],
    (c) => ['Классификатор', `тема «${c.topic}», срочность ${c.urgent ? 'высокая' : 'обычная'}`],
    (c) => ['Поиск', c.found ? `нашёл ${c.found} ${App.plural(c.found, ['статью', 'статьи', 'статей'])} в базе знаний` : 'подходящих статей не нашёл'],
    () => ['Память', 'подтянула историю клиента из Postgres'],
    (c) => ['Ответ', c.escalate ? 'подготовил черновик для оператора' : 'написан по источникам и проверен'],
    () => ['Оператор', 'получил обращение с контекстом и черновиком'],
  ];

  const esc = (s) => s.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);

  function trace(module) {
    if (!pending) return;
    const { c } = pending;
    const [who, what] = STEPS[module](c);
    const human = c.escalate && module >= c.decideAt;
    steps.forEach((li, k) => li.classList.toggle('is-now', k === module));
    steps[module].classList.add(human ? 'is-human' : 'is-done');
    pending.route.push(STEP_NAMES[module]);
    // Новый шаг сменяет предыдущий в той же строке
    status.classList.toggle('is-human', human);
    status.innerHTML = `<i aria-hidden="true"></i><b>${who}:</b> ${esc(what)}`;
    swap(status);
  }

  function finish(resolved) {
    if (!pending) return;
    const { c, start } = pending;
    const sec = ((performance.now() - start) / 1000).toFixed(1).replace('.', ',');
    steps.forEach((li) => li.classList.remove('is-now'));
    // Обращение закрыто агентом — шаг «Человек» не понадобился
    if (resolved) steps[5].classList.add('is-skip');
    // Статус сворачивается в короткий маршрут обращения, под ним — ответ
    const meta = `${pending.route.join(' → ')} · ${sec} с`;
    status.className = 'run__status is-meta';
    status.textContent = meta;
    swap(status);
    const a = resolved ? c.answer : `Передано оператору: ${c.why}. Он ответит с готовым черновиком и всем контекстом.`;
    answer.classList.toggle('is-human', !resolved);
    answer.innerHTML = `<small>${resolved ? 'Ответ агента' : 'Нужен человек'}</small>${esc(a)}`;
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
    // Вопрос остаётся на виду, пока идёт обработка и после ответа
    question.textContent = q;
    question.hidden = false;
    swap(question);
    answer.hidden = true;
    status.className = 'run__status is-live';
    status.innerHTML = '<i aria-hidden="true"></i><b>Отправлено</b> в стойку…';
    lock(true);
    pending = { c, q, start: performance.now(), id: null, route: [] };
    if (server) {
      pending.id = server.send({ escalate: c.escalate, decideAt: c.decideAt });
      // Свой пакет хорошо видно, только если модуль не закрывает его — снимаем выбор и открываем дверцу
      server.select(-1);
    } else {
      // Без 3D шаги идут по таймеру
      const last = c.escalate ? 5 : 4;
      for (let i = 0; i <= last; i++) setTimeout(() => { trace(i); if (i === last) setTimeout(() => finish(!c.escalate), 600); }, 500 + i * 700);
    }
  };

  form.addEventListener('submit', (e) => { e.preventDefault(); ask(input.value); input.value = ''; });
  presets.forEach((p) => p.addEventListener('click', () => ask(p.textContent)));
})();
