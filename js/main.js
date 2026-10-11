/* =============================================================
   EE Tech Studio — 互動 / 動畫
   核心進場用 IntersectionObserver（穩、到處都能跑）；
   視差 / 服務區水平釘住用 GSAP ScrollTrigger（純加分，沒載到也不會壞）；
   平滑捲動用 Lenis（加分）。
   ============================================================= */
(function () {
  'use strict';

  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hasGSAP = typeof window.gsap !== 'undefined';
  const hasST = hasGSAP && typeof window.ScrollTrigger !== 'undefined';
  const hasLenis = typeof window.Lenis !== 'undefined';

  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // 表單不等進場動畫，一載入就接手（不然會走 HTML 的 mailto 備援，中文會變亂碼）
  setupContactForm();

  /* ---------- 進場載入（一定會收起，最多 2.8 秒） ---------- */
  const loader = document.getElementById('loader');
  let loaderDone = false;
  function killLoader() {
    if (loaderDone) return; loaderDone = true;
    if (loader) loader.style.display = 'none';
    boot();
  }
  setTimeout(killLoader, 2800);
  if (hasGSAP && !prefersReduced && loader) {
    gsap.timeline({ onComplete: killLoader })
      .to('.loader__text', { opacity: 1, duration: 0.5 })
      .to('.loader__text', { letterSpacing: '0.6em', opacity: 0, duration: 0.6, delay: 0.3, ease: 'power2.in' })
      .to(loader, { yPercent: -100, duration: 0.7, ease: 'power3.inOut' }, '-=0.15');
  } else {
    killLoader();
  }

  /* ---------- 主流程 ---------- */
  let booted = false;
  function boot() {
    if (booted) return; booted = true;

    setupNav();
    setupCursor();
    setupSmoothScroll();
    setupReveals();
    setupCounters();
    setupAboutText();
    setupGsapExtras();

    // 讓其他獨立載入的 script（例如 playground.js）知道 Lenis 已經接手捲動，
    // 之後要用程式捲動頁面請透過 window.eeScrollTo，不要再直接呼叫 scrollIntoView，
    // 不然 Lenis 接手時位置會被打回去。
    window.eeScrollTo = (target) => scrollToTarget(target);
    window.dispatchEvent(new Event('ee:ready'));

    // 保險：3.5 秒後把第一屏還隱形的 reveal 強制顯示（motion-fx.js 接手進場時由它自己負責）
    if (!fxReveals()) setTimeout(() => {
      const vh = window.innerHeight;
      document.querySelectorAll('.reveal:not(.is-visible)').forEach((el) => {
        if (el.getBoundingClientRect().top < vh) el.classList.add('force-show');
      });
    }, 3500);
  }

  /* ---------- 平滑捲動 ---------- */
  let lenis = null;
  function setupSmoothScroll() {
    if (!hasLenis || prefersReduced) return;
    lenis = new Lenis({ duration: 1.1, easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)) });
    if (hasST) {
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add((time) => lenis.raf(time * 1000));
      gsap.ticker.lagSmoothing(0);
    } else {
      const raf = (t) => { lenis.raf(t); requestAnimationFrame(raf); };
      requestAnimationFrame(raf);
    }
  }
  function scrollToTarget(sel) {
    const el = document.querySelector(sel);
    if (!el) return;
    if (lenis) lenis.scrollTo(el, { offset: -10 });
    else el.scrollIntoView({ behavior: prefersReduced ? 'auto' : 'smooth' });
  }

  /* ---------- 導覽列 ---------- */
  function setupNav() {
    const nav = document.getElementById('nav');
    const burger = document.getElementById('burger');
    if (!nav) return;
    const onScroll = () => nav.classList.toggle('nav--scrolled', window.scrollY > 40);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    burger && burger.addEventListener('click', () => nav.classList.toggle('nav--open'));
    document.querySelectorAll('a[href^="#"]').forEach((a) => {
      a.addEventListener('click', (e) => {
        const id = a.getAttribute('href');
        if (id.length > 1 && document.querySelector(id)) {
          e.preventDefault();
          nav.classList.remove('nav--open');
          scrollToTarget(id);
        }
      });
    });
  }

  /* ---------- 自訂游標（濾鏡感圓圈：mix-blend-mode 反轉底下顏色） ---------- */
  function setupCursor() {
    const cursor = document.getElementById('cursor');
    if (!cursor) return;
    if (!window.matchMedia('(hover: hover)').matches || !window.matchMedia('(pointer: fine)').matches) {
      cursor.style.display = 'none'; return;
    }
    let cx = innerWidth / 2, cy = innerHeight / 2, tx = cx, ty = cy, seen = false;
    addEventListener('mousemove', (e) => {
      tx = e.clientX; ty = e.clientY;
      if (!seen) { seen = true; cx = tx; cy = ty; cursor.classList.add('cursor--visible'); }
    });
    (function loop() {
      cx += (tx - cx) * 0.22; cy += (ty - cy) * 0.22;
      cursor.style.transform = `translate(${cx}px, ${cy}px) translate(-50%, -50%)`;
      requestAnimationFrame(loop);
    })();

    // 事件委派：滑到任何 [data-hover]（含從邊緣、從子元素進入）圓圈放大，濾鏡效果更明顯
    const isHoverTarget = (n) => n && n.closest && n.closest('[data-hover]');
    document.addEventListener('mouseover', (e) => {
      if (isHoverTarget(e.target)) cursor.classList.add('cursor--hover');
    });
    document.addEventListener('mouseout', (e) => {
      if (isHoverTarget(e.target) && !isHoverTarget(e.relatedTarget)) {
        cursor.classList.remove('cursor--hover');
      }
    });
    document.addEventListener('mouseleave', () => cursor.classList.remove('cursor--visible'));
    document.addEventListener('mouseenter', () => cursor.classList.add('cursor--visible'));
  }

  /* ---------- 進場 reveal（IntersectionObserver） ---------- */
  // motion-fx.js（Motion）有載到時，進場動畫改由它做（彈簧 + 模糊淡入、同時進畫面的依序出現）
  function fxReveals() { return !!(window.EE_FX && window.EE_FX.reveals); }
  function setupReveals() {
    if (fxReveals()) return;
    const items = document.querySelectorAll('.reveal');
    const contact = document.querySelector('.contact');
    if (!('IntersectionObserver' in window)) {
      items.forEach((el) => el.classList.add('is-visible'));
      contact && contact.classList.add('is-visible');
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) { en.target.classList.add('is-visible'); io.unobserve(en.target); }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });
    items.forEach((el) => io.observe(el));

    if (contact) {
      const io2 = new IntersectionObserver((entries) => {
        entries.forEach((en) => { if (en.isIntersecting) { contact.classList.add('is-visible'); io2.disconnect(); } });
      }, { threshold: 0.25 });
      io2.observe(contact);
    }
  }

  /* ---------- 數字計數 ---------- */
  function setupCounters() {
    if (window.EE_FX && window.EE_FX.counters) return; // anime-fx.js 接手
    const nums = document.querySelectorAll('.stat__num[data-count]');
    if (!nums.length) return;
    const run = (el) => {
      const end = parseFloat(el.dataset.count);
      const suffix = el.dataset.suffix || '';
      if (prefersReduced) { el.textContent = end + suffix; return; }
      const dur = 1500; const t0 = performance.now();
      const step = (now) => {
        const p = Math.min(1, (now - t0) / dur);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.round(end * eased) + suffix;
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };
    if (!('IntersectionObserver' in window)) { nums.forEach(run); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) { run(en.target); io.unobserve(en.target); } });
    }, { threshold: 0.6 });
    nums.forEach((el) => io.observe(el));
  }

  /* ---------- ABOUT 大段文字：逐字提亮（IO + CSS，不依賴 GSAP） ---------- */
  function setupAboutText() {
    const el = document.getElementById('aboutBig');
    if (!el || el.dataset.split || prefersReduced) return;
    el.dataset.split = '1';
    // 只把純文字拆成 <span class="word">，保留 <em> 等標籤
    el.innerHTML = el.innerHTML.replace(/(<[^>]+>)|([^<\s]+)/g,
      (m, tag, word) => (tag ? tag : `<span class="word">${word}</span>`));
    const words = el.querySelectorAll('.word, em');
    words.forEach((w, i) => { w.style.transitionDelay = Math.min(i * 22, 900) + 'ms'; });
    el.classList.add('split');

    if (!('IntersectionObserver' in window)) { el.classList.add('lit'); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) { el.classList.add('lit'); io.disconnect(); } });
    }, { threshold: 0.3 });
    io.observe(el);
  }

  /* ---------- 聯絡表單（FormSubmit：送出後直接寄到 ee.techww@gmail.com，不用自己的後端） ----------
     第一次有人送出時，FormSubmit 會先寄一封「Activate Form」信到信箱，點連結開通後才會開始轉寄。 */
  function setupContactForm() {
    const form = document.getElementById('cform');
    if (!form) return;
    const status = document.getElementById('cformStatus');
    const btn = form.querySelector('button[type="submit"]');
    const TO = 'ee.techww@gmail.com';
    const ENDPOINT = 'https://formsubmit.co/ajax/' + TO;

    const show = (msg, ok) => {
      if (!status) return;
      status.textContent = msg;
      status.hidden = false;
      status.classList.toggle('is-ok', ok);
      status.classList.toggle('is-err', !ok);
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

      fetch(ENDPOINT, {
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
        .finally(() => { if (btn) { btn.disabled = false; btn.textContent = '送出需求'; } });
    });
  }

  /* ---------- GSAP 加分效果（視差 + 服務區水平釘住） ---------- */
  function setupGsapExtras() {
    if (!hasGSAP || !hasST || prefersReduced) return;
    gsap.registerPlugin(ScrollTrigger);

    // 視差
    gsap.utils.toArray('[data-parallax]').forEach((el) => {
      const speed = parseFloat(el.dataset.speed || '0.2');
      gsap.to(el, {
        yPercent: speed * 100, ease: 'none',
        scrollTrigger: { trigger: el.closest('section') || el, start: 'top bottom', end: 'bottom top', scrub: true },
      });
    });

    // 服務區：釘住 + 水平捲動（桌機才做；沒做的話 CSS 會退回正常網格）
    const track = document.getElementById('servicesTrack');
    const pin = document.getElementById('servicesPin');
    if (track && pin && window.innerWidth > 820) {
      document.documentElement.classList.add('gsap-hpin');
      const dist = () => Math.max(0, track.scrollWidth - window.innerWidth + 80);
      gsap.to(track, {
        x: () => -dist(), ease: 'none',
        scrollTrigger: {
          trigger: pin, start: 'top top', end: () => '+=' + dist(),
          pin: true, scrub: 1, invalidateOnRefresh: true,
        },
      });
    }

    // 字體換好後版面尺寸會變，重新計算所有捲動觸發點
    window.addEventListener('load', () => ScrollTrigger.refresh());
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => setTimeout(() => ScrollTrigger.refresh(), 100));
    }
    window.addEventListener('resize', () => ScrollTrigger.refresh());
  }
})();
