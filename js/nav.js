// Навигация: всегда на экране и подстраивает цвет под секцию под ней.
// Плюс полноэкранное меню для телефона.
(() => {
  const nav = document.querySelector('[data-nav]');
  if (!nav) return;
  const main = document.querySelector('main');
  const sections = [...main.querySelectorAll(':scope > .section')];
  const footer = document.querySelector('.footer');

  // Позиции секций считаем один раз (и при ресайзе), а не опрашиваем раскладку на каждом кадре
  let tops = [], mainH = 0;
  const measure = () => {
    let y = 0;
    tops = sections.map((s) => { const t = y; y += s.offsetHeight; return t; });
    mainH = y;
  };
  measure();
  addEventListener('resize', measure);
  new ResizeObserver(measure).observe(main);

  const themeAt = (y) => {
    if (y >= mainH) return footer.dataset.theme;
    for (let i = sections.length - 1; i >= 0; i--) if (y >= tops[i]) return sections[i].dataset.theme;
    return sections[0].dataset.theme;
  };

  // Навигация видна всегда — меняется только цвет под секцию и подложка после начала прокрутки
  let queued = false;
  const update = () => {
    queued = false;
    const y = scrollY;
    const theme = themeAt(y + 28);
    if (nav.dataset.theme !== theme) nav.dataset.theme = theme;
    nav.classList.toggle('is-scrolled', y > 40);
  };
  // Работает только когда страницу крутят, не на каждом кадре
  addEventListener('scroll', () => { if (!queued) { queued = true; requestAnimationFrame(update); } }, { passive: true });
  update();

  // Меню раскрывается кругом из кнопки и закрывается так же
  const menu = document.querySelector('[data-menu]');
  const toggle = nav.querySelector('[data-menu-toggle]');
  if (!menu || !toggle) return;

  const open = () => {
    const b = toggle.getBoundingClientRect();
    menu.style.setProperty('--ox', `${b.left + b.width / 2}px`);
    menu.style.setProperty('--oy', `${b.top + b.height / 2}px`);
    menu.hidden = false;
    void menu.offsetWidth;
    App.root.classList.add('menu-open');
    toggle.setAttribute('aria-expanded', 'true');
    toggle.querySelector('.nav__menu-label').textContent = 'Закрыть';
    menu.querySelector('a').focus({ preventScroll: true });
  };
  const close = () => {
    if (!App.root.classList.contains('menu-open')) return;
    App.root.classList.remove('menu-open');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.querySelector('.nav__menu-label').textContent = 'Меню';
    setTimeout(() => { if (!App.root.classList.contains('menu-open')) menu.hidden = true; }, App.still ? 0 : 700);
  };
  App.closeMenu = close;
  toggle.addEventListener('click', () => (App.root.classList.contains('menu-open') ? close() : open()));
  addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
})();
