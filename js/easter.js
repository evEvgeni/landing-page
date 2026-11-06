// Пасхалки: набранное на клавиатуре «agent» (или «агент») запускает всю сеть, плюс привет в консоли.
(() => {
  const words = ['agent', 'агент'];
  let typed = '';
  addEventListener('keydown', (e) => {
    if (e.target.closest?.('input, textarea, [contenteditable]') || e.key.length !== 1) return;
    typed = (typed + e.key.toLowerCase()).slice(-5);
    if (!words.includes(typed)) return;
    typed = '';
    App.toast('Все агенты запущены ⚡');
    // Если сеть не видно — сначала возвращаемся на первый экран, потом запускаем
    if (scrollY > innerHeight * 0.5) {
      document.querySelector('a[href="#hero"]')?.click();
      setTimeout(() => App.netBurst?.(), 900);
    } else App.netBurst?.();
  });

  console.log(
    '%c Е.Ш. %c Любите заглядывать под капот? Я тоже. Напишите: hello@example.com',
    'background:#dc0000;color:#fff;font-weight:800;padding:4px 8px;border-radius:4px',
    'color:inherit;padding:4px'
  );
})();
