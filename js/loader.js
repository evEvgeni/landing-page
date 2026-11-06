// Заставка. Логотип появляется с «ударом» и вспышкой и медленно наезжает на камеру.
// Когда сайт загружен, камера влетает в ромб: он распадается на вертикальные ленты
// цветов сайта, фон растворяется, и сквозь ленты открывается страница.
// Всё движение — CSS-анимации; скрипт строит ленты и переключает фазы классами.
(() => {
  const el = document.querySelector('[data-loader]');
  if (!el) return;
  const { root } = App;
  if (!root.classList.contains('is-loading')) { el.remove(); return; }

  // Буквы имени выезжают по одной
  const name = el.querySelector('[data-loader-name]');
  name.replaceChildren(...[...name.textContent].map((ch, i) => {
    const s = document.createElement('span');
    s.textContent = ch;
    s.style.setProperty('--i', i);
    return s;
  }));

  // Ленты: случайные ширина и цвет, гуще к центру. Чем дальше от центра, тем позже вылетает
  const COLORS = ['var(--rosso)', 'var(--rosso)', 'var(--rosso)', 'var(--giallo)', 'var(--giallo)', '#fff', '#ff5a4a', '#7a0000'];
  const streaks = el.querySelector('[data-loader-streaks]');
  const count = innerWidth < 768 ? 36 : 64;
  for (let i = 0; i < count; i++) {
    const r = Math.random() * 2 - 1;
    const x = Math.sign(r) * Math.pow(Math.abs(r), 1.4) * 60;
    const b = document.createElement('i');
    b.style.setProperty('--x', `${x.toFixed(2)}vw`);
    b.style.setProperty('--w', `${(0.25 + Math.random() ** 2 * 2.6).toFixed(2)}vw`);
    b.style.setProperty('--d', `${((Math.abs(x) / 60) * 0.3 + Math.random() * 0.12).toFixed(3)}s`);
    b.style.setProperty('--c', COLORS[Math.floor(Math.random() * COLORS.length)]);
    streaks.append(b);
  }

  // Логотип стартует, когда готовы шрифты — иначе имя мигнуло бы запасным шрифтом
  const fonts = document.fonts ? document.fonts.ready : Promise.resolve();
  Promise.race([fonts, App.wait(600)]).then(() => el.classList.add('is-in'));

  // Заставка идёт не меньше 2 с — успеть увидеть логотип — и не дольше 3,2 с, даже на медленной сети
  const loaded = new Promise((r) => (document.readyState === 'complete' ? r() : addEventListener('load', r, { once: true })));
  Promise.race([Promise.all([fonts, loaded, App.wait(2000)]), App.wait(3200)]).then(async () => {
    // Пока имя гаснет, логотип съезжает так, чтобы ромб встал в центр: в него и летит камера
    const m = el.querySelector('.loader__mark').getBoundingClientRect();
    el.style.setProperty('--dx', `${(innerWidth / 2 - (m.left + m.width / 2)).toFixed(1)}px`);
    el.classList.add('is-go');
    // Сайт оживает, когда фон заставки начинает растворяться
    await App.wait(650);
    root.classList.remove('is-loading');
    App.markReady();
    await App.wait(1100);
    el.remove();
    try { sessionStorage.setItem('booted', '1'); } catch (e) {}
  });
})();
