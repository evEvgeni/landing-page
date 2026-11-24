(() => {
  const gate = document.querySelector('[data-learning-gate]');
  const content = document.querySelector('[data-learning-content]');
  const unlock = document.querySelector('[data-unlock-learning]');
  if (!gate || !content || !unlock) return;

  const STORAGE_KEY = 'learning-access-v1';
  let hasAccess = false;
  try { hasAccess = localStorage.getItem(STORAGE_KEY) === 'demo'; } catch (error) {}

  const render = () => {
    gate.hidden = hasAccess;
    content.hidden = !hasAccess;
    document.documentElement.classList.toggle('has-learning-access', hasAccess);
  };

  unlock.addEventListener('click', () => {
    hasAccess = true;
    try { localStorage.setItem(STORAGE_KEY, 'demo'); } catch (error) {}
    render();
    document.dispatchEvent(new Event('learning:unlock'));
    content.querySelector('h1')?.setAttribute('tabindex', '-1');
    content.querySelector('h1')?.focus({ preventScroll: true });
    App.toast('Демо-доступ открыт. Оплата будет подключена позже');
  });

  render();
})();
