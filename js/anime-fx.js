/* =============================================================
   EE Tech Studio — anime.js 加分效果
   全部是「錦上添花」：anime.js 沒載到、或使用者關閉動效，就什麼都不做，
   網站照原本（CSS + GSAP）的樣子顯示。
   - 區塊標題：逐字從下方浮上來
   - 作品插圖：線條一筆一筆描出來
   - 技術標籤：從中間往兩側依序彈出
   - 按鈕：滑鼠靠近時被「吸」過去，離開時彈回
   ============================================================= */
(function () {
  'use strict';

  if (typeof window.anime === 'undefined') return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const { animate, stagger, svg, splitText } = window.anime;
  const root = document.documentElement;
  root.classList.add('anime-on'); // CSS 用這個 class 把被 anime 接手的元素的 reveal 效果關掉，避免兩套動畫打架

  /** 元素第一次捲進畫面時執行一次 */
  function onFirstView(el, fn, threshold = 0.3) {
    if (!('IntersectionObserver' in window)) { fn(); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) { io.disconnect(); fn(); } });
    }, { threshold, rootMargin: '0px 0px -6% 0px' });
    io.observe(el);
  }

  /* ---------- 區塊標題：逐字浮上 ---------- */
  document.querySelectorAll('.section-title').forEach((title) => {
    const { chars } = splitText(title, { chars: { wrap: 'clip' } });
    chars.forEach((c) => { c.style.transform = 'translateY(110%)'; });
    onFirstView(title, () => {
      animate(chars, {
        y: ['110%', '0%'],
        duration: 800,
        ease: 'outExpo',
        delay: stagger(45),
      });
    }, 0.6);
  });

  /* ---------- 作品插圖：線條描繪 ---------- */
  document.querySelectorAll('.wart').forEach((art) => {
    const strokes = [...art.querySelectorAll('path, line, polyline, polygon, circle, rect, ellipse')].filter((el) => {
      const cs = getComputedStyle(el);
      return cs.stroke && cs.stroke !== 'none' && parseFloat(cs.strokeWidth) > 0;
    });
    if (!strokes.length) return;
    const drawables = svg.createDrawable(strokes);
    animate(drawables, { draw: '0 0', duration: 0 }); // 先藏起來，捲到才畫
    onFirstView(art, () => {
      animate(drawables, {
        draw: ['0 0', '0 1'],
        duration: 1400,
        ease: 'inOutQuad',
        delay: stagger(60),
      });
    }, 0.35);
  });

  /* ---------- 技術標籤：從中間往兩側彈出 ---------- */
  document.querySelectorAll('.stack__tags').forEach((group) => {
    const tags = group.querySelectorAll('.stack__tag');
    tags.forEach((t) => { t.style.opacity = '0'; });
    onFirstView(group, () => {
      animate(tags, {
        opacity: [0, 1],
        scale: [0.6, 1],
        y: [14, 0],
        duration: 700,
        ease: 'outBack(1.8)',
        delay: stagger(55, { from: 'center' }),
      });
    }, 0.5);
  });

  /* ---------- 按鈕磁吸（只在有滑鼠的裝置） ---------- */
  if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    document.querySelectorAll('.btn').forEach((btn) => {
      btn.addEventListener('mousemove', (e) => {
        const r = btn.getBoundingClientRect();
        animate(btn, {
          x: (e.clientX - r.left - r.width / 2) * 0.28,
          y: (e.clientY - r.top - r.height / 2) * 0.38,
          duration: 400,
          ease: 'outQuad',
        });
      });
      btn.addEventListener('mouseleave', () => {
        animate(btn, { x: 0, y: 0, duration: 900, ease: 'outElastic(1, .45)' });
      });
    });
  }
})();
