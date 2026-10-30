/* 主应用：页面渲染 / 学习会话 / 知识库编辑 / 导入导出 */
(function () {
  "use strict";
  var S = window.Store;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  var PAGE_META = {
    home: ["学习", "今天也要进步一点点"],
    path: ["学习路径", "跟着阶段走，不迷路"],
    lib: ["知识库", "内置 + 自建，随时可改"],
    stats: ["统计", "看得见的积累"],
    me: ["我的", "设置与数据"]
  };

  var curPage = "home";
  var libState = { domainId: "all", deckId: null, q: "" };
  var statDomain = "all";
  var pathDomain = "english";
  var homeDomain = null; // null 表示跟随 settings.activeDomain

  /* ---------- 工具 ---------- */
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function toast(msg) {
    var t = document.createElement("div");
    t.className = "toast";
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 2000);
  }
  function pct(a, b) { return b ? Math.round((a / b) * 100) : 0; }
  function mins(ms) { return Math.max(1, Math.round((ms || 0) / 60000)); }
  function domainName(id) {
    var d = S.index.domains.find(function (x) { return x.id === id; });
    return d ? d.name : "我的知识库";
  }
  function accentOf(id) {
    var d = S.index.domains.find(function (x) { return x.id === id; });
    return (d && d.accent) || "#F5A524";
  }
  function uidOf(prefix) { return S.uid(prefix); }

  /* ---------- 路由 ---------- */
  function go(page) {
    curPage = page;
    ["home", "path", "lib", "stats", "me"].forEach(function (p) {
      $("#page-" + p).classList.toggle("hidden", p !== page);
    });
    $$(".tabbar button").forEach(function (b) { b.classList.toggle("on", b.dataset.page === page); });
    $("#pageTitle").textContent = PAGE_META[page][0];
    $("#pageSub").textContent = PAGE_META[page][1];
    $("#btnSearch").classList.toggle("hidden", page === "me");
    render();
    window.scrollTo(0, 0);
  }

  function render() {
    if (curPage === "home") renderHome();
    else if (curPage === "path") renderPath();
    else if (curPage === "lib") renderLib();
    else if (curPage === "stats") renderStats();
    else renderMe();
  }

  /* ---------- 领域 chips ---------- */
  function domainChips(active, includeAll) {
    var out = "";
    if (includeAll) out += '<button class="chip' + (active === "all" ? " on" : "") + '" data-dom="all">全部</button>';
    S.index.domains.forEach(function (d) {
      out += '<button class="chip' + (active === d.id ? " on" : "") + '" data-dom="' + esc(d.id) + '">' + esc(d.name) + '</button>';
    });
    return '<div class="chips">' + out + "</div>";
  }
  function bindChips(root, cb) {
    $$(".chip[data-dom]", root).forEach(function (b) {
      b.onclick = function () { cb(b.dataset.dom); };
    });
  }

  /* ================= 首页 ================= */
  function activeHomeDomain() {
    return homeDomain || S.state.settings.activeDomain || "english";
  }

  function queueFor(domainId) {
    var did = domainId === "all" ? null : domainId;
    var due = S.dueCards(S.state.settings.dailyReview).filter(function (c) { return !did || c.domainId === did; });
    var fresh = S.newCards(did, S.state.settings.dailyNew);
    return { due: due, fresh: fresh, all: due.concat(fresh) };
  }

  function renderHome() {
    var dom = activeHomeDomain();
    var q = queueFor(dom);
    var st = S.todayStat();
    var streak = S.streak();
    var goal = S.state.settings.dailyNew;
    var dist = S.masteryDist(dom === "all" ? null : dom);
    var total = dist.reduce(function (a, b) { return a + b; }, 0);

    var html = "";
    html += '<div class="hero">' +
      '<div class="big">' + greet() + '</div>' +
      '<div class="goal">' + (dom === "all" ? "全部领域" : esc(domainName(dom))) + ' · 今日目标 ' + goal + ' 张新卡</div>' +
      '<div class="rings">' +
      '<div class="ring"><div class="num">' + q.due.length + '</div><div class="lb">待复习</div></div>' +
      '<div class="ring"><div class="num">' + q.fresh.length + '</div><div class="lb">可新学</div></div>' +
      '<div class="ring"><div class="num">' + streak + '</div><div class="lb">连续天数</div></div>' +
      '</div>' +
      '<div class="mt12"><div class="bar"><i style="width:' + pct(st.n, Math.max(1, goal)) + '%"></i></div>' +
      '<div class="tiny faint mt8">今日已新学 ' + st.n + ' / ' + goal + ' 张 · 复习 ' + st.rv + ' 张' + (st.ms ? ' · 用时约 ' + mins(st.ms) + ' 分钟' : '') + '</div></div>' +
      '</div>';

    html += domainChips(dom, true);

    html += '<button class="btn primary wide" id="btnStart"' + (q.all.length ? "" : " disabled") + '>' +
      (q.all.length ? "开始学习 · " + q.all.length + " 张" : "今日任务已完成 🎉") + '</button>';

    html += '<div class="mt16">';
    html += taskRow("🔁", "复习到期", q.due.length + " 张待复习", q.due.length ? "review" : null);
    html += taskRow("✨", "学习新卡", q.fresh.length + " 张可新学（上限 " + goal + "）", q.fresh.length ? "new" : null);
    html += taskRow("📈", "掌握进度", "已接触 " + (total - dist[0]) + " / " + total + " 张", null);
    html += "</div>";

    // 推荐分组
    var decks = S.index.decks.filter(function (d) { return dom === "all" || d.domainId === dom; })
      .map(function (d) { return { d: d, m: S.deckMastery(d.id) }; })
      .filter(function (x) { return x.m.learned < x.m.total; })
      .sort(function (a, b) { return b.m.pct - a.m.pct; }).slice(0, 3);
    if (decks.length) {
      html += '<div class="small muted mt16" style="margin-bottom:8px">继续学习</div>';
      decks.forEach(function (x) {
        html += '<div class="task" data-deck="' + esc(x.d.id) + '">' +
          '<div class="t-ic" style="background:color-mix(in srgb,' + accentOf(x.d.domainId) + ' 18%, var(--surface-2))">' + (x.d.builtin ? "📘" : "✍️") + '</div>' +
          '<div class="grow"><div class="t-title">' + esc(x.d.name) + '</div>' +
          '<div class="t-sub">' + esc(x.d.domainName) + ' · 已学 ' + x.m.pct + '%</div></div>' +
          '<div class="bar" style="width:60px"><i style="width:' + x.m.pct + '%"></i></div></div>';
      });
    }

    var host = $("#page-home");
    host.innerHTML = html;
    bindChips(host, function (id) { homeDomain = id; S.state.settings.activeDomain = id === "all" ? "english" : id; S.save(); renderHome(); });
    var bs = $("#btnStart", host);
    if (bs) bs.onclick = function () { startStudy(q.all, "今日学习 · " + (dom === "all" ? "全部" : domainName(dom))); };
    $$(".task[data-act]", host).forEach(function (b) {
      b.onclick = function () {
        var act = b.dataset.act;
        startStudy(act === "review" ? q.due : q.fresh, act === "review" ? "复习到期" : "学习新卡");
      };
    });
    $$(".task[data-deck]", host).forEach(function (b) {
      b.onclick = function () { libState.domainId = "all"; libState.deckId = b.dataset.deck; go("lib"); };
    });
  }

  function greet() {
    var h = new Date().getHours();
    if (h < 6) return "夜深了，学一点就好";
    if (h < 11) return "早上好，开始今天";
    if (h < 14) return "中午好，来一轮";
    if (h < 18) return "下午好，继续推进";
    return "晚上好，收个尾";
  }

  function taskRow(em, title, sub, act) {
    return '<div class="task"' + (act ? ' data-act="' + act + '"' : '') + '>' +
      '<div class="t-ic">' + em + '</div>' +
      '<div class="grow"><div class="t-title">' + title + '</div><div class="t-sub">' + sub + '</div></div>' +
      (act ? '<span class="badge">开始 ›</span>' : '') + '</div>';
  }

  /* ================= 路径 ================= */
  function renderPath() {
    var dom = pathDomain;
    var stages = S.PATHS[dom] || [];
    var html = domainChips(dom, false);
    if (!stages.length) {
      html += '<div class="empty"><div class="em">🧭</div>这个领域还没有内置学习路径<br><span class="small">可在知识库里自建分组来组织内容</span></div>';
      var host0 = $("#page-path");
      host0.innerHTML = html;
      bindChips(host0, function (id) { pathDomain = id; renderPath(); });
      return;
    }
    var order = S.pathDeckOrder(dom);
    stages.forEach(function (st, si) {
      var dm = st.decks.map(function (id) { return S.deckMastery(id); });
      var learned = dm.reduce(function (a, b) { return a + b.learned; }, 0);
      var total = dm.reduce(function (a, b) { return a + b.total; }, 0);
      var p = pct(learned, total);
      var cards = [];
      st.decks.forEach(function (id) { cards = cards.concat(S.index.byDeck[id] || []); });
      var pending = cards.filter(function (c) { var pr = S.getProgress(c.id); return !pr || pr.due <= Date.now(); });
      html += '<div class="stage' + (p === 100 ? " done" : "") + '">' +
        '<div class="st-head"><div class="st-name">' + esc(st.name) + '</div>' +
        '<span class="badge">' + learned + "/" + total + '</span></div>' +
        '<div class="st-goal">' + esc(st.goal) + '</div>' +
        '<div class="bar"><i style="width:' + p + '%"></i></div>' +
        '<div class="decks mt12">' +
        st.decks.map(function (id) {
          var d = S.index.decks.find(function (x) { return x.id === id; }) || { name: id };
          var m = S.deckMastery(id);
          return '<div class="deck-line" data-deck="' + esc(id) + '">' +
            '<span class="nm">' + esc(d.name) + '</span>' +
            '<div class="bar"><i style="width:' + m.pct + '%"></i></div>' +
            '<span class="pc">' + m.pct + '%</span></div>';
        }).join("") +
        '</div>' +
        '<button class="btn wide mt12" data-study="' + si + '"' + (pending.length ? "" : " disabled") + '>' +
        (pending.length ? "学习本阶段 · " + pending.length + " 张" : "本阶段已排满复习 ✓") + '</button>' +
        '</div>';
    });
    var host = $("#page-path");
    host.innerHTML = html;
    bindChips(host, function (id) { pathDomain = id; renderPath(); });
    $$("[data-study]", host).forEach(function (b) {
      b.onclick = function () {
        var st = stages[+b.dataset.study];
        var cards = [];
        st.decks.forEach(function (id) { cards = cards.concat(S.index.byDeck[id] || []); });
        cards = cards.filter(function (c) { var pr = S.getProgress(c.id); return !pr || pr.due <= Date.now(); });
        // 复习优先
        cards.sort(function (a, b2) {
          var pa = S.getProgress(a.id) ? 1 : 0, pb = S.getProgress(b2.id) ? 1 : 0;
          return pb - pa;
        });
        startStudy(cards, st.name);
      };
    });
    $$("[data-deck]", host).forEach(function (b) {
      b.onclick = function () { libState.domainId = dom; libState.deckId = b.dataset.deck; go("lib"); };
    });
  }

  /* ================= 知识库 ================= */
  function renderLib() {
    var host = $("#page-lib");
    var html = "";

    if (libState.deckId) {
      var deck = S.index.decks.find(function (d) { return d.id === libState.deckId; });
      if (!deck) { libState.deckId = null; return renderLib(); }
      var cards = (S.index.byDeck[deck.id] || []).slice();
      var m = S.deckMastery(deck.id);
      html += '<div class="row" style="margin-bottom:10px"><button class="btn ghost" id="btnBack">‹ 返回</button>' +
        '<div style="flex:1" class="small muted">' + esc(deck.domainName) + ' · ' + cards.length + ' 张 · 已学 ' + m.pct + '%</div></div>';
      html += '<div class="bar" style="margin-bottom:12px"><i style="width:' + m.pct + '%"></i></div>';
      html += '<div class="row" style="gap:8px;margin-bottom:12px">' +
        '<button class="btn" style="flex:1" id="btnStudyDeck">学习本组</button>' +
        (deck.builtin ? '' : '<button class="btn danger" id="btnDelDeck">删除分组</button>') + '</div>';
      if (libState.q) cards = cards.filter(function (c) { return (c.f + c.b).toLowerCase().indexOf(libState.q.toLowerCase()) >= 0; });
      if (!cards.length) html += '<div class="empty"><div class="em">🗂</div>这里还没有卡片</div>';
      cards.forEach(function (c) {
        var mv = S.mastery(c.id);
        var label = ["未学", "学习中", "巩固中", "已掌握"][mv];
        html += '<div class="kb-card">' +
          '<div class="between"><div class="row"><span class="dot m' + mv + '"></span><span class="q">' + esc(c.f) + '</span></div>' +
          '<span class="tiny faint">' + label + (c.builtin ? "" : ' · 自建') + '</span></div>' +
          (c.b ? '<div class="a">' + esc(c.b) + '</div>' : '') +
          (c.t ? '<div class="ex">' + esc(c.t) + '</div>' : '') +
          (c.builtin ? '' : '<div class="row mt12" style="gap:8px;justify-content:flex-end">' +
            '<button class="btn ghost small" data-edit="' + esc(c.id) + '">编辑</button>' +
            '<button class="btn ghost small" data-del="' + esc(c.id) + '" style="color:var(--bad)">删除</button></div>') +
          '</div>';
      });
      host.innerHTML = html;
      $("#btnBack", host).onclick = function () { libState.deckId = null; renderLib(); };
      $("#btnStudyDeck", host).onclick = function () {
        var list = (S.index.byDeck[deck.id] || []).filter(function (c) { var p = S.getProgress(c.id); return !p || p.due <= Date.now(); });
        if (!list.length) list = (S.index.byDeck[deck.id] || []).slice();
        startStudy(list, deck.name);
      };
      var bd = $("#btnDelDeck", host);
      if (bd) bd.onclick = function () {
        if (confirm("删除分组「" + deck.name + "」及其所有卡片？")) { S.deleteDeck(deck.id); libState.deckId = null; toast("已删除"); renderLib(); }
      };
      $$("[data-edit]", host).forEach(function (b) { b.onclick = function () { openCardEditor(b.dataset.edit); }; });
      $$("[data-del]", host).forEach(function (b) {
        b.onclick = function () {
          if (confirm("删除这张卡片？")) { S.deleteCard(b.dataset.del); toast("已删除"); renderLib(); }
        };
      });
      return;
    }

    html += '<input class="search" id="kbSearch" placeholder="搜索关键词（正面 / 背面 / 分组）" value="' + esc(libState.q) + '">';
    html += domainChips(libState.domainId, true);

    if (libState.q.trim()) {
      var res = S.search(libState.q).filter(function (c) { return libState.domainId === "all" || c.domainId === libState.domainId; });
      html += '<div class="small muted" style="margin:4px 0 10px">找到 ' + res.length + ' 条</div>';
      if (!res.length) html += '<div class="empty"><div class="em">🔍</div>没有匹配的卡片</div>';
      res.forEach(function (c) {
        html += '<div class="kb-card" data-godeck="' + esc(c.deckId) + '">' +
          '<div class="between"><span class="q">' + esc(c.f) + '</span><span class="tiny faint">' + esc(c.deckName) + '</span></div>' +
          '<div class="a">' + esc(c.b) + '</div>' + (c.t ? '<div class="ex">' + esc(c.t) + '</div>' : '') + '</div>';
      });
      host.innerHTML = html;
      bindSearch(host);
      bindChips(host, function (id) { libState.domainId = id; renderLib(); });
      $$("[data-godeck]", host).forEach(function (b) { b.onclick = function () { libState.deckId = b.dataset.godeck; libState.q = ""; renderLib(); }; });
      return;
    }

    var decks = S.index.decks.filter(function (d) { return libState.domainId === "all" || d.domainId === libState.domainId; });
    decks.forEach(function (d) {
      var m = S.deckMastery(d.id);
      html += '<div class="lib-item" data-deck="' + esc(d.id) + '">' +
        '<div class="em" style="background:' + accentOf(d.domainId) + '">' + esc((d.name || "?").slice(0, 2)) + '</div>' +
        '<div class="grow"><div class="nm">' + esc(d.name) + '</div>' +
        '<div class="ds">' + esc(d.domainName) + ' · ' + m.total + ' 张' + (d.builtin ? "" : " · 自建") + '</div>' +
        '<div class="bar mt8"><i style="width:' + m.pct + '%"></i></div></div>' +
        '<div class="tiny muted">' + m.pct + '%</div></div>';
    });
    if (!decks.length) html += '<div class="empty"><div class="em">📚</div>还没有分组，点右上角 ＋ 新建</div>';

    host.innerHTML = html;
    bindSearch(host);
    bindChips(host, function (id) { libState.domainId = id; renderLib(); });
    $$("[data-deck]", host).forEach(function (b) { b.onclick = function () { libState.deckId = b.dataset.deck; renderLib(); }; });
  }

  function bindSearch(host) {
    var s = $("#kbSearch", host);
    if (!s) return;
    s.oninput = function () { libState.q = s.value; renderLib(); var n = $("#kbSearch"); if (n) { n.focus(); n.setSelectionRange(n.value.length, n.value.length); } };
  }

  /* ================= 统计 ================= */
  function renderStats() {
    var did = statDomain === "all" ? null : statDomain;
    var dist = S.masteryDist(did);
    var total = dist.reduce(function (a, b) { return a + b; }, 0);
    var st = S.todayStat();
    var streak = S.streak();
    var sumDays = Object.keys(S.state.stats).filter(function (k) { var v = S.state.stats[k]; return (v.n + v.rv) > 0; }).length;

    var html = domainChips(statDomain, true);
    html += '<div class="grid2">' +
      '<div class="stat-mini"><div class="n" style="color:var(--gold)">' + streak + '</div><div class="l">连续打卡（天）</div></div>' +
      '<div class="stat-mini"><div class="n">' + (st.n + st.rv) + '</div><div class="l">今日学习（张）</div></div>' +
      '<div class="stat-mini"><div class="n">' + sumDays + '</div><div class="l">累计学习（天）</div></div>' +
      '<div class="stat-mini"><div class="n">' + (total - dist[0]) + '</div><div class="l">已接触（张）</div></div>' +
      '</div>';

    // 热力图
    html += '<div class="card mt16"><div class="between"><b>学习热力图</b><span class="tiny faint">近 12 周</span></div>' +
      '<div class="heat mt12">' + heatCells() + '</div>' +
      '<div class="legend"><span><b style="background:var(--surface-2)"></b>未学习</span>' +
      '<span><b style="background:color-mix(in srgb,var(--accent) 30%,var(--surface-2))"></b>少量</span>' +
      '<span><b style="background:var(--accent)"></b>达标</span>' +
      '<span><b style="background:var(--accent-2)"></b>超额</span></div></div>';

    // 近 14 天
    html += '<div class="card"><div class="between"><b>近 14 天学习量</b><span class="tiny faint">张 / 天</span></div>' +
      '<div class="chart">' + bars14() + '</div></div>';

    // 掌握度
    var labels = ["未学习", "学习中", "巩固中", "已掌握"];
    var colors = ["var(--faint)", "var(--bad)", "var(--warn)", "var(--ok)"];
    html += '<div class="card"><div class="between"><b>掌握度分布</b><span class="tiny faint">共 ' + total + ' 张</span></div>' +
      '<div class="mt12" style="display:flex;height:10px;border-radius:999px;overflow:hidden;background:var(--surface-2)">' +
      dist.map(function (n, i) { return '<i style="width:' + pct(n, total) + '%;background:' + colors[i] + '"></i>'; }).join("") +
      '</div><div class="legend">' +
      dist.map(function (n, i) { return '<span><b style="background:' + colors[i] + '"></b>' + labels[i] + ' ' + n + '</span>'; }).join("") +
      '</div></div>';

    // 分组掌握度
    var decks = S.index.decks.filter(function (d) { return !did || d.domainId === did; })
      .map(function (d) { return { d: d, m: S.deckMastery(d.id) }; })
      .sort(function (a, b) { return b.m.pct - a.m.pct; });
    if (decks.length) {
      html += '<div class="card"><b>分组掌握度</b><div class="mt12">' +
        decks.map(function (x) {
          return '<div class="deck-line" style="margin-bottom:9px"><span class="nm">' + esc(x.d.name) + '</span>' +
            '<div class="bar" style="flex:1"><i style="width:' + x.m.pct + '%"></i></div>' +
            '<span class="pc">' + x.m.pct + '%</span></div>';
        }).join("") + '</div></div>';
    }

    var host = $("#page-stats");
    host.innerHTML = html;
    bindChips(host, function (id) { statDomain = id; renderStats(); });
  }

  function heatCells() {
    var out = "";
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var start = new Date(today);
    start.setDate(start.getDate() - (today.getDay() + 77)); // 回到 11 周前的周日
    var d = new Date(start);
    for (var i = 0; i < 84; i++) {
      var k = S.dayKey(d.getTime());
      var v = S.state.stats[k];
      var n = v ? (v.n + v.rv) : 0;
      var lv = n === 0 ? 0 : n < 5 ? 1 : n < 15 ? 2 : n < 30 ? 3 : 4;
      var future = d > today;
      out += '<i class="' + (lv ? "l" + lv : "") + '" title="' + k + " · " + n + ' 张"' +
        (future ? ' style="opacity:.3"' : '') + '></i>';
      d.setDate(d.getDate() + 1);
    }
    return out;
  }

  function bars14() {
    var out = "";
    var d = new Date();
    for (var i = 13; i >= 0; i--) {
      var dd = new Date(); dd.setDate(d.getDate() - i);
      var k = S.dayKey(dd.getTime());
      var v = S.state.stats[k];
      var n = v ? (v.n + v.rv) : 0;
      var max = 1;
      for (var j = 0; j < 14; j++) {
        var t2 = new Date(); t2.setDate(d.getDate() - j);
        var v2 = S.state.stats[S.dayKey(t2.getTime())];
        if (v2) max = Math.max(max, v2.n + v2.rv);
      }
      out += '<div class="col" title="' + k + " · " + n + '"><i style="height:' + Math.max(3, Math.round((n / max) * 84)) + 'px"></i>' +
        '<span>' + (dd.getMonth() + 1) + "/" + dd.getDate() + '</span></div>';
    }
    return out;
  }

  /* ================= 我的 ================= */
  function renderMe() {
    var s = S.state.settings;
    var myCards = S.state.custom.length;
    var html = "";

    html += '<div class="card"><b>每日目标</b>' +
      '<div class="list-row"><div><div>每日新卡上限</div><div class="tiny faint">建议 8-15 张，贪多容易断</div></div>' +
      '<div class="stepper"><button data-step="new:-5">−</button><span class="v">' + s.dailyNew + '</span><button data-step="new:5">＋</button></div></div>' +
      '<div class="list-row"><div><div>每日复习上限</div><div class="tiny faint">到期卡很多时的熔断线</div></div>' +
      '<div class="stepper"><button data-step="rev:-10">−</button><span class="v">' + s.dailyReview + '</span><button data-step="rev:10">＋</button></div></div>' +
      '</div>';

    html += '<div class="card"><b>外观</b><div class="seg mt12">' +
      '<button data-theme="dark" class="' + (s.theme === "dark" ? "on" : "") + '">深色</button>' +
      '<button data-theme="light" class="' + (s.theme === "light" ? "on" : "") + '">浅色</button>' +
      '</div></div>';

    html += '<div class="card"><b>数据</b>' +
      '<div class="small muted mt8">自建卡片 ' + myCards + ' 张 · 学习记录 ' + Object.keys(S.state.progress).length + ' 条</div>' +
      '<div class="grid2 mt12" style="gap:8px">' +
      '<button class="btn" id="expJson">导出 JSON</button>' +
      '<button class="btn" id="expMd">导出 Markdown</button>' +
      '<button class="btn" id="impBtn">导入文件</button>' +
      '<button class="btn" id="impDemo">看导入格式</button>' +
      '</div>' +
      '<div class="grid2 mt12" style="gap:8px">' +
      '<button class="btn danger" id="resetProg">重置学习进度</button>' +
      '<button class="btn danger" id="resetAll">清空全部数据</button>' +
      '</div></div>';

    html += '<div class="card"><b>关于</b>' +
      '<div class="small muted mt8">这是一个完全本地运行的学习工具：数据存在你的手机浏览器里，不上传任何服务器。</div>' +
      '<div class="small muted mt8">复习节奏基于间隔重复（SM-2 简化版）：标记「掌握」的卡片会按 1 → 3 → 7 → 17 天左右的间隔逐步拉长，标记「忘记」则会回到短间隔重新巩固。</div>' +
      '<div class="small muted mt8">提示：在浏览器菜单选择「添加到主屏幕」，即可像 App 一样使用。</div>' +
      '</div>';

    var host = $("#page-me");
    host.innerHTML = html;
    $$("[data-step]", host).forEach(function (b) {
      b.onclick = function () {
        var p = b.dataset.step.split(":");
        var key = p[0] === "new" ? "dailyNew" : "dailyReview";
        var v = S.state.settings[key] + parseInt(p[1], 10);
        S.state.settings[key] = Math.min(p[0] === "new" ? 60 : 300, Math.max(p[0] === "new" ? 5 : 20, v));
        S.save(); renderMe();
      };
    });
    $$("[data-theme]", host).forEach(function (b) {
      b.onclick = function () { setTheme(b.dataset.theme); renderMe(); };
    });
    $("#expJson", host).onclick = function () { download("learn-app-备份-" + S.todayKey() + ".json", S.exportJSON(), "application/json"); };
    $("#expMd", host).onclick = function () { download("我的知识库-" + S.todayKey() + ".md", S.exportMarkdown(), "text/markdown"); };
    $("#impBtn", host).onclick = function () { $("#fileInput").click(); };
    $("#impDemo", host).onclick = showImportFormat;
    $("#resetProg", host).onclick = function () {
      if (confirm("重置所有卡片的学习进度？知识库内容会保留。")) { S.resetProgress(); toast("已重置进度"); renderMe(); }
    };
    $("#resetAll", host).onclick = function () {
      if (confirm("清空全部数据（含自建卡片与记录）？此操作不可恢复。")) { S.resetAll(); toast("已清空"); go("home"); }
    };
  }

  function setTheme(t) {
    S.state.settings.theme = t;
    document.documentElement.dataset.theme = t;
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", t === "dark" ? "#0E1116" : "#F4F6FA");
    S.save();
  }

  function download(name, text, type) {
    var blob = new Blob([text], { type: type + ";charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
    toast("已导出 " + name);
  }

  /* ================= 学习会话 ================= */
  var sess = null;

  function startStudy(list, title) {
    if (!list || !list.length) { toast("没有可学习的卡片"); return; }
    sess = { queue: list.slice(), i: 0, flipped: false, title: title, start: Date.now(), done: [], again: 0 };
    renderStudy();
  }

  function renderStudy() {
    var root = $("#studyRoot");
    if (!sess) { root.innerHTML = ""; return; }
    if (sess.i >= sess.queue.length) return renderStudyDone();

    var c = sess.queue[sess.i];
    var left = sess.queue.length - sess.i;
    var prog = pct(sess.i, sess.queue.length);
    var mv = S.mastery(c.id);
    var label = ["未学", "学习中", "巩固中", "已掌握"][mv];

    root.innerHTML =
      '<div class="study">' +
      '<div class="study-top">' +
      '<button class="iconbtn" id="sClose">✕</button>' +
      '<div class="bar"><i style="width:' + prog + '%"></i></div>' +
      '<div class="stage-pill">' + left + ' 张</div>' +
      '</div>' +
      '<div class="tiny faint" style="margin-bottom:8px">' + esc(sess.title) + ' · ' + esc(c.deckName) + ' · <span style="color:' + ["var(--faint)", "var(--bad)", "var(--warn)", "var(--ok)"][mv] + '">' + label + '</span></div>' +
      '<div class="flipwrap"><div class="flip" id="flip"><div class="flip-inner">' +
      '<div class="face"><div class="label">Question</div><div class="front-text">' + esc(c.f) + '</div>' +
      '<div class="tap-hint">点击卡片查看答案</div></div>' +
      '<div class="face back"><div class="label">Answer</div><div class="back-text">' + esc(c.b || "（暂无内容）") + '</div>' +
      (c.t ? '<div class="ex-text">' + esc(c.t) + '</div>' : '') +
      '<div class="tap-hint">还记得起来吗？</div></div>' +
      '</div></div></div>' +
      '<div class="grades' + (sess.flipped ? "" : " hide") + '">' +
      '<button class="grade g0" data-g="0"><span class="g-em">😵</span>忘记<small>10 分钟后再来</small></button>' +
      '<button class="grade g1" data-g="1"><span class="g-em">🤔</span>模糊<small>间隔小幅延长</small></button>' +
      '<button class="grade g2" data-g="2"><span class="g-em">✅</span>掌握<small>间隔明显拉长</small></button>' +
      '</div>' +
      '</div>';

    $("#sClose", root).onclick = closeStudy;
    var flip = $("#flip", root);
    flip.onclick = function () {
      sess.flipped = !sess.flipped;
      flip.classList.toggle("show", sess.flipped);
      flip.parentNode.parentNode.querySelector(".grades").classList.toggle("hide", !sess.flipped);
    };
    $$(".grade", root).forEach(function (b) {
      b.onclick = function (e) {
        e.stopPropagation();
        grade(+b.dataset.g);
      };
    });
  }

  function grade(g) {
    var c = sess.queue[sess.i];
    var before = S.mastery(c.id);
    S.review(c.id, g);
    sess.done.push({ id: c.id, g: g, isNew: before === 0 });
    if (g === 0) {
      // 忘记的卡片在本轮末尾再出现一次
      var already = sess.queue.indexOf(c);
      if (sess.repeat !== c.id) { sess.queue.push(c); sess.repeat = c.id; }
      void already;
    }
    sess.i++;
    sess.flipped = false;
    renderStudy();
  }

  function renderStudyDone() {
    var root = $("#studyRoot");
    var n = sess.done.filter(function (x) { return x.isNew; }).length;
    var rv = sess.done.length - n;
    var forgot = sess.done.filter(function (x) { return x.g === 0; }).length;
    var ms = Date.now() - sess.start;
    S.addStudyTime(ms);
    root.innerHTML =
      '<div class="study"><div class="done-wrap">' +
      '<div class="done-em">' + (forgot > 3 ? "💪" : "🎉") + '</div>' +
      '<h2>这一轮完成</h2>' +
      '<div class="small muted">' + esc(sess.title) + '</div>' +
      '<div class="done-stats">' +
      '<div class="stat-mini"><div class="n">' + n + '</div><div class="l">新学</div></div>' +
      '<div class="stat-mini"><div class="n">' + rv + '</div><div class="l">复习</div></div>' +
      '<div class="stat-mini"><div class="n" style="color:var(--bad)">' + forgot + '</div><div class="l">忘记</div></div>' +
      '</div>' +
      '<div class="small faint">用时约 ' + mins(ms) + ' 分钟</div>' +
      '<div style="width:100%;display:grid;gap:10px;margin-top:18px">' +
      (forgot ? '<button class="btn primary wide" id="againBtn">再练一次忘记的 ' + Math.min(forgot, 20) + ' 张</button>' : '') +
      '<button class="btn wide" id="finishBtn">完成，回到首页</button>' +
      '</div></div></div>';
    $("#finishBtn", root).onclick = function () { sess = null; root.innerHTML = ""; go("home"); };
    var ab = $("#againBtn", root);
    if (ab) ab.onclick = function () {
      var ids = sess.done.filter(function (x) { return x.g === 0; }).map(function (x) { return x.id; }).slice(0, 20);
      var list = ids.map(function (id) { return S.index.byId[id]; }).filter(Boolean);
      sess = null;
      startStudy(list, "巩固忘记的卡片");
    };
  }

  function closeStudy() {
    if (sess) S.addStudyTime(Date.now() - sess.start);
    sess = null;
    $("#studyRoot").innerHTML = "";
    render();
  }

  /* ================= 弹层 ================= */
  function openSheet(html) {
    var root = $("#sheetRoot");
    root.innerHTML = '<div class="sheet-mask"><div class="sheet">' + html + '</div></div>';
    $(".sheet-mask", root).onclick = function (e) { if (e.target === this) closeSheet(); };
  }
  function closeSheet() { $("#sheetRoot").innerHTML = ""; }

  function openCardEditor(cardId) {
    var card = cardId ? S.index.byId[cardId] : null;
    var curDeck = card ? card.deckId : (libState.deckId || null);
    var curDomain = card ? card.domainId : (libState.domainId !== "all" ? libState.domainId : S.index.domains[0].id);

    function deckOptions(dom) {
      var out = S.index.decks.filter(function (d) { return d.domainId === dom; })
        .map(function (d) { return '<option value="' + esc(d.id) + '"' + (d.id === curDeck ? " selected" : "") + '>' + esc(d.name) + '</option>'; }).join("");
      return out + '<option value="__new__">＋ 新建分组…</option>';
    }
    var domainOptions = S.index.domains.map(function (d) {
      return '<option value="' + esc(d.id) + '"' + (d.id === curDomain ? " selected" : "") + '>' + esc(d.name) + '</option>';
    }).join("") + '<option value="__new__">＋ 新建领域…</option>';

    openSheet(
      '<h3>' + (card ? "编辑卡片" : "新增卡片") + '</h3>' +
      '<div class="field"><label>正面（问题 / 词语）</label><textarea id="fFront" placeholder="例如：什么是北极星指标">' + esc(card ? card.f : "") + '</textarea></div>' +
      '<div class="field"><label>背面（答案 / 释义）</label><textarea id="fBack" placeholder="要点、判断标准、用法">' + esc(card ? card.b : "") + '</textarea></div>' +
      '<div class="field"><label>补充（例句 / 例子，可留空）</label><input id="fTip" value="' + esc(card ? card.t : "") + '" placeholder="例如：Day-30 retention is our north-star metric."></div>' +
      '<div class="field"><label>领域</label><select id="fDomain">' + domainOptions + '</select></div>' +
      '<div class="field hidden" id="wrapNewDomain"><label>新领域名称</label><input id="fNewDomain" placeholder="例如：数据分析"></div>' +
      '<div class="field"><label>分组</label><select id="fDeck">' + deckOptions(curDomain) + '</select></div>' +
      '<div class="field hidden" id="wrapNewDeck"><label>新分组名称</label><input id="fNewDeck" placeholder="例如：SQL 高频考点"></div>' +
      '<div class="row" style="gap:10px;margin-top:14px">' +
      '<button class="btn" style="flex:1" id="btnCancel">取消</button>' +
      '<button class="btn primary" style="flex:2" id="btnSave">保存</button></div>' +
      '<div class="tiny faint center mt12">提示：纯文本即可，支持换行；一次写一张卡，学习时记得最牢。</div>'
    );

    var root = $("#sheetRoot");
    $("#fDomain", root).onchange = function () {
      var v = this.value;
      $("#wrapNewDomain", root).classList.toggle("hidden", v !== "__new__");
      var sel = $("#fDeck", root);
      curDeck = null;
      sel.innerHTML = deckOptions(v === "__new__" ? "__none__" : v);
      $("#wrapNewDeck", root).classList.toggle("hidden", sel.value !== "__new__");
    };
    $("#fDeck", root).onchange = function () {
      $("#wrapNewDeck", root).classList.toggle("hidden", this.value !== "__new__");
    };
    $("#btnCancel", root).onclick = closeSheet;
    $("#btnSave", root).onclick = function () {
      var f = $("#fFront", root).value.trim();
      var b = $("#fBack", root).value.trim();
      var t = $("#fTip", root).value.trim();
      if (!f) { toast("正面不能为空"); return; }
      var domSel = $("#fDomain", root).value;
      var domId, domName, deckId;
      if (domSel === "__new__") {
        domName = $("#fNewDomain", root).value.trim() || "我的知识库";
        domId = S.addDomain(domName).id;
        var ndName = $("#fNewDeck", root).value.trim();
        deckId = ndName
          ? S.addDeck(domId, ndName, domName).id
          : (S.index.decks.find(function (d) { return d.domainId === domId; }) || {}).id;
      } else {
        domId = domSel;
        domName = domainName(domId);
        var deckSel = $("#fDeck", root).value;
        deckId = deckSel === "__new__"
          ? S.addDeck(domId, $("#fNewDeck", root).value.trim() || "新分组", domName).id
          : deckSel;
      }
      if (!deckId) { toast("请先选择分组"); return; }
      if (card) S.updateCard(card.id, { f: f, b: b, t: t, deckId: deckId, domainId: domId, domainName: domName });
      else S.addCard({ f: f, b: b, t: t, deckId: deckId, domainId: domId, domainName: domName });
      closeSheet();
      toast(card ? "已保存" : "已添加");
      render();
    };
    setTimeout(function () { var f = $("#fFront", root); if (f && !card) f.focus(); }, 60);
  }

  function showImportFormat() {
    openSheet(
      '<h3>支持的导入格式</h3>' +
      '<div class="small muted"><b>1. Markdown（推荐）</b></div>' +
      '<pre class="small" style="background:var(--surface);padding:10px;border-radius:10px;overflow:auto;font-size:12px">## 分组名称\n### 正面（问题）\n背面内容，可多行\n> 补充例句（可选）\n\n### 另一个问题\n答案</pre>' +
      '<div class="small muted mt12"><b>2. CSV / TSV</b></div>' +
      '<pre class="small" style="background:var(--surface);padding:10px;border-radius:10px;overflow:auto;font-size:12px">front,back,tip\n什么是MVP,用最小成本验证关键假设,人工后台+付费按钮</pre>' +
      '<div class="small muted mt12"><b>3. JSON</b></div>' +
      '<div class="small muted">本应用导出的备份文件，可直接导入并恢复进度与自建卡片。</div>' +
      '<button class="btn primary wide mt16" id="okFmt">知道了</button>'
    );
    $("#okFmt").onclick = closeSheet;
  }

  function handleFile(file) {
    var r = new FileReader();
    r.onload = function () {
      var text = String(r.result || "");
      var parsed = S.parseImport(text);
      if (!parsed.decks || !parsed.decks.length) { toast("没能识别出可导入的内容"); return showImportFormat(); }
      var count = parsed.decks.reduce(function (a, d) { return a + d.cards.length; }, 0);
      // 目标领域
      var customDomain = S.index.domains.find(function (d) { return !d.builtin; });
      var targetId = customDomain ? customDomain.id : null;
      var opts = S.index.domains.map(function (d) {
        return '<option value="' + esc(d.id) + '"' + (d.id === targetId ? " selected" : "") + '>' + esc(d.name) + '</option>';
      }).join("");
      openSheet(
        '<h3>导入预览</h3>' +
        '<div class="small muted">识别为 <b>' + parsed.format + '</b> 格式，共 ' + parsed.decks.length + ' 个分组、' + count + ' 张卡片。</div>' +
        '<div style="max-height:180px;overflow:auto;margin:12px 0">' +
        parsed.decks.map(function (d) {
          return '<div class="small" style="margin-bottom:8px"><b>' + esc(d.name) + '</b>' +
            d.cards.slice(0, 3).map(function (c) { return '<div class="tiny faint">· ' + esc(c.f) + '</div>'; }).join("") +
            (d.cards.length > 3 ? '<div class="tiny faint">… 等 ' + d.cards.length + ' 张</div>' : '') + '</div>';
        }).join("") + '</div>' +
        '<div class="field"><label>导入到</label><select id="impTarget">' + opts + '</select></div>' +
        '<div class="row" style="gap:10px"><button class="btn" style="flex:1" id="impCancel">取消</button>' +
        '<button class="btn primary" style="flex:2" id="impOk">确认导入</button></div>'
      );
      $("#impCancel").onclick = closeSheet;
      $("#impOk").onclick = function () {
        var id = $("#impTarget").value;
        var d = S.index.domains.find(function (x) { return x.id === id; });
        var res = S.importParsed(parsed, { domainId: id, domainName: d ? d.name : "我的知识库" });
        closeSheet();
        toast("导入完成：新增 " + res.added + " 张" + (res.merged ? "，更新 " + res.merged + " 张" : ""));
        render();
      };
    };
    r.readAsText(file, "utf-8");
  }

  /* ================= 初始化 ================= */
  function init() {
    S.load();
    setTheme(S.state.settings.theme || "dark");
    $$(".tabbar button").forEach(function (b) { b.onclick = function () { go(b.dataset.page); }; });
    $("#btnAdd").onclick = function () { openCardEditor(null); };
    $("#btnSearch").onclick = function () {
      if (curPage === "lib") { var s = $("#kbSearch"); if (s) { s.focus(); return; } }
      libState.q = "";
      go("lib");
      setTimeout(function () { var s2 = $("#kbSearch"); if (s2) s2.focus(); }, 80);
    };
    $("#fileInput").onchange = function (e) {
      var f = e.target.files && e.target.files[0];
      if (f) handleFile(f);
      e.target.value = "";
    };
    go("home");
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
