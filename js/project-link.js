// Переход из карточки проекта на его страницу: красная заливка карточки разрастается на весь экран,
// в ней выезжает название — и под той же заливкой открывается страница проекта.
(() => {
  const cards = document.querySelectorAll('a.project[data-page]');
  const remember = () => { try { sessionStorage.setItem('wipe', '1'); sessionStorage.setItem('from-index', '1'); } catch (e) {} };

  cards.forEach((card) => card.addEventListener('click', (e) => {
    // Открыть в новой вкладке и т.п. — обычное поведение браузера
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (App.still || !card.animate) { try { sessionStorage.setItem('from-index', '1'); } catch (err) {} return; }
    e.preventDefault();

    const r = card.getBoundingClientRect();
    const wipe = document.createElement('div');
    wipe.className = 'wipe';
    wipe.setAttribute('aria-hidden', 'true');
    const num = card.querySelector('.project__num')?.textContent || '';
    const name = card.querySelector('.project__name')?.textContent || '';
    wipe.innerHTML = `<p class="wipe__num">${num}</p><p class="wipe__title"><span>${name}</span></p>`;
    document.body.append(wipe);

    const from = `inset(${r.top}px ${innerWidth - r.right}px ${innerHeight - r.bottom}px ${r.left}px)`;
    const ease = 'cubic-bezier(.65, 0, .35, 1)';
    wipe.animate([{ clipPath: from }, { clipPath: 'inset(0px 0px 0px 0px)' }], { duration: 750, easing: ease, fill: 'both' });
    wipe.querySelector('span').animate([{ transform: 'translateY(105%)' }, { transform: 'none' }], { duration: 700, delay: 380, easing: 'cubic-bezier(.2, .8, .2, 1)', fill: 'both' });
    wipe.querySelector('.wipe__num').animate([{ opacity: 0 }, { opacity: 0.6 }], { duration: 400, delay: 500, fill: 'both' });

    remember();
    setTimeout(() => { location.href = card.href; }, 1150);
  }));

  // Вернулись кнопкой «назад» из кэша страницы — заливку убираем
  addEventListener('pageshow', (e) => { if (e.persisted) document.querySelectorAll('.wipe').forEach((w) => w.remove()); });

  // Пришли по ссылке «Все проекты» (index.html#projects): секции лежат стопкой, поэтому позицию берём у scroll.js
  const id = location.hash.slice(1);
  const target = id && document.getElementById(id);
  if (target && App.measureSections) {
    const sections = [...document.querySelectorAll('main > .section')];
    const i = sections.indexOf(target);
    if (i > 0) App.ready.then(() => requestAnimationFrame(() => scrollTo({ top: App.measureSections().tops[i], behavior: 'instant' })));
  }
})();
