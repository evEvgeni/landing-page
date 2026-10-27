// Работает для любого количества секций: ничего менять при росте сайта не нужно.

// 1. Свет за курсором внутри текущей секции
document.addEventListener('pointermove', (e) => {
  const section = e.target.closest('.section');
  if (!section) return;
  const r = section.getBoundingClientRect();
  section.style.setProperty('--mx', `${e.clientX - r.left}px`);
  section.style.setProperty('--my', `${e.clientY - r.top}px`);
}, { passive: true });

// 2. Поочерёдное появление [data-reveal] внутри каждой секции
const items = document.querySelectorAll('[data-reveal]');
items.forEach((el) => {
  const siblings = [...el.parentElement.querySelectorAll(':scope > [data-reveal]')];
  el.style.setProperty('--i', siblings.indexOf(el));
});

const io = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    entry.target.classList.add('is-visible');
    io.unobserve(entry.target);
  });
}, { threshold: 0.15 });

items.forEach((el) => io.observe(el));

// 3. Сеть агентов работает: задачи летят к узлам, узлы выполняют их и возвращают результат
const net = document.querySelector('[data-net]');

if (net) {
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

  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    nodes.forEach((n) => say(n, 'done'));
  } else {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
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

    const dispatch = async (n) => {
      n.busy = true; n.link.classList.add('on');
      await fly(core, n, 650);
      say(n, 'work'); await wait(rand(1500, 2600));
      say(n, 'done');
      await fly(n, core, 650);
      coreDot.classList.remove('bump'); void coreDot.getBBox(); coreDot.classList.add('bump');
      await wait(1500);
      say(n, 'idle'); n.link.classList.remove('on'); n.busy = false;
    };

    (async () => {
      await wait(1800);
      while (true) {
        const idle = nodes.filter((n) => !n.busy);
        if (nodes.length - idle.length < 3 && idle.length) dispatch(idle[Math.floor(Math.random() * idle.length)]);
        await wait(rand(700, 1300));
      }
    })();
  }
}

// 4. Год в футере всегда актуален
document.querySelectorAll('[data-year]').forEach((el) => (el.textContent = new Date().getFullYear()));