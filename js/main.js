/* =============================================================
   EE Tech Studio — 全螢幕敘事
   - 開場倒數 → 主標逐行浮上
   - Lenis 平滑捲動 + GSAP ScrollTrigger
   - 服務：黏住畫面，捲動切換 4 個服務，3D 機械跟著拆開
   - 作品：黏住畫面，橫向滑過；流程：進度線 + 逐步點亮
   - 3D 機械（machine.js）的位置 / 角度 / 拆解程度依目前章節決定
   - 所有進場動畫離開畫面會重設，捲回來會重播
   GSAP 沒載到、或使用者關閉動效：不加 .fx-on，網站就是一般的長頁面，內容全部看得到。
   ============================================================= */
(function () {
  'use strict';

  const root = document.documentElement;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hasGSAP = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';
  const FX = hasGSAP && !reduced;
  if (FX) root.classList.add('fx-on');

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const clamp01 = (v) => Math.min(1, Math.max(0, v));
  const smooth = (a, b, v) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };
  const isSmall = () => window.innerWidth <= 820;

  const year = $('#year');
  if (year) year.textContent = new Date().getFullYear();

  setupContactForm();
  setupMenu();

  /* ---------- 沒有動畫的情況：直接收掉開場、照一般頁面走 ---------- */
  if (!FX) {
    const intro = $('#intro');
    if (intro) intro.classList.add('is-done');
    if (window.EE_MACHINE) window.EE_MACHINE.set({ opacity: 0.9 });
    $$('a[data-scroll]').forEach((a) => a.addEventListener('click', () => closeMenu()));
    return;
  }

  const { gsap, ScrollTrigger } = window;
  gsap.registerPlugin(ScrollTrigger);
  const hasSplit = typeof window.SplitText !== 'undefined';
  if (hasSplit) gsap.registerPlugin(window.SplitText);

  /* ---------- 平滑捲動 ---------- */
  let lenis = null;
  if (typeof window.Lenis !== 'undefined') {
    lenis = new window.Lenis({ duration: 1.15, easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)) });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
  }
  function scrollToTarget(sel) {
    const el = $(sel);
    if (!el) return;
    if (lenis) lenis.scrollTo(el, { offset: 0, duration: 1.6 });
    else el.scrollIntoView({ behavior: 'smooth' });
  }
  window.eeScrollTo = scrollToTarget;
  $$('a[data-scroll]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href');
      const sel = id === '#top' ? 'main' : id;
      if (!id || id.charAt(0) !== '#' || !$(sel)) return;
      e.preventDefault();
      closeMenu();
      scrollToTarget(sel);
    });
  });

  /* ---------- 文字拆行（主標、各章大標） ---------- */
  const splits = new Map();
  if (hasSplit) {
    $$('[data-split]').forEach((el) => {
      splits.set(el, new window.SplitText(el, { type: 'lines', mask: 'lines', linesClass: 'split-line' }));
    });
  }
  const linesOf = (el) => (splits.get(el) ? splits.get(el).lines : [el]);

  /* ---------- 開場 ---------- */
  const intro = $('#intro');
  const heroTitleLines = linesOf($('.hero__title'));
  gsap.set(heroTitleLines, { yPercent: 110 });
  gsap.set('.hero [data-reveal], .hero__meta', { opacity: 0, y: 24 });
  const counter = { v: 0 };
  const minTime = new Promise((r) => setTimeout(r, 1300));
  const fontsReady = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
  gsap.to(counter, {
    v: 100, duration: 1.3, ease: 'power2.inOut',
    onUpdate: () => {
      $('#introCount').textContent = String(Math.round(counter.v)).padStart(3, '0');
      $('#introBar').style.transform = `scaleX(${counter.v / 100})`;
    },
  });
  Promise.race([Promise.all([minTime, fontsReady]), new Promise((r) => setTimeout(r, 3500))]).then(() => {
    ScrollTrigger.refresh();
    const tl = gsap.timeline();
    tl.to(intro, { yPercent: -100, duration: 1, ease: 'expo.inOut' })
      .set(intro, { display: 'none' })
      .to(heroTitleLines, { yPercent: 0, duration: 1.2, ease: 'expo.out', stagger: 0.1 }, '-=0.45')
      .to('.hero [data-reveal], .hero__meta', { opacity: 1, y: 0, duration: 1, ease: 'expo.out', stagger: 0.08 }, '-=0.9');
  });

  /* ---------- 各章大標 + 一般元素：進畫面浮上，離開後重設（捲回來重播） ----------
     在「黏住畫面」的長段落裡的元素，位置一直固定在畫面上，所以進出場要看整個章節，不能看元素自己。 */
  const STICKY = '.story__sticky, .work__sticky, .process__sticky';
  const triggerFor = (el) => (el.closest(STICKY) ? { trigger: el.closest('.chapter'), start: 'top 70%', end: 'bottom 30%' } : null);
  $$('[data-split]').forEach((el) => {
    if (el.closest('.hero')) return;
    const lines = linesOf(el);
    gsap.set(lines, { yPercent: 110 });
    const show = () => gsap.to(lines, { yPercent: 0, duration: 1.1, ease: 'expo.out', stagger: 0.08, overwrite: true });
    const hide = () => gsap.set(lines, { yPercent: 110, overwrite: true });
    ScrollTrigger.create(Object.assign({ trigger: el, start: 'top 85%', end: 'bottom 10%' }, triggerFor(el), { onEnter: show, onEnterBack: show, onLeave: hide, onLeaveBack: hide }));
  });
  $$('[data-reveal]').forEach((el) => {
    if (el.closest('.hero')) return;
    const show = () => gsap.to(el, { opacity: 1, y: 0, duration: 1, ease: 'expo.out', overwrite: true });
    const hide = () => gsap.set(el, { opacity: 0, y: 24, overwrite: true });
    ScrollTrigger.create(Object.assign({ trigger: el, start: 'top 88%', end: 'bottom 5%' }, triggerFor(el), { onEnter: show, onEnterBack: show, onLeave: hide, onLeaveBack: hide }));
  });

  /* ---------- 服務：捲動切換 4 個步驟 ---------- */
  const story = $('#services');
  const steps = $$('.step', story);
  const stepBars = $$('.story__progress i', story);
  let activeStep = 0;
  const stepBase = () => (isSmall() ? { yPercent: 0 } : { yPercent: -50 }); // 桌機垂直置中（CSS 的 translateY(-50%) 交給 GSAP 管）
  gsap.set(steps, Object.assign({ y: 0 }, stepBase()));
  steps.forEach((s, i) => { if (i) gsap.set(s, { autoAlpha: 0 }); });
  function showStep(i) {
    if (i === activeStep) return;
    const out = steps[activeStep], inn = steps[i];
    const dir = i > activeStep ? 1 : -1;
    activeStep = i;
    steps.forEach((s, j) => s.classList.toggle('is-active', j === i));
    $('#stepNo').textContent = String(i + 1).padStart(2, '0');
    gsap.to(out, { autoAlpha: 0, y: -40 * dir, duration: 0.5, ease: 'power3.in', overwrite: true });
    gsap.fromTo(inn, { autoAlpha: 0, y: 60 * dir }, { autoAlpha: 1, y: 0, duration: 0.9, ease: 'expo.out', delay: 0.25, overwrite: true });
    gsap.fromTo($$('.step__list li', inn), { opacity: 0, x: -14 }, { opacity: 1, x: 0, duration: 0.7, ease: 'expo.out', stagger: 0.07, delay: 0.45 });
  }

  /* ---------- 作品 / 流程 ---------- */
  const work = $('#work');
  const track = $('#workTrack');
  const panels = $$('.wpanel', track);
  const process = $('#process');
  const processItems = $$('.process__steps li', process);

  /* ---------- 章節狀態（導覽、右側進度、3D 位置） ---------- */
  const chapters = $$('.chapter');
  const chapNo = $('#chapNo'), chapName = $('#chapName'), railFill = $('#railFill');
  let lastChapter = null;
  const HALF_PI = Math.PI / 2;

  // 黏住的長段落「捲了多少」：已捲距離 / 可捲距離
  function sectionProgress(el) {
    const r = el.getBoundingClientRect();
    return clamp01(-r.top / Math.max(1, r.height - window.innerHeight));
  }

  function update() {
    const vh = window.innerHeight;
    const small = isSmall();
    const docH = document.documentElement.scrollHeight - vh;
    railFill.style.transform = `scaleY(${clamp01(window.scrollY / Math.max(1, docH))})`;

    // 目前章節：畫面中線落在哪一章
    let current = chapters[0];
    for (const c of chapters) { const r = c.getBoundingClientRect(); if (r.top <= vh * 0.5 && r.bottom > vh * 0.5) { current = c; break; } }
    if (current !== lastChapter) {
      lastChapter = current;
      chapNo.textContent = current.dataset.chapter;
      chapName.textContent = current.dataset.name;
    }

    // 服務
    const sp = sectionProgress(story);
    showStep(Math.min(3, Math.floor(sp * 4.0001)));
    stepBars.forEach((b, i) => { b.style.transform = `scaleX(${clamp01(sp * 4 - i)})`; });

    // 作品（桌機才橫向）
    const wp = sectionProgress(work);
    if (!small) {
      const pad = parseFloat(getComputedStyle(track).paddingLeft) || 0; // 橫向捲動容器的右側留白不會算進 scrollWidth，自己補上
      const dist = Math.max(0, track.scrollWidth - window.innerWidth + pad);
      track.style.transform = `translate3d(${(-dist * smooth(0.04, 0.96, wp)).toFixed(1)}px,0,0)`;
    } else {
      track.style.transform = '';
    }
    $('#workNo').textContent = String(Math.min(panels.length, 1 + Math.floor(wp * panels.length * 0.999))).padStart(2, '0');

    // 流程
    if (!small) {
      const pp = sectionProgress(process);
      $('#processFill').style.transform = `scaleX(${smooth(0.05, 0.9, pp)})`;
      processItems.forEach((li, i) => li.classList.toggle('is-on', pp * processItems.length * 1.05 >= i + 0.3));
    }

    // 3D 機械姿態
    const m = window.EE_MACHINE;
    if (!m) return;
    const id = current.id;
    if (id === 'hero') {
      const heroR = $('#hero').getBoundingClientRect();
      const heroVis = clamp01(1 + heroR.top / (heroR.height * 0.9));
      m.set(small
        ? { x: 0, y: 2.1, scale: 0.5, rotX: 0.35, rotY: -0.5, rotZ: -1.05, explode: 0, opacity: 0.85 * heroVis + 0.15, spin: 0.18 }
        : { x: 3.05, y: 0.3, scale: 0.74, rotX: 0.3, rotY: -0.7, rotZ: -1.05, explode: 0, opacity: 1, spin: 0.15 });
    } else if (id === 'services') {
      const e = smooth(0.04, 0.82, sp);
      m.set(small
        ? { x: 0, y: 1.9, scale: 0.5 - e * 0.13, rotX: 0.3, rotY: -0.45, rotZ: -HALF_PI, explode: e, opacity: 1, spin: 0.06 }
        : { x: 2.45, y: 0.05, scale: 0.7 - e * 0.18, rotX: 0.28, rotY: -0.5 + sp * 0.5, rotZ: -HALF_PI + 0.2, explode: e, opacity: 1, spin: 0.05 });
    } else if (id === 'work' || id === 'process') {
      m.set({ opacity: 0, explode: 1 });
    } else if (id === 'team') {
      m.set(small
        ? { x: 0, y: 2.2, scale: 0.4, rotX: 0.4, rotY: 0.3, rotZ: -1.05, explode: 0.35, opacity: 0.18, spin: 0.12 }
        : { x: 3.6, y: 1.5, scale: 0.55, rotX: 0.4, rotY: 0.3, rotZ: -1.05, explode: 0.25, opacity: 0.14, spin: 0.12 });
    } else if (id === 'contact') {
      m.set(small
        ? { x: 0, y: 2.6, scale: 0.42, rotX: 0.35, rotY: -0.4, rotZ: -1.05, explode: 0, opacity: 0.35, spin: 0.2 }
        : { x: 0.2, y: 0.1, scale: 0.85, rotX: 0.32, rotY: 0.6, rotZ: -1.05, explode: 0, opacity: 0.16, spin: 0.2 });
    }
  }

  let scheduled = false;
  const requestUpdate = () => { if (!scheduled) { scheduled = true; requestAnimationFrame(() => { scheduled = false; update(); }); } };
  if (lenis) lenis.on('scroll', requestUpdate);
  window.addEventListener('scroll', requestUpdate, { passive: true });
  window.addEventListener('resize', () => {
    gsap.set(steps, stepBase());
    ScrollTrigger.refresh();
    requestUpdate();
  });
  window.addEventListener('machine:ready', requestUpdate);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { ScrollTrigger.refresh(); requestUpdate(); });
  update();

  /* ---------- 選單 ---------- */
  function setupMenu() {
    const btn = $('#menuBtn'), menu = $('#menu');
    if (!btn || !menu) return;
    btn.addEventListener('click', () => (menu.hidden ? openMenu() : closeMenu()));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); });
  }
  function openMenu() {
    const btn = $('#menuBtn'), menu = $('#menu');
    menu.hidden = false;
    root.classList.add('menu-open');
    btn.setAttribute('aria-expanded', 'true');
    btn.querySelector('.nav__menu-label').textContent = '關閉';
    if (window.gsap && !reduced) {
      window.gsap.fromTo(menu, { opacity: 0 }, { opacity: 1, duration: 0.4, ease: 'power2.out' });
      window.gsap.fromTo('.menu__list a', { yPercent: 60, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.8, ease: 'expo.out', stagger: 0.05 });
    }
  }
  function closeMenu() {
    const btn = $('#menuBtn'), menu = $('#menu');
    if (!menu || menu.hidden) return;
    menu.hidden = true;
    root.classList.remove('menu-open');
    btn.setAttribute('aria-expanded', 'false');
    btn.querySelector('.nav__menu-label').textContent = '選單';
  }

  /* ---------- 聯絡表單（FormSubmit：送出後直接寄到 ee.techww@gmail.com，不用自己的後端） ----------
     第一次有人送出時，FormSubmit 會先寄一封「Activate Form」信到信箱，點連結開通後才會開始轉寄。 */
  function setupContactForm() {
    const form = document.getElementById('cform');
    if (!form) return;
    const status = document.getElementById('cformStatus');
    const btn = form.querySelector('button[type="submit"]');
    const label = btn ? btn.innerHTML : '';
    const TO = 'ee.techww@gmail.com';
    const show = (msg, ok) => {
      status.textContent = msg; status.hidden = false;
      status.classList.toggle('is-ok', ok); status.classList.toggle('is-err', !ok);
    };
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const data = new FormData(form);
      if (data.get('_honey')) return; // 蜜罐：機器人填了就默默不送
      const name = (data.get('name') || '').trim();
      const payload = {
        稱呼: name,
        聯絡方式: (data.get('contact') || '').trim(),
        想做什麼: data.get('type'),
        預算範圍: data.get('budget'),
        '想解決的問題 / 補充': (data.get('message') || '').trim() || '（無）',
        _subject: `[網站詢問] ${data.get('type')}－${name}`,
        _template: 'table',
        _captcha: 'false',
      };
      if (btn) { btn.disabled = true; btn.textContent = '送出中…'; }
      fetch('https://formsubmit.co/ajax/' + TO, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload),
      })
        .then((r) => r.json().catch(() => ({})).then((j) => ({ ok: r.ok, j })))
        .then(({ ok, j }) => {
          if (ok && String(j.success) === 'true') {
            form.reset();
            show('收到了！我們會用你留的方式回覆，通常一到兩個工作天內。', true);
          } else if (/activat/i.test(j.message || '')) {
            show(`表單正在開通中，這次可能沒送到。請先直接寄信到 ${TO}，謝謝！`, false);
          } else {
            throw new Error(j.message || 'send failed');
          }
        })
        .catch(() => show(`送出失敗，你也可以直接寄信到 ${TO}`, false))
        .finally(() => { if (btn) { btn.disabled = false; btn.innerHTML = label; } });
    });
  }
})();
