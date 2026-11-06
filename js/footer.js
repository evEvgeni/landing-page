// Футер: кнопка «скопировать почту» и часы с моим местным временем.
(() => {
  document.querySelectorAll('[data-copy]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const text = btn.dataset.copy;
      try {
        await navigator.clipboard.writeText(text);
        App.toast('Почта скопирована');
      } catch {
        // Буфер обмена недоступен (например, страница открыта с file://) — открываем почтовый клиент
        location.href = `mailto:${text}`;
      }
    });
  });

  // Время там, где живу я, а не посетитель. Обновляется ровно на смене минуты
  const clock = document.querySelector('[data-clock]');
  if (clock) {
    const fmt = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: clock.dataset.tz });
    const tick = () => {
      const now = new Date();
      clock.textContent = fmt.format(now);
      clock.dateTime = now.toISOString();
      setTimeout(tick, 60000 - (now % 60000));
    };
    tick();
  }
})();
