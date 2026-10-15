/* =============================================================
   EE Tech Studio — 3D 精密機械：伺服致動器（Three.js）
   零件（由後往前）：後蓋與接頭、驅動電路板、光學編碼盤、後軸承、磁鐵轉子、銅線定子、
   馬達外殼、兩段行星齒輪、交叉滾子軸承、前蓋、輸出法蘭、內六角螺絲、主軸。
   畫面怎麼擺由 main.js 決定：它依捲動位置呼叫 window.EE_MACHINE.set({...})，
   這裡每一幀把目前狀態平滑地靠近目標。
   直接操作（Apple 式）：用滑鼠按住機械可以轉動——貼著游標 1:1 跟著動、尊重你抓的位置；
   放開時帶著你放手當下的速度繼續轉（速度交接），再用彈簧回到原位；超過轉動範圍會有橡皮筋式的阻力。
   抓住正在回彈的機械可以立刻接手（可中斷）。只處理滑鼠 / 觸控筆；手機的手指留給捲動。
   保險：關閉動效、省流量、不支援 WebGL、CDN 載不到 → 不顯示，網站照常。
   'three' 的實際網址在 index.html 的 importmap。
   ============================================================= */
(function () {
  'use strict';

  // 先放一個接收器：Three.js 還沒載好之前 main.js 設的目標也不會丟
  const target = { x: 2.2, y: 0, scale: 0.8, rotX: 0.35, rotY: -0.6, rotZ: -0.9, explode: 0, focus: 0, opacity: 1, spin: 0.12 };
  window.EE_MACHINE = { set(p) { Object.assign(target, p); }, ready: false };

  const status = (msg) => { document.documentElement.dataset.three = msg; };
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
  const whenIdle = () => ('requestIdleCallback' in window ? requestIdleCallback(start, { timeout: 1500 }) : setTimeout(start, 400));
  if (document.readyState === 'complete') whenIdle();
  else window.addEventListener('load', whenIdle, { once: true });

  function init(THREE, RoomEnvironment) {
    const V2 = THREE.Vector2, V3 = THREE.Vector3;
    const TAU = Math.PI * 2;
    const small = () => window.innerWidth < 820;

    /* ---------- 渲染器 ---------- */
    const canvas = document.createElement('canvas');
    canvas.className = 'machine';
    canvas.setAttribute('aria-hidden', 'true');
    document.body.prepend(canvas);
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    } catch (e) { canvas.remove(); status('webgl-failed'); return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, small() ? 1.5 : 1.75));
    renderer.setClearColor(0x000000, 0);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.8;
    const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 200);
    camera.position.set(0, 0, 16);

    const key = new THREE.DirectionalLight(0xffffff, 1.5); key.position.set(-5, 7, 8); scene.add(key);
    const rimA = new THREE.PointLight(0x7fd8ff, 8, 18); rimA.position.set(6, 3, -3); scene.add(rimA);
    const rimB = new THREE.PointLight(0xbfeaff, 12, 18); rimB.position.set(-6, -4, 2); scene.add(rimB);

    /* ---------- 材質 ---------- */
    const std = (o) => new THREE.MeshStandardMaterial(o);
    const M = {
      housing: std({ color: 0x2a2f37, metalness: 0.85, roughness: 0.42 }),   // 陽極處理鋁（石墨灰）
      alu: std({ color: 0xaeb6c0, metalness: 1, roughness: 0.3 }),            // 車削鋁
      steel: std({ color: 0xc9d0d8, metalness: 1, roughness: 0.2 }),
      chrome: std({ color: 0xf1f3f6, metalness: 1, roughness: 0.06 }),
      blackOxide: std({ color: 0x16181c, metalness: 0.8, roughness: 0.45 }),   // 黑色螺絲
      copper: std({ color: 0xc27a45, metalness: 1, roughness: 0.28 }),
      magnetA: std({ color: 0x2f343c, metalness: 0.7, roughness: 0.35 }),    // 磁鐵：石墨灰與深冰藍交錯
      magnetB: std({ color: 0x2a86b8, metalness: 0.65, roughness: 0.35 }),
      iceDeep: std({ color: 0x2f9fd8, metalness: 0.85, roughness: 0.3 }),    // 太陽齒輪：深一階的冰藍陽極處理
      ice: std({ color: 0x86d9fb, metalness: 0.7, roughness: 0.32 }),        // 行星齒輪：冰藍
      pcb: std({ color: 0x0d1f1a, metalness: 0.2, roughness: 0.7 }),
      gold: std({ color: 0xd4a94e, metalness: 1, roughness: 0.25 }),
      chip: std({ color: 0x101114, metalness: 0.3, roughness: 0.55 }),
      glass: new THREE.MeshStandardMaterial({ color: 0x9fd8ff, metalness: 0.2, roughness: 0.05, transparent: true, opacity: 0.32, depthWrite: false }),
      slot: std({ color: 0x0b0c0f, metalness: 0.4, roughness: 0.5 }),
      glow: new THREE.MeshBasicMaterial({ color: 0x5cc9fb }),
    };
    M.housing.side = THREE.DoubleSide;
    M.alu.side = THREE.DoubleSide;

    /* ---------- 幾何工具 ---------- */
    const mesh = (g, m) => new THREE.Mesh(g, m);
    // 車床：pts 是 [半徑, 高度] 的輪廓
    const lathe = (pts, seg = 96) => new THREE.LatheGeometry(pts.map(([r, y]) => new V2(r, y)), seg);
    // 矩形截面的環
    const ring = (rIn, rOut, h, seg = 96) => lathe([[rIn, -h / 2], [rOut, -h / 2], [rOut, h / 2], [rIn, h / 2], [rIn, -h / 2]], seg);
    // 有倒角的環（看起來像車削件）
    const chamferRing = (rIn, rOut, h, c, seg = 96) => lathe([[rIn + c, -h / 2], [rOut - c, -h / 2], [rOut, -h / 2 + c], [rOut, h / 2 - c], [rOut - c, h / 2], [rIn + c, h / 2], [rIn, h / 2 - c], [rIn, -h / 2 + c], [rIn + c, -h / 2]], seg);
    function toothPts(n, rRoot, rTip) {
      const out = [], step = TAU / n;
      for (let i = 0; i < n; i++) {
        const a = i * step;
        [[a, rRoot], [a + step * 0.2, rTip], [a + step * 0.45, rTip], [a + step * 0.65, rRoot]]
          .forEach(([ang, r]) => out.push([Math.cos(ang) * r, Math.sin(ang) * r]));
      }
      return out;
    }
    const trace = (p, pts) => { pts.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y))); p.closePath(); return p; };
    const hole = (x, y, r) => { const h = new THREE.Path(); h.absarc(x, y, r, 0, TAU, true); return h; };
    function extrude(shape, depth, bevel = 0.008, curve = 12) {
      const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: curve });
      g.rotateX(-Math.PI / 2); g.translate(0, -depth / 2, 0); g.computeVertexNormals();
      return g;
    }
    function gear(n, rTip, rRoot, bore, depth, holes) {
      const s = trace(new THREE.Shape(), toothPts(n, rRoot, rTip));
      if (bore) s.holes.push(hole(0, 0, bore));
      (holes || []).forEach(([x, y, r]) => s.holes.push(hole(x, y, r)));
      return extrude(s, depth);
    }
    function ringGear(n, rOuter, rRoot, rTip, depth) {
      const s = new THREE.Shape(); s.absarc(0, 0, rOuter, 0, TAU, false);
      s.holes.push(trace(new THREE.Path(), toothPts(n, rRoot, rTip)));
      return extrude(s, depth);
    }
    function disc(r, depth, bore, holes, curve = 48) {
      const s = new THREE.Shape(); s.absarc(0, 0, r, 0, TAU, false);
      if (bore) s.holes.push(hole(0, 0, bore));
      (holes || []).forEach(([x, y, hr]) => s.holes.push(hole(x, y, hr)));
      return extrude(s, depth, 0.01, curve);
    }
    const circle = (n, r, phase = 0) => Array.from({ length: n }, (_, i) => { const a = phase + (i / n) * TAU; return [Math.cos(a) * r, Math.sin(a) * r, a]; });
    // 內六角螺絲：頭朝 +Y
    const capHead = new THREE.CylinderGeometry(0.075, 0.075, 0.08, 32);
    const capSocket = new THREE.CylinderGeometry(0.035, 0.035, 0.02, 6);
    function capScrew(len) {
      const g = new THREE.Group();
      const h = mesh(capHead, M.blackOxide); h.position.y = 0.04; g.add(h);
      const s = mesh(capSocket, M.slot); s.position.y = 0.081; g.add(s);
      const b = mesh(new THREE.CylinderGeometry(0.042, 0.042, len, 16), M.blackOxide); b.position.y = -len / 2; g.add(b);
      return g;
    }

    /* ---------- 組裝 ----------
       每個零件放在 holder 裡；holder 在「組裝位置」和「拆開位置」之間移動。
       模型的軸是本地 Y 軸（後 = 下，前 = 上）。 */
    const model = new THREE.Group();     // 自轉（沿軸）
    const pose = new THREE.Group();      // 姿態（傾斜 / 擺成橫的）
    const stage = new THREE.Group();     // 位置、大小
    pose.add(model); stage.add(pose); scene.add(stage);

    const parts = [];
    let layerCount = 0;
    // layer：拆開後沿軸排第幾層；radial：往外推；side：往旁邊移（主軸用）
    function add(obj, y, layer, opt = {}) {
      const holder = new THREE.Group();
      holder.add(obj);
      holder.position.set(opt.x || 0, y, opt.z || 0);
      model.add(holder);
      const dir = new V3(opt.x || 0, 0, opt.z || 0);
      if (dir.lengthSq() > 1e-6) dir.normalize();
      const p = { holder, base: holder.position.clone(), layer, radial: opt.radial || 0, side: opt.side || null, dir };
      parts.push(p);
      layerCount = Math.max(layerCount, layer + 1);
      return p;
    }

    // L0 後蓋 + 接頭 + 線材固定頭
    const rear = new THREE.Group();
    rear.add(mesh(chamferRing(0.0, 1.18, 0.16, 0.03), M.housing));
    const conn = mesh(new THREE.BoxGeometry(0.5, 0.18, 0.28), M.blackOxide); conn.position.set(0.45, -0.16, 0); rear.add(conn);
    const pins = new THREE.CylinderGeometry(0.018, 0.018, 0.06, 8);
    for (let i = 0; i < 6; i++) { const p = mesh(pins, M.gold); p.position.set(0.3 + (i % 3) * 0.1, -0.27, i < 3 ? -0.05 : 0.05); rear.add(p); }
    const gland = mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.22, 24), M.alu); gland.position.set(-0.45, -0.19, 0.1); rear.add(gland);
    circle(6, 1.0, 0.3).forEach(([x, z]) => { const s = mesh(capHead, M.blackOxide); s.position.set(x, -0.09, z); s.rotation.x = Math.PI; rear.add(s); });
    add(rear, -2.15, 0);

    // L1 驅動電路板（晶片、電容、金色焊墊）
    const pcb = new THREE.Group();
    pcb.add(mesh(disc(1.02, 0.035, 0.18, circle(4, 0.88, 0.78).map(([x, y]) => [x, y, 0.05])), M.pcb));
    const chipBig = mesh(new THREE.BoxGeometry(0.42, 0.05, 0.42), M.chip); chipBig.position.set(0.18, 0.04, -0.32); pcb.add(chipBig);
    [[-0.45, 0.25, 0.22, 0.16], [-0.1, 0.45, 0.16, 0.24], [0.55, 0.25, 0.14, 0.14], [-0.5, -0.35, 0.2, 0.12]].forEach(([x, z, w, d]) => {
      const c = mesh(new THREE.BoxGeometry(w, 0.04, d), M.chip); c.position.set(x, 0.035, z); pcb.add(c);
    });
    const capGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.16, 20);
    [[0.62, -0.05], [0.66, -0.25], [-0.2, -0.68], [0.05, -0.72]].forEach(([x, z]) => { const c = mesh(capGeo, M.alu); c.position.set(x, 0.1, z); pcb.add(c); });
    const pad = new THREE.BoxGeometry(0.035, 0.01, 0.06);
    for (let i = 0; i < 10; i++) { const p = mesh(pad, M.gold); p.position.set(-0.02 + i * 0.045, 0.022, -0.06); pcb.add(p); }
    for (let i = 0; i < 8; i++) { const p = mesh(pad, M.gold); p.position.set(0.42, 0.022, -0.5 + i * 0.045); p.rotation.y = Math.PI / 2; pcb.add(p); }
    add(pcb, -1.92, 1);

    // L2 光學編碼盤（透明盤 + 一圈細槽）+ 讀取頭
    const enc = new THREE.Group();
    enc.add(mesh(disc(0.86, 0.014, 0.13, null, 96), M.glass));
    const slots = new THREE.InstancedMesh(new THREE.BoxGeometry(0.012, 0.018, 0.09), M.slot, 96);
    const dummy = new THREE.Object3D();
    circle(96, 0.74).forEach(([x, z, a], i) => { dummy.position.set(x, 0, z); dummy.rotation.set(0, -a, 0); dummy.updateMatrix(); slots.setMatrixAt(i, dummy.matrix); });
    enc.add(slots);
    const hubE = mesh(ring(0.13, 0.26, 0.06, 48), M.alu); enc.add(hubE);
    add(enc, -1.72, 2);
    const head = new THREE.Group();
    const hb = mesh(new THREE.BoxGeometry(0.24, 0.16, 0.2), M.blackOxide); head.add(hb);
    const led = mesh(new THREE.BoxGeometry(0.06, 0.02, 0.04), M.glow); led.position.set(0, -0.09, 0); head.add(led);
    add(head, -1.62, 2, { x: 0, z: 0.78, radial: 0.45 });

    // L3 後軸承（內外環 + 滾珠）
    add(mesh(chamferRing(0.16, 0.42, 0.14, 0.015), M.steel), -1.48, 3);
    const ballGeo = new THREE.SphereGeometry(0.045, 16, 12);
    circle(10, 0.29).forEach(([x, z]) => add(mesh(ballGeo, M.chrome), -1.48, 3, { x, z, radial: 0.3 }));

    // L4 磁鐵轉子（鋼芯 + 12 片交錯磁鐵）
    const rotor = new THREE.Group();
    rotor.add(mesh(chamferRing(0.13, 0.5, 1.0, 0.02), M.steel));
    const magGeo = new THREE.BoxGeometry(0.22, 0.92, 0.07);
    circle(12, 0.535).forEach(([x, z, a], i) => { const m = mesh(magGeo, i % 2 ? M.magnetA : M.magnetB); m.position.set(x, 0, z); m.rotation.y = -a + Math.PI / 2; rotor.add(m); });
    add(rotor, -0.85, 4);

    // L5 定子（矽鋼片疊層 + 12 組銅線圈）
    const stator = new THREE.Group();
    const lam = [];
    for (let i = 0; i < 9; i++) lam.push([[0.95, -0.45 + i * 0.1], [1.06, -0.45 + i * 0.1], [1.06, -0.45 + i * 0.1 + 0.085], [0.95, -0.45 + i * 0.1 + 0.085]]);
    lam.forEach((pts) => stator.add(mesh(lathe([...pts, pts[0]], 96), M.alu)));
    const toothGeo = new THREE.BoxGeometry(0.34, 0.9, 0.1);
    const coilGeo = new THREE.TorusGeometry(0.11, 0.045, 10, 24);
    circle(12, 0.78).forEach(([x, z, a]) => {
      const t = mesh(toothGeo, M.alu); t.position.set(x, 0, z); t.rotation.y = -a; stator.add(t);
      for (const yy of [-0.32, -0.11, 0.11, 0.32]) {
        const c = mesh(coilGeo, M.copper); c.position.set(x, yy, z); c.rotation.set(Math.PI / 2, 0, a); c.scale.set(1.6, 1, 0.8); stator.add(c);
      }
    });
    add(stator, -0.85, 5);

    // L6 馬達外殼（散熱鰭片 + 發光細環）
    const housing = new THREE.Group();
    housing.add(mesh(chamferRing(1.1, 1.24, 1.32, 0.02), M.housing));
    for (let i = 0; i < 7; i++) { const f = mesh(ring(1.24, 1.34, 0.05, 96), M.housing); f.position.y = -0.5 + i * 0.16; housing.add(f); }
    const glowRing = mesh(new THREE.TorusGeometry(1.245, 0.01, 8, 160), M.glow); glowRing.rotation.x = Math.PI / 2; glowRing.position.y = 0.6; housing.add(glowRing);
    add(housing, -0.85, 6);

    // L7–L8 第一段行星齒輪（內齒環 48、太陽 12、行星 18×3）
    const S1 = { ring: 48, sun: 12, planet: 18, r: 0.52 };
    add(mesh(ringGear(S1.ring, 1.2, 1.0, 0.92, 0.22), M.housing), 0.02, 7);
    const sun1 = mesh(gear(S1.sun, 0.36, 0.3, 0.12, 0.24), M.iceDeep);
    add(sun1, 0.02, 8);
    const planets1 = circle(3, S1.r).map(([x, z, a]) => {
      const m = mesh(gear(S1.planet, 0.47, 0.41, 0.06, 0.22, circle(4, 0.24, 0.4).map(([hx, hy]) => [hx, hy, 0.05])), M.ice);
      return { m, a0: a, p: add(m, 0.02, 8, { x, z, radial: 0.55 }), r: S1.r };
    });
    const carrier1 = mesh(gear(3, 0.95, 0.55, 0.14, 0.06), M.alu);
    const carrier1P = add(carrier1, 0.2, 8);

    // L9–L10 第二段行星齒輪（內齒環 54、太陽 14、行星 20×4）
    const S2 = { ring: 54, sun: 14, planet: 20, r: 0.6 };
    add(mesh(ringGear(S2.ring, 1.22, 1.07, 1.0, 0.24), M.housing), 0.42, 9);
    const sun2 = mesh(gear(S2.sun, 0.42, 0.36, 0.12, 0.26), M.iceDeep);
    add(sun2, 0.42, 10);
    const planets2 = circle(4, S2.r).map(([x, z, a]) => {
      const m = mesh(gear(S2.planet, 0.46, 0.4, 0.06, 0.24), M.ice);
      return { m, a0: a, p: add(m, 0.42, 10, { x, z, radial: 0.5 }), r: S2.r };
    });
    const carrier2 = new THREE.Group();
    carrier2.add(mesh(disc(0.98, 0.07, 0.14, circle(4, 0.6, 0.785).map(([x, y]) => [x, y, 0.12])), M.alu));
    const pinG = new THREE.CylinderGeometry(0.05, 0.05, 0.32, 16);
    circle(4, S2.r).forEach(([x, z]) => { const p = mesh(pinG, M.chrome); p.position.set(x, -0.16, z); carrier2.add(p); });
    const carrier2P = add(carrier2, 0.6, 10);

    // L11 交叉滾子軸承（外環、內環、28 顆交錯 45° 的滾子）
    add(mesh(chamferRing(0.98, 1.2, 0.26, 0.02), M.steel), 0.88, 11);
    add(mesh(chamferRing(0.56, 0.8, 0.26, 0.02), M.steel), 0.88, 11);
    const rollerGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.11, 18);
    circle(28, 0.89).forEach(([x, z, a], i) => {
      const r = mesh(rollerGeo, M.chrome);
      r.rotation.set(0, -a, (i % 2 ? 1 : -1) * Math.PI / 4);
      add(r, 0.88, 11, { x, z, radial: 0.35 });
    });

    // L12 前蓋（12 顆螺絲孔位）
    const front = new THREE.Group();
    front.add(mesh(chamferRing(0.82, 1.26, 0.3, 0.03), M.housing));
    add(front, 1.14, 12);

    // L13 輸出法蘭（8 個安裝孔 + 定位銷）
    const flange = new THREE.Group();
    flange.add(mesh(disc(0.88, 0.18, 0.16, circle(8, 0.66, 0.2).map(([x, y]) => [x, y, 0.055])), M.alu));
    const dowel = new THREE.CylinderGeometry(0.03, 0.03, 0.1, 12);
    [[0.42, 0], [-0.42, 0]].forEach(([x, z]) => { const d = mesh(dowel, M.chrome); d.position.set(x, 0.12, z); flange.add(d); });
    const lip = mesh(chamferRing(0.16, 0.34, 0.06, 0.01), M.steel); lip.position.y = 0.12; flange.add(lip);
    add(flange, 1.38, 13);

    // L14 前蓋上的 12 顆內六角螺絲（拆開時往前、往外散）
    circle(12, 1.08, 0.13).forEach(([x, z]) => add(capScrew(0.5), 1.3, 14, { x, z, radial: 0.55 }));

    // 主軸：拆開時移到旁邊（不擋中間的零件）
    const shaft = new THREE.Group();
    shaft.add(mesh(new THREE.CylinderGeometry(0.12, 0.12, 3.6, 40), M.chrome));
    const keyway = mesh(new THREE.BoxGeometry(0.06, 0.45, 0.2), M.steel); keyway.position.set(0, 1.4, 0.06); shaft.add(keyway);
    const clip = mesh(new THREE.TorusGeometry(0.125, 0.012, 8, 40, TAU * 0.85), M.blackOxide); clip.rotation.x = Math.PI / 2; clip.position.y = 1.0; shaft.add(clip);
    add(shaft, -0.2, 7, { side: new V3(0, 0, 2.1) });

    /* ---------- 尺寸 ---------- */
    let W = 1, H = 1;
    function resize() {
      W = window.innerWidth; H = window.innerHeight;
      renderer.setSize(W, H, false);
      camera.aspect = W / H;
      camera.fov = W / H < 0.8 ? 38 : 28; // 直式螢幕視角放寬一點
      camera.updateProjectionMatrix();
    }
    resize();
    window.addEventListener('resize', resize);

    /* ---------- 滑鼠：輕微視差 + 拖曳轉動（速度交接、橡皮筋、彈簧回彈） ---------- */
    let mx = 0, my = 0;
    // user.yaw / user.pitch：使用者拖出來的角度（疊加在章節決定的姿態上）；vel 是它們的速度（弧度 / 秒）
    const user = { yaw: 0, pitch: 0, yawVel: 0, pitchVel: 0, dragging: false };
    const YAW_LIMIT = 1.2, PITCH_LIMIT = 0.7;
    const RAD_PER_PX = 0.0075;
    let rawYaw = 0, rawPitch = 0;   // 沒套橡皮筋的原始拖曳量
    let samples = [];               // 最近幾次 pointermove（時間、位置），放開時用來算速度
    let overMachine = false;
    let bounds = null;              // 機械在螢幕上的範圍（pointermove 時節流更新）
    let boundsAt = 0;
    const SKIP = 'a, button, input, textarea, select, label, summary, [role="button"], .menu, .cform';

    // 橡皮筋：越過邊界越拉不動（Apple 的公式），整個物件像有彈性
    const rubber = (x, limit) => {
      const over = Math.abs(x) - limit;
      if (over <= 0) return x;
      const c = 0.55;
      return Math.sign(x) * (limit + (over * limit * c) / (limit + c * over));
    };
    const inverseRubber = (y, limit) => { // 反推：目前顯示的角度對應的原始拖曳量（抓住回彈中的物件時要接續）
      const over = Math.abs(y) - limit;
      if (over <= 0) return y;
      const c = 0.55;
      const d = (over * limit) / (limit * c - c * over) ; // 解 over' = d：y-limit = (d*limit*c)/(limit+c*d)
      return Math.sign(y) * (limit + (isFinite(d) && d > 0 ? d : over));
    };
    // 機械目前在螢幕上的範圍：把 3D 範圍框的 8 個角投影到螢幕
    const box = new THREE.Box3();
    const corner = new V3();
    function updateBounds() {
      boundsAt = performance.now();
      if (cur.opacity < 0.5) { bounds = null; return; }
      stage.updateMatrixWorld(true);
      box.setFromObject(stage);
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (let i = 0; i < 8; i++) {
        corner.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).project(camera);
        const px = (corner.x * 0.5 + 0.5) * W, py = (-corner.y * 0.5 + 0.5) * H;
        x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py);
      }
      bounds = { x0: x0 - 8, y0: y0 - 8, x1: x1 + 8, y1: y1 + 8 };
    }
    const hit = (x, y) => !!bounds && x >= bounds.x0 && x <= bounds.x1 && y >= bounds.y0 && y <= bounds.y1;
    const htmlEl = document.documentElement;

    window.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch' || !Number.isFinite(e.clientX)) return;
      mx = e.clientX / W - 0.5; my = e.clientY / H - 0.5;
      if (user.dragging) {
        // 1:1 跟著游標：用「這次移動的距離」累加到原始拖曳量，再套橡皮筋
        const last = samples[samples.length - 1];
        rawYaw += (e.clientX - last.x) * RAD_PER_PX;
        rawPitch += (e.clientY - last.y) * RAD_PER_PX;
        user.yaw = rubber(rawYaw, YAW_LIMIT);
        user.pitch = rubber(rawPitch, PITCH_LIMIT);
        samples.push({ t: e.timeStamp, x: e.clientX, y: e.clientY });
        if (samples.length > 6) samples.shift();
        return;
      }
      if (performance.now() - boundsAt > 80) updateBounds();
      const over = hit(e.clientX, e.clientY) && !(e.target.closest && e.target.closest(SKIP));
      if (over !== overMachine) { overMachine = over; htmlEl.classList.toggle('over-machine', over); }
    }, { passive: true });

    window.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch' || e.button !== 0) return;
      if (e.target.closest && e.target.closest(SKIP)) return;
      updateBounds();
      if (!hit(e.clientX, e.clientY)) return;
      user.dragging = true;
      // 抓住的瞬間：速度歸零（接手），原始拖曳量接續目前顯示的角度，不會跳
      user.yawVel = 0; user.pitchVel = 0;
      rawYaw = inverseRubber(user.yaw, YAW_LIMIT);
      rawPitch = inverseRubber(user.pitch, PITCH_LIMIT);
      samples = [{ t: e.timeStamp, x: e.clientX, y: e.clientY }];
      htmlEl.classList.add('is-grabbing');
      try { e.target.setPointerCapture(e.pointerId); } catch (err) { /* 沒有也沒關係 */ }
      e.preventDefault(); // 不要選到文字
    });

    const release = (e) => {
      if (!user.dragging) return;
      user.dragging = false;
      htmlEl.classList.remove('is-grabbing');
      // 放開時的速度：取最近約 100ms 內的移動
      const end = samples[samples.length - 1];
      let from = samples[0];
      for (const sm of samples) { if (end.t - sm.t <= 100) { from = sm; break; } }
      const dtv = Math.max((end.t - from.t) / 1000, 0.016);
      // 超過一小段時間沒動就放開 = 不是甩出去，速度歸零
      const idle = ((e.timeStamp || end.t) - end.t) > 80;
      user.yawVel = idle ? 0 : ((end.x - from.x) / dtv) * RAD_PER_PX;
      user.pitchVel = idle ? 0 : ((end.y - from.y) / dtv) * RAD_PER_PX;
      // 速度上限：避免一甩就轉好幾圈
      user.yawVel = Math.max(-12, Math.min(12, user.yawVel));
      user.pitchVel = Math.max(-8, Math.min(8, user.pitchVel));
    };
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);

    // 彈簧：回到 0，帶著放手時的速度（速度交接）。阻尼 0.8 → 有一點彈，因為這是「甩出去」的動量；回應 0.7 秒。
    const SPRING_W = (2 * Math.PI) / 0.7, SPRING_Z = 0.8;
    function stepSpring(x, v, dt) {
      // 半隱式歐拉，切成小步避免不穩定
      const n = Math.max(1, Math.ceil(dt / 0.008)), h = dt / n;
      for (let i = 0; i < n; i++) {
        v += (-SPRING_W * SPRING_W * x - 2 * SPRING_Z * SPRING_W * v) * h;
        x += v * h;
      }
      return [x, v];
    }

    /* ---------- 每一幀 ---------- */
    const cur = Object.assign({}, target, { opacity: 0 });
    const clamp01 = (v) => Math.min(1, Math.max(0, v));
    const lerp = (a, b, t) => a + (b - a) * t;
    const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    // 拆開後每一層沿軸排列的位置：依各層零件的實際厚度累加，長零件（外殼、定子、轉子）才不會疊在一起
    const THICK = [0.32, 0.2, 0.16, 0.16, 1.0, 0.95, 1.36, 0.24, 0.28, 0.26, 0.4, 0.28, 0.32, 0.3, 0.55];
    const GAP = 0.3;
    const explodedY = [];
    let acc = 0;
    for (let i = 0; i < layerCount; i++) { const t = THICK[i] || 0.3; explodedY.push(acc + t / 2); acc += t + GAP; }
    const total = acc - GAP;
    for (let i = 0; i < layerCount; i++) explodedY[i] -= total / 2;
    const half = (layerCount - 1) / 2;
    let prev = performance.now();
    let spinA = 0, gearA = 0;
    let running = false;

    function frame() {
      running = false;
      const now = performance.now();
      const dt = Math.min((now - prev) / 1000, 0.05);
      prev = now;

      const k = 1 - Math.pow(0.003, dt);
      for (const name in target) {
        const v = target[name];
        if (Number.isFinite(v)) cur[name] = Number.isFinite(cur[name]) ? lerp(cur[name], v, name === 'opacity' ? 1 - Math.pow(0.0008, dt) : k) : v;
      }
      canvas.style.opacity = clamp01(cur.opacity).toFixed(3);

      if (cur.opacity > 0.01 && !document.hidden) {
        stage.position.set(cur.x + mx * 0.25, cur.y - my * 0.15, 0);
        stage.scale.setScalar(cur.scale);
        if (!user.dragging && (user.yaw || user.pitch || user.yawVel || user.pitchVel)) {
          [user.yaw, user.yawVel] = stepSpring(user.yaw, user.yawVel, dt);
          [user.pitch, user.pitchVel] = stepSpring(user.pitch, user.pitchVel, dt);
          if (Math.abs(user.yaw) < 1e-4 && Math.abs(user.yawVel) < 1e-3) { user.yaw = 0; user.yawVel = 0; }
          if (Math.abs(user.pitch) < 1e-4 && Math.abs(user.pitchVel) < 1e-3) { user.pitch = 0; user.pitchVel = 0; }
        }
        pose.rotation.set(cur.rotX + my * 0.08 + user.pitch, cur.rotY + mx * 0.12 + user.yaw, cur.rotZ);

        spinA += dt * cur.spin;
        model.rotation.y = spinA;

        // 齒輪照齒數比運轉（內齒環固定）
        gearA += dt * 0.6;
        const c1 = gearA * S1.sun / (S1.sun + S1.ring);
        sun1.rotation.y = -gearA; carrier1.rotation.y = -c1;
        planets1.forEach((g) => { const a = g.a0 + c1; g.p.base.set(Math.cos(a) * g.r, g.p.base.y, Math.sin(a) * g.r); g.p.dir.set(Math.cos(a), 0, Math.sin(a)); g.m.rotation.y = (gearA - c1) * S1.sun / S1.planet; });
        const g2 = c1; // 第一段行星架帶動第二段太陽輪
        const c2 = g2 * S2.sun / (S2.sun + S2.ring);
        sun2.rotation.y = -g2; carrier2.rotation.y = -c2;
        planets2.forEach((g) => { const a = g.a0 + c2; g.p.base.set(Math.cos(a) * g.r, g.p.base.y, Math.sin(a) * g.r); g.p.dir.set(Math.cos(a), 0, Math.sin(a)); g.m.rotation.y = (g2 - c2) * S2.sun / S2.planet; });
        rotor.rotation.y = -gearA * 1.5;
        enc.rotation.y = -gearA * 1.5;

        // 拆開：從兩端往中間依序展開；拆開後各層沿軸等距排列
        const e = clamp01(cur.explode);
        for (let i = 0; i < parts.length; i++) {
          const p = parts[i];
          const fromCenter = Math.abs(p.layer - half) / half;          // 0 = 中間, 1 = 兩端
          const local = ease(clamp01(e * 1.6 - (1 - fromCenter) * 0.6));
          const ey = explodedY[p.layer];
          const y = lerp(p.base.y, ey, local);
          let x = p.base.x + p.dir.x * p.radial * local;
          let z = p.base.z + p.dir.z * p.radial * local;
          if (p.side) { x += p.side.x * local; z += p.side.z * local; }
          p.holder.position.set(x, y, z);
        }
        renderer.render(scene, camera);
      }
      schedule();
    }
    function schedule() { if (!running) { running = true; requestAnimationFrame(frame); } }
    document.addEventListener('visibilitychange', () => { if (!document.hidden) { prev = performance.now(); schedule(); } });

    window.EE_MACHINE.ready = true;
    window.dispatchEvent(new Event('machine:ready'));
    status('running');
    schedule();
  }
})();
