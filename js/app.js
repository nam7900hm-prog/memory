/* 학습 기억법 — 앱 로직
   화면: 처음(#/) · 연상 기억 수업(#/class) · 기법(#/t/id) · 레슨(#/t/id/n) · 내 기억 노트(#/notes)
   원칙: ✏️ 정리 → 🧠 저장 → 💡 꺼내기 (상단 띠에 항상 표시) */
(function () {
  "use strict";
  const T = window.TECHNIQUES, SUBJ = window.SUBJECTS, ST = window.STAGES, SETS = window.CLASS_SETS;
  const $app = document.getElementById("app");
  const $dock = document.getElementById("qr-dock");
  const $strip = document.getElementById("motto-strip");

  /* ---------- 저장 ---------- */
  const KEY = "memory-app.v1";
  const store = (() => {
    let s = {};
    try { s = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { s = {}; }
    s.done = s.done || {}; s.notes = s.notes || []; s.drafts = s.drafts || {};
    s.qr = s.qr || "small"; s.qrUrl = s.qrUrl || ""; s.classWords = s.classWords || {};
    return s;
  })();
  function save() { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) { /* 저장 불가 환경 */ } }

  /* ---------- 도우미 ---------- */
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const h = (html) => { const t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstElementChild; };
  const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const firstChar = (s) => { const t = String(s).trim(); return t ? Array.from(t)[0] : ""; };
  const markFact = (s) => esc(s).replace(/\[(.+?)\]/g, "<mark>$1</mark>");
  const techById = (id) => T.find((t) => t.id === id);
  const subj = (id) => SUBJ.find((x) => x.id === id) || { id, icon: "📘", color: "#14213d" };
  const norm = (s) => String(s || "").toLowerCase().replace(/\s+/g, "").trim();

  /* 단계 종류 → 학습 원칙 단계 */
  const STEP_META = {
    explain: { kind: "이해하기", st: ["write"] },
    gallery: { kind: "과목별 예시", st: ["write"] },
    quiz: { kind: "확인 문제", st: ["recall"] },
    order: { kind: "순서 떠올리기", st: ["store", "recall"] },
    build: { kind: "직접 만들기", st: ["store"] },
    cycle: { kind: "마무리 활동", st: ["write", "store", "recall"] },
  };
  const stageTags = (sts, kind) => `<div class="stage-tags">${sts.map((k) => `<span class="stage-tag ${k}">${ST[k].icon} ${ST[k].name}</span>`).join("")}${kind ? `<span class="stage-tag kind">${esc(kind)}</span>` : ""}</div>`;

  /* ---------- 상단 고정 띠 ---------- */
  function renderStrip(active) {
    const keys = ["write", "store", "recall"];
    $strip.innerHTML = `<div class="motto">“${esc(window.MOTTO).replace("꺼내는", "<em>꺼내는</em>")}”</div>
      <div class="stages">${keys.map((k, i) => `${i ? '<span class="stage-arrow">→</span>' : ""}<span class="stage-pill ${k} ${active && !active.includes(k) ? "dim" : ""}">${ST[k].icon} <span>${i + 1}. ${ST[k].name}</span></span>`).join("")}</div>`;
  }

  /* ---------- 라우터 ---------- */
  let cleanup = null;
  function route() {
    if (cleanup) { cleanup(); cleanup = null; }
    const parts = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
    const navKey = parts[0] || "home";
    document.querySelectorAll("[data-nav]").forEach((a) => a.classList.toggle("active", a.dataset.nav === navKey));
    $app.innerHTML = "";
    $app.style.removeProperty("--c");
    renderStrip(null);
    if (parts[0] === "t" && techById(parts[1])) {
      const tech = techById(parts[1]);
      $app.style.setProperty("--c", tech.color);
      if (parts[2] !== undefined && tech.levels[+parts[2]]) renderLesson(tech, +parts[2]);
      else renderTech(tech);
    } else if (parts[0] === "notes") renderNotes();
    else if (parts[0] === "class") renderClass(parts[1]);
    else renderHome();
    window.scrollTo(0, 0);
  }
  window.addEventListener("hashchange", route);

  /* =====================================================================
     처음 화면
     ===================================================================== */
  function renderHome() {
    const cards = T.map((t, i) => {
      const dots = t.levels.map((_, li) => `<i class="${store.done[t.id + "-" + li] ? "on" : ""}"></i>`).join("");
      return `<a class="tech-card" style="--c:${t.color}" href="#/t/${t.id}">
        <span class="num">STEP ${i + 1}</span><span class="icon">${t.icon}</span>
        <h3>${esc(t.name)}</h3><p>${esc(t.intro)}</p>
        <div class="dots" title="기초 · 중급 · 고급">${dots}</div></a>`;
    }).join("");
    const subjects = SUBJ.map((s) => `<span class="subj-chip" style="--sc:${s.color}">${s.icon} ${s.id}</span>`).join("");
    $app.append(h(`<section>
      <a class="class-banner" href="#/class">
        <span class="cb-tag">🎬 수업 시작</span>
        <span class="cb-title">연상 기억 수업</span>
        <span class="cb-sub">단어 보기 → 1차 꺼내기 → 연상으로 연결 → 머릿속으로 돌리기 → 16칸 최종 꺼내기</span>
        <span class="cb-go">들어가기 →</span>
      </a>

      <div class="hero">
        <span class="kicker">수학 · 과학 · 역사 · 사회 · 국어 · 영어</span>
        <h1 class="hero-title"><small>방법을 바꾸면 미래가 보인다</small>학습 기억법</h1>
        <p class="lead">무작정 반복하지 않고, 뇌가 좋아하는 방식으로 바꿔서 외웁니다. 세 가지 기억법을 <b>기초 → 중급 → 고급</b> 순서로 하나씩 익혀 보세요.</p>
        <div class="subj-row">${subjects}</div>
      </div>

      <div class="principle">
        <h2>“${esc(window.MOTTO)}”</h2>
        <p class="sub">모든 활동은 이 세 단계로 진행됩니다. 화면 위쪽 색 띠가 지금 어느 단계인지 알려 줘요.</p>
        <div class="cycle3">
          <div class="write"><div class="big">✏️</div><h3>1. 연필로 요점 정리</h3><p>공책에 연필로 핵심만 짧게 적습니다. 손으로 쓰는 동안 머릿속에서 내용이 정리됩니다.</p></div>
          <div class="store"><div class="big">🧠</div><h3>2. 머리에 저장</h3><p>정리한 내용을 장면·장소·첫 글자로 바꿔 머릿속에 넣습니다. 눈을 감고 3번 되새깁니다.</p></div>
          <div class="recall"><div class="big">💡</div><h3>3. 꺼내기</h3><p>보지 않고 빈칸에 꺼내 적고, 정리한 것과 비교합니다. 꺼내 본 만큼 오래 남습니다.</p></div>
        </div>
      </div>

      <div class="own-principle">
        <div class="op-icon">🙅‍♀️📎 → 🙋✏️</div>
        <div><h3>예시는 예시일 뿐! 내가 직접 만든 장면이 진짜 기억입니다</h3>
        <p>앱의 모든 예시는 '만드는 방법'을 보여 주기 위한 것이에요. 예시를 그대로 외우지 말고, <b>① 내가 아는 단어·장소·친구를 적고 → ② 그것으로 크게·이상하게 과장한 문장을 직접 만들고 → ③ 막힐 때만 예시를 참고</b>하세요.</p></div>
      </div>

      <div class="path">
        <div><b>① 기초</b><span>원리를 이해하고 과목별 예시 따라 하기</span></div>
        <div><b>② 중급</b><span>정의 문장과 풀이 순서에 적용하기</span></div>
        <div><b>③ 고급</b><span>나만의 기억 장치를 설계하고 셀프 테스트</span></div>
      </div>
      <div class="tech-grid">${cards}</div>
    </section>`));
  }

  /* =====================================================================
     연상 기억 수업 (선생님 설명 자료 + 학생 활동)
     ===================================================================== */
  const PHASES = [
    { key: "show", name: "단어 보기", st: "store" },
    { key: "recall1", name: "1차 꺼내기", st: "recall" },
    { key: "link", name: "연상으로 연결", st: "write" },
    { key: "replay", name: "머릿속으로 돌리기", st: "store" },
    { key: "recall2", name: "최종 꺼내기", st: "recall" },
  ];

  function classWords(set) {
    const custom = store.classWords[set.id];
    return custom && custom.length ? custom : set.words.slice();
  }
  function grade(words, answers, aliases) {
    const keys = words.map((w) => [norm(w), ...((aliases && aliases[w]) || []).map(norm)]);
    const matchIdx = (a) => keys.findIndex((k) => k.includes(norm(a)));
    const used = new Set();
    let any = 0, inOrder = 0;
    const marks = answers.map((a, i) => {
      if (!norm(a)) return "";
      const idx = matchIdx(a);
      if (idx < 0 || used.has(idx)) return "no";
      used.add(idx); any++;
      if (idx === i) { inOrder++; return "order"; }
      return "yes";
    });
    return { any, inOrder, marks };
  }

  function renderClass(setId) {
    const set = SETS.find((s) => s.id === setId) || SETS[0];
    const ck = "class-" + set.id;
    const state = store.drafts[ck] || (store.drafts[ck] = { phase: 0, r1: [], r2: [], links: [], speed: 2 });
    let words = classWords(set);
    let timer = null;
    cleanup = () => { clearInterval(timer); clearTimeout(timer); };

    const root = h(`<section class="class-page">
      <a class="back" href="#/">← 처음으로</a>
      <div class="class-head">
        <h1>🎬 연상 기억 수업</h1>
        <div class="set-tabs">${SETS.map((s) => `<a class="set-tab ${s.id === set.id ? "on" : ""}" href="#/class/${s.id}">${esc(s.label)} <small>${classWords(s).length}개</small></a>`).join("")}</div>
      </div>
      <div class="phase-tabs"></div>
      <div class="class-stage"></div>
      <details class="teacher-box"><summary>👩‍🏫 선생님 진행 팁 · 단어 바꾸기</summary>
        <ul>${set.teacherTips.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>
        <label class="field">이 세트의 단어 (쉼표나 줄바꿈으로 구분, 최대 16개)</label>
        <textarea class="wedit">${esc(words.join(", "))}</textarea>
        <div class="row" style="margin-top:8px"><button class="btn sm wsave">단어 적용</button><button class="btn ghost sm wreset">처음 단어로</button><span class="muted wmsg"></span></div>
      </details>
    </section>`);
    $app.append(root);
    const tabs = root.querySelector(".phase-tabs"), stage = root.querySelector(".class-stage");

    root.querySelector(".wsave").onclick = () => {
      const list = root.querySelector(".wedit").value.split(/[,\n]/).map((x) => x.trim()).filter(Boolean).slice(0, 16);
      if (list.length < 3) { root.querySelector(".wmsg").textContent = "단어를 3개 이상 적어 주세요."; return; }
      store.classWords[set.id] = list; state.r1 = []; state.r2 = []; state.links = []; state.phase = 0; save(); route();
    };
    root.querySelector(".wreset").onclick = () => { delete store.classWords[set.id]; state.r1 = []; state.r2 = []; state.links = []; state.phase = 0; save(); route(); };

    const isDefault = !store.classWords[set.id];
    const linkText = (i) => (isDefault ? set.links[i] : "");

    function go(p) { cleanup(); state.phase = p; save(); draw(); window.scrollTo({ top: 0, behavior: "smooth" }); }
    function drawTabs() {
      tabs.innerHTML = PHASES.map((p, i) => `<button class="phase-tab ${p.st} ${i === state.phase ? "on" : ""}" data-p="${i}"><b>${i + 1}</b> ${p.name}</button>`).join("");
      tabs.querySelectorAll("button").forEach((b) => (b.onclick = () => go(+b.dataset.p)));
      renderStrip([PHASES[state.phase].st]);
    }
    function nextBtn(label) {
      const b = h(`<button class="btn big-btn">${label} →</button>`);
      b.onclick = () => go(state.phase + 1);
      return b;
    }

    /* 16칸 적기 */
    function blanksGrid(key, title, desc, onGrade) {
      const n = Math.max(set.blanks || 16, words.length);
      const vals = state[key];
      const box = h(`<div class="cls-card recall-card"><h2>${title}</h2><p class="muted">${desc}</p>
        <div class="blanks">${Array.from({ length: n }, (_, i) => `<label class="blank"><span>${i + 1}</span><input type="text" autocomplete="off" value="${esc(vals[i] || "")}"></label>`).join("")}</div>
        <div class="row" style="margin-top:14px"><button class="btn gr">채점하기</button><button class="btn ghost clr">지우기</button></div>
        <div class="result"></div></div>`);
      const inputs = [...box.querySelectorAll("input")];
      inputs.forEach((inp, i) => {
        inp.addEventListener("input", () => { vals[i] = inp.value; save(); });
        inp.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); (inputs[i + 1] || inp).focus(); } });
      });
      box.querySelector(".clr").onclick = () => { state[key] = []; save(); draw(); };
      box.querySelector(".gr").onclick = () => {
        const g = grade(words, inputs.map((x) => x.value), set.aliases);
        inputs.forEach((inp, i) => { inp.parentElement.className = "blank " + (g.marks[i] || ""); });
        state[key + "Score"] = g.any; save();
        box.querySelector(".result").innerHTML = "";
        box.querySelector(".result").append(onGrade(g));
      };
      return box;
    }

    function draw() {
      drawTabs();
      stage.innerHTML = "";
      const P = PHASES[state.phase].key;

      if (P === "show") {
        const card = h(`<div class="cls-card"><h2>1단계 · 단어 보기</h2>
          <p class="lead">화면에 단어가 <b>하나씩 순서대로</b> 나타났다가 사라집니다. 아무 방법 없이, 최대한 많이 기억해 보세요!</p>
          <div class="row"><span class="muted">한 단어 보여 주는 시간</span>${[1.5, 2, 3].map((s) => `<button class="btn sm ${state.speed == s ? "" : "ghost"} sp" data-s="${s}">${s}초</button>`).join("")}</div>
          <div class="flash-stage idle"><div class="fs-num"></div><div class="fs-word">준비되면 시작!</div><div class="fs-bar"><i></i></div></div>
          <div class="row" style="justify-content:center;margin-top:16px"><button class="btn big-btn start">▶ 단어 보여 주기 시작</button><button class="btn ghost fullscreen">⛶ 전체 화면</button></div></div>`);
        card.querySelectorAll(".sp").forEach((b) => (b.onclick = () => { state.speed = +b.dataset.s; save(); draw(); }));
        const fsEl = card.querySelector(".flash-stage"), num = card.querySelector(".fs-num"), wd = card.querySelector(".fs-word"), bar = card.querySelector(".fs-bar i");
        card.querySelector(".fullscreen").onclick = () => { try { (fsEl.requestFullscreen || fsEl.webkitRequestFullscreen).call(fsEl); } catch (e) { /* 전체 화면 불가 */ } };
        card.querySelector(".start").onclick = (ev) => {
          ev.target.disabled = true;
          let i = -3;
          fsEl.classList.remove("idle", "gone");
          fsEl.scrollIntoView({ block: "center", behavior: "smooth" });
          const tick = () => {
            if (i < 0) { num.textContent = ""; wd.textContent = String(-i); wd.className = "fs-word count"; i++; timer = setTimeout(tick, 800); return; }
            if (i >= words.length) {
              num.textContent = ""; wd.className = "fs-word"; wd.innerHTML = "단어가 사라졌습니다! 🫥<br><small>기억나는 단어를 떠올려 보세요</small>";
              fsEl.classList.add("gone"); bar.style.width = "100%";
              try { if (document.fullscreenElement) document.exitFullscreen(); } catch (e) { /* noop */ }
              card.append(nextBtn("2단계 · 1차 꺼내기로"));
              return;
            }
            num.textContent = `${i + 1} / ${words.length}`;
            wd.className = "fs-word pop"; wd.textContent = words[i];
            bar.style.width = ((i + 1) / words.length) * 100 + "%";
            i++; timer = setTimeout(tick, state.speed * 1000);
          };
          tick();
        };
        stage.append(card);
      }

      if (P === "recall1") {
        stage.append(blanksGrid("r1", "2단계 · 1차 꺼내기", "기억나는 단어를 순서대로 적어 보세요. 순서가 기억나지 않으면 생각나는 대로 적어도 됩니다. (공책에 연필로 적어도 좋아요)", (g) => {
          const d = h(`<div><div class="score-big">${g.any} <small>/ ${words.length}개 기억</small></div>
            <p class="muted">순서까지 맞힌 단어: ${g.inOrder}개 · 파란 칸 = 순서까지 정답, 초록 칸 = 단어 정답, 빨간 칸 = 목록에 없는 단어</p>
            <p>대부분 <b>앞쪽 몇 개와 마지막 몇 개</b>만 기억납니다. 중간 단어들은 서로 연결되는 고리가 없기 때문이에요. 이제 연상 기억법으로 고리를 만들어 봅시다!</p></div>`);
          d.append(h(`<p class="own-title">다음 단계에서는 선생님 예시를 외우는 게 아니라, <b>여러분이 아는 단어와 장면으로 직접</b> 단어를 연결합니다.</p>`));
          d.append(nextBtn("3단계 · 연상으로 연결하기"));
          return d;
        }));
      }

      if (P === "link") {
        const card = h(`<div class="cls-card"><h2>3단계 · 연상으로 단어 연결하기</h2>
          <div class="intro-box">${set.intro.map((p) => `<p>${esc(p)}</p>`).join("")}</div>
          <div class="word-strip">${words.map((w, i) => `<span class="ws" data-i="${i}">${esc(w)}</span>`).join('<span class="wa">→</span>')}</div>
          <div class="link-view"></div>
          <div class="row" style="justify-content:space-between;margin-top:14px"><button class="btn ghost lp">← 이전 연결</button><button class="btn ghost all">📜 전체 이야기 보기</button><button class="btn ln">다음 연결 →</button></div>
          <div class="all-story" hidden></div></div>`);
        let li = Math.min(state.li || 0, words.length - 2);
        const view = card.querySelector(".link-view");
        state.own = state.own || {};
        const show = () => {
          state.li = li; save();
          card.querySelectorAll(".ws").forEach((s) => s.classList.toggle("on", +s.dataset.i === li || +s.dataset.i === li + 1));
          const ex = linkText(li);
          const od = state.own[li] || (state.own[li] = { s: state.links[li] || "" });
          view.innerHTML = "";
          const v = h(`<div class="link-card">
            <div class="lk-count">연결 ${li + 1} / ${words.length - 1}</div>
            <div class="lk-pair"><span class="lw">${esc(words[li])}</span><span class="la">→</span><span class="lw">${esc(words[li + 1])}</span></div>
            ${OWN_NOTICE}<div class="own-slot"></div><div class="gate-slot"></div></div>`);
          const mk = ownMaker(od, { target: `${words[li]} → ${words[li + 1]}`, a: `예) ${words[li]}을(를) 보면 떠오르는 것: 우리 동네, 내 친구, 좋아하는 음식…`, b: `${words[li]}이(가) ${words[li + 1]}와(과) 부딪히는 엄청 이상한 장면을 내 말로 적어 보세요` });
          mk.querySelector(".os").addEventListener("input", (e) => { state.links[li] = e.target.value; save(); });
          v.querySelector(".own-slot").append(mk);
          if (ex) v.querySelector(".gate-slot").append(revealGate(od, set.mode === "demo" ? "선생님 예시 보기" : "예시 장면 보기", (bd) => bd.append(h(`<div class="lk-scene">🎬 ${esc(ex)}</div>`))));
          view.append(v);
          card.querySelector(".lp").disabled = li === 0;
          const ln = card.querySelector(".ln");
          ln.textContent = li >= words.length - 2 ? "4단계 · 머릿속으로 돌리기 →" : "다음 연결 →";
        };
        card.querySelector(".lp").onclick = () => { if (li > 0) { li--; show(); } };
        card.querySelector(".ln").onclick = () => { if (li < words.length - 2) { li++; show(); } else go(state.phase + 1); };
        card.querySelectorAll(".ws").forEach((s) => (s.onclick = () => { li = Math.min(+s.dataset.i, words.length - 2); show(); }));
        card.querySelector(".all").onclick = () => {
          const box = card.querySelector(".all-story");
          box.hidden = !box.hidden;
          box.innerHTML = `<ol>${words.slice(0, -1).map((w, i) => `<li><b>${esc(w)} → ${esc(words[i + 1])}</b><br>${state.links[i] ? "✏️ " + esc(state.links[i]) : `<span class="muted">(아직 내 장면을 적지 않음 — 적고 나서 다시 보세요)</span>`}</li>`).join("")}</ol>`;
        };
        show();
        stage.append(card);
      }

      if (P === "replay") {
        const card = h(`<div class="cls-card"><h2>4단계 · 머릿속으로 이야기 돌리기</h2>
          <p class="lead">눈을 감고 <b>${esc(words[0])}</b>에서 시작해 <b>${esc(words[words.length - 1])}</b>까지, <b>내가 만든 장면</b>을 영화처럼 머릿속에서 돌려 보세요. 예시 장면이 아니라 내 장면으로! 소리와 움직임까지 떠올립니다.</p>
          <div class="timer big" style="--p:0"><div class="tnum">30</div></div>
          <div class="row" style="justify-content:center"><button class="btn big-btn tgo">▶ 30초 시작</button></div>
          <p class="muted" style="text-align:center;margin-top:10px">힌트: 첫 단어만 보고 시작하세요 → <b class="hint-first">${esc(words[0])}</b> → ? → ? …</p></div>`);
        const tm = card.querySelector(".timer"), tn = card.querySelector(".tnum");
        card.querySelector(".tgo").onclick = (e) => {
          e.target.disabled = true; let t = 30;
          timer = setInterval(() => {
            t--; tn.textContent = t; tm.style.setProperty("--p", ((30 - t) / 30) * 100);
            if (t <= 0) { clearInterval(timer); tn.textContent = "끝!"; card.append(nextBtn("5단계 · 최종 꺼내기")); }
          }, 1000);
        };
        card.append(nextBtn("건너뛰고 최종 꺼내기"));
        stage.append(card);
      }

      if (P === "recall2") {
        stage.append(blanksGrid("r2", "5단계 · 최종 꺼내기 (16칸)", "이야기를 따라가며 단어를 순서대로 16칸에 적어 보세요. 막히면 앞 장면을 떠올리면 다음 단어가 나옵니다.", (g) => {
          const before = state.r1Score;
          const diff = before != null ? g.any - before : null;
          const d = h(`<div><div class="score-compare">
              <div><span>1차 (그냥 외우기)</span><b>${before != null ? before : "–"}</b></div>
              <div class="arrow">→</div>
              <div class="after"><span>최종 (연상 기억)</span><b>${g.any}</b></div>
            </div>
            <p class="score-msg">${diff != null ? (diff > 0 ? `🎉 연상 기억법으로 <b>${diff}개</b> 더 기억했어요!` : diff === 0 ? "같은 개수예요. 장면을 더 크고 이상하게 바꿔 다시 도전해 보세요!" : "장면 연결이 약한 곳을 찾아 다시 만들어 보세요.") : ""} 순서까지 맞힌 단어: ${g.inOrder}개</p>
            <p class="muted">도전: 이번에는 <b>거꾸로</b>(${esc(words[words.length - 1])} → ${esc(words[0])}) 말해 보세요. 사슬이 단단하면 거꾸로도 꺼낼 수 있습니다.</p>
            <div class="row"></div></div>`);
          const row = d.querySelector(".row");
          const sv = h(`<button class="btn soft">📒 내 기억 노트에 저장</button>`);
          sv.onclick = () => {
            addNote({ id: "class" }, "연상 기억 수업", `${set.label} — ${g.any}/${words.length}개`, `1차 ${before ?? "-"}개 → 최종 ${g.any}개\n\n` + words.slice(0, -1).map((w, i) => `${w} → ${words[i + 1]}: ${state.links[i] || linkText(i)}`).join("\n"), "class-" + set.id);
            sv.textContent = "✓ 저장했어요";
          };
          const again = h(`<button class="btn ghost">처음부터 다시</button>`);
          again.onclick = () => { state.r1 = []; state.r2 = []; state.r1Score = null; state.r2Score = null; state.li = 0; go(0); };
          row.append(sv, again);
          const nextSet = SETS[SETS.indexOf(set) + 1];
          if (nextSet) row.append(h(`<a class="btn" href="#/class/${nextSet.id}">${esc(nextSet.label)} 도전 →</a>`));
          return d;
        }));
      }
    }
    draw();
  }

  /* =====================================================================
     기법 / 레슨
     ===================================================================== */
  function renderTech(tech) {
    const items = tech.levels.map((lv, i) => `<a class="level-item" href="#/t/${tech.id}/${i}">
      <span class="level-badge l${i}">${lv.level}</span>
      <div><h3>${esc(lv.title)}</h3><p>${esc(lv.goal)}</p></div>
      <span class="check">${store.done[tech.id + "-" + i] ? "✅" : "›"}</span></a>`).join("");
    $app.append(h(`<section>
      <a class="back" href="#/">← 처음으로</a>
      <div class="tech-head"><h1>${tech.icon} ${esc(tech.name)}</h1><p class="muted">${esc(tech.intro)}</p></div>
      <div class="level-list">${items}</div></section>`));
  }

  function renderLesson(tech, li) {
    const lv = tech.levels[li];
    let idx = 0;
    const root = h(`<section>
      <a class="back" href="#/t/${tech.id}">← ${esc(tech.name)}</a>
      <div class="lesson-top"><b>${lv.level}</b><div class="progress"><i></i></div><span class="muted pc"></span></div>
      <h2>${esc(lv.title)}</h2>
      <p class="muted">🎯 ${esc(lv.goal)}</p>
      <div class="card stage" tabindex="-1"></div>
      <div class="lesson-nav"><button class="btn ghost prev">이전</button><button class="btn next">다음</button></div>
    </section>`);
    $app.append(root);
    const stage = root.querySelector(".stage"), bar = root.querySelector(".progress > i"), pc = root.querySelector(".pc");
    const prev = root.querySelector(".prev"), next = root.querySelector(".next");
    const draftKey = (i) => `${tech.id}-${li}-${i}`;

    function show() {
      if (cleanup) { cleanup(); cleanup = null; }
      const step = lv.steps[idx], meta = STEP_META[step.type];
      bar.style.width = ((idx + 1) / (lv.steps.length + 1)) * 100 + "%";
      pc.textContent = `${idx + 1} / ${lv.steps.length}`;
      prev.disabled = idx === 0;
      next.textContent = idx === lv.steps.length - 1 ? "완료하기 ✓" : "다음";
      stage.style.setProperty("--stc", `var(--st-${meta.st[0]})`);
      renderStrip(meta.st);
      stage.innerHTML = stageTags(meta.st, meta.kind);
      RENDER[step.type](stage, step, draftKey(idx), tech);
    }
    function finish() {
      store.done[tech.id + "-" + li] = true; save();
      bar.style.width = "100%";
      const nextLv = tech.levels[li + 1], nextTech = T[T.indexOf(tech) + 1];
      const nextLink = nextLv ? `<a class="btn" href="#/t/${tech.id}/${li + 1}">${nextLv.level} 단계로 →</a>`
        : nextTech ? `<a class="btn" href="#/t/${nextTech.id}">다음 기억법: ${esc(nextTech.name)} →</a>` : `<a class="btn" href="#/notes">내 기억 노트 보기 →</a>`;
      stage.innerHTML = "";
      stage.append(h(`<div class="done-box"><div class="big">🎉</div><h2>${lv.level} 완료!</h2>
        <p class="muted">💡 꺼내기는 한 번으로 끝나지 않아요. 내일 한 번, 일주일 뒤 한 번 더 꺼내 보면 오래 남습니다.</p>
        <div class="row" style="justify-content:center"><a class="btn ghost" href="#/t/${tech.id}">목록으로</a>${nextLink}</div></div>`));
      root.querySelector(".lesson-nav").style.display = "none";
      pc.textContent = "완료";
      renderStrip(null);
    }
    prev.onclick = () => { if (idx > 0) { idx--; show(); window.scrollTo({ top: 0, behavior: "smooth" }); } };
    next.onclick = () => { if (idx < lv.steps.length - 1) { idx++; show(); window.scrollTo({ top: 0, behavior: "smooth" }); } else finish(); };
    show();
  }

  /* ---------- '예시는 예시' 안내 + 내 장면 만들기 ---------- */
  const OWN_NOTICE = `<div class="own-notice"><b>⚠️ 예시는 예시일 뿐이에요!</b> 예시를 그대로 외우면 오히려 더 어렵습니다. <b>내가 아는 단어와 장면</b>으로, <b>크게·이상하게 과장해서</b> 직접 만들어야 내 기억이 됩니다.</div>`;
  const EXAG = ["크게", "움직이게", "이상하게", "소리·냄새", "내가 등장"];
  /* d: 저장 객체, opts: {target, a, b} → 내가 아는 단어 + 과장 문장 + 과장 체크 */
  function ownMaker(d, opts) {
    d.chk = d.chk || [];
    const box = h(`<div class="own-box">
      <div class="own-title">✏️ 내가 직접 만들기${opts.target ? ` — <b>${esc(opts.target)}</b>` : ""}</div>
      <label class="field">① 이걸 보고 떠오르는 <u>내가 아는 단어·사물·장소</u> (2~3개)</label>
      <input type="text" class="ow" placeholder="${esc(opts.a || "예) 우리 집 강아지, 급식 떡볶이, 학교 운동장")}" value="${esc(d.w)}">
      <label class="field">② 그 단어들로 <u>과장된 장면 문장</u> 만들기</label>
      <textarea class="os" placeholder="${esc(opts.b || "내가 아는 것들이 크게, 이상하게, 움직이는 장면으로 한 문장을 써 보세요")}">${esc(d.s)}</textarea>
      <div class="exag"><span class="muted">과장 체크:</span>${EXAG.map((x) => `<button type="button" class="ex-chip ${d.chk.includes(x) ? "on" : ""}" data-x="${x}">${x}</button>`).join("")}<span class="ex-score"></span></div>
    </div>`);
    const score = () => { const n = d.chk.length; box.querySelector(".ex-score").textContent = n >= 4 ? `🔥 ${n}/5 아주 강한 장면!` : n >= 2 ? `👍 ${n}/5 조금 더 과장해 볼까요?` : `${n}/5`; };
    box.querySelector(".ow").addEventListener("input", (e) => { d.w = e.target.value; save(); });
    box.querySelector(".os").addEventListener("input", (e) => { d.s = e.target.value; save(); });
    box.querySelectorAll(".ex-chip").forEach((c) => (c.onclick = () => {
      const x = c.dataset.x, i = d.chk.indexOf(x);
      if (i >= 0) d.chk.splice(i, 1); else d.chk.push(x);
      c.classList.toggle("on"); save(); score();
    }));
    score();
    return box;
  }
  /* 예시는 내 장면을 먼저 적은 뒤에 열린다 */
  function revealGate(d, label, buildContent) {
    const wrap = h(`<div class="gate"><button class="btn soft gate-btn">👀 ${esc(label)}</button><div class="gate-msg"></div><div class="gate-body" hidden></div></div>`);
    const btn = wrap.querySelector(".gate-btn"), body = wrap.querySelector(".gate-body"), msg = wrap.querySelector(".gate-msg");
    const open = () => {
      btn.remove(); msg.innerHTML = ""; body.hidden = false;
      body.append(h(`<div class="ref-head">📎 참고 예시 — 외우지 마세요! 만드는 <b>방법</b>만 가져가세요</div>`));
      buildContent(body);
      body.append(h(`<div class="after-ref">✏️ 이제 예시에서 배운 방법으로 <b>위의 내 문장을 더 과장해서 고쳐</b> 보세요. 내 장면이 예시보다 이상하고 재미있으면 성공!</div>`));
      d.opened = true; save();
    };
    btn.onclick = () => {
      if (!String(d.s || "").trim() && !btn.dataset.warned) {
        btn.dataset.warned = "1"; btn.textContent = "👀 그래도 예시 보기";
        msg.innerHTML = `<div class="feedback bad">먼저 위 칸에 한 줄이라도 <b>내 장면</b>을 적어 보세요. 서툴러도 괜찮아요!</div>`;
        return;
      }
      open();
    };
    if (d.opened) open();
    return wrap;
  }

  /* ---------- 과목 탭 ---------- */
  function subjectTabs(list, current, onPick) {
    const wrap = h(`<div class="subj-tabs" role="tablist">${list.map((x, i) => { const s = subj(x.subject); return `<button class="subj-tab ${i === current ? "on" : ""}" style="--sc:${s.color}" data-i="${i}" role="tab">${s.icon} ${s.id}</button>`; }).join("")}</div>`);
    wrap.querySelectorAll("button").forEach((b) => (b.onclick = () => {
      wrap.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b));
      onPick(+b.dataset.i);
    }));
    return wrap;
  }

  /* ---------- 단계별 렌더러 ---------- */
  const RENDER = {
    explain(el, s) {
      el.append(h(`<div><h3>${esc(s.title)}</h3>${s.body.map((p) => `<p>${esc(p)}</p>`).join("")}
        <div class="tips">${s.tips.map((t) => `<div>✔ ${esc(t)}</div>`).join("")}</div></div>`));
    },

    gallery(el, s, key) {
      const d = store.drafts[key] || (store.drafts[key] = { i: 0, tries: {}, own: {} });
      d.own = d.own || {};
      el.append(h(`<div><h3>${esc(s.title)}</h3><p class="muted">과목 탭을 고르세요. 순서: ① 외울 내용 보기 → ② 내가 아는 단어로 직접 만들기 → ③ 예시 참고 → ④ 내 장면 고치기</p></div>`));
      const body = h(`<div></div>`);
      const drawEx = (i) => {
        d.i = i; save();
        const ex = s.examples[i], sc = subj(ex.subject);
        const od = d.own[i] || (d.own[i] = {});
        body.innerHTML = "";
        const card = h(`<div class="ex-card" style="--sc:${sc.color}">
          <span class="ex-subj">${sc.icon} ${sc.id}</span>
          <div class="fact"><div class="term">${esc(ex.term)}</div><div>${markFact(ex.fact)}</div></div>
          ${OWN_NOTICE}
          <div class="own-slot"></div>
          <div class="gate-slot"></div>
          <div class="try-box">💡 한 번 더 연습: ${esc(ex.tryit)}<textarea placeholder="이번에도 내가 아는 단어와 장면으로 적어 보세요">${esc(d.tries[i] || "")}</textarea></div>
          <div class="ex-nav"><button class="btn ghost sm pv">← 이전 과목</button><span class="muted">${i + 1} / ${s.examples.length}</span><button class="btn sm nx">다음 과목 →</button></div>
        </div>`);
        card.querySelector(".own-slot").append(ownMaker(od, { target: ex.term }));
        card.querySelector(".gate-slot").append(revealGate(od, "예시 참고하기", (bd) => {
          bd.append(h(`<ol class="ladder">${ex.scene.map(([a, b]) => `<li><b>${esc(a)}</b><span>${esc(b)}</span></li>`).join("")}</ol>`));
          bd.append(h(`<div class="explain-box"><h4>🔍 이 예시는 어떤 방법으로 만들었을까? — 자세한 설명</h4>${ex.explain.map((p) => `<p>${esc(p)}</p>`).join("")}</div>`));
        }));
        card.querySelector(".try-box textarea").addEventListener("input", (e) => { d.tries[i] = e.target.value; save(); });
        const pv = card.querySelector(".pv"), nx = card.querySelector(".nx");
        pv.disabled = i === 0; nx.disabled = i === s.examples.length - 1;
        pv.onclick = () => tabs.querySelectorAll("button")[i - 1].click();
        nx.onclick = () => tabs.querySelectorAll("button")[i + 1].click();
        body.append(card);
      };
      const tabs = subjectTabs(s.examples, d.i, (i) => { drawEx(i); tabs.scrollIntoView({ block: "nearest", behavior: "smooth" }); });
      el.append(tabs, body);
      drawEx(d.i);
    },

    quiz(el, s) {
      const box = h(`<div><h3>${esc(s.title)}</h3><p style="font-size:18px;font-weight:600">${esc(s.q)}</p><div class="options"></div><div class="fb"></div></div>`);
      const opts = box.querySelector(".options"), fb = box.querySelector(".fb");
      s.options.forEach((o, i) => {
        const b = h(`<button class="opt">${esc(o)}</button>`);
        b.onclick = () => {
          if (opts.dataset.solved) return;
          if (i === s.answer) { b.classList.add("correct"); opts.dataset.solved = "1"; fb.innerHTML = `<div class="feedback good">정답! ${esc(s.why)}</div>`; }
          else { b.classList.remove("wrong"); void b.offsetWidth; b.classList.add("wrong"); fb.innerHTML = `<div class="feedback bad">다시 한 번! 장면을 떠올려 보세요.</div>`; }
        };
        opts.append(b);
      });
      el.append(box);
    },

    order(el, s, key) {
      const hasPlace = s.items.some((x) => x.place);
      const d = store.drafts[key] || (store.drafts[key] = { mine: [] });
      const box = h(`<div><h3>${esc(s.title)}</h3><p>${esc(s.prompt)}</p>
        ${OWN_NOTICE}
        <p class="own-title" style="margin-top:12px">✏️ 항목마다 <u>내가 아는 단어·장면</u>으로 과장된 장면을 적어 저장하세요. 그다음 가리고 꺼냅니다.</p>
        <div class="study">${s.items.map((x, i) => `<div class="study-card">
          <div class="${hasPlace ? "place" : "item"}">${esc(hasPlace ? x.place : x.item)}</div>
          <div>${hasPlace ? `<div class="item">${esc(x.item)}</div>` : ""}
            <input type="text" class="mine" data-i="${i}" placeholder="내 장면 (예: 우리 집 ○○이 …)" value="${esc(d.mine[i] || "")}">
            ${x.image ? `<details class="ref-mini"><summary>📎 예시 살짝 보기 (참고만)</summary>${esc(x.image)}</details>` : ""}
          </div></div>`).join("")}</div>
        ${s.story ? `<details class="ref-mini story-ref"><summary>📎 예시 이야기 보기 (참고만 — 내 이야기로 바꾸세요)</summary>${esc(s.story)}</details>` : ""}
        <button class="btn go">🧠 내 장면으로 저장했어요 — 가리고 꺼내기</button>
        <div class="test" hidden><div class="slots"></div><p class="muted">💡 내 장면을 떠올리며 순서대로 눌러 꺼내 보세요.</p><div class="pool"></div><div class="fb"></div></div></div>`);
      box.querySelectorAll(".mine").forEach((inp) => inp.addEventListener("input", () => { d.mine[+inp.dataset.i] = inp.value; save(); }));
      const study = box.querySelector(".study"), go = box.querySelector(".go"), test = box.querySelector(".test"), storyEl = box.querySelector(".story-ref");
      go.onclick = () => {
        study.hidden = true; go.hidden = true; if (storyEl) storyEl.hidden = true; test.hidden = false;
        renderStrip(["recall"]);
        const slots = test.querySelector(".slots"), pool = test.querySelector(".pool"), fb = test.querySelector(".fb");
        slots.innerHTML = s.items.map((x, i) => `<div class="slot"><span class="place">${esc(hasPlace ? x.place : i + 1 + "번째")}</span><span class="val"></span></div>`).join("");
        let pos = 0;
        shuffle(s.items.map((x, i) => ({ ...x, i }))).forEach((x) => {
          const b = h(`<button class="chip-btn">${esc(x.item)}</button>`);
          b.onclick = () => {
            if (x.i === pos) {
              const slot = slots.children[pos]; slot.classList.add("filled"); slot.querySelector(".val").textContent = x.item; b.remove(); pos++;
              if (pos === s.items.length) fb.innerHTML = `<div class="feedback good">완벽해요! 내 장면으로 모든 순서를 꺼냈어요. 🎯</div>`;
            } else {
              b.classList.remove("wrong"); void b.offsetWidth; b.classList.add("wrong");
              const mine = d.mine[pos];
              fb.innerHTML = `<div class="feedback bad">${hasPlace ? `'${esc(s.items[pos].place)}'에 무엇을 놓았었죠?` : `${pos + 1}번째 장면을 떠올려 보세요.`}${mine ? ` 내 장면 힌트: “${esc(mine.slice(0, 12))}…”` : ""}</div>`;
            }
          };
          pool.append(b);
        });
        const again = h(`<button class="btn soft sm" style="margin-top:14px">다시 보기</button>`);
        again.onclick = () => { study.hidden = false; go.hidden = false; if (storyEl) storyEl.hidden = false; test.hidden = true; again.remove(); renderStrip(["store", "recall"]); };
        test.append(again);
      };
      el.append(box);
    },

    build(el, s, key, tech) {
      el.append(h(`<div><h3>${esc(s.title)}</h3>${s.prompt ? `<p>${esc(s.prompt)}</p>` : ""}</div>`));
      const area = h(`<div></div>`);
      const pick = (i) => {
        const d = store.drafts[key] || (store.drafts[key] = {});
        d.sel = i; save();
        area.innerHTML = "";
        BUILD[s.kind](area, s, `${key}-${i}`, tech, s.tasks ? s.tasks[i] : null);
      };
      const cur = (store.drafts[key] && store.drafts[key].sel) || 0;
      el.append(h(OWN_NOTICE));
      if (s.tasks) el.append(h(`<p class="muted" style="margin:10px 0 0">📚 과목을 고르세요</p>`), subjectTabs(s.tasks, cur, pick));
      el.append(area);
      pick(cur);
    },

    cycle(el, s, key, tech) {
      const d = store.drafts[key] || (store.drafts[key] = { p: 0, memo: "", recall: "", penciled: false });
      const keys = ["write", "store", "recall"];
      let timer2 = null;
      cleanup = () => clearInterval(timer2);
      const wrap = h(`<div><h3>${esc(s.title)}</h3><p>오늘 배운 <b>${esc(s.topic)}</b>을(를) 세 단계로 내 것으로 만듭니다.</p>
        <div class="cy-steps">${keys.map((k, i) => `<span class="${k}">${ST[k].icon} ${i + 1}. ${ST[k].short}</span>`).join("")}</div><div class="cy-body"></div></div>`);
      const body = wrap.querySelector(".cy-body");
      const setP = (p) => {
        clearInterval(timer2);
        d.p = p; save();
        wrap.querySelectorAll(".cy-steps span").forEach((x, i) => x.classList.toggle("on", i === p));
        renderStrip([keys[p]]);
        body.innerHTML = "";
        if (p === 0) {
          const pnl = h(`<div class="cy-panel" style="--pc:var(--st-write)"><h3>✏️ 1. 연필로 요점 정리</h3>
            <p>공책을 펴고 <b>연필로</b> 아래 질문에 답하며 요점을 정리하세요. 문장은 짧게, 핵심 단어 위주로!</p>
            <ol class="guide-list">${s.guide.map((g) => `<li>${esc(g)}</li>`).join("")}</ol>
            <label class="check-line"><input type="checkbox" ${d.penciled ? "checked" : ""}> 공책에 연필로 정리했어요</label>
            <label class="field">정리한 핵심을 여기에도 옮겨 적어 두세요 (꺼내기 후 비교할 때 사용해요)</label>
            <textarea class="memo" placeholder="예) 연상 이미지 = ① 소리 바꾸기 ② 뜻을 행동으로 / 규칙: 크게·움직이게·이상하게·감각">${esc(d.memo)}</textarea>
            <div class="row" style="margin-top:12px"><span class="spacer"></span><button class="btn nx">🧠 저장 단계로 →</button></div></div>`);
          pnl.querySelector("input").onchange = (e) => { d.penciled = e.target.checked; save(); };
          pnl.querySelector(".memo").addEventListener("input", (e) => { d.memo = e.target.value; save(); });
          pnl.querySelector(".nx").onclick = () => setP(1);
          body.append(pnl);
        } else if (p === 1) {
          const memo = d.memo.trim() || s.guide.join("\n");
          const pnl = h(`<div class="cy-panel" style="--pc:var(--st-store)"><h3>🧠 2. 머리에 저장</h3>
            <p>아래 정리를 <b>소리 내어 3번</b> 읽고, 시작 버튼을 누른 뒤 눈을 감고 30초 동안 머릿속으로 되새기세요. 시작하면 글이 가려집니다.</p>
            <div class="memo-show">${esc(memo)}</div>
            <div class="timer" style="--p:0"><div>30</div></div>
            <div class="row" style="justify-content:center"><button class="btn tg">▶ 30초 저장 시작</button><button class="btn ghost nx">💡 꺼내기 단계로 →</button></div></div>`);
          const ms = pnl.querySelector(".memo-show"), tm = pnl.querySelector(".timer"), tn = tm.firstElementChild;
          pnl.querySelector(".tg").onclick = (e) => {
            e.target.disabled = true; ms.classList.add("covered"); let t = 30;
            timer2 = setInterval(() => { t--; tn.textContent = t; tm.style.setProperty("--p", ((30 - t) / 30) * 100); if (t <= 0) { clearInterval(timer2); tn.textContent = "끝!"; } }, 1000);
          };
          pnl.querySelector(".nx").onclick = () => setP(2);
          body.append(pnl);
        } else {
          const pnl = h(`<div class="cy-panel" style="--pc:var(--st-recall)"><h3>💡 3. 꺼내기</h3>
            <p>정리한 것을 <b>보지 말고</b>, 기억나는 대로 아래에 모두 적어 보세요. 그다음 '비교하기'를 누르세요.</p>
            <textarea class="rc" style="min-height:150px" placeholder="기억나는 대로 적어 보세요">${esc(d.recall)}</textarea>
            <div class="row" style="margin-top:12px"><button class="btn ghost bk">← 다시 저장하기</button><span class="spacer"></span><button class="btn cmp">비교하기</button></div>
            <div class="cmp-out"></div></div>`);
          pnl.querySelector(".rc").addEventListener("input", (e) => { d.recall = e.target.value; save(); });
          pnl.querySelector(".bk").onclick = () => setP(1);
          pnl.querySelector(".cmp").onclick = () => {
            const memo = d.memo.trim(), rec = d.recall.trim(), out = pnl.querySelector(".cmp-out");
            if (!rec) { out.innerHTML = `<div class="feedback bad">먼저 기억나는 것을 적어 주세요.</div>`; return; }
            if (!memo) {
              out.innerHTML = `<div class="feedback good">공책에 연필로 정리한 내용과 직접 비교해 보세요. 빠진 부분에 빨간 펜으로 표시하면, 그곳이 다음에 다시 꺼내 볼 곳입니다.</div>`;
            } else {
              const tokens = (t) => (t.match(/[가-힣A-Za-z0-9²√±+\-=]{2,}/g) || []);
              const recN = norm(rec);
              const memoT = [...new Set(tokens(memo))];
              const hit = memoT.filter((w) => recN.includes(norm(w)));
              const pct = memoT.length ? Math.round((hit.length / memoT.length) * 100) : 0;
              const marked = esc(memo).replace(/[가-힣A-Za-z0-9²√±+\-=]{2,}/g, (w) => (recN.includes(norm(w)) ? `<span class="hit">${w}</span>` : `<span class="miss">${w}</span>`));
              out.innerHTML = `<div class="score-line">핵심 단어 ${hit.length} / ${memoT.length}개 꺼냄 (${pct}%)</div>
                <div class="compare"><div><h4>✏️ 내가 정리한 것 <small class="muted">(분홍 = 못 꺼낸 단어)</small></h4>${marked}</div><div><h4>💡 내가 꺼낸 것</h4>${esc(rec)}</div></div>
                <p class="muted" style="margin-top:10px">분홍색 단어를 공책에 빨간 펜으로 표시하고, 그 부분만 장면을 더 강하게 만들어 내일 다시 꺼내 보세요.</p>`;
            }
            addNote(tech, "정리→저장→꺼내기", s.topic, `✏️ 정리\n${memo || "(공책에 정리)"}\n\n💡 꺼낸 것\n${rec}`, key);
          };
          body.append(pnl);
        }
      };
      el.append(wrap);
      setP(d.p || 0);
    },
  };

  /* ---------- 직접 만들기 ---------- */
  function addNote(tech, kind, title, body, key) {
    const i = key ? store.notes.findIndex((n) => n.key === key) : -1;
    const note = { key, tech: tech.id, kind, title, body, ts: Date.now() };
    if (i >= 0) store.notes[i] = note; else store.notes.unshift(note);
    save();
  }
  function savedFlash(el) {
    const m = el.querySelector(".saved-msg");
    if (!m) return;
    m.textContent = "✓ 내 기억 노트에 저장했어요";
    setTimeout(() => (m.textContent = ""), 2500);
  }

  const BUILD = {
    image(el, s, key, tech, task) {
      const d = store.drafts[key] || {};
      const box = h(`<div>
        <div class="fact"><div class="term">${esc(task.term)}</div><div>${esc(task.fact)}</div></div>
        <label class="field">① 소리·뜻을 바꾼 사물</label><input type="text" class="a" placeholder="예) 소수 → 소" value="${esc(d.a)}">
        <label class="field">② 뜻을 보여 주는 장면 (크게·움직이게·이상하게·감각)</label><textarea class="b" placeholder="장면을 영화처럼 적어 보세요">${esc(d.b)}</textarea>
        <div class="hint">💡 힌트 <small>(예시일 뿐! 내가 아는 단어·장면으로 바꾸세요)</small><br>${esc(task.hint)}</div>
        <div class="row" style="margin-top:14px"><button class="btn sv">저장하기</button><span class="saved-msg"></span></div></div>`);
      box.querySelector(".sv").onclick = () => {
        const a = box.querySelector(".a").value.trim(), b = box.querySelector(".b").value.trim();
        store.drafts[key] = { a, b }; save();
        if (!a && !b) return;
        addNote(tech, `연상 이미지 · ${task.subject}`, task.term, `${task.fact}\n\n🔁 ${a}\n🎬 ${b}`, key);
        savedFlash(box);
      };
      el.append(box);
    },

    story(el, s, key, tech, task) {
      const d = store.drafts[key] || { scenes: ["", "", ""] };
      const box = h(`<div>
        <div class="fact"><div class="term">${esc(task.term)}</div><div>${esc(task.fact)}</div></div>
        <div class="hint">💡 힌트 <small>(예시일 뿐! 내가 아는 단어·장면으로 바꾸세요)</small><br>${esc(task.hint)}</div>
        <label class="field">장면 사슬 (앞 장면의 물건이 다음 장면을 부르도록)</label><div class="palace-rows scenes"></div>
        <div class="row" style="margin-top:10px"><button class="btn soft sm add">+ 장면 추가</button></div>
        <div class="row" style="margin-top:14px"><button class="btn sv">저장하기</button><span class="saved-msg"></span></div></div>`);
      const wrap = box.querySelector(".scenes");
      const addRow = (v) => {
        const n = wrap.children.length + 1;
        const r = h(`<div class="palace-row" style="grid-template-columns:34px 1fr 40px"><span class="n">${n}</span><input type="text" placeholder="${n === 1 ? "무대(조건·처음)" : "다음 장면"}" value="${esc(v)}"><button class="icon-btn" title="삭제">✕</button></div>`);
        r.querySelector("button").onclick = () => { r.remove(); [...wrap.children].forEach((c, i) => (c.querySelector(".n").textContent = i + 1)); };
        wrap.append(r);
      };
      d.scenes.forEach(addRow);
      box.querySelector(".add").onclick = () => addRow("");
      box.querySelector(".sv").onclick = () => {
        const scenes = [...wrap.querySelectorAll("input")].map((i) => i.value.trim());
        store.drafts[key] = { scenes }; save();
        const filled = scenes.filter(Boolean);
        if (!filled.length) return;
        addNote(tech, `이야기 사슬 · ${task.subject}`, task.term, filled.map((x, i) => `${i + 1}. ${x}`).join("\n"), key);
        savedFlash(box);
      };
      el.append(box);
    },

    palace(el, s, key, tech, task) {
      const n = Math.max(task.items.length, s.defaultPlaces.length);
      const d = store.drafts[key] || { name: "", places: Array.from({ length: n }, (_, i) => s.defaultPlaces[i] || ""), items: Array.from({ length: n }, (_, i) => task.items[i] || "") };
      const box = h(`<div>
        <p class="task-topic">📌 ${esc(task.subject)} — ${esc(task.topic)}</p>
        <label class="field">궁전 이름</label><input type="text" class="nm" placeholder="예) 우리 집 — ${esc(task.topic)}" value="${esc(d.name)}">
        <label class="field">장소 → 놓을 내용 (내용 뒤에 장면을 덧붙여 보세요)</label><div class="palace-rows rows"></div>
        <div class="row" style="margin-top:10px"><button class="btn soft sm add">+ 장소 추가</button></div>
        <div class="row" style="margin-top:14px"><button class="btn sv">저장하기</button>${s.selfTest ? `<button class="btn ghost st">💡 셀프 테스트</button>` : ""}<span class="saved-msg"></span></div>
        <div class="tz"></div></div>`);
      const rows = box.querySelector(".rows");
      const addRow = (p, it) => {
        const k = rows.children.length + 1;
        const r = h(`<div class="palace-row"><span class="n">${k}</span><input type="text" class="p" placeholder="장소" value="${esc(p)}"><input type="text" class="i" placeholder="외울 내용 + 장면" value="${esc(it)}"><button class="icon-btn" title="삭제">✕</button></div>`);
        r.querySelector("button").onclick = () => { r.remove(); [...rows.children].forEach((c, i) => (c.querySelector(".n").textContent = i + 1)); };
        rows.append(r);
      };
      d.places.forEach((p, i) => addRow(p, d.items[i] || ""));
      box.querySelector(".add").onclick = () => addRow("", "");
      const collect = () => {
        const pairs = [...rows.children].map((r) => [r.querySelector(".p").value.trim(), r.querySelector(".i").value.trim()]);
        const name = box.querySelector(".nm").value.trim();
        store.drafts[key] = { name, places: pairs.map((x) => x[0]), items: pairs.map((x) => x[1]) }; save();
        return { name, pairs: pairs.filter((x) => x[0] && x[1]) };
      };
      box.querySelector(".sv").onclick = () => {
        const { name, pairs } = collect();
        if (!pairs.length) { box.querySelector(".saved-msg").textContent = "장소를 1곳 이상 적어 주세요"; return; }
        addNote(tech, `기억의 궁전 · ${task.subject}`, name || task.topic, pairs.map((x, i) => `${i + 1}. ${x[0]} → ${x[1]}`).join("\n"), key);
        savedFlash(box);
      };
      const st = box.querySelector(".st");
      if (st) st.onclick = () => {
        const { pairs } = collect(), tz = box.querySelector(".tz");
        if (pairs.length < 2) { tz.innerHTML = `<div class="feedback bad">장소와 내용을 2개 이상 채워 주세요.</div>`; return; }
        selfTest(tz, pairs.map(([p, it]) => ({ q: p, a: it })), "이 장소에 무엇을 놓았나요?");
      };
      el.append(box);
    },

    acro(el, s, key, tech, task) {
      const d = store.drafts[key] || { list: task.items.join("\n"), phrase: "", scene: "" };
      const box = h(`<div>
        <p class="task-topic">📌 ${esc(task.subject)} — ${esc(task.topic)}</p>
        <label class="field">외울 항목 (한 줄에 하나)</label><textarea class="ls">${esc(d.list)}</textarea>
        <div class="row" style="margin-top:12px"><b>뽑힌 첫 글자</b><span class="spacer"></span>${s.shuffle ? `<button class="btn soft sm sh">🔀 순서 섞기 (순서 무관할 때만)</button>` : ""}</div>
        <div class="letters"></div>
        <label class="field">내가 만든 두문자어 / 뜻 있는 문장</label><input type="text" class="ph" placeholder="예) 수금지화 목토천해" value="${esc(d.phrase)}">
        <label class="field">떠올릴 장면 (선택)</label><input type="text" class="sc" placeholder="예) 대성이가 높이 올라갈수록 열이 났다 내렸다" value="${esc(d.scene)}">
        <div class="row" style="margin-top:14px"><button class="btn sv">저장하기</button>${s.selfTest ? `<button class="btn ghost st">💡 셀프 테스트</button>` : ""}<span class="saved-msg"></span></div>
        <div class="tz"></div></div>`);
      const ls = box.querySelector(".ls"), letters = box.querySelector(".letters");
      const items = () => ls.value.split("\n").map((x) => x.trim()).filter(Boolean);
      const draw = () => { letters.innerHTML = items().map((x) => `<span class="letter" title="${esc(x)}">${esc(firstChar(x))}</span>`).join("") || `<span class="muted">항목을 입력하면 여기에 나타나요</span>`; };
      ls.addEventListener("input", draw); draw();
      const sh = box.querySelector(".sh");
      if (sh) sh.onclick = () => { ls.value = shuffle(items()).join("\n"); draw(); };
      const persist = () => { store.drafts[key] = { list: items().join("\n"), phrase: box.querySelector(".ph").value.trim(), scene: box.querySelector(".sc").value.trim() }; save(); };
      box.querySelector(".sv").onclick = () => {
        persist();
        const list = items(); if (!list.length) return;
        const acr = list.map(firstChar).join(""), dd = store.drafts[key];
        addNote(tech, `두문자어 · ${task.subject}`, dd.phrase || acr, `🔤 ${acr}${dd.scene ? `\n🎬 ${dd.scene}` : ""}\n` + list.map((x) => `· ${x}`).join("\n"), key);
        savedFlash(box);
      };
      const st = box.querySelector(".st");
      if (st) st.onclick = () => {
        persist();
        const list = items(), tz = box.querySelector(".tz");
        if (list.length < 2) { tz.innerHTML = `<div class="feedback bad">항목을 2개 이상 적어 주세요.</div>`; return; }
        selfTest(tz, list.map((x, i) => ({ q: `${i + 1}번째 글자 「${firstChar(x)}」`, a: x })), "이 글자는 무엇의 첫 글자였나요?");
      };
      el.append(box);
    },
  };

  /* ---------- 셀프 테스트 (플래시카드) ---------- */
  function selfTest(el, cards, ask) {
    renderStrip(["recall"]);
    let i = 0, ok = 0;
    const step = () => {
      if (i >= cards.length) {
        el.innerHTML = `<div class="flash"><div class="q">${ok} / ${cards.length}</div><div class="a">${ok === cards.length ? "모두 꺼냈어요! 🎉" : "못 꺼낸 것만 장면을 더 과장해서 다시 만들어 보세요."}</div></div>`;
        return;
      }
      const c = cards[i];
      el.innerHTML = "";
      const f = h(`<div class="flash"><div class="muted">💡 ${esc(ask)} (${i + 1}/${cards.length})</div><div class="q">${esc(c.q)}</div><div class="a"></div>
        <div class="row" style="justify-content:center;margin-top:12px"><button class="btn rv">정답 보기</button></div></div>`);
      const a = f.querySelector(".a"), row = f.querySelector(".row");
      f.querySelector(".rv").onclick = () => {
        a.textContent = c.a; row.innerHTML = "";
        const y = h(`<button class="btn" style="background:var(--good)">꺼냈어요</button>`);
        const n = h(`<button class="btn" style="background:var(--bad)">못 꺼냈어요</button>`);
        y.onclick = () => { ok++; i++; step(); };
        n.onclick = () => { i++; step(); };
        row.append(n, y);
      };
      el.append(f);
    };
    step();
  }

  /* ---------- 내 기억 노트 ---------- */
  function renderNotes() {
    const list = store.notes.map((n, i) => {
      const t = techById(n.tech) || { icon: "🎬", color: "var(--ink)" };
      return `<div class="card note" style="--c:${t.color}"><div class="note-meta">${t.icon} ${esc(n.kind)} · ${new Date(n.ts).toLocaleDateString("ko-KR")}</div>
        <h3 style="color:var(--c)">${esc(n.title)}</h3><pre>${esc(n.body)}</pre>
        <div class="row"><span class="spacer"></span><button class="btn ghost sm del" data-i="${i}">삭제</button></div></div>`;
    }).join("");
    const sec = h(`<section><h1>📒 내 기억 노트</h1>
      <p class="muted">직접 만든 장면·궁전·두문자어와 꺼내기 기록이 이 기기에 저장됩니다. 💡 하루 뒤, 일주일 뒤 제목만 보고 내용을 먼저 꺼내 본 다음 읽어 보세요.</p>
      <div class="note-list">${list || `<div class="card"><p>아직 저장된 노트가 없어요.</p><a class="btn" href="#/">기억법 시작하기</a></div>`}</div></section>`);
    sec.querySelectorAll(".del").forEach((b) => (b.onclick = () => {
      if (!b.dataset.confirm) { b.dataset.confirm = "1"; b.textContent = "정말 삭제?"; return; }
      store.notes.splice(+b.dataset.i, 1); save(); route();
    }));
    $app.append(sec);
  }

  /* ---------- QR 도크: 작게 / 크게 / 숨기기 ---------- */
  function qrTarget() {
    if (store.qrUrl) return store.qrUrl;
    return location.origin && location.origin !== "null" ? location.origin + location.pathname : location.href.split("#")[0];
  }
  function qrSVG() {
    try { return QR.toSVG(qrTarget()); } catch (e) { return `<p style="color:#14213d;padding:8px">주소가 너무 길어 QR을 만들 수 없어요</p>`; }
  }
  function setQR(mode) { store.qr = mode; save(); renderDock(); }
  function ctrl(mode) {
    return `<div class="qr-ctrl"><button data-m="small" class="${mode === "small" ? "on" : ""}">작게</button><button data-m="large" class="${mode === "large" ? "on" : ""}">크게</button><button data-m="hidden">숨기기</button></div>`;
  }
  function bindCtrl(root) { root.querySelectorAll("[data-m]").forEach((b) => (b.onclick = () => setQR(b.dataset.m))); }
  function renderDock() {
    $dock.innerHTML = "";
    document.querySelector(".qr-overlay")?.remove();
    const mode = store.qr;
    document.body.classList.toggle("qr-small-on", mode === "small");
    if (mode === "hidden") {
      const pill = h(`<button class="qr-pill" aria-label="QR 코드 보이기">▦ QR 접속</button>`);
      pill.onclick = () => setQR("small");
      $dock.append(pill); return;
    }
    if (mode === "small") {
      const card = h(`<div class="qr-small"><div class="qr-box" title="누르면 크게 보기">${qrSVG()}</div><div class="cap">📷 태블릿으로 찍고 입장</div>${ctrl(mode)}</div>`);
      card.querySelector(".qr-box").onclick = () => setQR("large");
      bindCtrl(card); $dock.append(card); return;
    }
    const ov = h(`<div class="qr-overlay" role="dialog" aria-label="QR 코드 크게 보기">
      <h2>📷 태블릿·스마트폰 카메라로 QR을 찍어 입장하세요</h2>
      <div class="qr-box">${qrSVG()}</div>
      <div class="url">${esc(qrTarget())}</div>
      ${ctrl(mode)}
      <button class="linkish ed">접속 주소 직접 입력</button>
      <div class="url-edit" hidden><input type="text" placeholder="비워 두면 현재 주소 자동 사용" value="${esc(store.qrUrl)}"><button class="btn sm ok">적용</button></div></div>`);
    bindCtrl(ov);
    ov.querySelector(".ed").onclick = () => { ov.querySelector(".url-edit").hidden = false; ov.querySelector(".url-edit input").focus(); };
    ov.querySelector(".ok").onclick = () => { store.qrUrl = ov.querySelector(".url-edit input").value.trim(); save(); renderDock(); };
    ov.addEventListener("click", (e) => { if (e.target === ov) setQR("small"); });
    document.body.append(ov);
  }
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && store.qr === "large") setQR("small"); });

  /* ---------- 시작 ---------- */
  renderDock();
  route();
})();
