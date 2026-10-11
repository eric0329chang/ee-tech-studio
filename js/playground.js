/* =============================================================
   EE Tech Studio — 實驗室小遊戲
   純 vanilla JS，無任何函式庫。三個遊戲共用一個舞台，切換分頁時
   會先清掉前一個遊戲的計時器再掛新的。
   ============================================================= */
(function () {
  'use strict';

  var stage = document.getElementById('labStage');
  var hint = document.getElementById('labHint');
  var tabs = document.querySelectorAll('.lab__tab');
  if (!stage) return;

  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  };

  /* 「好友默契測驗」的連結編碼：資料就塞在網址本身，不需要後端／資料庫。 */
  var FRIEND_PARAM = 'fq';
  var FRIEND_QUESTIONS = [
    { q: '假日比較想？', opts: ['耍廢在家', '出門走走', '揪朋友聚聚', '把進度補完'] },
    { q: '心情不好的時候最想？', opts: ['睡一覺', '吃點好吃的', '找人聊聊', '自己靜一靜'] },
    { q: '朋友形容你最常說？', opts: ['很靠譜', '很搞笑', '很溫柔', '很有想法'] },
    { q: '選餐廳你通常？', opts: ['早就想好要吃什麼', '都可以，看大家', '先查評價', '挑最近的就好'] },
    { q: '半夜睡不著會？', opts: ['滑手機', '亂想事情', '聽音樂／Podcast', '躺著等睡著'] },
    { q: '收到禮物最想要？', opts: ['實用的東西', '好吃的', '有紀念意義的小物', '現金或禮券'] }
  ];
  function encodeFriendPayload(name, answers) {
    var json = JSON.stringify({ n: name, a: answers });
    var b64 = btoa(unescape(encodeURIComponent(json)));
    return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function getFriendPayload() {
    try {
      var raw = new URLSearchParams(location.search).get(FRIEND_PARAM);
      if (!raw) return null;
      var b64 = raw.replace(/-/g, '+').replace(/_/g, '/');
      var json = decodeURIComponent(escape(atob(b64)));
      var data = JSON.parse(json);
      if (!data || typeof data.n !== 'string' || !Array.isArray(data.a)) return null;
      return data;
    } catch (e) { return null; }
  }
  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(function () { return true; }, function () { return false; });
    }
    return new Promise(function (resolve) {
      try {
        var ta = document.createElement('textarea');
        ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.focus(); ta.select();
        var ok = document.execCommand('copy');
        document.body.removeChild(ta);
        resolve(ok);
      } catch (e) { resolve(false); }
    });
  }

  var games = {
    reaction: reactionGame, aim: aimGame, memory: memoryGame,
    puzzle: puzzleGame, '2048': game2048, stamp: stampGame, quiz: quizGame,
    friend: friendGame
  };
  var hints = {
    reaction: '畫面變綠色就馬上點 —— 測你的反應速度（毫秒）',
    aim: '15 秒內，冒出來的點越快點掉越好',
    memory: '翻開兩張一樣的圖就消掉，用最少步數清空',
    puzzle: '點跟空格相鄰的數字把它滑過去，排回 1～15 的順序',
    '2048': '點一下畫面後用方向鍵（手機滑動）合併相同數字，湊出 2048',
    stamp: '模擬活動集點 —— 蓋滿一張卡就兌換，這就是我們做「集點與抽獎互動」的樣子',
    quiz: '答 5 題選擇題，看看你最適合先找我們做哪個服務',
    friend: '出一份關於你的題，生成連結傳給朋友猜，看他多了解你'
  };

  var cleanup = null;
  function mount(fn) {
    if (typeof cleanup === 'function') { try { cleanup(); } catch (e) {} }
    stage.innerHTML = '';
    cleanup = fn(stage) || null;
  }

  Array.prototype.forEach.call(tabs, function (t) {
    t.addEventListener('click', function () {
      Array.prototype.forEach.call(tabs, function (x) { x.classList.toggle('is-active', x === t); });
      var key = t.dataset.game;
      if (hint) hint.textContent = hints[key] || '';
      mount(games[key] || reactionGame);
    });
  });

  var sharedFriendQuiz = getFriendPayload();
  if (sharedFriendQuiz) {
    // 有人傳了「好友默契測驗」連結進來：直接開那個分頁、跳過預設遊戲
    Array.prototype.forEach.call(tabs, function (x) { x.classList.toggle('is-active', x.dataset.game === 'friend'); });
    if (hint) hint.textContent = hints.friend;
    mount(friendGame);
    scrollToLabWhenReady();
  } else {
    // 平常進站：直接開服務測驗（比反應力測試更能讓訪客順便認識我們的服務）
    Array.prototype.forEach.call(tabs, function (x) { x.classList.toggle('is-active', x.dataset.game === 'quiz'); });
    if (hint) hint.textContent = hints.quiz;
    mount(quizGame);
  }

  // main.js 的 Lenis 平滑捲動是非同步啟動的（loader 收起後才建立），
  // 太早呼叫原生 scrollIntoView 會在 Lenis 接手時被打回原位。
  // 等 main.js 廣播 ee:ready（Lenis 已就緒）再捲，並保留一個保底逾時避免萬一事件沒發生。
  function scrollToLabWhenReady() {
    var done = false;
    function go() {
      if (done) return;
      done = true;
      if (typeof window.eeScrollTo === 'function') window.eeScrollTo('#lab');
      else {
        var labEl = document.getElementById('lab');
        if (labEl) labEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
    window.addEventListener('ee:ready', go, { once: true });
    setTimeout(go, 3200); // 保底：main.js 萬一沒發事件也不會完全不捲
  }

  /* ---------- 遊戲 1：反應力測試 ---------- */
  function reactionGame(root) {
    var box = el('button', 'lab-react');
    box.type = 'button';
    root.appendChild(box);

    var state = 'idle';
    var t0 = 0;
    var timer = null;

    function best() { return store.get('ee_lab_react_best'); }
    function render() {
      if (state === 'idle') box.innerHTML = face('點一下開始', best() ? '最佳 ' + best() + ' ms' : '準備好了嗎？');
      else if (state === 'wait') box.innerHTML = face('等待綠色…', '先別點');
      else if (state === 'go') box.innerHTML = face('現在！點！', '');
      else if (state === 'early') box.innerHTML = face('太快了 😅', '等變綠色再點，點一下重來');
      box.dataset.state = state;
    }
    function toWait() {
      state = 'wait'; render();
      timer = setTimeout(function () {
        state = 'go'; t0 = now(); render();
      }, 900 + Math.random() * 2200);
    }
    box.addEventListener('click', function () {
      if (state === 'idle' || state === 'early' || state === 'done') { toWait(); return; }
      if (state === 'wait') { clearTimeout(timer); state = 'early'; render(); return; }
      if (state === 'go') {
        var ms = Math.round(now() - t0);
        var b = best() ? +best() : null;
        var shown = b ? Math.min(ms, b) : ms;
        if (!b || ms < b) store.set('ee_lab_react_best', ms);
        state = 'done';
        box.dataset.state = 'done';
        box.innerHTML = face(ms + ' ms', verdict(ms) + ' · 最佳 ' + shown + ' ms — 點一下再玩');
      }
    });
    render();
    return function () { clearTimeout(timer); };
  }
  function verdict(ms) {
    if (ms < 200) return '超人反應';
    if (ms < 280) return '很快';
    if (ms < 350) return '一般水準';
    if (ms < 450) return '再練練';
    return '喝杯咖啡再來';
  }

  /* ---------- 遊戲 2：手速點點看 ---------- */
  function aimGame(root) {
    var wrap = el('div', 'lab-aim');
    var hud = el('div', 'lab-aim__hud');
    var field = el('div', 'lab-aim__field');
    wrap.appendChild(hud); wrap.appendChild(field);
    root.appendChild(wrap);

    var score = 0, left = 15, running = false, spawnT = null, tickT = null;
    var dots = [];

    function best() { return +(store.get('ee_lab_aim_best') || 0); }
    function hudRender(msg) {
      hud.innerHTML =
        '<span>分數 <b>' + score + '</b></span>' +
        '<span>時間 <b>' + left + 's</b></span>' +
        '<span>最佳 <b>' + best() + '</b></span>' +
        (msg ? '<span class="lab-aim__msg">' + msg + '</span>' : '');
    }
    function clearDots() {
      dots.forEach(function (d) { clearTimeout(d._t); if (d.parentNode) d.parentNode.removeChild(d); });
      dots = [];
    }
    function start() {
      score = 0; left = 15; running = true;
      clearDots(); field.innerHTML = '';
      hudRender();
      tickT = setInterval(function () {
        left--; hudRender();
        if (left <= 0) end();
      }, 1000);
      spawn();
    }
    function spawn() {
      if (!running) return;
      var d = el('button', 'lab-aim__dot');
      d.type = 'button';
      var s = 34 + Math.random() * 26;
      var w = field.clientWidth || 480;
      var h = field.clientHeight || 300;
      d.style.width = d.style.height = s + 'px';
      d.style.left = Math.max(0, Math.random() * (w - s)) + 'px';
      d.style.top = Math.max(0, Math.random() * (h - s)) + 'px';
      d.addEventListener('click', function () {
        if (!running) return;
        score++; hudRender();
        clearTimeout(d._t);
        if (d.parentNode) d.parentNode.removeChild(d);
      });
      d._t = setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, 1100);
      dots.push(d);
      field.appendChild(d);
      spawnT = setTimeout(spawn, 470 + Math.random() * 340);
    }
    function end() {
      running = false;
      clearInterval(tickT); clearTimeout(spawnT); clearDots();
      if (score > best()) store.set('ee_lab_aim_best', score);
      hudRender('結束！這一輪點掉 ' + score + ' 顆');
      field.appendChild(mkBtn('再玩一次', start));
    }
    hudRender();
    field.appendChild(mkBtn('開始（15 秒）', start));
    return function () { running = false; clearInterval(tickT); clearTimeout(spawnT); clearDots(); };
  }

  /* ---------- 遊戲 3：翻牌配對 ---------- */
  function memoryGame(root) {
    var symbols = ['🎮', '🎨', '💡', '🚀', '📊', '🍩', '✨', '🔧'];
    var wrap = el('div', 'lab-mem');
    var hud = el('div', 'lab-mem__hud');
    var grid = el('div', 'lab-mem__grid');
    wrap.appendChild(hud); wrap.appendChild(grid);
    root.appendChild(wrap);

    var moves = 0, matched = 0, lock = false, first = null, total = 0;
    var timers = [];

    function best() { return +(store.get('ee_lab_mem_best') || 0); }
    function hudRender(msg) {
      hud.innerHTML =
        '<span>步數 <b>' + moves + '</b></span>' +
        '<span>最佳 <b>' + (best() || '—') + '</b></span>' +
        (msg ? '<span class="lab-mem__msg">' + msg + '</span>' : '');
    }
    function build() {
      timers.forEach(clearTimeout); timers = [];
      moves = 0; matched = 0; lock = false; first = null;
      var deck = shuffle(symbols.concat(symbols));
      total = deck.length;
      grid.innerHTML = '';
      deck.forEach(function (sym) {
        var c = el('button', 'lab-mem__card');
        c.type = 'button';
        c.innerHTML = '<span class="lab-mem__face">' + sym + '</span>';
        c.addEventListener('click', function () { flip(c, sym); });
        grid.appendChild(c);
      });
      hudRender();
    }
    function flip(c, sym) {
      if (lock || c.classList.contains('is-up') || c.classList.contains('is-done')) return;
      c.classList.add('is-up');
      if (!first) { first = { c: c, sym: sym }; return; }
      moves++; hudRender();
      if (first.sym === sym) {
        first.c.classList.add('is-done'); c.classList.add('is-done');
        first = null; matched += 2;
        if (matched === total) win();
      } else {
        lock = true;
        var a = first.c; first = null;
        timers.push(setTimeout(function () {
          a.classList.remove('is-up'); c.classList.remove('is-up'); lock = false;
        }, 680));
      }
    }
    function win() {
      var b = best();
      if (!b || moves < b) store.set('ee_lab_mem_best', moves);
      hudRender('完成！' + moves + ' 步');
      hud.appendChild(mkBtn('再來一局', build));
    }
    build();
    return function () { timers.forEach(clearTimeout); };
  }

  /* ---------- 遊戲 4：滑動拼圖（15-puzzle） ---------- */
  function puzzleGame(root) {
    var SIZE = 4, N = SIZE * SIZE;
    var solved = [];
    for (var i = 1; i < N; i++) solved.push(i);
    solved.push(0);

    var wrap = el('div', 'lab-puzzle');
    var hud = el('div', 'lab-mem__hud');
    var grid = el('div', 'lab-puzzle__grid');
    wrap.appendChild(hud); wrap.appendChild(grid);
    root.appendChild(wrap);

    var tiles = solved.slice();
    var moves = 0, won = false;

    function best() { return +(store.get('ee_lab_puzzle_best') || 0); }
    function neighborIdx(idx) {
      var r = Math.floor(idx / SIZE), c = idx % SIZE, res = [];
      if (r > 0) res.push(idx - SIZE);
      if (r < SIZE - 1) res.push(idx + SIZE);
      if (c > 0) res.push(idx - 1);
      if (c < SIZE - 1) res.push(idx + 1);
      return res;
    }
    function swap(a, b) { var t = tiles[a]; tiles[a] = tiles[b]; tiles[b] = t; }
    function isSolved() {
      for (var i2 = 0; i2 < N; i2++) if (tiles[i2] !== solved[i2]) return false;
      return true;
    }
    function shuffleBoard() {
      tiles = solved.slice();
      var blank = N - 1, lastBlank = -1;
      for (var k = 0; k < 300; k++) {
        var opts = neighborIdx(blank).filter(function (x) { return x !== lastBlank; });
        var pick = opts[Math.floor(Math.random() * opts.length)];
        swap(pick, blank); lastBlank = blank; blank = pick;
      }
      moves = 0; won = false;
    }
    function hudRender() {
      hud.innerHTML =
        '<span>步數 <b>' + moves + '</b></span>' +
        '<span>最佳 <b>' + (best() || '—') + '</b></span>' +
        (won ? '<span class="lab-mem__msg">完成！' + moves + ' 步</span>' : '');
      hud.appendChild(mkBtn('打亂重來', start));
    }
    function render() {
      grid.innerHTML = '';
      tiles.forEach(function (v, idx) {
        var c = el('button', 'lab-puzzle__cell' + (v === 0 ? ' is-blank' : ''));
        c.type = 'button';
        if (v !== 0) c.textContent = v;
        c.addEventListener('click', function () { tryMove(idx); });
        grid.appendChild(c);
      });
      hudRender();
    }
    function tryMove(idx) {
      if (won) return;
      var blank = tiles.indexOf(0);
      if (neighborIdx(blank).indexOf(idx) === -1) return;
      swap(idx, blank); moves++;
      if (isSolved()) {
        won = true;
        var b = best();
        if (!b || moves < b) store.set('ee_lab_puzzle_best', moves);
      }
      render();
    }
    function start() { shuffleBoard(); render(); }
    start();
    return null;
  }

  /* ---------- 遊戲 5：2048（方塊有身分、會真的滑過去，合併時彈一下） ---------- */
  function game2048(root) {
    var SIZE = 4;
    var SLIDE_MS = 130; // 要跟 CSS .lab-2048__tile 的 transition 時間對齊

    var wrap = el('div', 'lab-2048');
    wrap.tabIndex = 0;
    var hud = el('div', 'lab-mem__hud');
    var boardEl = el('div', 'lab-2048__board');
    var gridLayer = el('div', 'lab-2048__grid');
    for (var s = 0; s < SIZE * SIZE; s++) gridLayer.appendChild(el('div', 'lab-2048__socket'));
    var tileLayer = el('div', 'lab-2048__tiles');
    var overlay = el('div', 'lab-2048__overlay');
    overlay.hidden = true;
    boardEl.appendChild(gridLayer); boardEl.appendChild(tileLayer); boardEl.appendChild(overlay);
    var note = el('div', 'lab-2048__note');
    note.textContent = '點一下畫面，再用方向鍵移動（手機直接滑動）';
    wrap.appendChild(hud); wrap.appendChild(boardEl); wrap.appendChild(note);
    root.appendChild(wrap);

    var board;    // 16 格，每格是 {id,value} 或 null —— 有身分，滑動時沿用同一個 DOM 元素
    var tileEls;  // id -> .lab-2048__tile 元素
    var nextId, score, over, won;
    var busy = false; // 有合併還沒收尾時鎖住輸入，避免連按時 board 跟 DOM 對不上
    var pendingFinish = null;

    function best() { return +(store.get('ee_lab_2048_best') || 0); }
    function hudRender() {
      hud.innerHTML = '<span>分數 <b>' + score + '</b></span><span>最佳 <b>' + Math.max(best(), score) + '</b></span>';
      hud.appendChild(mkBtn('重新開始', start));
    }
    function updateOverlay() {
      if (over) {
        overlay.hidden = false;
        overlay.innerHTML = '<strong>遊戲結束</strong><span>分數 ' + score + '</span>';
        overlay.appendChild(mkBtn('再玩一次', start));
      } else if (won) {
        overlay.hidden = false;
        overlay.innerHTML = '<strong>湊到 2048 了 🎉</strong><span>可以繼續玩到滿版</span>';
        overlay.appendChild(mkBtn('繼續玩', function () { won = false; overlay.hidden = true; }));
      } else {
        overlay.hidden = true;
      }
    }

    function idxRC(idx) { return { r: Math.floor(idx / SIZE), c: idx % SIZE }; }
    function makeTileEl(idx, value, isMerge) {
      var rc = idxRC(idx);
      var t = el('div', 'lab-2048__tile');
      t.style.setProperty('--r', rc.r); t.style.setProperty('--c', rc.c);
      var inner = el('div', 'lab-2048__tile-inner v-' + value + (isMerge ? ' is-merge' : ''));
      inner.textContent = value;
      t.appendChild(inner);
      tileLayer.appendChild(t);
      return t;
    }
    function moveTileEl(elm, idx) {
      var rc = idxRC(idx);
      elm.style.setProperty('--r', rc.r); elm.style.setProperty('--c', rc.c);
    }
    function removeTileEl(id) {
      var elm = tileEls[id];
      if (elm && elm.parentNode) elm.parentNode.removeChild(elm);
      delete tileEls[id];
    }

    function spawnTile() {
      var empties = [];
      board.forEach(function (t, i2) { if (!t) empties.push(i2); });
      if (!empties.length) return null;
      var idx = empties[Math.floor(Math.random() * empties.length)];
      var value = Math.random() < 0.9 ? 2 : 4;
      var tile = { id: nextId++, value: value };
      board[idx] = tile;
      tileEls[tile.id] = makeTileEl(idx, value, false);
      return tile;
    }
    function buildLineGroups(dir) {
      var groups = [];
      if (dir === 'left' || dir === 'right') {
        for (var r = 0; r < SIZE; r++) {
          var idxs = []; for (var c = 0; c < SIZE; c++) idxs.push(r * SIZE + c);
          groups.push({ idxs: idxs, reverse: dir === 'right' });
        }
      } else {
        for (var c2 = 0; c2 < SIZE; c2++) {
          var idxs2 = []; for (var r2 = 0; r2 < SIZE; r2++) idxs2.push(r2 * SIZE + c2);
          groups.push({ idxs: idxs2, reverse: dir === 'down' });
        }
      }
      return groups;
    }
    // 處理一條 row／col：把非空的方塊往目的地擠、相鄰同值的合併一次
    function collapseLine(idxs, reverse) {
      var order = idxs.slice();
      if (reverse) order.reverse();
      var src = [];
      order.forEach(function (idx) { if (board[idx]) src.push({ tile: board[idx], fromIdx: idx }); });

      var placed = [], changed = false, i2 = 0, outPos = 0;
      while (i2 < src.length) {
        var cur = src[i2];
        var destIdx = order[outPos];
        if (i2 + 1 < src.length && src[i2 + 1].tile.value === cur.tile.value) {
          var b = src[i2 + 1];
          var merged = { id: nextId++, value: cur.tile.value * 2 };
          placed.push({ toIdx: destIdx, tile: merged, isMerge: true, fromA: cur, fromB: b });
          changed = true;
          i2 += 2;
        } else {
          placed.push({ toIdx: destIdx, tile: cur.tile, isMerge: false, fromA: cur });
          if (cur.fromIdx !== destIdx) changed = true;
          i2 += 1;
        }
        outPos++;
      }
      return { placed: placed, changed: changed };
    }
    function move(dir) {
      if (over || busy) return;
      var allPlaced = [], anyChange = false, gained = 0;
      buildLineGroups(dir).forEach(function (g) {
        var res = collapseLine(g.idxs, g.reverse);
        if (res.changed) anyChange = true;
        res.placed.forEach(function (p) { if (p.isMerge) gained += p.tile.value; allPlaced.push(p); });
      });
      if (!anyChange) return;

      var newBoard = new Array(SIZE * SIZE).fill(null);
      var merges = [];
      allPlaced.forEach(function (p) {
        newBoard[p.toIdx] = p.tile;
        if (p.isMerge) {
          merges.push(p);
          moveTileEl(tileEls[p.fromA.tile.id], p.toIdx);
          moveTileEl(tileEls[p.fromB.tile.id], p.toIdx);
        } else if (p.fromA.fromIdx !== p.toIdx) {
          moveTileEl(tileEls[p.fromA.tile.id], p.toIdx);
        }
      });
      board = newBoard;
      score += gained;
      if (score > best()) store.set('ee_lab_2048_best', score);

      var finish = function () {
        merges.forEach(function (p) {
          removeTileEl(p.fromA.tile.id);
          removeTileEl(p.fromB.tile.id);
          tileEls[p.tile.id] = makeTileEl(p.toIdx, p.tile.value, true);
          if (p.tile.value === 2048) won = true;
        });
        spawnTile();
        if (!won && isGameOver()) over = true;
        busy = false;
        hudRender();
        updateOverlay();
      };
      // 有合併的話，先讓方塊滑到定位再換成合體方塊；這段期間鎖住輸入，
      // 免得連按時 board（邏輯狀態）已經改了，但合併後的新方塊 DOM 還沒生出來。
      if (merges.length) { busy = true; pendingFinish = setTimeout(finish, SLIDE_MS); } else finish();
    }
    function isGameOver() {
      for (var i2 = 0; i2 < board.length; i2++) if (!board[i2]) return false;
      for (var i3 = 0; i3 < board.length; i3++) {
        var r = Math.floor(i3 / SIZE), c = i3 % SIZE, v = board[i3].value;
        if (c < SIZE - 1 && board[i3 + 1].value === v) return false;
        if (r < SIZE - 1 && board[i3 + SIZE].value === v) return false;
      }
      return true;
    }
    function start() {
      board = new Array(SIZE * SIZE).fill(null);
      tileEls = {};
      nextId = 1; score = 0; over = false; won = false;
      tileLayer.innerHTML = '';
      spawnTile(); spawnTile();
      hudRender();
      updateOverlay();
      wrap.focus();
    }
    function onKey(e) {
      var map = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };
      if (map[e.key]) { e.preventDefault(); move(map[e.key]); }
    }
    var touchX = 0, touchY = 0;
    function onTouchStart(e) { var t = e.changedTouches[0]; touchX = t.clientX; touchY = t.clientY; }
    function onTouchEnd(e) {
      var t = e.changedTouches[0];
      var dx = t.clientX - touchX, dy = t.clientY - touchY;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
      if (Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? 'right' : 'left');
      else move(dy > 0 ? 'down' : 'up');
    }
    function onWrapClick() { wrap.focus(); }
    wrap.addEventListener('keydown', onKey);
    wrap.addEventListener('touchstart', onTouchStart, { passive: true });
    wrap.addEventListener('touchend', onTouchEnd, { passive: true });
    wrap.addEventListener('click', onWrapClick);

    start();
    return function () {
      clearTimeout(pendingFinish);
      wrap.removeEventListener('keydown', onKey);
      wrap.removeEventListener('touchstart', onTouchStart);
      wrap.removeEventListener('touchend', onTouchEnd);
      wrap.removeEventListener('click', onWrapClick);
    };
  }

  /* ---------- 遊戲 6：集點卡（示範活動集點/抽獎互動） ---------- */
  function stampGame(root) {
    var TOTAL = 8;
    var STAMP = '☕';
    var wrap = el('div', 'lab-stamp');
    var hud = el('div', 'lab-mem__hud');
    var card = el('div', 'lab-stamp__card');
    var actions = el('div', 'lab-stamp__actions');
    wrap.appendChild(hud); wrap.appendChild(card); wrap.appendChild(actions);
    root.appendChild(wrap);

    var filled = 0, full = false;

    function totalStamps() { return +(store.get('ee_lab_stamp_total') || 0); }
    function totalCards() { return +(store.get('ee_lab_stamp_cards') || 0); }
    function hudRender() {
      hud.innerHTML =
        '<span>累積蓋章 <b>' + totalStamps() + '</b></span>' +
        '<span>集滿張數 <b>' + totalCards() + '</b></span>' +
        (full ? '<span class="lab-mem__msg">這張集滿了，可以兌換！</span>' : '');
    }
    function renderCard() {
      card.innerHTML = '';
      for (var i2 = 0; i2 < TOTAL; i2++) {
        var slot = el('div', 'lab-stamp__slot' + (i2 < filled ? ' is-filled' : ''));
        if (i2 < filled) slot.textContent = STAMP;
        card.appendChild(slot);
      }
    }
    function renderActions() {
      actions.innerHTML = '';
      actions.appendChild(mkBtn(full ? '🎉 兌換並開新卡' : '蓋一個章', onTap));
    }
    function onTap() {
      if (full) {
        filled = 0; full = false;
        renderCard(); renderActions(); hudRender();
        return;
      }
      filled++;
      store.set('ee_lab_stamp_total', totalStamps() + 1);
      if (filled >= TOTAL) {
        full = true;
        store.set('ee_lab_stamp_cards', totalCards() + 1);
      }
      renderCard(); renderActions(); hudRender();
    }
    hudRender(); renderCard(); renderActions();
    return null;
  }

  /* ---------- 遊戲 7：服務測驗（你適合找我們做哪個服務？） ---------- */
  function quizGame(root) {
    var ORDER = ['web', 'game', 'design', 'data'];
    var QUESTIONS = [
      {
        q: '你現在最頭痛的是？',
        opts: [
          { t: '沒有一個像樣的官網，客人常常找不到我們', k: 'web' },
          { t: '想辦活動、辦抽獎，但沒有能讓人「玩」的東西', k: 'game' },
          { t: '東西都有，就是看起來很陽春、不好看', k: 'design' },
          { t: '不知道客人到底是誰、從哪裡來的', k: 'data' }
        ]
      },
      {
        q: '如果只能用一句話形容你現在最需要的，你會說？',
        opts: [
          { t: '一個能一直用、好維護的系統', k: 'web' },
          { t: '讓人玩過就記得我們', k: 'game' },
          { t: '拍出來、貼出去的東西要有質感', k: 'design' },
          { t: '能用數字說服自己（或老闆）的依據', k: 'data' }
        ]
      },
      {
        q: '你比較常聽到誰在抱怨？',
        opts: [
          { t: '「你們網站是不是壞了，打不開」', k: 'web' },
          { t: '「辦了活動，但好像都沒人理」', k: 'game' },
          { t: '「你們 IG 每次風格都不一樣」', k: 'design' },
          { t: '「哪個廣告有效，我們自己也不知道」', k: 'data' }
        ]
      },
      {
        q: '預算有限，你會優先花在？',
        opts: [
          { t: '把線上下單／預約流程弄順', k: 'web' },
          { t: '做一個好玩的互動吸引人潮', k: 'game' },
          { t: '統一視覺，讓人一眼認出我們', k: 'design' },
          { t: '先搞懂客群，再決定怎麼花錢', k: 'data' }
        ]
      },
      {
        q: '半年後，你最想聽到客人說什麼？',
        opts: [
          { t: '「你們網站用起來好順」', k: 'web' },
          { t: '「上次那個活動我還記得，超好玩」', k: 'game' },
          { t: '「你們品牌很好認、很有質感」', k: 'design' },
          { t: '「你們很懂我們要什麼」', k: 'data' }
        ]
      }
    ];
    var RESULTS = {
      web: {
        tag: '01', title: '客製化網站開發',
        desc: '你需要的是一個前後端都撐得住的系統 —— 品牌官網、點餐／預約流程、後台金流，一次做對，之後改字改圖不求人。'
      },
      game: {
        tag: '02', title: '互動小遊戲製作',
        desc: '你需要的是讓人「玩過就記得」的東西 —— 活動抽獎、集點互動，順便留下名單跟數據。'
      },
      design: {
        tag: '03', title: '視覺美編與後續服務',
        desc: '你需要的是統一、有質感的視覺 —— 介面設計、品牌素材，上線後也持續幫你優化，不是做完就消失。'
      },
      data: {
        tag: '04', title: '客群數據分析',
        desc: '你需要的是先看懂客人 —— 誰來、從哪來、為什麼離開，用數據找到對的人，再決定怎麼花行銷預算。'
      }
    };

    var wrap = el('div', 'lab-quiz');
    root.appendChild(wrap);

    var idx = 0;
    var scores = { web: 0, game: 0, design: 0, data: 0 };

    function render() {
      wrap.innerHTML = '';
      if (idx < QUESTIONS.length) renderQuestion(); else renderResult();
    }
    function renderQuestion() {
      var q = QUESTIONS[idx];
      var progress = el('div', 'lab-quiz__progress');
      progress.textContent = '第 ' + (idx + 1) + ' / ' + QUESTIONS.length + ' 題';
      var bar = el('div', 'lab-quiz__bar');
      var fill = el('div', 'lab-quiz__bar-fill');
      fill.style.width = Math.round((idx / QUESTIONS.length) * 100) + '%';
      bar.appendChild(fill);
      var qEl = el('div', 'lab-quiz__q');
      qEl.textContent = q.q;
      var opts = el('div', 'lab-quiz__opts');
      q.opts.forEach(function (o) {
        var b = el('button', 'lab-quiz__opt');
        b.type = 'button';
        b.textContent = o.t;
        b.addEventListener('click', function () {
          scores[o.k]++; idx++; render();
        });
        opts.appendChild(b);
      });
      wrap.appendChild(progress);
      wrap.appendChild(bar);
      wrap.appendChild(qEl);
      wrap.appendChild(opts);
    }
    function renderResult() {
      var best = ORDER[0], bestScore = -1;
      ORDER.forEach(function (k) { if (scores[k] > bestScore) { bestScore = scores[k]; best = k; } });
      var r = RESULTS[best];
      var box = el('div', 'lab-quiz__result');
      box.innerHTML =
        '<span class="lab-quiz__result-no">' + r.tag + '</span>' +
        '<div class="lab-quiz__result-label">你適合找我們做</div>' +
        '<h3 class="lab-quiz__result-title">' + r.title + '</h3>' +
        '<p class="lab-quiz__result-desc">' + r.desc + '</p>';
      var actions = el('div', 'lab-quiz__result-actions');
      var cta = document.createElement('a');
      cta.className = 'lab-btn'; cta.href = '#contact'; cta.textContent = '跟我們聊聊這個 →';
      var again = mkBtn('重新測一次', function () {
        idx = 0; scores = { web: 0, game: 0, design: 0, data: 0 }; render();
      });
      again.classList.add('lab-quiz__retry');
      actions.appendChild(cta);
      actions.appendChild(again);
      wrap.appendChild(box);
      wrap.appendChild(actions);
    }

    render();
    return null;
  }

  /* ---------- 遊戲 8：好友默契測驗（自己出題，生連結傳給朋友猜） ---------- */
  function friendGame(root) {
    var wrap = el('div', 'lab-quiz lab-friend');
    root.appendChild(wrap);

    var payload = getFriendPayload();
    if (payload) runGuess(payload); else runIntro();

    function renderQuestionInto(container, progressText, q, idx, onPick) {
      var progress = el('div', 'lab-quiz__progress'); progress.textContent = progressText;
      var bar = el('div', 'lab-quiz__bar');
      var fill = el('div', 'lab-quiz__bar-fill');
      fill.style.width = Math.round((idx / FRIEND_QUESTIONS.length) * 100) + '%';
      bar.appendChild(fill);
      var qEl = el('div', 'lab-quiz__q'); qEl.textContent = q.q;
      var opts = el('div', 'lab-quiz__opts');
      q.opts.forEach(function (t, i) {
        var b = el('button', 'lab-quiz__opt'); b.type = 'button'; b.textContent = t;
        b.addEventListener('click', function () { onPick(i); });
        opts.appendChild(b);
      });
      container.appendChild(progress);
      container.appendChild(bar);
      container.appendChild(qEl);
      container.appendChild(opts);
    }

    function runIntro() {
      wrap.innerHTML = '';
      var box = el('div', 'lab-friend__panel');
      box.innerHTML =
        '<div class="lab-friend__eyebrow">好友默契測驗</div>' +
        '<h3 class="lab-quiz__result-title">出一份關於你的題，傳給朋友猜</h3>' +
        '<p class="lab-quiz__result-desc">回答 ' + FRIEND_QUESTIONS.length + ' 題，我們生一個專屬連結給你。' +
        '朋友點開連結、憑直覺猜你的答案，答完馬上看到默契值。整個測驗都在瀏覽器裡跑，答案就藏在連結裡，沒有伺服器另外存起來。</p>';
      box.appendChild(mkBtn('開始出題', function () { runCreate(0, []); }));
      wrap.appendChild(box);
    }

    function runCreate(idx, answers) {
      wrap.innerHTML = '';
      if (idx >= FRIEND_QUESTIONS.length) { runNamePrompt(answers); return; }
      renderQuestionInto(wrap, '出題中 · 第 ' + (idx + 1) + ' / ' + FRIEND_QUESTIONS.length + ' 題', FRIEND_QUESTIONS[idx], idx, function (choice) {
        runCreate(idx + 1, answers.concat([choice]));
      });
    }

    function runNamePrompt(answers) {
      wrap.innerHTML = '';
      var box = el('div', 'lab-friend__panel');
      box.innerHTML =
        '<div class="lab-friend__eyebrow">最後一步</div>' +
        '<h3 class="lab-quiz__result-title">怎麼稱呼你？</h3>' +
        '<p class="lab-quiz__result-desc">朋友點開連結時，會看到「OOO 想知道你多了解他」。</p>';
      var input = document.createElement('input');
      input.className = 'lab-friend__input'; input.maxLength = 12; input.placeholder = '你的名字或暱稱';
      box.appendChild(input);
      box.appendChild(mkBtn('產生連結', function () {
        var name = (input.value || '').trim().slice(0, 12) || '朋友';
        runShare(name, answers);
      }));
      wrap.appendChild(box);
    }

    function runShare(name, answers) {
      wrap.innerHTML = '';
      var code = encodeFriendPayload(name, answers);
      var url = location.origin + location.pathname + '?' + FRIEND_PARAM + '=' + code + '#lab';

      var box = el('div', 'lab-friend__panel');
      box.innerHTML =
        '<div class="lab-friend__eyebrow">連結好了</div>' +
        '<h3 class="lab-quiz__result-title">傳給朋友，看他多了解你</h3>' +
        '<p class="lab-quiz__result-desc">點開連結會直接進入猜題，朋友不用另外找分頁。</p>';

      var row = el('div', 'lab-friend__linkrow');
      var input = document.createElement('input');
      input.className = 'lab-friend__input'; input.readOnly = true; input.value = url;
      input.addEventListener('click', function () { input.select(); });
      row.appendChild(input);

      var hasShare = !!navigator.share;
      var shareBtn = mkBtn(hasShare ? '分享連結' : '複製連結', function () {
        if (hasShare) {
          navigator.share({ title: name + ' 的好友默契測驗', text: name + ' 想知道你多了解他／她，來測測看！', url: url }).catch(function () {});
        } else {
          copyText(url).then(function (ok) {
            shareBtn.textContent = ok ? '已複製 ✓' : '請手動選取複製';
            setTimeout(function () { shareBtn.textContent = '複製連結'; }, 1600);
          });
        }
      });
      row.appendChild(shareBtn);
      box.appendChild(row);

      var again = mkBtn('重新出一份', function () { runIntro(); });
      again.classList.add('lab-quiz__retry');
      box.appendChild(again);
      wrap.appendChild(box);
    }

    function runGuess(data) { guessStep(data, 0, []); }
    function guessStep(data, idx, guesses) {
      wrap.innerHTML = '';
      if (idx >= FRIEND_QUESTIONS.length) { runScore(data, guesses); return; }
      if (idx === 0) {
        var lead = el('div', 'lab-friend__lead');
        lead.textContent = data.n + ' 想知道你有多了解他／她 —— 憑直覺選';
        wrap.appendChild(lead);
      }
      renderQuestionInto(wrap, '第 ' + (idx + 1) + ' / ' + FRIEND_QUESTIONS.length + ' 題', FRIEND_QUESTIONS[idx], idx, function (choice) {
        guessStep(data, idx + 1, guesses.concat([choice]));
      });
    }

    function runScore(data, guesses) {
      wrap.innerHTML = '';
      var hit = 0;
      var rows = FRIEND_QUESTIONS.map(function (q, i) {
        var ok = guesses[i] === data.a[i];
        if (ok) hit++;
        return { q: q.q, mine: q.opts[guesses[i]], theirs: q.opts[data.a[i]], ok: ok };
      });
      var pct = Math.round((hit / FRIEND_QUESTIONS.length) * 100);

      var box = el('div', 'lab-friend__score');
      box.innerHTML =
        '<div class="lab-friend__eyebrow">默契結果</div>' +
        '<h3 class="lab-quiz__result-title">答對 ' + hit + ' / ' + FRIEND_QUESTIONS.length + ' 題 · 默契值 ' + pct + '%</h3>';

      var list = el('div', 'lab-friend__rows');
      rows.forEach(function (r) {
        var row = el('div', 'lab-friend__row' + (r.ok ? ' is-ok' : ' is-no'));
        row.innerHTML =
          '<span class="lab-friend__mark">' + (r.ok ? '✓' : '✗') + '</span>' +
          '<span class="lab-friend__rowtext"><b>' + r.q + '</b>你猜：' + r.mine + (r.ok ? '' : '　實際：' + r.theirs) + '</span>';
        list.appendChild(row);
      });
      box.appendChild(list);

      var actions = el('div', 'lab-quiz__result-actions');
      var again = mkBtn('換你出一題，測你的朋友 →', function () {
        try { history.replaceState(null, '', location.pathname + location.hash); } catch (e) {}
        runIntro();
      });
      actions.appendChild(again);
      box.appendChild(actions);
      wrap.appendChild(box);
    }

    return null;
  }

  /* ---------- 小工具 ---------- */
  function el(tag, cls) { var e = document.createElement(tag); if (cls) e.className = cls; return e; }
  function face(a, b) { return '<strong>' + a + '</strong>' + (b ? '<em>' + b + '</em>' : ''); }
  function now() { return (window.performance && performance.now) ? performance.now() : Date.now(); }
  function mkBtn(label, fn) {
    var b = el('button', 'lab-btn'); b.type = 'button'; b.textContent = label;
    b.addEventListener('click', fn);
    return b;
  }
  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
})();
