/* =============================================================
   EE Tech Studio — Motion（motion.dev）動畫層
   負責「進場」與「互動」：
   - 頂端捲動進度條
   - 開場：主標題逐行彈上、其他元素模糊淡入
   - 進場：所有 .reveal 模糊淡入；同時進畫面的元素自動依序出現（每次捲回來都會重播）
   - 作品圖：遮罩由內往外展開
   - 關於我們：大段文字跟著捲動逐字亮起
   - 服務 / 團隊卡片：滑鼠 3D 傾斜 + 光暈跟著游標
   - 按鈕：磁吸（彈簧）
   Motion 沒載到、或使用者關閉動效：什麼都不做，交回 main.js 原本的 CSS 進場。
   這支要在 main.js 之前載入（main.js 會看 window.EE_FX 決定要不要自己做進場）。
   ============================================================= */
(function () {
  'use strict';

  if (typeof window.Motion === 'undefined') return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const { animate, inView, scroll, stagger } = window.Motion;

  const root = document.documentElement;
  root.classList.add('motion-on');
  window.EE_FX = Object.assign(window.EE_FX || {}, { reveals: true });

  const EASE = [0.16, 1, 0.3, 1]; // 快進慢停，整站統一
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const animeOwnsTitles = root.classList.contains('anime-on'); // 標題逐字交給 anime-fx.js

  /* ---------- 頂端捲動進度條 ---------- */
  const bar = document.createElement('div');
  bar.className = 'scroll-progress';
  bar.setAttribute('aria-hidden', 'true');
  document.body.appendChild(bar);
  scroll(animate(bar, { transform: ['scaleX(0)', 'scaleX(1)'] }, { ease: 'linear' }));

  /* ---------- 進場：模糊淡入，同一瞬間進畫面的依序出現 ---------- */
  const IN = { opacity: [0, 1], y: [28, 0], filter: ['blur(10px)', 'blur(0px)'] };
  let queue = [];
  let flushScheduled = false;
  function flush() {
    flushScheduled = false;
    const els = queue;
    queue = [];
    els.forEach((el) => el.classList.add('is-visible'));
    animate(els, IN, { duration: 0.9, ease: EASE, delay: stagger(0.08) })
      .then(() => els.forEach((el) => { el.style.filter = ''; })); // 結束後拿掉 filter，不留額外的合成層
  }
  function enqueue(el) {
    queue.push(el);
    if (!flushScheduled) { flushScheduled = true; requestAnimationFrame(flush); }
  }

  // 每次進畫面都重播：完全離開畫面時悄悄重設回「藏起來」的狀態，下次捲回來再淡入一次
  function hide(el) {
    animate(el, { opacity: 0, y: 28, filter: 'blur(10px)' }, { duration: 0 });
  }
  document.querySelectorAll('.reveal').forEach((el) => {
    if (el.closest('.hero')) return;                                   // 開場另外處理
    if (animeOwnsTitles && el.classList.contains('section-title')) return;
    inView(el, () => {
      enqueue(el);
      return () => {                                                   // 離開畫面
        const i = queue.indexOf(el);
        if (i >= 0) queue.splice(i, 1);
        hide(el);
      };
    }, { margin: '0px 0px -10% 0px' });
  });

  /* ---------- 開場（載入畫面收起後） ---------- */
  function heroIntro() {
    const lines = document.querySelectorAll('.hero__title .line > span');
    animate(lines, { y: ['110%', '0%'] }, { duration: 1.1, ease: EASE, delay: stagger(0.11) });
    const rest = document.querySelectorAll('.hero .reveal');
    rest.forEach((el) => el.classList.add('is-visible'));
    animate(rest, IN, { duration: 1, ease: EASE, delay: stagger(0.1, { startDelay: 0.35 }) })
      .then(() => rest.forEach((el) => { el.style.filter = ''; }));
    // 光暈只淡入：它們的 transform 是 GSAP 視差在控制，這裡不能碰
    animate('.hero .blob', { opacity: [0, 0.38] }, { duration: 1.8, ease: EASE });
  }
  window.addEventListener('ee:ready', heroIntro, { once: true });

  /* ---------- 聯絡區大標 ---------- */
  const contact = document.querySelector('.contact');
  if (contact) {
    const lines = contact.querySelectorAll('.contact__title .line > span');
    inView(contact, () => {
      contact.classList.add('is-visible');
      animate(lines, { y: ['110%', '0%'] }, { duration: 1.1, ease: EASE, delay: stagger(0.12) });
      return () => animate(lines, { y: '110%' }, { duration: 0 });
    }, { amount: 0.25 });
  }

  /* ---------- 作品圖：遮罩展開 + 文字依序進場 ---------- */
  document.querySelectorAll('.wcard').forEach((card) => {
    const media = card.querySelector('.wcard__media');
    const body = card.querySelector('.wcard__body');
    const parts = body ? [...body.children] : [];
    const CLOSED = 'inset(14% 10% 14% 10% round 18px)';
    const reset = () => {
      if (media) animate(media, { clipPath: CLOSED }, { duration: 0 });
      animate(parts, { opacity: 0, y: 24 }, { duration: 0 });
    };
    reset();
    inView(card, () => {
      if (media) {
        animate(media, { clipPath: [CLOSED, 'inset(0% 0% 0% 0% round 18px)'] }, { duration: 1.3, ease: EASE });
      }
      animate(parts, { opacity: [0, 1], y: [24, 0] }, { duration: 0.9, ease: EASE, delay: stagger(0.09, { startDelay: 0.2 }) });
      return reset; // 離開畫面就重設，下次進來再播
    }, { amount: 0.3 });
  });

  /* ---------- 關於我們：逐字跟著捲動亮起 ---------- */
  const about = document.getElementById('aboutBig');
  if (about && !about.dataset.split) {
    about.dataset.split = '1';      // main.js 看到這個就不會再拆一次
    about.classList.add('split', 'scrub');
    // 中文沒有空格，逐字拆；英文、數字整個字一起
    const walker = document.createTreeWalker(about, NodeFilter.SHOW_TEXT);
    const texts = [];
    while (walker.nextNode()) texts.push(walker.currentNode);
    texts.forEach((node) => {
      const frag = document.createDocumentFragment();
      node.textContent.split(/([A-Za-z0-9]+|\s+)/).forEach((tok) => {
        if (!tok) return;
        if (/^\s+$/.test(tok)) { frag.appendChild(document.createTextNode(' ')); return; }
        const pieces = /^[A-Za-z0-9]+$/.test(tok) ? [tok] : [...tok];
        pieces.forEach((ch) => {
          const span = document.createElement('span');
          span.className = 'word';
          span.textContent = ch;
          frag.appendChild(span);
        });
      });
      node.parentNode.replaceChild(frag, node);
    });
    const words = about.querySelectorAll('.word');
    const n = words.length;
    let last = -1;
    scroll((progress) => {
      const lit = progress * (n + 6); // 一次亮一小段，前緣有漸層
      if (Math.abs(lit - last) < 0.05) return;
      last = lit;
      for (let i = 0; i < n; i++) {
        const t = Math.min(1, Math.max(0, (lit - i) / 6));
        words[i].style.opacity = 0.18 + 0.82 * t;
      }
    }, { target: about, offset: ['start 0.85', 'end 0.45'] });
  }

  if (!finePointer) return; // 下面都是滑鼠互動

  /* ---------- 卡片：3D 傾斜 + 光暈跟著游標 ---------- */
  const TILT = { type: 'spring', stiffness: 260, damping: 26 };
  document.querySelectorAll('.scard, .member').forEach((card) => {
    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      card.style.setProperty('--mx', (px * 100).toFixed(1) + '%');
      card.style.setProperty('--my', (py * 100).toFixed(1) + '%');
      animate(card, { transformPerspective: 900, rotateY: (px - 0.5) * 8, rotateX: (0.5 - py) * 8, y: -6 }, TILT);
    });
    card.addEventListener('pointerleave', () => {
      animate(card, { rotateY: 0, rotateX: 0, y: 0 }, TILT);
    });
  });

  /* ---------- 按鈕磁吸 ---------- */
  document.querySelectorAll('.btn').forEach((btn) => {
    btn.addEventListener('pointermove', (e) => {
      const r = btn.getBoundingClientRect();
      animate(btn, {
        x: (e.clientX - r.left - r.width / 2) * 0.3,
        y: (e.clientY - r.top - r.height / 2) * 0.4,
      }, { type: 'spring', stiffness: 320, damping: 20 });
    });
    btn.addEventListener('pointerleave', () => {
      animate(btn, { x: 0, y: 0 }, { type: 'spring', stiffness: 260, damping: 12 });
    });
  });
})();
