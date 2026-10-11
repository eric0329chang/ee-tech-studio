/* =============================================================
   EE Tech Studio — anime.js 加分效果
   全部是「錦上添花」：anime.js 沒載到、或使用者關閉動效，就什麼都不做，
   網站照原本（CSS + GSAP）的樣子顯示。
   - 區塊標題：逐字從下方浮上來
   - 作品插圖：線條一筆一筆描出來
   - 技術標籤：從中間往兩側依序彈出
   - 數字：計數
   （進場、卡片傾斜、按鈕磁吸在 motion-fx.js，用 Motion 做）
   ============================================================= */
(function () {
  'use strict';

  if (typeof window.anime === 'undefined') return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const { animate, stagger, svg, splitText } = window.anime;
  const root = document.documentElement;
  root.classList.add('anime-on'); // CSS 用這個 class 把被 anime 接手的元素的 reveal 效果關掉，避免兩套動畫打架

  /**
   * 元素捲進畫面（露出 threshold 比例）時執行 enter；完全離開畫面時執行 leave 重設，
   * 下次捲回來會再播一次。enter 回傳的動畫在離開時會先被取消，避免跟重設打架。
   */
  function onView(el, enter, leave, threshold = 0.3) {
    if (!('IntersectionObserver' in window)) { enter(); return; }
    let shown = false;
    let anim = null;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!shown && en.isIntersecting && en.intersectionRatio >= threshold) {
          shown = true;
          anim = enter();
        } else if (shown && !en.isIntersecting) {
          shown = false;
          if (anim && anim.cancel) anim.cancel();
          anim = null;
          leave();
        }
      });
    }, { threshold: [0, threshold], rootMargin: '0px 0px -6% 0px' });
    io.observe(el);
  }

  /* ---------- 區塊標題：逐字浮上 ---------- */
  document.querySelectorAll('.section-title').forEach((title) => {
    const { chars } = splitText(title, { chars: { wrap: 'clip' } });
    const hide = () => animate(chars, { y: '110%', duration: 0 });
    hide();
    onView(title, () => animate(chars, {
      y: ['110%', '0%'],
      duration: 800,
      ease: 'outExpo',
      delay: stagger(45),
    }), hide, 0.6);
  });

  /* ---------- 作品插圖：線條描繪 ---------- */
  document.querySelectorAll('.wart').forEach((art) => {
    const strokes = [...art.querySelectorAll('path, line, polyline, polygon, circle, rect, ellipse')].filter((el) => {
      const cs = getComputedStyle(el);
      return cs.stroke && cs.stroke !== 'none' && parseFloat(cs.strokeWidth) > 0;
    });
    if (!strokes.length) return;
    const drawables = svg.createDrawable(strokes);
    const hide = () => animate(drawables, { draw: '0 0', duration: 0 }); // 先藏起來，捲到才畫
    hide();
    onView(art, () => animate(drawables, {
      draw: ['0 0', '0 1'],
      duration: 1400,
      ease: 'inOutQuad',
      delay: stagger(60),
    }), hide, 0.35);
  });

  /* ---------- 技術標籤：從中間往兩側彈出 ---------- */
  document.querySelectorAll('.stack__tags').forEach((group) => {
    const tags = group.querySelectorAll('.stack__tag');
    const hide = () => animate(tags, { opacity: 0, duration: 0 });
    hide();
    onView(group, () => animate(tags, {
      opacity: [0, 1],
      scale: [0.6, 1],
      y: [14, 0],
      duration: 700,
      ease: 'outBack(1.8)',
      delay: stagger(55, { from: 'center' }),
    }), hide, 0.5);
  });

  /* ---------- 數字計數（取代 main.js 的手寫版：出場加速、收尾很慢） ---------- */
  window.EE_FX = Object.assign(window.EE_FX || {}, { counters: true });
  document.querySelectorAll('.stat__num[data-count]').forEach((el) => {
    const end = parseFloat(el.dataset.count);
    const suffix = el.dataset.suffix || '';
    const obj = { v: 0 };
    const hide = () => { obj.v = 0; el.textContent = '0' + suffix; };
    hide();
    onView(el, () => animate(obj, {
      v: [0, end],
      duration: 2000,
      ease: 'outExpo',
      onUpdate: () => { el.textContent = Math.round(obj.v) + suffix; },
    }), hide, 0.6);
  });
})();
