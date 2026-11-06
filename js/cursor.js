// Свой курсор: точка и кольцо, которое догоняет её с инерцией.
// Только для мыши: на сенсорных экранах и при reduced motion ничего не включается.
(() => {
  if (!App.fine || App.still) return;
  const { pointer, lerp } = App;

  // Два отдельных fixed-элемента: так каждый движется со своей скоростью
  const make = (cls) => { const el = document.createElement('div'); el.className = cls; el.setAttribute('aria-hidden', 'true'); document.body.append(el); return el; };
  const dot = make('cursor-dot');
  const ring = make('cursor-ring');
  // Пока мышь не двигалась, курсора не видно — иначе он висел бы в углу экрана
  App.root.classList.add('has-cursor', 'is-cursor-away');
  const wake = () => App.root.classList.remove('is-cursor-away');
  addEventListener('pointermove', wake, { once: true });
  addEventListener('pointerdown', wake, { once: true });
  document.documentElement.addEventListener('pointerleave', () => App.root.classList.add('is-cursor-away'));
  document.documentElement.addEventListener('pointerenter', () => pointer.active && wake());

  // Цвет под тему секции: на красном и чёрном — жёлтый, на светлом — красный.
  // Пишем прямо в элементы курсора: переменная на <html> пересчитывала бы стили всей страницы
  const colors = { rosso: 'var(--giallo)', ink: 'var(--giallo)', paper: 'var(--rosso)' };
  let color = '';
  document.addEventListener('pointerover', (e) => {
    const t = e.target;
    if (!(t instanceof Element)) return;
    // На красных и чёрных клетках таблицы стека — жёлтый, на жёлтых и белых — красный
    const g = t.closest('.el, .el-card')?.dataset.group;
    const c = g ? (g === 'lang' || g === 'data' ? colors.ink : colors.paper) : colors[t.closest('[data-theme]')?.dataset.theme] || colors.ink;
    if (c === color) return;
    color = c;
    dot.style.setProperty('--cursor', c);
    ring.style.setProperty('--cursor', c);
  });
  document.addEventListener('pointerdown', () => ring.classList.add('is-down'));
  document.addEventListener('pointerup', () => ring.classList.remove('is-down'));

  const r = { x: pointer.x, y: pointer.y };
  let lx = -1, ly = -1;
  App.loop(() => {
    if (!pointer.active) return;
    // Кольцо догнало точку и мышь стоит — кадр ничего не пишет
    if (lx === pointer.x && ly === pointer.y && Math.abs(r.x - lx) < 0.1 && Math.abs(r.y - ly) < 0.1) return;
    lx = pointer.x; ly = pointer.y;
    r.x = lerp(r.x, lx, 0.22); r.y = lerp(r.y, ly, 0.22);
    dot.style.transform = `translate3d(${lx}px, ${ly}px, 0)`;
    ring.style.transform = `translate3d(${r.x.toFixed(1)}px, ${r.y.toFixed(1)}px, 0)`;
  });
})();
