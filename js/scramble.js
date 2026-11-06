// «Расшифровка» текста: буквы перебирают случайные символы своего алфавита и по очереди встают на место.
// App.scramble(el) — вручную; номера карточек — при появлении.
(() => {
  const POOLS = {
    num: '0123456789',
    cyr: 'АБВГДЕЖЗИКЛМНОПРСТУФХЦЧШЩЭЮЯ',
    lat: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  };
  const poolOf = (ch) => (/\d/.test(ch) ? POOLS.num : /[а-яё]/i.test(ch) ? POOLS.cyr : /[a-z]/i.test(ch) ? POOLS.lat : null);
  const pick = (s) => s[Math.floor(Math.random() * s.length)];

  App.scramble = (el, text = el.dataset.text ?? el.textContent, ms = 650) => {
    el.dataset.text = text;
    cancelAnimationFrame(el._scramble);
    if (App.still) { el.textContent = text; return; }

    const chars = [...text];
    const at = chars.map((_, i) => (i / chars.length) * ms * 0.65 + Math.random() * ms * 0.35);
    const start = performance.now();
    let frame = 0;
    const step = (now) => {
      const t = now - start;
      // Случайные буквы меняются через кадр — мерцание читается спокойнее
      if (frame++ % 2 === 0) {
        el.textContent = chars.map((ch, i) => {
          const pool = poolOf(ch);
          if (t >= at[i] || !pool) return ch;
          const r = pick(pool);
          return ch === ch.toLowerCase() ? r.toLowerCase() : r;
        }).join('');
      }
      if (t < ms) el._scramble = requestAnimationFrame(step);
      else el.textContent = text;
    };
    el._scramble = requestAnimationFrame(step);
  };

  // Номер карточки «подбирается», когда карточка появляется на экране
  document.querySelectorAll('.project').forEach((card) => {
    const num = card.querySelector('.project__num');
    if (num) card.addEventListener('reveal', () => setTimeout(() => App.scramble(num, num.textContent, 900), 250), { once: true });
  });
})();
