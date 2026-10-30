/* 存储层：数据模型 / 间隔重复调度 / 统计 / 导入导出 */
(function () {
  "use strict";

  var KEY = "learnapp.v1";
  var DAY = 86400000;

  /* ---------- 学习路径（阶段 → deck） ---------- */
  var PATHS = {
    english: [
      { name: "阶段一 · 词汇地基", goal: "掌握职场高频词，能读懂英文邮件与文档", decks: ["en-vocab"] },
      { name: "阶段二 · 地道表达", goal: "开会与邮件中听懂、用对高频短语", decks: ["en-phrase"] },
      { name: "阶段三 · 精准语法", goal: "写作不踩常见语法坑", decks: ["en-grammar"] },
      { name: "阶段四 · 表达升级", goal: "把普通英文改写成专业英文", decks: ["en-polish"] }
    ],
    pm: [
      { name: "阶段一 · 产品认知", goal: "建立判断需求与方案价值的底层框架", decks: ["pm-basic"] },
      { name: "阶段二 · 需求与用户", goal: "把杂乱需求变成有序决策，学会做研究", decks: ["pm-req", "pm-research"] },
      { name: "阶段三 · 数据与实验", goal: "用指标和 A/B 实验验证判断", decks: ["pm-metric"] },
      { name: "阶段四 · 商业与增长", goal: "理解钱怎么赚、用户怎么长", decks: ["pm-biz"] },
      { name: "阶段五 · 落地与 AI", goal: "把方案推进上线，理解 AI 产品方法论", decks: ["pm-collab", "pm-ai"] }
    ]
  };

  /* ---------- 状态 ---------- */
  var state = null;
  var index = { cards: [], byId: {}, byDeck: {}, decks: [], domains: [] };

  function defaultState() {
    return {
      version: 1,
      settings: { theme: "dark", dailyNew: 10, dailyReview: 40, activeDomain: "english" },
      progress: {},
      stats: {},
      customDomains: [],
      customDecks: [],
      custom: [],
      createdAt: Date.now()
    };
  }

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      state = raw ? JSON.parse(raw) : defaultState();
    } catch (e) {
      state = defaultState();
    }
    if (!state.settings) state.settings = defaultState().settings;
    if (!state.progress) state.progress = {};
    if (!state.stats) state.stats = {};
    if (!state.custom) state.custom = [];
    if (!state.customDecks) state.customDecks = [];
    if (!state.customDomains) state.customDomains = [];
    buildIndex();
    return state;
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {
      console.warn("保存失败", e);
    }
  }

  /* ---------- 索引 ---------- */
  function buildIndex() {
    index = { cards: [], byId: {}, byDeck: {}, decks: [], domains: [] };
    var domains = [window.KB_ENGLISH, window.KB_PM];
    domains.forEach(function (d) {
      index.domains.push({ id: d.id, name: d.name, subtitle: d.subtitle, icon: d.icon, accent: d.accent, builtin: true });
      d.decks.forEach(function (deck) {
        index.decks.push({ id: deck.id, domainId: d.id, name: deck.name, desc: deck.desc, domainName: d.name, accent: d.accent, builtin: true });
        index.byDeck[deck.id] = [];
        deck.cards.forEach(function (c, i) {
          var card = {
            id: d.id + ":" + deck.id + ":" + i,
            f: c.f, b: c.b, t: c.t || "",
            deckId: deck.id, domainId: d.id, domainName: d.name, deckName: deck.name,
            builtin: true
          };
          index.cards.push(card);
          index.byId[card.id] = card;
          index.byDeck[deck.id].push(card);
        });
      });
    });
    // 自定义领域（用户新建的）
    (state.customDomains || []).forEach(function (d) {
      if (index.domains.some(function (x) { return x.id === d.id; })) return;
      index.domains.push({ id: d.id, name: d.name, subtitle: "自定义", icon: d.icon || "MY", accent: "#F5A524", builtin: false });
    });
    // 兼容：早期版本只有 customDecks 的情况
    (state.customDecks || []).forEach(function (d) {
      if (index.domains.some(function (x) { return x.id === d.domainId; })) return;
      index.domains.push({ id: d.domainId, name: d.domainName || "我的知识库", subtitle: "自定义", icon: "MY", accent: "#F5A524", builtin: false });
    });
    (state.customDecks || []).forEach(function (deck) {
      index.decks.push({ id: deck.id, domainId: deck.domainId, name: deck.name, desc: deck.desc || "", domainName: deck.domainName || "我的知识库", accent: "#F5A524", builtin: false });
      index.byDeck[deck.id] = [];
    });
    (state.custom || []).forEach(function (c) {
      var card = {
        id: c.id, f: c.f, b: c.b || "", t: c.t || "",
        deckId: c.deckId, domainId: c.domainId, domainName: c.domainName || "我的知识库",
        deckName: (index.decks.find(function (d) { return d.id === c.deckId; }) || {}).name || "未分组",
        builtin: false
      };
      index.cards.push(card);
      index.byId[card.id] = card;
      if (!index.byDeck[card.deckId]) index.byDeck[card.deckId] = [];
      index.byDeck[card.deckId].push(card);
    });
  }

  /* ---------- 日期 ---------- */
  function dayKey(ts) {
    var d = ts === undefined ? new Date() : new Date(ts);
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  function todayKey() { return dayKey(Date.now()); }

  /* ---------- SRS ---------- */
  function getProgress(id) {
    return state.progress[id] || null;
  }

  // 掌握度：0 未学 1 学习中 2 巩固中 3 已掌握
  function mastery(id) {
    var p = state.progress[id];
    if (!p) return 0;
    if (p.i >= 21) return 3;
    if (p.i >= 7) return 2;
    return 1;
  }

  // grade: 0 忘记 1 模糊 2 掌握
  function review(id, grade) {
    var now = Date.now();
    var p = state.progress[id] || { e: 2.5, i: 0, r: 0, l: 0, due: 0 };
    var before = mastery(id);
    if (grade === 0) {
      p.l++;
      p.r = 0;
      p.i = 0;
      p.due = now + 10 * 60 * 1000; // 10 分钟后再来
      p.e = Math.max(1.3, p.e - 0.2);
    } else if (grade === 1) {
      p.r++;
      p.i = p.i === 0 ? 1 : Math.max(1, Math.round(p.i * 1.3));
      p.e = Math.max(1.3, p.e - 0.05);
      p.due = now + p.i * DAY;
    } else {
      p.r++;
      if (p.i === 0) p.i = 1;
      else if (p.i < 3) p.i = 3;
      else p.i = Math.round(p.i * p.e);
      p.e = Math.min(2.8, p.e + 0.05);
      p.due = now + p.i * DAY;
    }
    p.last = now;
    state.progress[id] = p;

    var k = todayKey();
    var s = state.stats[k] || { n: 0, rv: 0, ms: 0 };
    if (before === 0) s.n++;   // 首次接触：计入新学
    else s.rv++;               // 再次出现：计入复习
    state.stats[k] = s;
    save();
    return p;
  }

  function addStudyTime(ms) {
    var k = todayKey();
    var s = state.stats[k] || { n: 0, rv: 0, ms: 0 };
    s.ms += ms;
    state.stats[k] = s;
  }

  function dueCards(limit) {
    var now = Date.now();
    var list = index.cards.filter(function (c) {
      var p = state.progress[c.id];
      return p && p.due && p.due <= now;
    });
    list.sort(function (a, b) { return state.progress[a.id].due - state.progress[b.id].due; });
    return limit ? list.slice(0, limit) : list;
  }

  function newCards(domainId, limit) {
    var pool = index.cards.filter(function (c) {
      if (domainId && c.domainId !== domainId) return false;
      return !state.progress[c.id];
    });
    // 按学习路径顺序
    var order = pathDeckOrder(domainId);
    pool.sort(function (a, b) {
      var oa = order.indexOf(a.deckId), ob = order.indexOf(b.deckId);
      oa = oa < 0 ? 99 : oa; ob = ob < 0 ? 99 : ob;
      return oa - ob;
    });
    return limit ? pool.slice(0, limit) : pool;
  }

  function pathDeckOrder(domainId) {
    var out = [];
    (PATHS[domainId] || []).forEach(function (st) { st.decks.forEach(function (d) { out.push(d); }); });
    // 不在路径中的 deck 追加在最后
    index.decks.forEach(function (d) {
      if (d.domainId === domainId && out.indexOf(d.id) < 0) out.push(d.id);
    });
    return out;
  }

  function todayStat() {
    return state.stats[todayKey()] || { n: 0, rv: 0, ms: 0 };
  }

  function streak() {
    var n = 0;
    var d = new Date();
    // 今天没学不算断，从今天往前找
    for (var i = 0; i < 400; i++) {
      var k = dayKey(d.getTime());
      var s = state.stats[k];
      var active = s && (s.n + s.rv) > 0;
      if (active) n++;
      else if (i > 0) break;
      else if (!active && i === 0) { /* 今天未学，继续看昨天 */ }
      d.setDate(d.getDate() - 1);
    }
    return n;
  }

  function masteryDist(domainId) {
    var dist = [0, 0, 0, 0];
    index.cards.forEach(function (c) {
      if (domainId && c.domainId !== domainId) return;
      dist[mastery(c.id)]++;
    });
    return dist;
  }

  function deckMastery(deckId) {
    var cards = index.byDeck[deckId] || [];
    if (!cards.length) return { learned: 0, total: 0, pct: 0, avg: 0 };
    var learned = 0, sum = 0;
    cards.forEach(function (c) {
      var m = mastery(c.id);
      if (m > 0) learned++;
      sum += m;
    });
    return { learned: learned, total: cards.length, pct: Math.round((learned / cards.length) * 100), avg: sum / cards.length };
  }

  /* ---------- 自定义卡片 ---------- */
  function uid(prefix) {
    return (prefix || "c") + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function addCard(data) {
    var card = {
      id: uid("c"), f: data.f, b: data.b || "", t: data.t || "",
      deckId: data.deckId, domainId: data.domainId, domainName: data.domainName || "我的知识库"
    };
    state.custom.push(card);
    save();
    buildIndex();
    return card;
  }

  function updateCard(id, data) {
    var c = state.custom.find(function (x) { return x.id === id; });
    if (!c) return null;
    c.f = data.f; c.b = data.b || ""; c.t = data.t || "";
    if (data.deckId) { c.deckId = data.deckId; c.domainId = data.domainId; c.domainName = data.domainName; }
    save();
    buildIndex();
    return c;
  }

  function deleteCard(id) {
    state.custom = state.custom.filter(function (x) { return x.id !== id; });
    delete state.progress[id];
    save();
    buildIndex();
  }

  function addDeck(domainId, name, domainName) {
    var deck = { id: uid("d"), domainId: domainId, name: name, desc: "", domainName: domainName || "我的知识库" };
    state.customDecks.push(deck);
    save();
    buildIndex();
    return deck;
  }

  function deleteDeck(deckId) {
    state.customDecks = state.customDecks.filter(function (d) { return d.id !== deckId; });
    var removed = state.custom.filter(function (c) { return c.deckId === deckId; });
    removed.forEach(function (c) { delete state.progress[c.id]; });
    state.custom = state.custom.filter(function (c) { return c.deckId !== deckId; });
    save();
    buildIndex();
  }

  function addDomain(name, icon) {
    var id = uid("dom");
    state.customDomains.push({ id: id, name: name, icon: icon || "MY" });
    state.customDecks.push({ id: uid("d"), domainId: id, name: "默认分组", desc: "", domainName: name });
    save();
    buildIndex();
    if (state.settings) state.settings.activeDomain = id;
    save();
    return { id: id, name: name, icon: icon || "MY" };
  }

  function deleteDomain(domainId) {
    var removed = state.custom.filter(function (c) { return c.domainId === domainId; });
    removed.forEach(function (c) { delete state.progress[c.id]; });
    state.custom = state.custom.filter(function (c) { return c.domainId !== domainId; });
    state.customDecks = state.customDecks.filter(function (d) { return d.domainId !== domainId; });
    state.customDomains = state.customDomains.filter(function (d) { return d.id !== domainId; });
    save();
    buildIndex();
  }

  /* ---------- 导入导出 ---------- */
  function exportJSON() {
    return JSON.stringify({
      app: "learn-app", version: 1, exportedAt: new Date().toISOString(),
      settings: state.settings, progress: state.progress, stats: state.stats,
      customDomains: state.customDomains, customDecks: state.customDecks, custom: state.custom
    }, null, 2);
  }

  function exportMarkdown() {
    var lines = ["# 我的知识库导出", "", "> 导出时间：" + new Date().toLocaleString(), ""];
    var group = {};
    state.custom.forEach(function (c) {
      var deck = (index.decks.find(function (d) { return d.id === c.deckId; }) || {});
      var title = (c.domainName || "我的知识库") + " / " + (deck.name || "未分组");
      if (!group[title]) group[title] = [];
      group[title].push(c);
    });
    Object.keys(group).forEach(function (title) {
      lines.push("## " + title, "");
      group[title].forEach(function (c) {
        lines.push("### " + c.f);
        lines.push(c.b || "");
        if (c.t) lines.push("> " + c.t);
        lines.push("");
      });
    });
    return lines.join("\n");
  }

  // 解析：Markdown（## 分组 / ### 正面 / 正文背面 / > 补充）或 CSV（front,back,tip）
  function parseImport(text) {
    var trimmed = (text || "").trim();
    if (!trimmed) return { decks: [], format: "empty" };
    if (trimmed[0] === "{" || trimmed[0] === "[") {
      try {
        var j = JSON.parse(trimmed);
        return { format: "json", json: j };
      } catch (e) { /* 继续当文本处理 */ }
    }
    var lines = trimmed.split(/\r?\n/);
    var decks = [];
    var cur = null;
    var mode = null;
    // 判断是否 CSV/TSV
    var first = lines[0] || "";
    var isCSV = /^(front|正面|q|question)?[,;\t]?(back|背面|a|answer)?[,;\t]/i.test(first) || (first.split(/[,;\t]/).length >= 2 && !/^#{1,3}\s/.test(first) && !/^###?\s/.test(first));
    if (isCSV) {
      var sep = first.indexOf("\t") >= 0 ? "\t" : (first.indexOf(";") >= 0 ? ";" : ",");
      var start = 0;
      if (/front|正面|question/i.test(first.split(sep)[0])) start = 1; // 跳过表头
      for (var i = start; i < lines.length; i++) {
        var parts = lines[i].split(sep);
        if (!parts[0] || !parts[0].trim()) continue;
        pushCard("导入分组", { f: unq(parts[0]), b: unq(parts[1] || ""), t: unq(parts[2] || "") });
      }
      return { format: "csv", decks: decks };
    }
    // Markdown
    for (var j = 0; j < lines.length; j++) {
      var ln = lines[j];
      if (/^##\s+/.test(ln)) {
        cur = { name: ln.replace(/^##\s+/, "").trim(), cards: [] };
        decks.push(cur);
        mode = null;
      } else if (/^###\s+/.test(ln)) {
        if (!cur) { cur = { name: "导入分组", cards: [] }; decks.push(cur); }
        mode = { f: ln.replace(/^###\s+/, "").trim(), b: "", t: "" };
        cur.cards.push(mode);
      } else if (/^>\s?/.test(ln)) {
        if (mode) mode.t += (mode.t ? " " : "") + ln.replace(/^>\s?/, "");
      } else if (ln.trim()) {
        if (mode) mode.b += (mode.b ? "\n" : "") + ln.trim();
      }
    }
    if (!decks.length) return { format: "unknown", decks: [] };
    return { format: "markdown", decks: decks };

    function pushCard(name, card) {
      var d = decks.find(function (x) { return x.name === name; });
      if (!d) { d = { name: name, cards: [] }; decks.push(d); }
      d.cards.push(card);
    }
    function unq(s) {
      s = (s || "").trim();
      if (s.length > 1 && ((s[0] === '"' && s[s.length - 1] === '"') || (s[0] === "'" && s[s.length - 1] === "'"))) s = s.slice(1, -1);
      return s;
    }
  }

  // 把解析结果写入（返回新增数量）
  function importParsed(parsed, target) {
    var added = 0, merged = 0;
    if (parsed.format === "json" && parsed.json) {
      var j = parsed.json;
      if (j.custom) state.custom = j.custom.concat(state.custom.filter(function (c) { return !j.custom.some(function (x) { return x.id === c.id; }); }));
      if (j.customDomains) state.customDomains = j.customDomains.concat(state.customDomains.filter(function (c) { return !j.customDomains.some(function (x) { return x.id === c.id; }); }));
      if (j.customDecks) state.customDecks = j.customDecks.concat(state.customDecks.filter(function (c) { return !j.customDecks.some(function (x) { return x.id === c.id; }); }));
      if (j.progress) Object.keys(j.progress).forEach(function (k) { if (!state.progress[k]) state.progress[k] = j.progress[k]; });
      if (j.stats) Object.keys(j.stats).forEach(function (k) {
        var a = state.stats[k] || { n: 0, rv: 0, ms: 0 }, b = j.stats[k];
        state.stats[k] = { n: Math.max(a.n, b.n || 0), rv: Math.max(a.rv, b.rv || 0), ms: Math.max(a.ms, b.ms || 0) };
      });
      save(); buildIndex();
      return { added: (j.custom || []).length, merged: 0 };
    }
    var domainId = target.domainId, domainName = target.domainName;
    parsed.decks.forEach(function (d) {
      var deck = state.customDecks.find(function (x) { return x.domainId === domainId && x.name === d.name; });
      if (!deck) deck = addDeck(domainId, d.name, domainName);
      d.cards.forEach(function (c) {
        if (!c.f) return;
        var exist = state.custom.find(function (x) { return x.deckId === deck.id && x.f === c.f; });
        if (exist) { exist.b = c.b; exist.t = c.t; merged++; }
        else { state.custom.push({ id: uid("c"), f: c.f, b: c.b || "", t: c.t || "", deckId: deck.id, domainId: domainId, domainName: domainName }); added++; }
      });
    });
    save(); buildIndex();
    return { added: added, merged: merged };
  }

  function resetAll() {
    state = defaultState();
    save();
    buildIndex();
  }

  function resetProgress() {
    state.progress = {};
    state.stats = {};
    save();
  }

  /* ---------- 搜索 ---------- */
  function search(q) {
    q = (q || "").trim().toLowerCase();
    if (!q) return [];
    return index.cards.filter(function (c) {
      return (c.f + " " + c.b + " " + c.t + " " + c.deckName + " " + c.domainName).toLowerCase().indexOf(q) >= 0;
    }).slice(0, 60);
  }

  window.Store = {
    PATHS: PATHS,
    load: load, save: save,
    get state() { return state; },
    get index() { return index; },
    dayKey: dayKey, todayKey: todayKey,
    getProgress: getProgress, mastery: mastery, review: review, addStudyTime: addStudyTime,
    dueCards: dueCards, newCards: newCards, pathDeckOrder: pathDeckOrder,
    todayStat: todayStat, streak: streak, masteryDist: masteryDist, deckMastery: deckMastery,
    addCard: addCard, updateCard: updateCard, deleteCard: deleteCard,
    addDeck: addDeck, deleteDeck: deleteDeck, addDomain: addDomain, deleteDomain: deleteDomain, uid: uid,
    exportJSON: exportJSON, exportMarkdown: exportMarkdown, parseImport: parseImport, importParsed: importParsed,
    resetAll: resetAll, resetProgress: resetProgress, search: search
  };
})();
