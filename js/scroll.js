// Всё, что зависит от прокрутки: «стопка карт» из секций, занавес футера, кнопка «наверх» и переход по якорям.
// Каждый эффект работает только пока его видно и ничего не пишет, когда менять нечего.
(() => {
  const { clamp, still, root } = App;
  const main = document.querySelector('main');
  const sections = [...main.querySelectorAll(':scope > .section')];
  const footer = document.querySelector('.footer');

  let H = innerHeight, tops = [], mainH = 0, footH = 0, docH = 0;

  // Стопка карт: секция прилипает, следующая наезжает поверх, а уходящая чуть уменьшается и темнеет.
  // Затемнение — отдельный слой: его opacity не трогает стили содержимого секции
  const stack = !still;
  root.classList.toggle('has-stack', stack);
  const shades = sections.slice(0, -1).map((s) => {
    if (!stack) return null;
    const d = document.createElement('div');
    d.className = 'section__shade';
    d.setAttribute('aria-hidden', 'true');
    s.append(d);
    return d;
  });
  const last = sections.map(() => ({ cover: -1, stuck: null }));

  // Размеры считаем при загрузке и ресайзе, а не на каждом кадре
  const layout = () => {
    H = innerHeight;
    let y = 0;
    tops = sections.map((s) => { const t = y; y += s.offsetHeight; return t; });
    mainH = y;
    footH = footer.offsetHeight;
    docH = document.documentElement.scrollHeight;
    // Высокая секция прилипает нижним краем — иначе её низ никто бы не увидел.
    // Уменьшается она к центру экрана, а не к своему центру
    if (stack) sections.forEach((s, i) => {
      const top = Math.min(0, H - s.offsetHeight);
      s.style.top = `${top}px`;
      s.style.transformOrigin = `50% ${H / 2 - top}px`;
      last[i].cover = -1;
    });
    // Занавес футера включаем, только если футер помещается в экран
    root.classList.toggle('has-curtain', !still && footH < H * 0.95);
    onScroll();
  };

  // Прокрутка: занавес футера и кнопка «наверх». Обработчик объединяет события в один кадр
  const toTop = document.querySelector('[data-to-top]');
  const ring = toTop?.querySelector('.to-top__ring');
  let lastReveal = -1;
  let queued = false;
  function onScroll() {
    queued = false;
    const y = scrollY;
    if (stack) sections.forEach((s, i) => {
      const st = last[i];
      // Следующая секция въезжает снизу: 0 — только показалась, 1 — закрыла эту целиком
      if (i < sections.length - 1) {
        const cover = clamp((y + H - tops[i + 1]) / H);
        if (Math.abs(cover - st.cover) > 0.001) {
          st.cover = cover;
          s.style.transform = cover > 0 ? `scale(${(1 - cover * 0.07).toFixed(4)})` : '';
          shades[i].style.opacity = (cover * 0.6).toFixed(3);
          // Закрытую секцию браузер не рисует вовсе
          s.style.visibility = cover >= 1 ? 'hidden' : '';
        }
      }
      // Скруглённые углы у въезжающей секции пропадают, когда она доехала до верха
      if (i > 0) {
        const stuck = y >= tops[i] - 1;
        if (stuck !== st.stuck) { st.stuck = stuck; s.classList.toggle('is-stuck', stuck); }
      }
    });
    const reveal = root.classList.contains('has-curtain') ? clamp((y + H - mainH) / footH) : 1;
    if (Math.abs(reveal - lastReveal) > 0.002) { lastReveal = reveal; footer.style.setProperty('--reveal', reveal.toFixed(3)); }
    if (toTop) {
      toTop.classList.toggle('is-on', y > H * 0.8);
      ring.style.strokeDashoffset = (1 - clamp(y / Math.max(1, docH - H))).toFixed(3);
    }
  }
  addEventListener('scroll', () => { if (!queued) { queued = true; requestAnimationFrame(onScroll); } }, { passive: true });
  layout();
  addEventListener('resize', layout);
  new ResizeObserver(layout).observe(main);
  document.fonts?.ready.then(layout);

  bindAnchors();

  // Переход по якорю — просто плавная прокрутка к секции. Футер лежит под занавесом,
  // поэтому для него цель — самый низ страницы
  function bindAnchors() {
    const targetY = (el) => {
      if (el === footer) return docH - H;
      const i = sections.indexOf(el);
      return i >= 0 ? tops[i] : el.getBoundingClientRect().top + scrollY;
    };
    const go = (el, hash) => {
      App.closeMenu?.();
      scrollTo({ top: targetY(el), behavior: still ? 'auto' : 'smooth' });
      history.pushState(null, '', hash);
      // Фокус переезжает в секцию — клавиатура и скринридер продолжают с нужного места
      el.setAttribute('tabindex', '-1');
      el.focus({ preventScroll: true });
    };
    document.addEventListener('click', (e) => {
      const a = e.target.closest('a[href^="#"]');
      if (!a || e.defaultPrevented) return;
      const hash = a.getAttribute('href');
      const el = hash.length > 1 && document.getElementById(hash.slice(1));
      if (!el) return;
      e.preventDefault();
      go(el, hash);
    });
  }
})();
