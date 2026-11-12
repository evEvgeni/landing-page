// 3D-сцена страницы Support Agent: серверная стойка, в которой работает агент.
// Обращения-пакеты приходят по кабелю сверху, спускаются по световоду и останавливаются в модулях-агентах.
// Закрытые агентом уходят жёлтыми по кабелю вправо, сложные — красными к пульту оператора слева.
// Наружу отдаёт App.server: выбор и подсветка модулей, отправка своего обращения, события для сводки.
(() => {
  const stage = document.querySelector('[data-stage]');
  if (!stage) return;
  const canvas = stage.querySelector('[data-stage-canvas]');
  const fail = () => stage.classList.add('is-fallback');
  if (!window.THREE) return fail();

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (e) { return fail(); }

  const { still, clamp, lerp } = App;
  const T = THREE;
  const COL = { rosso: 0xdc0000, giallo: 0xffed00, ink: 0x181818 };
  const ease = (t) => 1 - Math.pow(1 - clamp(t), 3);
  // Авария: broken — стойка сломана, shake — тряска, smoke — сколько дыма, fire — огонь из блока питания,
  // alarm — тревога на пульте, plateErr — на табличке ошибка, door — дверца болтается на петлях
  const fx = { broken: false, shake: 0, smoke: 0, fire: 0, alarm: 0, plateErr: false, door: 0, start: 0 };

  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;

  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(30, 1, 0.1, 100);

  // Весь мир крутится вокруг оси стойки — вместе с кабелями и пультом оператора
  const world = new T.Group();
  scene.add(world);

  // ---------- Свет ----------
  scene.add(new T.HemisphereLight(0xffffff, 0x2a0000, 0.55));
  const key = new T.DirectionalLight(0xffffff, 1.05);
  key.position.set(4, 9, 7);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -6, right: 6, top: 7, bottom: -3, near: 1, far: 30 });
  key.shadow.radius = 4;
  scene.add(key);
  const rim = new T.PointLight(COL.rosso, 2.4, 14);   // красный контровой свет — фирменный цвет на гранях
  rim.position.set(-3.5, 3.5, -3);
  scene.add(rim);
  const fill = new T.PointLight(COL.giallo, 0.5, 9);
  fill.position.set(2.5, 1.5, 4.5);
  scene.add(fill);
  const fireLight = new T.PointLight(0xff6a00, 0, 7); // оранжевый отсвет пожара
  fireLight.position.set(0, 0.7, 2.2);
  scene.add(fireLight);

  // ---------- Текстуры из canvas: надписи на модулях, перфорация двери, свечение ----------
  const tex = (w, h, draw) => {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const t = new T.CanvasTexture(c);
    t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    t.redraw = () => { draw(c.getContext('2d'), w, h); t.needsUpdate = true; };
    t.redraw();
    return t;
  };
  const FONT = '"Archivo", system-ui, sans-serif';
  const font = (ctx, weight, size) => {
    ctx.font = `${weight} ${size}px ${FONT}`;
    if ('fontStretch' in ctx) ctx.fontStretch = 'condensed';
  };

  const glowTex = tex(128, 128, (ctx, w) => {
    const g = ctx.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.22, 'rgba(255,255,255,.85)');
    g.addColorStop(0.5, 'rgba(255,255,255,.18)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, w);
  });

  // ---------- Размеры стойки ----------
  const W = 2.5, H = 4.4, D = 2.2;
  const UH = 0.5, GAP = 0.06;
  const ZF = D / 2 - 0.05;                    // лицевая плоскость модулей
  const BUS = { x: W / 2 - 0.07, z: D / 2 - 0.03 }; // световод на правой стойке, по нему спускаются пакеты
  const modY = (i) => 4.0 - UH / 2 - i * (UH + GAP);

  const metal = new T.MeshStandardMaterial({ color: 0x1f1f22, metalness: 0.35, roughness: 0.55 });
  const metalDark = new T.MeshStandardMaterial({ color: 0x121214, metalness: 0.3, roughness: 0.6 });
  const yellow = new T.MeshStandardMaterial({ color: COL.giallo, metalness: 0.15, roughness: 0.4, emissive: COL.giallo, emissiveIntensity: 0.08 });
  const rubber = new T.MeshStandardMaterial({ color: 0x0d0d0e, roughness: 0.8 });

  const rack = new T.Group();
  world.add(rack);
  const box = (w, h, d, mat, x, y, z, parent = rack) => {
    const m = new T.Mesh(new T.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.castShadow = true; m.receiveShadow = true;
    parent.add(m);
    return m;
  };

  // Корпус: боковины, крыша, цоколь, задняя стенка, монтажные стойки
  box(0.08, H, D, metal, -W / 2 + 0.04, H / 2, 0);
  box(0.08, H, D, metal, W / 2 - 0.04, H / 2, 0);
  box(W, 0.1, D, metal, 0, H - 0.05, 0);
  box(W, 0.12, D, metalDark, 0, 0.06, 0);
  box(W - 0.16, H - 0.2, 0.05, metalDark, 0, H / 2, -D / 2 + 0.03);
  [-1, 1].forEach((s) => box(0.1, H - 0.22, 0.06, metalDark, s * (W / 2 - 0.15), H / 2, D / 2 - 0.12));
  // Жёлтые акценты: кромка крыши и опоры — как фирменные детали сайта
  box(W + 0.02, 0.035, 0.035, yellow, 0, H - 0.02, D / 2 + 0.005);
  [[-1, -1], [-1, 1], [1, -1], [1, 1]].forEach(([sx, sz]) => box(0.16, 0.08, 0.16, yellow, sx * (W / 2 - 0.12), -0.04, sz * (D / 2 - 0.12)));

  // Табличка над модулями
  const plate = new T.Mesh(new T.PlaneGeometry(2.04, 0.24), new T.MeshBasicMaterial({
    map: tex(1024, 120, (ctx, w, h) => {
      const err = fx.plateErr;
      ctx.fillStyle = err ? '#4a0000' : '#141416'; ctx.fillRect(0, 0, w, h);
      ctx.textAlign = 'left';
      font(ctx, 800, 64); ctx.fillStyle = '#ffffff'; ctx.textBaseline = 'middle';
      ctx.fillText(err ? 'SYSTEM FAILURE' : 'SUPPORT AGENT', 24, h / 2 + 4);
      font(ctx, 700, 34); ctx.fillStyle = err ? '#ff5a5a' : '#ffed00'; ctx.textAlign = 'right';
      ctx.fillText(err ? 'ERR 500 · DUCK ON IT' : 'RACK 01 · PROD', w - 24, h / 2 + 2);
    }),
  }));
  plate.position.set(0, 4.16, D / 2 - 0.08);
  rack.add(plate);

  // Блок питания внизу: решётка вентиляции
  const psu = new T.Mesh(new T.PlaneGeometry(2.04, 0.5), new T.MeshStandardMaterial({
    roughness: 0.6, metalness: 0.3,
    map: tex(1024, 250, (ctx, w, h) => {
      ctx.fillStyle = '#1b1b1d'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#0b0b0c';
      for (let y = 40; y < h - 40; y += 18) ctx.fillRect(170, y, w - 340, 8);
      font(ctx, 700, 30); ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.textBaseline = 'middle';
      ctx.fillText('PSU', 40, h / 2);
      ctx.fillStyle = '#ffed00'; ctx.beginPath(); ctx.arc(w - 70, h / 2, 12, 0, 7); ctx.fill();
    }),
  }));
  psu.position.set(0, 0.42, D / 2 - 0.08);
  rack.add(psu);

  // Световод — тонкая полоса на правой стойке
  const busMat = new T.MeshBasicMaterial({ color: 0x3a3500 });
  box(0.03, 3.5, 0.03, busMat, BUS.x, 2.32, BUS.z).castShadow = false;

  // ---------- Модули ----------
  const CODES = ['GATEWAY', 'CLASSIFIER', 'RAG SEARCH', 'MEMORY · PG', 'RESPONDER', 'HANDOFF'];
  const SUBS = ['INGRESS · PII FILTER', 'TOPIC · URGENCY', 'HYBRID · RERANK', 'POSTGRES · PGVECTOR', 'LLM · GUARDRAILS', 'HUMAN IN THE LOOP'];
  const FW = 2.14, FH = UH - 0.03;
  // Перевод координат текстуры лицевой панели (1024×224) в метры
  const px = (x) => (x / 1024 - 0.5) * FW;
  const py = (y) => (0.5 - y / 224) * FH;

  const drawFace = (i) => (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#2a2a2d'); g.addColorStop(0.08, '#212124'); g.addColorStop(1, '#19191b');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(255,255,255,.06)'; ctx.fillRect(0, 0, w, 3);
    ctx.textBaseline = 'alphabetic';
    font(ctx, 700, 30); ctx.fillStyle = i === 5 ? '#ff3b3b' : '#ffed00';
    ctx.fillText(String(i + 1).padStart(2, '0'), 92, 70);
    font(ctx, 800, 66); ctx.fillStyle = '#ffffff';
    ctx.fillText(CODES[i], 92, 138);
    font(ctx, 600, 22); ctx.fillStyle = 'rgba(255,255,255,.45)';
    ctx.fillText(SUBS[i], 92, 178);
    // гнёзда светодиодов и порты
    ctx.fillStyle = '#0c0c0d';
    [470, 505, 540].forEach((x) => { ctx.beginPath(); ctx.arc(x, 70, 13, 0, 7); ctx.fill(); });
    for (let k = 0; k < 4; k++) { ctx.fillStyle = '#0a0a0b'; ctx.fillRect(452 + k * 34, 118, 26, 22); ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.strokeRect(452 + k * 34, 118, 26, 22); }
    // вентиляционная решётка
    ctx.fillStyle = '#0d0d0e';
    for (let x = 620; x < 880; x += 15) ctx.fillRect(x, 44, 7, 136);
    // шкала нагрузки (заполнение — отдельная плоскость)
    ctx.fillStyle = '#0c0c0d'; ctx.fillRect(912, 40, 22, 144);
  };

  const modules = CODES.map((code, i) => {
    const g = new T.Group();
    g.position.y = modY(i);
    rack.add(g);
    const chassisD = D - 0.36;
    const chassis = box(FW - 0.14, FH - 0.02, chassisD, metal, 0, 0, ZF - 0.04 - chassisD / 2, g);
    // Плата на крышке корпуса — видна, когда модуль выдвинут
    box(0.5, 0.05, 0.5, metalDark, -0.45, FH / 2, ZF - 0.7, g);
    box(0.22, 0.03, 0.22, yellow, -0.45, FH / 2 + 0.04, ZF - 0.7, g);
    box(0.7, 0.06, 0.3, metalDark, 0.4, FH / 2, ZF - 0.55, g);
    box(0.7, 0.06, 0.3, metalDark, 0.4, FH / 2, ZF - 1.0, g);

    const face = tex(1024, 224, drawFace(i));
    const side = metal;
    const facePlate = box(FW, FH, 0.04, [side, side, side, side, new T.MeshStandardMaterial({ map: face, roughness: 0.55, metalness: 0.2 }), side], 0, 0, ZF - 0.02, g);

    // Ручки — жёлтые, как акценты сайта
    [-1, 1].forEach((s) => {
      box(0.05, FH * 0.62, 0.04, yellow, s * (FW / 2 - 0.05), 0, ZF + 0.03, g);
    });

    // Светодиоды: статус, активность, питание
    const leds = [470, 505, 540].map((x) => {
      const m = new T.Mesh(new T.CircleGeometry(0.022, 16), new T.MeshBasicMaterial({ color: 0x333333 }));
      m.position.set(px(x), py(70), ZF + 0.002);
      g.add(m);
      return m;
    });
    // Ореол вокруг светодиода статуса — заметен издалека
    const halo = new T.Sprite(new T.SpriteMaterial({ map: glowTex, color: COL.giallo, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false }));
    halo.scale.set(0.32, 0.32, 1);
    halo.position.set(px(470), py(70), ZF + 0.01);
    g.add(halo);

    // Шкала нагрузки
    const barH = (144 / 224) * FH;
    const bar = new T.Mesh(new T.PlaneGeometry(px(934) - px(912), barH), new T.MeshBasicMaterial({ color: i === 5 ? COL.rosso : COL.giallo }));
    bar.geometry.translate(0, barH / 2, 0);
    bar.position.set((px(912) + px(934)) / 2, py(184), ZF + 0.002);
    bar.scale.y = 0.02;
    g.add(bar);

    // Рамка подсветки при наведении и выборе
    const edge = new T.LineSegments(new T.EdgesGeometry(new T.BoxGeometry(FW + 0.02, FH + 0.02, 0.06)), new T.LineBasicMaterial({ color: COL.giallo, transparent: true, opacity: 0 }));
    edge.position.z = ZF - 0.02;
    g.add(edge);

    // Любая деталь модуля (корпус, панель, светодиоды) указывает на свой модуль.
    // Рамка и ореол — только украшение: лучу их не замечать, иначе они перехватывают наведение
    g.traverse((m) => {
      if (m.isMesh) m.userData.module = i;
      else if (m.isLine || m.isSprite) m.raycast = () => {};
    });
    return { i, g, face, leds, halo, bar, edge, hover: 0, pull: 0, flash: 0, load: 0, hits: 0, intro: 0, broken: false, brk: 0, tilt: 0, fallen: false, fp: 0, fallTo: null, landed: false };
  });

  // ---------- Дверца с перфорацией ----------
  const door = new T.Group();
  door.position.set(-W / 2 + 0.02, 0, D / 2 + 0.04);
  rack.add(door);
  const holes = tex(256, 512, (ctx, w, h) => {
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#000';
    for (let y = 10; y < h; y += 14) for (let x = 10 + ((y / 14) % 2) * 7; x < w; x += 14) { ctx.beginPath(); ctx.arc(x, y, 4.6, 0, 7); ctx.fill(); }
  });
  holes.wrapS = holes.wrapT = T.RepeatWrapping;
  holes.repeat.set(3, 3);
  const DW = W - 0.04, DH = H - 0.14;
  const mesh = new T.Mesh(new T.PlaneGeometry(DW - 0.16, DH - 0.16), new T.MeshStandardMaterial({ color: 0x2a2a2d, metalness: 0.4, roughness: 0.5, alphaMap: holes, alphaTest: 0.5, side: T.DoubleSide }));
  mesh.position.set(DW / 2, H / 2, 0);
  mesh.castShadow = true;
  door.add(mesh);
  box(DW, 0.08, 0.05, metal, DW / 2, H / 2 + DH / 2 - 0.04, 0, door);
  box(DW, 0.08, 0.05, metal, DW / 2, H / 2 - DH / 2 + 0.04, 0, door);
  box(0.08, DH, 0.05, metal, 0.04, H / 2, 0, door);
  box(0.08, DH, 0.05, metal, DW - 0.04, H / 2, 0, door);
  box(0.05, 0.7, 0.07, yellow, DW - 0.14, H / 2, 0.04, door);
  door.traverse((m) => { if (m.isMesh) m.userData.door = true; });

  // ---------- Кабели ----------
  const tube = (pts, r = 0.04) => {
    const curve = new T.CatmullRomCurve3(pts.map((p) => new T.Vector3(...p)), false, 'centripetal');
    const m = new T.Mesh(new T.TubeGeometry(curve, 80, r, 10, false), rubber);
    m.castShadow = true;
    world.add(m);
    return curve.getSpacedPoints(60);
  };
  const y4 = modY(4), y5 = modY(5);
  const inPath = tube([[-1.2, 9, -2.6], [-0.2, 7, -1.2], [0.8, 5.4, 0.4], [BUS.x, H + 0.15, BUS.z], [BUS.x, H - 0.02, BUS.z]]);
  // Закрытые обращения уходят по полу вперёд, за нижний край кадра (а не вправо — там текст сводки)
  const okPath = tube([[BUS.x, y4, BUS.z], [BUS.x + 0.35, y4 - 0.05, D / 2 + 0.25], [1.95, 0.6, 1.7], [2.2, 0.05, 2.7], [2.35, 0.05, 5], [2.4, 0.05, 9]]);
  // К оператору: из модуля HANDOFF по полу назад и вправо, к пульту за стойкой (слева стоит открытая дверца)
  const OP = new T.Vector3(2.75, 0, -1.35);
  const humanPath = tube([[BUS.x, y5, BUS.z], [BUS.x + 0.3, y5 - 0.08, D / 2 + 0.2], [1.85, 0.3, 1.0], [2.35, 0.05, 0.25], [OP.x - 0.05, 0.05, OP.z + 0.55], [OP.x, 0.5, OP.z + 0.05]]);

  // ---------- Пульт оператора: стойка с монитором ----------
  const op = new T.Group();
  op.position.copy(OP);
  op.rotation.y = -0.35;
  world.add(op);
  box(0.5, 0.06, 0.4, metalDark, 0, 0.03, 0, op);
  box(0.08, 1.0, 0.08, metal, 0, 0.53, 0, op);
  box(0.95, 0.62, 0.06, metal, 0, 1.25, 0.02, op);
  const screenTex = tex(512, 320, (ctx, w, h) => {
    ctx.fillStyle = '#140404'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#dc0000';
    ctx.beginPath(); ctx.arc(w / 2, 118, 44, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.ellipse(w / 2, 238, 86, 58, 0, Math.PI, 0); ctx.fill();
    font(ctx, 800, 40); ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
    ctx.fillText('OPERATOR', w / 2, 296);
  });
  const screen = new T.Mesh(new T.PlaneGeometry(0.86, 0.54), new T.MeshBasicMaterial({ map: screenTex, color: 0x777777 }));
  screen.position.set(0, 1.25, 0.056);
  op.add(screen);

  // ---------- Пасхалка: уточка отладки за стойкой ----------
  // Отсылка к rubber duck debugging: проговори баг уточке — и он найдётся. Спереди её закрывает стойка,
  // видно её, только если развернуть стойку задом. Входит в группу стойки, чтобы стенки корпуса её заслоняли
  const duck = (() => {
    const shell = new T.MeshStandardMaterial({ color: 0xdfe4e8, roughness: 0.55, metalness: 0.05 });
    const orange = new T.MeshStandardMaterial({ color: 0xff6418, roughness: 0.5 });
    const servo = new T.MeshStandardMaterial({ color: 0x141416, roughness: 0.6, metalness: 0.3 });
    const g = new T.Group();
    g.position.set(-0.3, 0, -D / 2 - 0.85);
    g.rotation.y = Math.PI + 0.35; // смотрит назад — на того, кто заглянул за стойку
    g.scale.setScalar(1.35);
    rack.add(g);
    const body = new T.Group();
    g.add(body);
    // Лапы: оранжевые «ботинки» и сервоприводы над ними
    const feet = [-1, 1].map((s) => {
      const f = new T.Group();
      f.position.x = s * 0.13;
      body.add(f);
      box(0.15, 0.11, 0.24, orange, 0, 0.055, 0.03, f);
      box(0.09, 0.17, 0.1, servo, 0, 0.19, -0.01, f);
      return f;
    });
    // Корпус с красной кнопкой и треугольной пластиной сбоку
    box(0.36, 0.22, 0.28, shell, 0, 0.38, 0, body);
    box(0.05, 0.03, 0.05, new T.MeshStandardMaterial({ color: COL.rosso, roughness: 0.4 }), 0.08, 0.505, -0.06, body);
    box(0.02, 0.16, 0.2, shell, 0.19, 0.3, -0.06, body).rotation.x = 0.5;
    // Шея из двух сервоприводов
    box(0.08, 0.2, 0.08, servo, 0, 0.58, -0.04, body);
    // Голова на шарнире: белый корпус с куполом, оранжевая полоса снизу, глаз-камера и зелёные огоньки
    const head = new T.Group();
    head.position.set(0, 0.7, -0.04);
    body.add(head);
    box(0.3, 0.14, 0.5, shell, 0, 0.08, 0.06, head);
    const dome = new T.Mesh(new T.CylinderGeometry(0.15, 0.15, 0.5, 24, 1, false, -Math.PI / 2, Math.PI), shell);
    dome.rotation.x = Math.PI / 2;
    dome.position.set(0, 0.15, 0.06);
    dome.castShadow = true;
    head.add(dome);
    box(0.31, 0.045, 0.51, orange, 0, 0.0, 0.06, head);
    const eye = new T.Mesh(new T.TorusGeometry(0.06, 0.025, 10, 24), orange);
    eye.position.set(0, 0.1, 0.315);
    head.add(eye);
    const lens = new T.Mesh(new T.CircleGeometry(0.045, 20), new T.MeshStandardMaterial({ color: 0x0a0a0c, roughness: 0.15, metalness: 0.6 }));
    lens.position.set(0, 0.1, 0.312);
    head.add(lens);
    const glint = new T.Mesh(new T.CircleGeometry(0.012, 10), new T.MeshBasicMaterial({ color: 0xffffff }));
    glint.position.set(0.018, 0.118, 0.316);
    head.add(glint);
    const leds = [0, 1, 2].map((k) => {
      const m = new T.Mesh(new T.CircleGeometry(0.009, 8), new T.MeshBasicMaterial({ color: 0x3dff8a }));
      m.position.set(0.151, 0.06 + k * 0.025, 0.18);
      m.rotation.y = Math.PI / 2;
      head.add(m);
      return m;
    });
    g.traverse((m) => { if (m.isMesh) m.userData.duck = true; });
    return { g, body, head, feet, leds, hop: 0, hover: 0, quacks: 0 };
  })();
  const QUACKS = [
    'Кря! Вы нашли уточку отладки',
    'Кря! Расскажите мне про баг — он найдётся',
    'Кря-кря. Тесты зелёные, можно катить',
    'Кря… Только никому не говорите, что я тут',
  ];
  const quack = () => {
    duck.hop = 1;
    App.toast(QUACKS[duck.quacks++ % QUACKS.length]);
  };

  // ---------- Пол: тень, кольца-«орбиты», красное свечение позади ----------
  const floor = new T.Mesh(new T.PlaneGeometry(30, 30), new T.ShadowMaterial({ opacity: 0.45 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  world.add(floor);
  const ringMat = new T.MeshBasicMaterial({ color: COL.giallo, transparent: true, opacity: 0.22, side: T.DoubleSide });
  const rings = [2.35, 3.1].map((r, k) => {
    const m = new T.Mesh(new T.RingGeometry(r, r + (k ? 0.008 : 0.016), 128, 1, 0, Math.PI * (k ? 1.4 : 2)), ringMat);
    m.rotation.x = -Math.PI / 2;
    m.position.y = 0.005;
    world.add(m);
    return m;
  });
  const back = new T.Sprite(new T.SpriteMaterial({ map: glowTex, color: COL.rosso, transparent: true, opacity: 0.55, depthWrite: false }));
  back.scale.set(11, 11, 1);
  back.position.set(0, 2.4, -4);
  scene.add(back);

  // ---------- Пакеты-обращения ----------
  const packets = [];
  const pool = [];
  const spriteFor = () => pool.pop() || (() => {
    const s = new T.Sprite(new T.SpriteMaterial({ map: glowTex, transparent: true, blending: T.AdditiveBlending, depthWrite: false }));
    world.add(s);
    return s;
  })();
  const v = (x, y, z) => new T.Vector3(x, y, z);

  // Маршрут: кабель → световод с остановками в модулях → выход
  const route = (escalate) => {
    const pts = inPath.map((p) => ({ p }));
    const last = escalate ? 5 : 4;
    for (let i = 0; i <= last; i++) pts.push({ p: v(BUS.x, modY(i), BUS.z), stop: i });
    (escalate ? humanPath : okPath).forEach((p) => pts.push({ p }));
    return pts;
  };

  let seq = 0;
  const spawn = ({ escalate = Math.random() < 0.3, decideAt = 1 + (Math.random() < 0.5 ? 1 : 0), user = false } = {}) => {
    const s = spriteFor();
    s.visible = true;
    const pk = { id: ++seq, s, pts: route(escalate), k: user ? 24 : 0, dwell: 0, escalate, decideAt, user, color: new T.Color(0xfff7b0), fade: 1, done: false };
    s.position.copy(pk.pts[pk.k].p);
    s.material.color.copy(pk.color);
    s.scale.setScalar(user ? 0.62 : 0.36);
    packets.push(pk);
    return pk.id;
  };

  // ---------- События для сводки ----------
  const handlers = {};
  const emit = (type, data) => (handlers[type] || []).forEach((fn) => fn(data));

  const step = (pk, dt) => {
    // Авария: обращения замирают на месте и мигают красным, после ремонта едут дальше — ничего не теряется
    if (fx.broken) { pk.s.material.color.setHex(Math.sin(performance.now() / 90 + pk.id) > 0 ? 0xff2a2a : 0x551010); return; }
    if (pk.dwell > 0) { pk.dwell -= dt; return; }
    let dist = (pk.k < inPath.length ? 3.2 : 2.1) * dt * (pk.user ? 1.25 : 1);
    while (dist > 0 && pk.k < pk.pts.length - 1) {
      const to = pk.pts[pk.k + 1];
      const d = pk.s.position.distanceTo(to.p);
      if (d > dist) { pk.s.position.lerp(to.p, dist / d); dist = 0; break; }
      pk.s.position.copy(to.p);
      dist -= d;
      pk.k++;
      if (to.stop != null) {
        const m = modules[to.stop];
        m.flash = 1; m.hits++;
        if (to.stop === pk.decideAt && pk.escalate) pk.color.setHex(0xff2a2a);
        if (to.stop === 4 && !pk.escalate) pk.color.setHex(COL.giallo);
        pk.dwell = pk.user ? 0.5 : 0.22;
        if (pk.user) emit('stage', { id: pk.id, module: to.stop, escalate: pk.escalate });
        break;
      }
    }
    pk.s.material.color.lerp(pk.color, 0.15);
    const left = pk.pts.length - 1 - pk.k;
    // У пульта или за краем сцены пакет гаснет
    if (left < 8) pk.fade = left / 8;
    pk.s.material.opacity = pk.fade;
    if (left <= 0 && !pk.done) {
      pk.done = true;
      if (pk.escalate) opFlash = 1;
      emit('done', { id: pk.id, resolved: !pk.escalate, user: pk.user });
    }
  };
  let opFlash = 0;

  // ---------- Частицы: искры, дым, мультяшные облачка ----------
  const parts = [];
  const partPool = [];
  const part = (o) => {
    const s = partPool.pop() || (() => {
      const sp = new T.Sprite(new T.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false }));
      world.add(sp);
      return sp;
    })();
    s.visible = true;
    s.position.copy(o.p);
    s.material.color.setHex(o.color);
    s.material.blending = o.add ? T.AdditiveBlending : T.NormalBlending;
    s.material.needsUpdate = true;
    parts.push({ s, v: o.v, g: o.g || 0, life: o.life, max: o.life, s0: o.s0, s1: o.s1, a: o.a ?? 1, delay: o.delay || 0 });
  };
  const rnd = (a, b) => a + Math.random() * (b - a);
  // Искры из-под клюва или из сломанного модуля
  const sparks = (p, n = 5) => {
    for (let k = 0; k < n; k++) part({ p: p.clone(), v: v(rnd(-1.6, 1.6), rnd(0.8, 2.6), rnd(-1.6, 1.6)), g: -7, life: rnd(0.3, 0.55), s0: 0.13, s1: 0.03, color: Math.random() < 0.5 ? 0xffed00 : 0xfff7d0, add: true });
  };
  // «Пуф»: кольцо облачков там, где уточка исчезла или появилась
  const puff = (p) => {
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      part({ p: v(p.x, p.y + 0.35, p.z), v: v(Math.cos(a) * 1.7, rnd(0.2, 0.9), Math.sin(a) * 1.7), g: -1, life: 0.42, s0: 0.32, s1: 0.75, color: 0xeeeeee, a: 0.85 });
    }
  };
  // Пунктир пыли по пути — как в мультике, когда герой сорвался с места
  const trail = (a, b) => {
    for (let k = 1; k < 7; k++) {
      const p = a.clone().lerp(b, k / 7);
      p.y += 0.45 + Math.sin((k / 7) * Math.PI) * 0.6;
      part({ p, v: v(0, 0.1, 0), life: 0.25 + k * 0.05, s0: 0.2, s1: 0.32, color: 0xdddddd, a: 0.6 });
    }
  };
  const smoke = (p) => part({ p, v: v(rnd(-0.15, 0.15), rnd(0.5, 0.9), rnd(-0.15, 0.15)), life: rnd(1.6, 2.4), s0: 0.35, s1: 1.4, color: 0x3a3a3e, a: 0.55 });
  const tickParts = (dt) => {
    for (let k = parts.length - 1; k >= 0; k--) {
      const q = parts[k];
      q.life -= dt;
      if (q.life <= 0) { q.s.visible = false; partPool.push(q.s); parts.splice(k, 1); continue; }
      q.v.y += q.g * dt;
      q.s.position.addScaledVector(q.v, dt);
      const age = 1 - q.life / q.max;
      q.s.scale.setScalar(lerp(q.s0, q.s1, age));
      q.s.material.opacity = q.a * (1 - age * age);
    }
  };

  // ---------- Поломка и мультяшный ремонт ----------
  // По кнопке «Сломать сервер» стойка вздрагивает, два модуля выпадают вперёд, валит дым, обращения замирают.
  // Уточка выскакивает из-за стойки и чинит: исчезает с «пуфом» в одном месте и тут же шлёпается в другом
  const DS = 1.35; // обычный размер уточки
  const DUCK_HOME = { pos: v(-0.3, 0, -D / 2 - 0.85), rot: Math.PI + 0.35 };
  const faceTo = (from, to) => Math.atan2(to.x - from.x, to.z - from.z);
  let job = null;

  // Ключевые кадры «сплющилась → вытянулась»: [доля времени, ширина, высота, подъём]
  const OUT_KEYS = [[0, 1, 1, 0], [0.35, 1.35, 0.6, 0], [1, 0.3, 1.9, 0.7]];
  const IN_KEYS = [[0, 0.35, 1.9, 0.9], [0.35, 1.4, 0.55, 0], [0.6, 0.88, 1.15, 0], [0.8, 1.05, 0.95, 0], [1, 1, 1, 0]];
  const sample = (K, k) => {
    for (let i = 0; i < K.length - 1; i++) {
      if (k <= K[i + 1][0]) {
        const q = (k - K[i][0]) / (K[i + 1][0] - K[i][0]);
        return [1, 2, 3].map((j) => lerp(K[i][j], K[i + 1][j], q));
      }
    }
    return K[K.length - 1].slice(1);
  };

  const reboot = () => {
    fx.broken = false; fx.smoke = 0; fx.alarm = 0; fx.fire = 0;
    // Волна огоньков сверху вниз — стойка перезагрузилась
    modules.forEach((m, i) => setTimeout(() => (m.flash = 1), i * 110));
    const sec = ((performance.now() - fx.start) / 1000).toFixed(1).replace('.', ',');
    emit('repaired', sec);
  };

  const breakServer = () => {
    if (fx.broken || job || introT < 2) return;
    Object.assign(fx, { broken: true, shake: 1.7, smoke: 1.4, fire: 1, alarm: 1, plateErr: true, door: 1, start: performance.now() });
    plate.material.map.redraw();
    api.select(-1);
    if (!doorOpen) api.toggleDoor();
    idle = 10;
    // Красная вспышка по всей сцене в момент удара
    stage.classList.remove('is-boom');
    void stage.offsetWidth;
    stage.classList.add('is-boom');
    // Три модуля выпадают вперёд и перекашиваются, четвёртый вываливается из стойки на пол
    const [a, b, c, d] = [0, 1, 2, 3, 4, 5].sort(() => Math.random() - 0.5).slice(0, 4);
    [a, b, c].sort((x, y) => x - y).forEach((i, n) => {
      modules[i].broken = true;
      modules[i].tilt = (n % 2 ? -1 : 1) * rnd(0.16, 0.26);
      sparks(v(rnd(-0.6, 0.6), modY(i), ZF + 0.6), 24);
    });
    const fm = modules[d];
    fx.fireAt = d;
    fm.fallen = true;
    fm.landed = false;
    fm.fallTo = { x: 0.85, y: FH / 2 + 0.005, z: 1.75, ry: rnd(0.25, 0.45) };
    sparks(v(0, modY(d), ZF + 0.3), 30);
    emit('broken');
    App.toast('БАБАХ! Стойка упала — уточка уже бежит');

    // Маршрут ремонта: тушит огонь → модули → упавший модуль → монитор оператора → перезагрузка → домой
    const onModule = (i, side) => {
      const x = side * 0.45;
      const pos = v(x, modY(i) + FH / 2 - 0.01 + x * modules[i].tilt, D / 2 + 0.5);
      return { pos, look: v(x - side * 0.6, pos.y + 0.05, pos.z), work: 0.8 };
    };
    const homeLook = DUCK_HOME.pos.clone().add(v(Math.sin(DUCK_HOME.rot), 0, Math.cos(DUCK_HOME.rot)));
    // Уточка запрыгивает на упавший модуль, чинит — и тот по дуге влетает обратно в стойку
    const onFloor = { pos: v(fm.fallTo.x - 0.35, FH + 0.01, fm.fallTo.z + 0.1), look: v(fm.fallTo.x + 0.35, FH + 0.05, fm.fallTo.z + 0.1), work: 0.9, fix: () => (fm.fallen = false) };
    const [m1, m2, m3] = [a, b, c].sort((x, y) => x - y);
    const spots = [
      // Тушит пожар: вместо искр — облачка пены
      { pos: v(-0.75, 0, fm.fallTo.z + 0.55), look: v(0.1, FH + 0.1, fm.fallTo.z + 0.2), work: 1.0, foam: true, fix: () => { fx.fire = 0; fx.smoke = 0.9; puff(v(0.5, FH, fm.fallTo.z + 0.2)); } },
      { ...onModule(m1, -1), fix: () => (modules[m1].broken = false) },
      { ...onModule(m2, 1), fix: () => (modules[m2].broken = false) },
      onFloor,
      { pos: v(OP.x, 1.56, OP.z), look: v(0.8, 1.6, 0), work: 0.7, fix: () => { fx.alarm = 0; fx.plateErr = false; plate.material.map.redraw(); } },
      { ...onModule(m3, -1), fix: () => { modules[m3].broken = false; fx.smoke = 0.25; } },
      { pos: v(1.2, 0, D / 2 + 1.0), look: v(BUS.x, 0.9, BUS.z + 0.02), work: 0.9, fix: reboot },
      { pos: DUCK_HOME.pos.clone(), look: homeLook, work: 0, home: true },
    ];
    setTimeout(() => {
      job = { spots, i: 0, phase: 'out', t: 0, from: duck.g.position.clone(), spark: 0 };
    }, still ? 200 : 700);
  };

  // Кадр ремонта: фазы out (исчезает) → gap (пауза) → in (появляется на новом месте) → work (чинит клювом)
  const tickJob = (dt, t) => {
    const g = duck.g;
    const spot = job.spots[job.i];
    job.t += dt;
    let sx = 1, sy = 1, lift = 0;
    duck.head.rotation.set(0, 0, 0);
    duck.body.position.y = 0;
    if (job.phase === 'out') {
      const k = Math.min(1, job.t / 0.24);
      [sx, sy, lift] = sample(OUT_KEYS, k);
      g.position.y = job.from.y + lift;
      if (k >= 1) {
        puff(job.from);
        trail(job.from, spot.pos);
        g.visible = false;
        job.phase = 'gap'; job.t = 0;
      }
    } else if (job.phase === 'gap') {
      if (job.t > 0.08) {
        g.position.copy(spot.pos);
        g.rotation.y = faceTo(spot.pos, spot.look);
        g.visible = true;
        job.phase = 'in'; job.t = 0; job.landed = false;
      }
    } else if (job.phase === 'in') {
      const k = Math.min(1, job.t / 0.36);
      [sx, sy, lift] = sample(IN_KEYS, k);
      g.position.y = spot.pos.y + lift;
      if (k >= 0.35 && !job.landed) { job.landed = true; puff(spot.pos); }
      if (k >= 1) {
        if (spot.home) { job = null; g.scale.setScalar(DS); g.rotation.y = DUCK_HOME.rot; return; }
        job.phase = 'work'; job.t = 0;
      }
    } else if (job.phase === 'work') {
      // Долбит клювом, как дятел, из-под клюва летят искры
      const peck = Math.max(0, Math.sin(t * 26));
      duck.head.rotation.x = 0.2 + peck * 0.55;
      duck.body.position.y = peck * 0.02;
      job.spark -= dt;
      if (job.spark <= 0) {
        job.spark = 0.08;
        const at = spot.look.clone().add(v(rnd(-0.05, 0.05), rnd(-0.05, 0.05), rnd(-0.05, 0.05)));
        if (spot.foam) part({ p: at, v: v(rnd(-0.6, 0.6), rnd(0.3, 1), rnd(-0.3, 0.6)), g: -2, life: 0.6, s0: 0.25, s1: 0.5, color: 0xffffff, a: 0.9 });
        else sparks(at, 3);
      }
      if (job.t > spot.work) {
        spot.fix?.();
        job.from = g.position.clone();
        job.i++;
        job.phase = 'out'; job.t = 0;
      }
    }
    g.scale.set(DS * sx, DS * sy, DS * sx);
  };

  // ---------- Взаимодействие: вращение, наведение, клик ----------
  const HOME_YAW = -0.42;
  const DOOR_OPEN = -1.8;  // угол открытой дверцы: в сторону, но не во весь размах
  const view = { yaw: HOME_YAW - 1.4, pitch: 0, vel: 0, dist: 12, ty: 2.3, fit: 12, cx: 0.5 };
  let hovered = -1, hoveredDoor = false, hoveredDuck = false, selected = -1, listHover = -1;
  let doorOpen = true, doorAngle = 0;
  let idle = 0;
  const ray = new T.Raycaster();
  const ndc = new T.Vector2();
  const tip = stage.querySelector('[data-tip]');
  const tipNum = stage.querySelector('[data-tip-num]');
  const tipName = stage.querySelector('[data-tip-name]');
  const hint = stage.querySelector('[data-hint]');
  const names = [...document.querySelectorAll('.module__name')].map((n) => n.textContent);

  const pick = (e) => {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    // Берём только ближайший объект под курсором: если это стенка корпуса (стойку развернули задом
    // или боком), модуль за ней не подсвечивается и не кликается
    const hit = ray.intersectObject(rack, true)[0];
    const u = hit?.object.userData || {};
    return { module: u.module ?? -1, door: !!u.door, duck: !!u.duck };
  };

  let drag = null;
  canvas.addEventListener('pointerdown', (e) => {
    drag = { x: e.clientX, y: e.clientY, sx: e.clientX, moved: 0, id: e.pointerId };
    view.vel = 0;
  });
  canvas.addEventListener('pointermove', (e) => {
    if (drag && drag.id === e.pointerId) {
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      drag.moved += Math.abs(dx) + Math.abs(dy);
      if (drag.moved > 6 && !drag.captured) { drag.captured = true; canvas.setPointerCapture(e.pointerId); }
      view.yaw += dx * 0.0065;
      view.vel = dx * 0.0065;
      view.pitch = clamp(view.pitch + dy * 0.003, -0.18, 0.4);
      drag.x = e.clientX; drag.y = e.clientY;
      idle = 0;
      if (drag.moved > 30) hint?.classList.add('is-gone');
      return;
    }
    if (e.pointerType !== 'mouse') return;
    const p = pick(e);
    setHover(p.module);
    hoveredDoor = p.door;
    if (p.duck) idle = Math.min(idle, 0); // разглядывают уточку — стойку не разворачиваем
    hoveredDuck = p.duck;
    canvas.classList.toggle('is-pointing', p.module >= 0 || p.door || p.duck);
  });
  const end = (e) => {
    if (!drag || drag.id !== e.pointerId) return;
    const click = drag.moved < 6;
    drag = null;
    if (!click || e.type === 'pointercancel') return;
    const p = pick(e);
    if (p.duck) {
      if (job) return App.toast('Кря! Не отвлекайте — чиню');
      idle = -6; // пока с уточкой общаются, стойка не разворачивается обратно
      return quack();
    }
    if (fx.broken) return; // во время аварии модули и дверца не трогаются
    if (p.door) return api.toggleDoor();
    api.select(p.module === selected ? -1 : p.module);
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', (e) => { if (drag && drag.id === e.pointerId) drag = null; });
  canvas.addEventListener('pointerleave', () => { if (!drag) { setHover(-1); hoveredDoor = false; hoveredDuck = false; } });

  function setHover(i) {
    if (i === hovered) return;
    hovered = i;
    emit('hover', i);
  }

  // ---------- Размер ----------
  const summary = document.querySelector('.summary');
  const wide = matchMedia('(min-width: 64.01rem)');
  const resize = () => {
    const w = stage.clientWidth, h = stage.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    // На десктопе холст лежит во всю ширину под сводкой: камера строит кадр для свободной области
    // слева от сводки, а остальная ширина холста просто продолжает сцену вправо
    const region = wide.matches && summary
      ? clamp(summary.getBoundingClientRect().left - stage.getBoundingClientRect().left, w * 0.4, w)
      : w;
    camera.aspect = region / h;
    camera.setViewOffset(region, h, 0, 0, w, h);
    camera.updateProjectionMatrix();
    stage.style.setProperty('--region', `${region}px`);
    fit();
  };

  // Камера отъезжает ровно настолько, чтобы в кадр целиком попали стойка, открытая дверца и пульт оператора.
  // Считаем по «домашнему» ракурсу, чтобы при вращении расстояние не прыгало
  const keyPoints = (() => {
    const pts = [];
    [-W / 2, W / 2].forEach((x) => [0, H + 0.1].forEach((y) => [-D / 2, D / 2].forEach((z) => pts.push(v(x, y, z)))));
    const DW = W - 0.04, hx = -W / 2 + 0.02, hz = D / 2 + 0.04;
    // Край дверцы на доле f её ширины
    const door = (f) => [0, H].map((y) => v(hx + DW * f * Math.cos(DOOR_OPEN), y, hz - DW * f * Math.sin(DOOR_OPEN)));
    const op = [-0.5, 0.5].flatMap((dx) => [0, 1.6].map((y) => v(OP.x + dx, y, OP.z)));
    return { base: [...pts, ...op], door: [door(1), door(0.5)] };
  })();
  function fit() {
    const tanV = Math.tan(T.MathUtils.degToRad(camera.fov / 2));
    const tanH = tanV * camera.aspect;
    // Широкое окно — дверца целиком, обычное — хотя бы половина, узкое (телефон) — только стойка и пульт,
    // иначе стойка стала бы совсем маленькой
    const a = camera.aspect;
    const pts = [...keyPoints.base, ...(a >= 1.2 ? keyPoints.door[0] : a >= 0.8 ? keyPoints.door[1] : [])];
    const c = Math.cos(HOME_YAW), s = Math.sin(HOME_YAW);
    const rot = pts.map((p) => ({ x: p.x * c + p.z * s, y: p.y, z: -p.x * s + p.z * c }));
    // На десктопе в центре свободной области — сама стойка, а не середина всей сцены:
    // иначе широкая дверца утягивала бы стойку к левому краю. В узком окне места мало —
    // там центрируем всю сцену, чтобы пульт оператора не уходил за край
    const xs = rot.map((p) => p.x);
    view.cx = a >= 0.8 ? 0 : (Math.min(...xs) + Math.max(...xs)) / 2;
    view.fit = Math.max(9, ...rot.map((p) => p.z + Math.max(Math.abs(p.x - view.cx) * 1.1 / tanH, Math.abs(p.y - 2.3) * 1.14 / tanV)));
  }
  new ResizeObserver(resize).observe(stage);
  resize();

  // Надписи перерисовываются, когда загрузятся шрифты сайта
  document.fonts?.ready.then(() => { modules.forEach((m) => m.face.redraw()); plate.material.map.redraw(); screenTex.redraw(); });

  // ---------- Цикл ----------
  let visible = true;
  new IntersectionObserver(([e]) => (visible = e.isIntersecting)).observe(stage);

  // Старт: стойка разворачивается к зрителю, модули по одному въезжают, дверца открывается
  const wiping = () => App.root.classList.contains('is-wiping');
  let introT = still ? 10 : -0.25;
  let spawnIn = 0.2;
  let last = performance.now();
  const tmp = new T.Vector3();

  App.loop((now) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!visible || document.hidden) return;
    const t = now / 1000;

    if (!wiping()) introT += dt;
    const intro = ease(introT / 1.8);

    // Вращение: инерция после броска, в покое — плавное покачивание вокруг «домашнего» ракурса
    idle += dt;
    // Пока идёт авария и ремонт, стойка стоит лицом к зрителю — чтобы было видно уточку
    const busy = fx.broken || job;
    if (busy) idle = Math.max(idle, 7);
    if (!drag) {
      view.yaw += view.vel;
      view.vel *= 0.93;
      if (Math.abs(view.vel) < 0.0005) view.vel = 0;
      const sway = still || busy ? 0 : Math.sin(t * 0.35) * 0.22;
      const home = selected >= 0 ? -0.18 : HOME_YAW + sway;
      if (introT < 2 || (idle > 6 && !view.vel)) {
        // Возвращаемся кратчайшим путём, даже если стойку прокрутили на несколько оборотов
        const diff = Math.atan2(Math.sin(home - view.yaw), Math.cos(home - view.yaw));
        view.yaw += diff * (introT < 2 ? 0.06 : 0.02);
        view.pitch = lerp(view.pitch, 0, 0.02);
      }
    }
    world.rotation.y = view.yaw;
    world.scale.setScalar(0.86 + 0.14 * intro);
    // Тряска в момент поломки
    fx.shake = Math.max(0, fx.shake - dt * 1.6);
    const sh = still ? 0 : Math.min(1.7, fx.shake);
    world.position.set(rnd(-0.11, 0.11) * sh, rnd(-0.07, 0.07) * sh, 0);

    // Камера: при выборе модуля подлетает к нему
    // При выборе модуля камера лишь слегка подъезжает к нему — стойка остаётся в кадре
    const tDist = selected >= 0 ? view.fit * 0.84 : view.fit;
    const tY = selected >= 0 ? lerp(2.3, modY(selected), 0.3) : 2.3;
    view.dist = lerp(view.dist, tDist, 0.06);
    view.ty = lerp(view.ty, tY, 0.06);
    const elev = 0.13 + view.pitch;
    camera.position.set(view.cx, view.ty + Math.sin(elev) * view.dist, Math.cos(elev) * view.dist);
    camera.lookAt(view.cx, view.ty, 0);

    // Дверца
    const doorTarget = doorOpen && introT > 0.05 ? DOOR_OPEN : 0;
    doorAngle = lerp(doorAngle, doorTarget, still ? 1 : 0.07);
    // После удара дверца болтается на петлях и постепенно успокаивается
    fx.door = Math.max(0, fx.door - dt * 0.45);
    door.rotation.y = doorAngle + (still ? 0 : Math.sin(t * 15) * 0.4 * fx.door * fx.door);
    // Табличка с ошибкой повисает на одном винте
    plate.rotation.z = lerp(plate.rotation.z, fx.plateErr ? -0.2 : 0, 0.1);
    plate.position.y = lerp(plate.position.y, fx.plateErr ? 4.1 : 4.16, 0.1);

    // Модули
    const activeHover = hovered >= 0 ? hovered : listHover;
    modules.forEach((m) => {
      const inT = ease((introT - 0.55 - m.i * 0.12) / 0.9);
      m.hover = lerp(m.hover, activeHover === m.i ? 1 : 0, 0.15);
      m.pull = lerp(m.pull, selected === m.i ? 1 : 0, 0.09);
      m.flash = Math.max(0, m.flash - dt * 2.2);
      // Нагрузка — скользящая доля заходов пакетов
      m.load = lerp(m.load, clamp(m.hits * 0.18), 0.04);
      m.hits = Math.max(0, m.hits - dt * 0.55);
      // Сломанный модуль выпадает вперёд и перекашивается; починенный задвигается обратно
      m.brk = lerp(m.brk, m.broken ? 1 : 0, 0.12);
      m.g.position.z = (1 - inT) * 3.2 + m.hover * 0.07 + m.pull * 1.05 + m.brk * 0.9;
      m.g.rotation.z = m.brk * m.tilt;
      // Упавший модуль: вываливается вперёд и вниз с ускорением, после ремонта по дуге влетает обратно
      if (m.fallTo && (m.fallen || m.fp > 0)) {
        m.fp = clamp(m.fp + dt * (m.fallen ? 1.6 : -1.5));
        const k = m.fp, to = m.fallTo;
        const xz = ease(k);
        const y = m.fallen ? lerp(modY(m.i), to.y, k * k) : lerp(modY(m.i), to.y, 1 - Math.pow(1 - k, 2)) + Math.sin(Math.PI * k) * 0.7;
        m.g.position.set(to.x * xz, y, m.g.position.z + to.z * xz);
        m.g.rotation.y = to.ry * xz;
        m.g.rotation.x = Math.sin(Math.PI * k) * (m.fallen ? 0.6 : -0.4);
        // Удар об пол: облако пыли, искры и вторая тряска
        if (m.fallen && k >= 1 && !m.landed) {
          m.landed = true;
          fx.shake = Math.max(fx.shake, 0.9);
          puff(v(to.x, 0, to.z + 0.1));
          sparks(v(to.x, 0.3, to.z + 0.6), 18);
        }
        if (!m.fallen && k <= 0) { m.g.position.x = 0; m.g.position.y = modY(m.i); m.g.rotation.set(0, 0, 0); m.fallTo = null; m.flash = 1; }
      }
      const blink = Math.sin(t * 9 + m.i * 2.1) > 0;
      m.edge.material.color.setHex(m.broken ? COL.rosso : COL.giallo);
      m.edge.material.opacity = m.broken ? (blink ? 0.9 : 0.2) : Math.max(m.hover * 0.7, m.pull, m.flash * 0.6);
      const red = m.i === 5;
      const f = m.flash;
      if (fx.broken) {
        // Авария: огоньки мигают красным вразнобой
        m.leds[0].material.color.setHex(Math.random() < 0.5 ? 0xff2020 : 0x330000);
        m.leds[1].material.color.setHex(Math.random() < 0.15 ? 0xff8080 : 0x2a2a2a);
        m.leds[2].material.color.setHex(m.broken ? (blink ? 0xff2020 : 0x330000) : 0x3dff8a);
      } else {
        m.leds[0].material.color.setHex(f > 0.05 ? (red ? 0xff2020 : COL.giallo) : 0x5a5a3a);
        m.leds[1].material.color.setHex(m.load > 0.05 && Math.sin(t * 22 + m.i * 3) > 0.2 ? 0xfff7b0 : 0x2a2a2a);
        m.leds[2].material.color.setHex(0x3dff8a);
      }
      m.halo.material.color.setHex(red ? COL.rosso : COL.giallo);
      m.halo.material.opacity = f * 0.9;
      m.bar.scale.y = Math.max(0.02, m.load);
    });

    // Пакеты
    if (introT > 2 && !fx.broken) {
      spawnIn -= dt;
      if (spawnIn <= 0 && packets.filter((p) => !p.user).length < 9) {
        spawn();
        spawnIn = 1.2 + Math.random() * 1.4;
      }
    }
    for (let k = packets.length - 1; k >= 0; k--) {
      const pk = packets[k];
      step(pk, dt);
      if (pk.done) { pk.s.visible = false; pool.push(pk.s); packets.splice(k, 1); }
    }

    // Пульт оператора вспыхивает, когда к нему пришло обращение
    opFlash = Math.max(0, opFlash - dt * 1.5);
    // Тревога: экран оператора мигает, красный контровой свет пульсирует
    const alarm = fx.alarm > 0 && Math.sin(t * 14) > 0 ? 1 : opFlash;
    screen.material.color.setScalar(0.45 + alarm * 0.55 + Math.sin(t * 2) * 0.03);
    rim.intensity = fx.broken ? 2.4 + (Math.sin(t * 7) * 0.5 + 0.5) * 2.6 : 2.4;

    // Пожар в блоке питания: языки пламени и мерцающий оранжевый отсвет
    // Пожар: горит упавший на пол модуль и крыша стойки — языки пламени и мерцающий оранжевый отсвет
    fireLight.intensity = lerp(fireLight.intensity, fx.fire ? rnd(2, 3.6) : 0, 0.3);
    if (fx.fire) {
      const fm = modules[fx.fireAt];
      const flame = (p, size) => part({ p, v: v(rnd(-0.2, 0.2), rnd(1.4, 2.4), rnd(-0.1, 0.2)), g: 0.6, life: rnd(0.45, 0.85), s0: size, s1: 0.06, color: [0xff3000, 0xff7a00, 0xffc400][Math.floor(Math.random() * 3)], add: true });
      if (fm?.fallTo && fm.landed && Math.random() < dt * 60) {
        // Точка на крышке упавшего модуля: из его координат в координаты сцены
        const p = fm.g.localToWorld(v(rnd(-0.9, 0.9), FH / 2, rnd(-0.5, 0.7)));
        world.worldToLocal(p);
        flame(p, rnd(0.45, 0.7));
        fireLight.position.set(fm.g.position.x, 0.9, fm.g.position.z + 0.3);
      }
      if (Math.random() < dt * 30) flame(v(rnd(-1, 1), H + 0.05, rnd(-0.7, 0.7)), rnd(0.4, 0.6));
      if (Math.random() < dt * 8) smoke(v(rnd(-0.6, 1.4), 1.0, D / 2 + 0.8));
    }

    // Дым из стойки и выпавших модулей, редкие искры из сломанных
    if (fx.smoke > 0 && Math.random() < fx.smoke * dt * 14) smoke(v(rnd(-0.8, 0.8), H + 0.05, rnd(-0.6, 0.6)));
    modules.forEach((m) => {
      if (!m.broken) return;
      if (Math.random() < dt * 4) smoke(v(rnd(-0.7, 0.7), modY(m.i) + 0.1, ZF + 0.9));
      if (!job && Math.random() < dt * 2.5) sparks(v(rnd(-0.9, 0.9), modY(m.i), ZF + 0.95), 4);
    });
    tickParts(dt);

    // Уточка чинит стойку — это своя анимация, обычное «безделье» не нужно
    if (job) tickJob(dt, t);
    else {
    // Уточка: крутит головой и переминается, по клику подпрыгивает и мотает головой
    duck.hop = Math.max(0, duck.hop - dt * 1.6);
    const hop = duck.hop > 0 ? Math.sin((1 - duck.hop) * Math.PI) : 0;
    const life = still ? 0 : 1;
    duck.body.position.y = hop * 0.28 + Math.abs(Math.sin(t * 2.2)) * 0.012 * life;
    duck.head.rotation.y = Math.sin(t * 0.6) * 0.5 * life + Math.sin(t * 28) * 0.4 * duck.hop;
    duck.head.rotation.z = Math.sin(t * 1.3) * 0.08 * life;
    duck.head.rotation.x = -0.08 + Math.sin(t * 0.9) * 0.05 * life - hop * 0.25;
    duck.feet.forEach((f, k) => (f.position.y = Math.max(0, Math.sin(t * 2.2 + k * Math.PI)) * 0.03 * life));
    }
    duck.leds.forEach((m, k) => m.material.color.setHex(Math.sin(t * (job ? 12 : 3) + k * 1.4) > 0 ? 0x3dff8a : 0x1a5a35));

    rings[0].rotation.z = t * 0.05;
    rings[1].rotation.z = -t * 0.08;
    busMat.color.setHex(fx.broken ? (Math.sin(t * 9) > 0 ? 0x5a0000 : 0x1a0000) : packets.length ? 0x4d4600 : 0x2a2700);

    renderer.render(scene, camera);

    // Подпись над наведённым модулем
    const tipI = hovered >= 0 ? hovered : -1;
    if (tipI >= 0) {
      const m = modules[tipI];
      m.g.localToWorld(tmp.set(-FW / 2 + 0.45, FH / 2, ZF)).project(camera);
      tip.style.transform = `translate(${((tmp.x + 1) / 2) * stage.clientWidth}px, ${((1 - tmp.y) / 2) * stage.clientHeight}px)`;
      tipNum.textContent = String(tipI + 1).padStart(2, '0');
      tipName.textContent = names[tipI] || CODES[tipI];
      tip.hidden = false;
    } else if (hoveredDuck) {
      duck.head.localToWorld(tmp.set(0, 0.32, 0.06)).project(camera);
      tip.style.transform = `translate(${((tmp.x + 1) / 2) * stage.clientWidth}px, ${((1 - tmp.y) / 2) * stage.clientHeight}px)`;
      tipNum.textContent = '?';
      tipName.textContent = 'Уточка отладки';
      tip.hidden = false;
    } else tip.hidden = true;
  });

  // ---------- API для сводки ----------
  const api = {
    on(type, fn) { (handlers[type] ||= []).push(fn); },
    // Выбор модуля: выдвигается из стойки, камера подлетает. Дверца при этом открывается
    select(i) {
      if (fx.broken && i >= 0) return; // сломанную стойку не разбирают — её чинит уточка
      selected = i;
      if (i >= 0 && !doorOpen) api.toggleDoor();
      idle = 3;
      emit('select', i);
    },
    hover(i) { listHover = i; },
    breakServer: () => breakServer(),
    get broken() { return fx.broken; },
    toggleDoor() {
      doorOpen = !doorOpen;
      if (!doorOpen && selected >= 0) api.select(-1);
      emit('door', doorOpen);
    },
    reset() { api.select(-1); view.pitch = 0; view.vel = 0; idle = 10; if (!doorOpen) api.toggleDoor(); },
    send(opts) { return spawn({ ...opts, user: true }); },
    load: (i) => modules[i]?.load || 0,
  };
  App.server = api;
})();
