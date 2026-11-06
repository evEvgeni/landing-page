// Ядро: общие помощники, единый цикл анимаций и появление блоков. Остальные скрипты пользуются window.App.
(() => {
  const root = document.documentElement;
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Мышь или тачпад: на сенсорных экранах курсор, наклоны и магниты не нужны
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;

  let markReady;
  const ready = new Promise((r) => (markReady = r));

  // Один requestAnimationFrame на всю страницу вместо отдельного цикла у каждого эффекта
  const tasks = new Set();
  const tick = (t) => {
    tasks.forEach((fn) => fn(t));
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  const pointer = { x: innerWidth / 2, y: innerHeight / 2, active: false };
  const track = (e) => { pointer.x = e.clientX; pointer.y = e.clientY; pointer.active = true; };
  addEventListener('pointermove', track, { passive: true });
  addEventListener('pointerdown', track, { passive: true });

  window.App = {
    root, still, fine, ready, pointer,
    markReady: () => markReady(),
    loop(fn) { tasks.add(fn); return () => tasks.delete(fn); },
    lerp: (a, b, k) => a + (b - a) * k,
    clamp: (v, a = 0, b = 1) => Math.min(b, Math.max(a, v)),
    wait: (ms) => new Promise((r) => setTimeout(r, ms)),
    // Плавная анимация числа: duration в мс, ease по умолчанию — быстрый старт и мягкая остановка
    tween(ms, fn, ease = (t) => 1 - Math.pow(1 - t, 3)) {
      return new Promise((done) => {
        const start = performance.now();
        const step = (now) => {
          const t = Math.min(1, (now - start) / ms);
          fn(ease(t));
          t < 1 ? requestAnimationFrame(step) : done();
        };
        requestAnimationFrame(step);
      });
    },
    // 1 год, 2 года, 5 лет
    plural(n, [one, few, many]) {
      const a = n % 10, b = n % 100;
      if (a === 1 && b !== 11) return one;
      if (a >= 2 && a <= 4 && (b < 12 || b > 14)) return few;
      return many;
    },
    toast(text) {
      const el = document.querySelector('[data-toast]');
      if (!el) return;
      el.textContent = text;
      el.classList.add('is-on');
      clearTimeout(el._t);
      el._t = setTimeout(() => el.classList.remove('is-on'), 2600);
    },
  };

  // Без прелоадера страница готова сразу
  if (!root.classList.contains('is-loading')) markReady();

  // 1. Поочерёдное появление [data-reveal] внутри каждого родителя
  const items = document.querySelectorAll('[data-reveal]');
  items.forEach((el) => {
    if (el.style.getPropertyValue('--i')) return;
    const siblings = [...el.parentElement.querySelectorAll(':scope > [data-reveal]')];
    el.style.setProperty('--i', siblings.indexOf(el));
  });

  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      el.classList.add('is-visible');
      el.dispatchEvent(new CustomEvent('reveal'));
      io.unobserve(el);
      // После появления атрибут снимается: у элемента снова работают его собственные transform и transition
      const done = (e) => {
        if (e.target !== el || e.propertyName !== 'opacity') return;
        el.removeAttribute('data-reveal');
        el.removeEventListener('transitionend', done);
      };
      el.addEventListener('transitionend', done);
    });
  }, { threshold: 0.15 });

  // Пока идёт прелоадер, блоки первого экрана ждут
  ready.then(() => items.forEach((el) => io.observe(el)));

  // 2. Год в футере всегда актуален
  document.querySelectorAll('[data-year]').forEach((el) => (el.textContent = new Date().getFullYear()));
})();
