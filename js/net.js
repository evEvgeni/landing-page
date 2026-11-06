// Сеть агентов работает: задачи летят к узлам, узлы выполняют их и возвращают результат.
// Клик по узлу запускает этого агента вручную, App.netBurst() — сразу всех.
(() => {
  const net = document.querySelector('[data-net]');
  if (!net) return;

  const core = { x: 260, y: 260 };
  const layer = net.querySelector('.packets');
  const coreDot = net.querySelector('.core');
  const nodes = [...net.querySelectorAll('.node')].map((g) => ({
    g, x: +g.dataset.x, y: +g.dataset.y, busy: false,
    link: net.querySelector(`.link[data-i="${g.dataset.i}"]`),
    label: g.querySelector('.node__label'),
  }));
  const say = (n, state) => {
    n.g.dataset.state = state;
    n.label.textContent = state === 'work' ? n.g.dataset.work : state === 'done' ? n.g.dataset.done : '';
  };

  if (App.still) {
    nodes.forEach((n) => say(n, 'done'));
    App.netBurst = () => {};
    return;
  }

  const rand = (a, b) => a + Math.random() * (b - a);
  const fly = (from, to, ms) => new Promise((done) => {
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    p.setAttribute('r', 6); p.setAttribute('class', 'packet');
    layer.append(p);
    p.animate(
      [{ transform: `translate(${from.x}px, ${from.y}px)` }, { transform: `translate(${to.x}px, ${to.y}px)` }],
      { duration: ms, easing: 'ease-in-out', fill: 'forwards' }
    ).onfinish = () => { p.remove(); done(); };
  });
  const bump = () => {
    // getBoundingClientRect перезапускает анимацию и не падает, когда граф скрыт
    coreDot.classList.remove('bump'); void coreDot.getBoundingClientRect(); coreDot.classList.add('bump');
  };

  const dispatch = async (n, fast = false) => {
    if (n.busy) return;
    n.busy = true; n.link.classList.add('on');
    await fly(core, n, fast ? 450 : 650);
    say(n, 'work'); await App.wait(fast ? rand(700, 1100) : rand(1500, 2600));
    say(n, 'done');
    await fly(n, core, fast ? 450 : 650);
    bump();
    await App.wait(1500);
    say(n, 'idle'); n.link.classList.remove('on'); n.busy = false;
  };

  // Узлы — настоящие кнопки: работают мышью и с клавиатуры
  nodes.forEach((n) => {
    n.g.setAttribute('tabindex', '0');
    n.g.setAttribute('role', 'button');
    n.g.setAttribute('aria-label', `Запустить агента: ${n.g.dataset.work.toLowerCase()}`);
    const go = () => dispatch(n, true);
    n.g.addEventListener('click', go);
    n.g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
  });

  App.netBurst = () => {
    nodes.forEach((n, i) => setTimeout(() => dispatch(n, true), i * 90));
    bump();
  };

  App.ready.then(async () => {
    await App.wait(1800);
    while (true) {
      const idle = nodes.filter((n) => !n.busy);
      if (nodes.length - idle.length < 3 && idle.length) dispatch(idle[Math.floor(Math.random() * idle.length)]);
      await App.wait(rand(700, 1300));
    }
  });
})();
