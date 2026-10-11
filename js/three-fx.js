/* =============================================================
   EE Tech Studio — 3D 背景（Three.js）
   一顆會「流動變形」的球（自己寫的 shader：3D 雜訊讓表面起伏，邊緣光 + 萊姆綠→鈷藍漸層），
   外圍一圈慢慢轉的粒子。
   - 首頁：在右側；滑鼠移動它會跟著轉，捲動越快表面起伏越大
   - 往下捲：慢慢淡出（中間區塊不畫，省電）
   - 捲到聯絡區：移到大標後面再出現
   保險：使用者關閉動效、省流量模式、不支援 WebGL、CDN 載不到 → 什麼都不做，網站照常。
   Three.js 很大，所以等頁面載入完、瀏覽器空閒時才去抓，不影響開場速度。
   ============================================================= */
(function () {
  'use strict';

  // 診斷：網址加 ?3d=debug，右下角會顯示 3D 目前的狀態（看不到球時用來查原因）
  const DEBUG = /[?&]3d=debug(?:&|$)/.test(location.search);
  function report(msg) {
    document.documentElement.dataset.three = msg;
    if (!DEBUG) return;
    const show = () => {
      let b = document.getElementById('three-debug');
      if (!b) {
        b = document.createElement('div');
        b.id = 'three-debug';
        b.style.cssText = 'position:fixed;right:12px;bottom:12px;z-index:9999;padding:8px 12px;border-radius:10px;background:#c5f04a;color:#0a0b0e;font:13px/1.4 system-ui,sans-serif;max-width:80vw';
        document.body.appendChild(b);
      }
      b.textContent = '3D：' + msg;
    };
    if (document.body) show(); else document.addEventListener('DOMContentLoaded', show);
  }

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { report('系統設定「減少動態效果」開著，所以不顯示'); return; }
  if (navigator.connection && navigator.connection.saveData) { report('省流量模式開著，所以不顯示'); return; }
  const probe = document.createElement('canvas');
  if (!(probe.getContext('webgl2') || probe.getContext('webgl'))) { report('這個瀏覽器不能用 WebGL（可能被瀏覽器防護或顯示卡設定擋掉）'); return; }

  const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.186.1/build/three.module.min.js';

  report('等頁面載完再載入 3D…');
  const start = () => {
    report('正在載入 Three.js…');
    import(THREE_URL).then(init).catch((e) => report('Three.js 載不到：' + (e && e.message || e)));
  };
  const whenIdle = () => ('requestIdleCallback' in window ? requestIdleCallback(start, { timeout: 2500 }) : setTimeout(start, 600));
  if (document.readyState === 'complete') whenIdle();
  else window.addEventListener('load', whenIdle, { once: true });

  // Ashima 3D simplex noise（MIT）
  const NOISE = `
    vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
    vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
    vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
    vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
    float snoise(vec3 v){
      const vec2 C=vec2(1.0/6.0,1.0/3.0); const vec4 D=vec4(0.0,0.5,1.0,2.0);
      vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);
      vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.0-g; vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);
      vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy;
      i=mod289(i);
      vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
      float n_=0.142857142857; vec3 ns=n_*D.wyz-D.xzx;
      vec4 j=p-49.0*floor(p*ns.z*ns.z); vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.0*x_);
      vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.0-abs(x)-abs(y);
      vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);
      vec4 s0=floor(b0)*2.0+1.0; vec4 s1=floor(b1)*2.0+1.0; vec4 sh=-step(h,vec4(0.0));
      vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
      vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
      vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
      p0*=norm.x; p1*=norm.y; p2*=norm.z; p3*=norm.w;
      vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0); m=m*m;
      return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
    }`;

  function init(THREE) {
    const isSmall = () => window.innerWidth < 820;
    const canvas = document.createElement('canvas');
    canvas.className = 'three-bg';
    canvas.setAttribute('aria-hidden', 'true');
    document.body.prepend(canvas);

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    } catch (e) { canvas.remove(); report('建立 WebGL 失敗：' + (e && e.message || e)); return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
    camera.position.set(0, 0, 9);

    const group = new THREE.Group();
    scene.add(group);

    /* ---------- 流動球 ---------- */
    const uniforms = {
      uTime: { value: 0 },
      uAmp: { value: 0.2 },
      uFreq: { value: 0.9 },
      uA: { value: new THREE.Color('#c5f04a') }, // 萊姆綠
      uB: { value: new THREE.Color('#4d7cff') }, // 鈷藍
      uC: { value: new THREE.Color('#7fd8ff') }, // 冰藍（邊緣光）
    };
    const blob = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1.5, isSmall() ? 48 : 72),
      new THREE.ShaderMaterial({
        uniforms,
        vertexShader: NOISE + `
          uniform float uTime, uAmp, uFreq;
          varying vec3 vPos; varying vec3 vNormal; varying float vNoise;
          float field(vec3 d){
            float n = snoise(d * uFreq + vec3(uTime * 0.18, uTime * 0.12, 0.0));
            return n + 0.35 * snoise(d * uFreq * 2.3 - uTime * 0.1);
          }
          vec3 displaced(vec3 d){ return d * (1.5 + field(d) * uAmp); }
          void main(){
            vec3 d = normalize(position);
            vec3 t = normalize(abs(d.y) > 0.99 ? cross(d, vec3(1.0, 0.0, 0.0)) : cross(d, vec3(0.0, 1.0, 0.0)));
            vec3 b = cross(d, t);
            const float e = 0.01;
            vec3 p  = displaced(d);
            vec3 pt = displaced(normalize(d + t * e));
            vec3 pb = displaced(normalize(d + b * e));
            vNormal = normalize(normalMatrix * normalize(cross(pt - p, pb - p)));  // 平滑法線，高光不會有鋸齒
            vNoise = field(d);
            vec4 mv = modelViewMatrix * vec4(p, 1.0);
            vPos = mv.xyz;
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: `
          uniform vec3 uA, uB, uC; uniform float uTime;
          varying vec3 vPos; varying vec3 vNormal; varying float vNoise;
          void main(){
            vec3 n = normalize(vNormal);
            if (dot(n, normalize(-vPos)) < 0.0) n = -n;
            vec3 v = normalize(-vPos);
            vec3 L = normalize(vec3(-0.5, 0.8, 0.6));
            float fres = pow(1.0 - max(dot(n, v), 0.0), 2.6);
            float diff = max(dot(n, L), 0.0);
            float spec = pow(max(dot(reflect(-L, n), v), 0.0), 48.0);
            float t = smoothstep(-0.7, 0.9, vNoise);
            vec3 tint = mix(uB, uA, t);                          // 表面顏色跟著起伏在藍綠之間流動
            float band = 0.5 + 0.5 * sin(vNoise * 7.0 + uTime * 0.7);  // 流動的彩色紋路
            vec3 core = vec3(0.03, 0.035, 0.05);
            vec3 body = mix(core, tint * 0.6, 0.12 + 0.38 * diff * band);
            vec3 col = body + mix(tint, uC, 0.5) * fres * 1.25 + vec3(spec * 0.55);
            gl_FragColor = vec4(col, 1.0);
          }`,
      }),
    );
    group.add(blob);

    /* ---------- 粒子環 ---------- */
    const COUNT = isSmall() ? 700 : 1600;
    const pos = new Float32Array(COUNT * 3);
    for (let i = 0; i < COUNT; i++) {
      const r = 2.3 + Math.random() * 1.4;
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
      pos[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th) * 0.55; // 壓扁成一圈
      pos[i * 3 + 2] = r * Math.cos(ph);
    }
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const dots = new THREE.Points(pGeo, new THREE.PointsMaterial({
      color: 0xc5f04a, size: 0.022, sizeAttenuation: true, transparent: true, opacity: 0.55, depthWrite: false,
    }));
    dots.rotation.z = 0.35;
    group.add(dots);

    /* ---------- 尺寸 ---------- */
    function resize() {
      const w = window.innerWidth;
      const h = window.innerHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    resize();
    window.addEventListener('resize', resize);

    /* ---------- 互動：滑鼠、捲動速度 ---------- */
    let mx = 0, my = 0;
    window.addEventListener('pointermove', (e) => {
      mx = e.clientX / window.innerWidth - 0.5;
      my = e.clientY / window.innerHeight - 0.5;
    }, { passive: true });
    let lastY = window.scrollY;
    let velocity = 0;

    const hero = document.querySelector('.hero');
    const contact = document.querySelector('.contact');
    const clamp01 = (v) => Math.min(1, Math.max(0, v));
    const lerp = (a, b, t) => a + (b - a) * t;

    // 目前狀態（每一幀往目標靠近，移動都是滑順的）
    const cur = { x: 2.2, y: 0, s: 1, op: 0 };
    const t0 = performance.now();
    let prev = t0;
    let running = false;

    function frame() {
      running = false;
      const now = performance.now();
      const dt = Math.min((now - prev) / 1000, 0.05);
      prev = now;
      const vh = window.innerHeight;

      // 捲動速度 → 表面起伏
      const y = window.scrollY;
      velocity = lerp(velocity, Math.abs(y - lastY), 0.12);
      lastY = y;

      // 首頁 / 聯絡區各自的可見程度
      const hr = hero.getBoundingClientRect();
      const heroVis = clamp01(1 + hr.top / (hr.height * 0.85));
      const cr = contact ? contact.getBoundingClientRect() : { top: 1e9, bottom: 1e9 };
      const contactVis = clamp01((vh - cr.top) / (vh * 0.7)) * clamp01(cr.bottom / (vh * 0.6));
      const inContact = contactVis > heroVis;

      const small = isSmall();
      const target = inContact
        ? { x: 0, y: small ? 1.2 : 1.05, s: small ? 0.75 : 0.95, op: contactVis * 0.4 }
        : { x: small ? 0.55 : 2.25, y: small ? 1.9 : 0.05, s: small ? 0.55 : 1, op: heroVis * (small ? 0.7 : 1) };

      const k = 1 - Math.pow(0.0015, dt); // 跟幀率無關的平滑
      cur.x = lerp(cur.x, target.x, k);
      cur.y = lerp(cur.y, target.y, k);
      cur.s = lerp(cur.s, target.s, k);
      cur.op = lerp(cur.op, target.op, 1 - Math.pow(0.0004, dt));
      canvas.style.opacity = cur.op.toFixed(3);

      if (cur.op > 0.01 && !document.hidden) {
        const t = (now - t0) / 1000;
        uniforms.uTime.value = t;
        uniforms.uAmp.value = lerp(uniforms.uAmp.value, 0.2 + Math.min(velocity * 0.012, 0.3), 0.08);
        group.position.set(cur.x, cur.y, 0);
        group.scale.setScalar(cur.s);
        blob.rotation.y = lerp(blob.rotation.y, t * 0.12 + mx * 1.1, 0.06);
        blob.rotation.x = lerp(blob.rotation.x, my * 0.8, 0.06);
        dots.rotation.y = t * 0.05 + mx * 0.4;
        dots.rotation.x = my * 0.25;
        renderer.render(scene, camera);
      }
      schedule();
    }
    function schedule() {
      if (running) return;
      running = true;
      requestAnimationFrame(frame);
    }
    document.addEventListener('visibilitychange', () => { if (!document.hidden) { prev = performance.now(); schedule(); } });
    canvas.classList.add('is-ready');
    report('正常運作中（' + (renderer.capabilities.isWebGL2 ? 'WebGL2' : 'WebGL1') + '）');
    schedule();
  }
})();
