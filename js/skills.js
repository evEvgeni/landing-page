// Периодическая таблица стека: наведение или клик по элементу показывает его в большой карточке,
// наведение на заголовок группы приглушает остальные столбцы. Клик по группе закрепляет выбор.
(() => {
  const grid = document.querySelector('[data-pt-grid]');
  const card = document.querySelector('[data-el-card]');
  if (!grid || !card) return;
  const els = [...grid.querySelectorAll('.el')];
  const groups = [...document.querySelectorAll('.pt-group')];
  const c = Object.fromEntries([...card.querySelectorAll('[data-c]')].map((n) => [n.dataset.c, n]));

  // Элементы появляются волной от левого верхнего угла: задержка = строка + столбец
  els.forEach((el, i) => el.style.setProperty('--i', (i % 3) + Math.floor(i / 3)));

  let current = els[0];
  const show = (el) => {
    if (el === current) return;
    current.setAttribute('aria-pressed', 'false');
    el.setAttribute('aria-pressed', 'true');
    current = el;
    const years = +el.dataset.years;
    card.dataset.group = el.dataset.group;
    c.num.textContent = el.querySelector('.el__num').textContent;
    c.group.textContent = el.dataset.gname;
    c.sym.textContent = el.querySelector('.el__sym').textContent;
    c.desc.textContent = el.querySelector('.el__desc').textContent;
    c.used.textContent = el.dataset.used;
    c.years.textContent = `${years} ${App.plural(years, ['год', 'года', 'лет'])}`;
    c.bar.style.setProperty('--level', years / 5);
    c.dots.style.setProperty('--n', years);
    App.scramble(c.name, el.querySelector('.el__name').textContent, 420);
    if (!App.still) {
      // Символ въезжает снизу, описание проявляется следом
      c.sym.animate([{ transform: 'translateY(35%)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 450, easing: 'cubic-bezier(.2, .8, .2, 1)' });
      c.desc.animate([{ opacity: 0, transform: 'translateY(.5rem)' }, { opacity: 1, transform: 'none' }], { duration: 400, delay: 60, easing: 'ease-out', fill: 'backwards' });
    }
  };
  els.forEach((el) => {
    el.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') show(el); });
    el.addEventListener('focus', () => show(el));
    el.addEventListener('click', () => {
      show(el);
      // На узком экране карточка под таблицей — подкручиваем к ней
      if (innerWidth < 1024) card.scrollIntoView({ behavior: App.still ? 'auto' : 'smooth', block: 'nearest' });
    });
  });

  // Группы: наведение подсвечивает столбец, клик закрепляет (повторный — снимает)
  let pinned = null;
  const focusGroup = (g) => {
    if (g) grid.dataset.focus = g; else delete grid.dataset.focus;
    groups.forEach((b) => b.classList.toggle('is-on', b.dataset.group === g));
  };
  groups.forEach((b) => {
    const g = b.dataset.group;
    b.addEventListener('pointerenter', () => focusGroup(g));
    b.addEventListener('pointerleave', () => focusGroup(pinned));
    b.addEventListener('click', () => {
      pinned = pinned === g ? null : g;
      groups.forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.group === pinned)));
      focusGroup(pinned);
      if (pinned) show(els.find((el) => el.dataset.group === pinned));
    });
  });
})();
