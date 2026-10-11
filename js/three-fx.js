/* =============================================================
   EE Tech Studio — 3D 精密機械（Three.js）
   一組「行星齒輪減速機」：底座、螺栓、軸承、內齒環、太陽 / 行星齒輪、行星架、彈簧、外殼、主軸、旋鈕。
   - 滑鼠靠近模型 → 零件依序沿軸拆開（爆炸圖）＋ 零件名稱標註；滑鼠離開 → 組裝回去
   - 按住拖曳可以轉動（放開有慣性）；齒輪平常就一直在轉
   - 手機（沒有滑鼠）：自動輪流拆解 / 組裝
   - 首頁在右側；往下捲淡出（中間區塊不畫，省電）；聯絡區移到大標後面再出現
   保險：使用者關閉動效、省流量模式、不支援 WebGL、CDN 載不到 → 什麼都不做，網站照常。
   Three.js 很大，所以等頁面載入完、瀏覽器空閒時才去抓（'three' 的實際網址在 index.html 的 importmap）。
   ============================================================= */
(function () {
  'use strict';

  const status = (msg) => { document.documentElement.dataset.three = msg; }; // 查問題時可以在開發者工具看 <html data-three>

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { status('reduced-motion'); return; }
  if (navigator.connection && navigator.connection.saveData) { status('save-data'); return; }
  const probe = document.createElement('canvas');
  if (!(probe.getContext('webgl2') || probe.getContext('webgl'))) { status('no-webgl'); return; }

  const start = () => {
    status('loading');
    Promise.all([import('three'), import('three/addons/environments/RoomEnvironment.js')])
      .then(([THREE, env]) => init(THREE, env.RoomEnvironment))
      .catch((e) => status('load-failed: ' + (e && e.message || e)));
  };
  const whenIdle = () => ('requestIdleCallback' in window ? requestIdleCallback(start, { timeout: 2500 }) : setTimeout(start, 600));
  if (document.readyState === 'complete') whenIdle();
  else window.addEventListener('load', whenIdle, { once: true });

  function init(THREE, RoomEnvironment) {
    const V3 = THREE.Vector3;
    const TAU = Math.PI * 2;
    const isTouch = !window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const isSmall = () => window.innerWidth < 820;

    /* ---------- 畫布 / 渲染器 ---------- */
    const canvas = document.createElement('canvas');
    canvas.className = 'three-bg';
    canvas.setAttribute('aria-hidden', 'true');
    document.body.prepend(canvas);
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    } catch (e) { canvas.remove(); status('webgl-failed'); return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.setClearColor(0x000000, 0);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture; // 金屬需要環境反射才有質感
    scene.environmentIntensity = 0.75;

    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
    camera.position.set(0, 0, 11);

    const key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(-4, 6, 6);
    scene.add(key);
    const rimLime = new THREE.PointLight(0xc5f04a, 7, 12);
    rimLime.position.set(4, 2, -2);
    scene.add(rimLime);
    const rimBlue = new THREE.PointLight(0x4d7cff, 16, 12);
    rimBlue.position.set(-4, -3, 1);
    scene.add(rimBlue);

    /* ---------- 材質 ---------- */
    const M = {
      graphite: new THREE.MeshStandardMaterial({ color: 0x2b3038, metalness: 0.9, roughness: 0.38 }),
      steel: new THREE.MeshStandardMaterial({ color: 0xb8c0ca, metalness: 1, roughness: 0.24 }),
      chrome: new THREE.MeshStandardMaterial({ color: 0xeef1f4, metalness: 1, roughness: 0.08 }),
      blue: new THREE.MeshStandardMaterial({ color: 0x3d63e0, metalness: 0.85, roughness: 0.3 }),
      lime: new THREE.MeshStandardMaterial({ color: 0xa9d63c, metalness: 0.75, roughness: 0.3 }),
      dark: new THREE.MeshStandardMaterial({ color: 0x14171c, metalness: 0.3, roughness: 0.7 }),
      glow: new THREE.MeshBasicMaterial({ color: 0xc5f04a }),
    };

    /* ---------- 幾何小工具 ---------- */
    // 一圈梯形齒的點（外齒：齒朝外；內齒：rTip < rRoot，齒朝內）
    function toothPoints(teeth, rRoot, rTip) {
      const out = [];
      const step = TAU / teeth;
      for (let i = 0; i < teeth; i++) {
        const a = i * step;
        [[a, rRoot], [a + step * 0.18, rTip], [a + step * 0.45, rTip], [a + step * 0.63, rRoot]]
          .forEach(([ang, r]) => out.push([Math.cos(ang) * r, Math.sin(ang) * r]));
      }
      return out;
    }
    function trace(path, pts) {
      pts.forEach(([x, y], j) => (j === 0 ? path.moveTo(x, y) : path.lineTo(x, y)));
      path.closePath();
      return path;
    }
    const circleHole = (x, y, r) => { const h = new THREE.Path(); h.absarc(x, y, r, 0, TAU, true); return h; };
    // 外齒輪：可選中心孔、減重孔
    function gearShape(teeth, rTip, rRoot, holeR, lighten) {
      const s = trace(new THREE.Shape(), toothPoints(teeth, rRoot, rTip));
      if (holeR) s.holes.push(circleHole(0, 0, holeR));
      if (lighten) {
        for (let i = 0; i < lighten.n; i++) {
          const a = (i / lighten.n) * TAU;
          s.holes.push(circleHole(Math.cos(a) * lighten.at, Math.sin(a) * lighten.at, lighten.r));
        }
      }
      return s;
    }
    // 內齒環：外圈是圓，內圈是朝內的齒
    function ringGearShape(teeth, rOuter, rRoot, rTip) {
      const s = new THREE.Shape();
      s.absarc(0, 0, rOuter, 0, TAU, false);
      s.holes.push(trace(new THREE.Path(), toothPoints(teeth, rRoot, rTip)));
      return s;
    }
    // 2D 輪廓擠出成厚度 depth、躺平（沿 Y 軸）、置中
    function extrude(shape, depth, bevel = 0.012) {
      const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 10 });
      g.rotateX(-Math.PI / 2);
      g.translate(0, -depth / 2, 0);
      g.computeVertexNormals();
      return g;
    }
    // 環形（截面是矩形），用車床旋轉出來
    function ringGeo(rIn, rOut, h, seg = 72) {
      const p = [[rIn, -h / 2], [rOut, -h / 2], [rOut, h / 2], [rIn, h / 2], [rIn, -h / 2]].map(([r, y]) => new THREE.Vector2(r, y));
      return new THREE.LatheGeometry(p, seg);
    }
    const mesh = (geo, mat) => new THREE.Mesh(geo, mat);

    /* ---------- 組裝 ----------
       每個零件包一層 holder：holder 負責「組裝位置 ↔ 拆開位置」的移動，裡面的 mesh 負責自轉（齒輪）。 */
    const model = new THREE.Group();       // 整台機器（拖曳轉動作用在這層）
    const tilt = new THREE.Group();        // 往前傾，看得到上面
    tilt.add(model);
    const stage = new THREE.Group();       // 位置 / 大小（首頁、聯絡區）
    stage.add(tilt);
    scene.add(stage);

    const parts = [];
    // order：拆開的先後（0 最先）；off：拆開時的位移；radial：沿半徑往外推多少
    function addPart(obj, base, off, order, radial = 0) {
      const holder = new THREE.Group();
      holder.add(obj);
      holder.position.copy(base);
      model.add(holder);
      const dir = new V3(base.x, 0, base.z);
      if (dir.lengthSq() > 1e-6) dir.normalize();
      const p = { holder, base: base.clone(), off, order, radial, dir };
      parts.push(p);
      return p;
    }

    // 底座 + 6 顆底座螺栓
    const base = new THREE.Group();
    base.add(mesh(new THREE.CylinderGeometry(1.75, 1.8, 0.2, 96), M.graphite));
    const baseLip = mesh(ringGeo(1.3, 1.55, 0.08), M.steel); baseLip.position.y = 0.13; base.add(baseLip);
    const basePart = addPart(base, new V3(0, -1.3, 0), new V3(0, -1.0, 0), 9);

    const boltHead = new THREE.CylinderGeometry(0.085, 0.085, 0.07, 6);
    const boltShank = new THREE.CylinderGeometry(0.038, 0.038, 0.26, 12);
    function bolt() {
      const g = new THREE.Group();
      const h = mesh(boltHead, M.chrome); h.position.y = 0.035; g.add(h);
      const s = mesh(boltShank, M.steel); s.position.y = -0.13; g.add(s);
      return g;
    }
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU + 0.26;
      addPart(bolt(), new V3(Math.cos(a) * 1.62, -1.17, Math.sin(a) * 1.62), new V3(0, 0.9, 0), 8, 0.35);
    }

    // 軸承：外圈、內圈、12 顆滾珠
    const bearingPart = addPart(mesh(ringGeo(1.0, 1.18, 0.2), M.steel), new V3(0, -1.0, 0), new V3(0, -0.55, 0), 7);
    addPart(mesh(ringGeo(0.62, 0.78, 0.2), M.steel), new V3(0, -1.0, 0), new V3(0, -0.35, 0), 7);
    const ball = new THREE.SphereGeometry(0.085, 20, 14);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU;
      addPart(mesh(ball, M.chrome), new V3(Math.cos(a) * 0.89, -1.0, Math.sin(a) * 0.89), new V3(0, -0.45, 0), 7, 0.45);
    }

    // 行星齒輪組：內齒環（固定）、太陽齒輪、3 顆行星齒輪
    const Z_RING = 42, Z_SUN = 12, Z_PLANET = 15;
    addPart(mesh(extrude(ringGearShape(Z_RING, 1.42, 1.22, 1.12), 0.24), M.graphite), new V3(0, -0.66, 0), new V3(0, -0.05, 0), 6);
    const sun = mesh(extrude(gearShape(Z_SUN, 0.38, 0.31, 0.14), 0.26), M.blue);
    addPart(sun, new V3(0, -0.66, 0), new V3(0, 0.45, 0), 5);
    const PLANET_R = 0.735;
    const planets = [];
    for (let i = 0; i < 3; i++) {
      const m = mesh(extrude(gearShape(Z_PLANET, 0.42, 0.35, 0.07), 0.24), M.lime);
      const a = (i / 3) * TAU;
      const part = addPart(m, new V3(Math.cos(a) * PLANET_R, -0.66, Math.sin(a) * PLANET_R), new V3(0, 0.2, 0), 5, 0.55);
      planets.push({ mesh: m, a0: a, part });
    }

    // 行星架（三爪盤 + 3 根銷）
    const carrier = new THREE.Group();
    carrier.add(mesh(extrude(gearShape(3, 1.0, 0.55, 0.16), 0.08, 0.01), M.steel));
    const pinGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.34, 16);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * TAU;
      const pin = mesh(pinGeo, M.chrome);
      pin.position.set(Math.cos(a) * PLANET_R, -0.17, Math.sin(a) * PLANET_R);
      carrier.add(pin);
    }
    const carrierPart = addPart(carrier, new V3(0, -0.44, 0), new V3(0, 0.75, 0), 4);

    // 彈簧（螺旋管）
    class Helix extends THREE.Curve {
      getPoint(t, target = new V3()) {
        const a = t * TAU * 6;
        return target.set(Math.cos(a) * 0.36, t * 0.62 - 0.31, Math.sin(a) * 0.36);
      }
    }
    const springPart = addPart(mesh(new THREE.TubeGeometry(new Helix(), 360, 0.032, 8, false), M.lime), new V3(0, -0.05, 0), new V3(0, 1.05, 0), 3);

    // 外殼（車床輪廓）+ 發光環
    const housing = new THREE.Group();
    const prof = [[1.12, -0.32], [1.2, -0.3], [1.2, 0.16], [1.08, 0.3], [0.5, 0.33], [0.44, 0.28], [0.44, 0.2]]
      .map(([r, y]) => new THREE.Vector2(r, y));
    const shell = mesh(new THREE.LatheGeometry(prof, 96), M.graphite);
    shell.material.side = THREE.DoubleSide;
    housing.add(shell);
    const glowRing = mesh(new THREE.TorusGeometry(1.205, 0.012, 8, 120), M.glow);
    glowRing.rotation.x = Math.PI / 2; glowRing.position.y = -0.06;
    housing.add(glowRing);
    const housingPart = addPart(housing, new V3(0, 0.1, 0), new V3(0, 1.55, 0), 2);

    // 外殼上 6 顆螺栓
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;
      addPart(bolt(), new V3(Math.cos(a) * 0.82, 0.43, Math.sin(a) * 0.82), new V3(0, 2.35, 0), 0, 0.25);
    }

    // 主軸（鍍鉻）
    const shaft = new THREE.Group();
    shaft.add(mesh(new THREE.CylinderGeometry(0.13, 0.13, 2.3, 32), M.chrome));
    const keyway = mesh(new THREE.BoxGeometry(0.05, 0.5, 0.27), M.dark); keyway.position.y = 0.75; shaft.add(keyway);
    addPart(shaft, new V3(0, -0.15, 0), new V3(0, 1.6, 0), 1);

    // 旋鈕（滾花 + 發光刻度）
    const knob = new THREE.Group();
    knob.add(mesh(new THREE.CylinderGeometry(0.4, 0.42, 0.26, 64), M.steel));
    const knobTop = mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.02, 64), M.dark); knobTop.position.y = 0.135; knob.add(knobTop);
    const mark = mesh(new THREE.BoxGeometry(0.04, 0.025, 0.2), M.glow); mark.position.set(0, 0.15, 0.17); knob.add(mark);
    const ridge = new THREE.BoxGeometry(0.02, 0.22, 0.03);
    for (let i = 0; i < 36; i++) {
      const a = (i / 36) * TAU;
      const r = mesh(ridge, M.graphite);
      r.position.set(Math.cos(a) * 0.415, 0, Math.sin(a) * 0.415);
      r.rotation.y = -a;
      knob.add(r);
    }
    const knobPart = addPart(knob, new V3(0, 0.6, 0), new V3(0, 2.0, 0), 0);
    const N_ORDER = 10;

    /* ---------- 標註（拆開時出現，HTML 疊在畫布上） ---------- */
    const LABELS = [
      { text: '旋鈕 KNOB', part: knobPart, side: 1 },
      { text: '外殼 HOUSING', part: housingPart, side: -1 },
      { text: '彈簧 SPRING', part: springPart, side: 1 },
      { text: '行星齒輪 PLANETARY', part: carrierPart, side: -1 },
      { text: '軸承 BEARING', part: bearingPart, side: 1 },
      { text: '底座 BASE', part: basePart, side: -1 },
    ];
    const labelLayer = document.createElement('div');
    labelLayer.className = 'mech-labels';
    labelLayer.setAttribute('aria-hidden', 'true');
    LABELS.forEach((l) => {
      const el = document.createElement('span');
      el.className = 'mech-label' + (l.side < 0 ? ' mech-label--left' : '');
      const dot = document.createElement('i');
      const txt = document.createElement('b');
      txt.textContent = l.text;
      el.append(dot, txt);
      labelLayer.appendChild(el);
      l.el = el;
    });
    document.body.appendChild(labelLayer);

    /* ---------- 尺寸 ---------- */
    let W = 1, H = 1;
    function resize() {
      W = window.innerWidth; H = window.innerHeight;
      renderer.setSize(W, H, false);
      camera.aspect = W / H;
      camera.updateProjectionMatrix();
    }
    resize();
    window.addEventListener('resize', resize);

    /* ---------- 互動 ---------- */
    let px = -1e4, py = -1e4, pointerIn = false;
    let mx = 0, my = 0;
    window.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch' || !Number.isFinite(e.clientX) || !Number.isFinite(e.clientY)) return;
      px = e.clientX; py = e.clientY; pointerIn = true;
      mx = px / W - 0.5; my = py / H - 0.5;
    }, { passive: true });
    document.documentElement.addEventListener('pointerleave', () => { pointerIn = false; });
    window.addEventListener('blur', () => { pointerIn = false; });

    // 拖曳轉動：在模型附近、而且不是按在連結 / 按鈕 / 表單上
    const rot = { y: 0.6, x: 0, vy: 0, vx: 0 };
    let dragging = false, lastX = 0, lastY = 0;
    const modelPx = { x: -1e4, y: -1e4, r: 1 };
    const interactive = 'a, button, input, textarea, select, label, [role="tab"], .lab__panel';
    window.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch' || e.button !== 0) return;
      if (e.target.closest && e.target.closest(interactive)) return;
      if (Math.hypot(e.clientX - modelPx.x, e.clientY - modelPx.y) > modelPx.r * 1.3) return;
      dragging = true; lastX = e.clientX; lastY = e.clientY;
      document.documentElement.classList.add('mech-dragging');
      e.preventDefault(); // 不要選到文字
    });
    window.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      rot.vy = (e.clientX - lastX) * 0.0085;
      rot.vx = (e.clientY - lastY) * 0.006;
      rot.y += rot.vy; rot.x += rot.vx;
      lastX = e.clientX; lastY = e.clientY;
    });
    const endDrag = () => { dragging = false; document.documentElement.classList.remove('mech-dragging'); };
    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);

    const hero = document.querySelector('.hero');
    const contact = document.querySelector('.contact');
    const clamp01 = (v) => Math.min(1, Math.max(0, v));
    const lerp = (a, b, t) => a + (b - a) * t;
    const smooth = (a, b, v) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };
    const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

    const cur = { x: 2.6, y: 0, s: 0.62, op: 0, explode: 0 };
    const tmp = new V3();
    const tmp2 = new V3();
    const t0 = performance.now();
    let prev = t0;
    let gearAngle = 0;
    let running = false;

    function frame() {
      running = false;
      const now = performance.now();
      const dt = Math.min((now - prev) / 1000, 0.05);
      prev = now;
      const t = (now - t0) / 1000;

      // 首頁 / 聯絡區各自的可見程度
      const hr = hero.getBoundingClientRect();
      const heroVis = clamp01(1 + hr.top / (hr.height * 0.85));
      const cr = contact ? contact.getBoundingClientRect() : { top: 1e9, bottom: 1e9 };
      const contactVis = clamp01((H * 0.75 - cr.top) / (H * 0.45)) * clamp01(cr.bottom / (H * 0.6)); // 聯絡區上緣過了畫面 3/4 才開始淡入
      const inContact = contactVis > heroVis;
      const small = isSmall();
      const target = inContact
        ? { x: 0, y: small ? 1.5 : 1.35, s: small ? 0.34 : 0.5, op: contactVis * 0.45 }
        : { x: small ? 0.75 : 2.5, y: small ? 1.65 : -0.05, s: small ? 0.34 : 0.7, op: heroVis * (small ? 0.75 : 1) };
      const k = 1 - Math.pow(0.0015, dt);
      cur.x = lerp(cur.x, target.x, k);
      cur.y = lerp(cur.y, target.y, k);
      cur.s = lerp(cur.s, target.s, k);
      cur.op = lerp(cur.op, target.op, 1 - Math.pow(0.0004, dt));
      canvas.style.opacity = cur.op.toFixed(3);

      if (cur.op > 0.01 && !document.hidden) {
        stage.position.set(cur.x, cur.y, 0);
        stage.scale.setScalar(cur.s);

        // 模型在螢幕上的位置與大小（判斷滑鼠有多近、拖曳範圍）
        stage.updateMatrixWorld();
        tmp.set(0, 0, 0).applyMatrix4(stage.matrixWorld).project(camera);
        modelPx.x = (tmp.x * 0.5 + 0.5) * W;
        modelPx.y = (-tmp.y * 0.5 + 0.5) * H;
        tmp2.set(1.8, 0, 0).applyMatrix4(stage.matrixWorld).project(camera);
        modelPx.r = Math.max(60, Math.abs(tmp2.x - tmp.x) * 0.5 * W) || 160;

        // 拆解程度：滑鼠越近越拆開；手機自動輪流
        let explodeTarget;
        if (isTouch) {
          explodeTarget = smooth(-0.25, 0.25, Math.sin(t * 0.7));
        } else if (dragging) {
          explodeTarget = cur.explode;
        } else {
          const d = pointerIn ? Math.hypot(px - modelPx.x, py - modelPx.y) : 1e9;
          explodeTarget = 1 - smooth(modelPx.r * 0.75, modelPx.r * 1.9, d);
        }
        if (!Number.isFinite(explodeTarget)) explodeTarget = 0;
        cur.explode = lerp(cur.explode, explodeTarget, 1 - Math.pow(0.02, dt));
        if (!Number.isFinite(cur.explode)) cur.explode = 0; // 一旦變 NaN 就永遠回不來，所以一定要擋

        // 齒輪運轉：內齒環固定，太陽輪帶動行星輪
        gearAngle += dt * 0.55;
        const carrierA = gearAngle * (Z_SUN / (Z_SUN + Z_RING));
        sun.rotation.y = -gearAngle;
        carrier.rotation.y = -carrierA;
        planets.forEach((pl) => {
          const a = pl.a0 + carrierA;
          pl.part.base.set(Math.cos(a) * PLANET_R, -0.66, Math.sin(a) * PLANET_R); // 跟行星架的銷同一個方向轉
          pl.part.dir.set(pl.part.base.x, 0, pl.part.base.z).normalize();
          pl.mesh.rotation.y = (gearAngle - carrierA) * (Z_SUN / Z_PLANET);
        });
        knob.rotation.y = -gearAngle * 0.4;

        // 每個零件依序拆開（上面的先走）
        const S = 0.55;
        for (let i = 0; i < parts.length; i++) {
          const p = parts[i];
          const local = easeInOut(clamp01(cur.explode * (1 + S) - (p.order / N_ORDER) * S));
          p.holder.position.set(
            p.base.x + p.off.x * local + p.dir.x * p.radial * local,
            p.base.y + p.off.y * local,
            p.base.z + p.off.z * local + p.dir.z * p.radial * local,
          );
        }

        // 轉動：拖曳 > 慣性 > 自動慢轉；滑鼠位置也會稍微帶動
        if (!dragging) {
          rot.vy *= Math.pow(0.04, dt);
          rot.vx *= Math.pow(0.04, dt);
          rot.y += rot.vy + dt * 0.18;
          rot.x += rot.vx;
          rot.x = lerp(rot.x, 0, 1 - Math.pow(0.3, dt)); // 上下傾斜慢慢回正
        }
        rot.x = Math.max(-0.6, Math.min(0.6, rot.x));
        model.rotation.y = rot.y + mx * 0.25;
        tilt.rotation.x = 0.42 + rot.x + my * 0.12;

        renderer.render(scene, camera);
        updateLabels();
      } else {
        labelLayer.style.opacity = '0';
      }
      schedule();
    }

    function updateLabels() {
      const a = isSmall() ? 0 : smooth(0.55, 0.9, cur.explode) * cur.op;
      labelLayer.style.opacity = a.toFixed(3);
      if (a <= 0.01) return;
      LABELS.forEach((l) => {
        l.part.holder.getWorldPosition(tmp).project(camera);
        const x = (tmp.x * 0.5 + 0.5) * W;
        const y = (-tmp.y * 0.5 + 0.5) * H;
        l.el.style.transform = `translate(${(x + l.side * modelPx.r * 0.95).toFixed(1)}px, ${y.toFixed(1)}px)`;
      });
      labelLayer.style.setProperty('--lead', (modelPx.r * 0.7).toFixed(0) + 'px');
    }

    function schedule() {
      if (running) return;
      running = true;
      requestAnimationFrame(frame);
    }
    document.addEventListener('visibilitychange', () => { if (!document.hidden) { prev = performance.now(); schedule(); } });
    canvas.classList.add('is-ready');
    status('running');
    schedule();
  }
})();
