/* 학습 기억법 — 앱 로직
   화면: 처음(#/) · 연상 기억 수업(#/class) · 기법(#/t/id) · 레슨(#/t/id/n) · 내 기억 노트(#/notes)
   원칙: ✏️ 정리 → 🧠 저장 → 💡 꺼내기 (상단 띠에 항상 표시) */
(function () {
  "use strict";
  const TECHS = window.TECHS, LV = window.LEVELS, TR = window.TRAINING, PAL = window.PALACES, SUBJ = window.SUBJECTS, ST = window.STAGES, SETS = window.CLASS_SETS;
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
  const techById = (id) => TECHS.find((t) => t.id === id);
  const subj = (id) => SUBJ.find((x) => x.id === id) || { id, icon: "📘", color: "#14213d" };
  const norm = (s) => String(s || "").toLowerCase().replace(/\s+/g, "").trim();

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
    if (parts[0] === "t" && TR[parts[1]] && TR[parts[1]][+parts[2]]) renderLesson(parts[1], +parts[2]);
    else if (parts[0] === "lv" && LV[+parts[1]]) renderLevel(+parts[1]);
else if (parts[0] === "notes") renderNotes();
    else if (parts[0] === "class" && parts[1] === "method") renderMethod();
    else if (parts[0] === "class") renderClass(parts[1]);
    else renderHome();
    window.scrollTo(0, 0);
  }
  window.addEventListener("hashchange", route);

  /* =====================================================================
     처음 화면
     ===================================================================== */
  function renderHome() {
    const lvCards = LV.map((L, n) => {
      const list = techsFor(n), done = list.filter((t) => store.done[`${t.id}-${n}`]).length;
      return `<a class="lv-card" style="--lc:${L.color}" href="#/lv/${n}">
        <span class="lv-big">${L.level}</span>
        <span class="lv-desc">${esc(L.desc)}</span>
        <span class="lv-techs">${list.map((t) => `<i>${t.icon} ${esc(t.name)}</i>`).join("")}</span>
        <span class="lv-foot"><span class="lv-prog">${done} / ${list.length} 완료</span><span class="lv-go">들어가기 →</span></span></a>`;
    }).join("");
    $app.append(h(`<section>
      <a class="class-banner" href="#/class/demo">
        <span class="cb-tag">🎬 수업</span>
        <span class="cb-title">연상 기억 수업</span>
        <span class="cb-sub">파트 1 · 연상 이미지 체험 &nbsp;|&nbsp; 파트 2 · 공부하는 방법</span>
        <span class="cb-go">들어가기 →</span>
      </a>
      <div class="hero">
        <h1 class="hero-title"><small>방법을 바꾸면 미래가 보인다</small>학습 기억법</h1>
        <p class="lead">본문을 읽고 → 요점을 정리하고 → 기억법으로 바꾸고 → 꺼내 봅니다. 단계를 골라 들어가세요.</p>
      </div>
      <div class="lv-grid">${lvCards}</div>
      <div class="flow-line">${[["📖", "본문 읽기"], ["✏️", "요점 정리"], ["🧩", "기억법 적용"], ["💡", "꺼내기"]].map(([i, t], k) => `${k ? "<span>→</span>" : ""}<b>${i} ${t}</b>`).join("")}</div>
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
      ${partTabs("word")}
      <div class="class-head">
        <h1>🎬 연상 이미지 체험</h1>
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
     수업 파트 2: 공부하는 방법 (장면 슬라이드 + 선생님 대본)
     ===================================================================== */
  function partTabs(on) {
    return `<div class="part-tabs">
      <a class="part-tab ${on === "word" ? "on" : ""}" href="#/class/demo"><small>파트 1</small>🎬 연상 이미지 체험</a>
      <a class="part-tab ${on === "method" ? "on" : ""}" href="#/class/method"><small>파트 2</small>📚 공부하는 방법</a></div>`;
  }
  const SLIDE_STAGE = { passage: ["write"], underline: ["write"], rules: ["write"], keys: ["write"], acro: ["store"], assoc: ["store"], palaces: ["store"], place: ["store"], link: ["store"], recall: ["recall"] };
  function bodySVG(active) {
    const pts = [[100, 38], [100, 88], [100, 140], [100, 212], [100, 262]];
    const lab = ["머리", "어깨", "배", "무릎", "발"];
    return `<svg viewBox="0 0 200 290" class="body-svg" aria-label="내 몸 궁전">
      <circle cx="100" cy="38" r="26" fill="#efe9dd" stroke="#14213d" stroke-width="4"/>
      <path d="M100 64 V180 M52 88 H148 M100 180 L70 270 M100 180 L130 270 M52 88 L38 150 M148 88 L162 150" stroke="#14213d" stroke-width="6" stroke-linecap="round" fill="none"/>
      ${pts.map(([x, y], i) => `<g class="bp ${active === i || active === "all" ? "on" : ""}"><circle cx="${x}" cy="${y}" r="15"/><text x="${x}" y="${y + 6}" text-anchor="middle">${i + 1}</text><text class="bl" x="${[136, 172, 172, 150, 150][i]}" y="${y + 6}" text-anchor="start">${lab[i]}</text></g>`).join("")}
    </svg>`;
  }
  function renderMethod() {
    const M = window.METHOD_LESSON;
    const st = store.drafts.method || (store.drafts.method = { i: 0, rc: [] });
    const plain = (t) => esc(t.replace(/\[\[|\]\]/g, ""));
    const marked = (t) => esc(t).replace(/\[\[(.+?)\]\]/g, '<mark class="ul">$1</mark>');
    const root = h(`<section class="method-page">
      <a class="back" href="#/">← 처음으로</a>
      ${partTabs("method")}
      <div class="class-head"><h1>📚 ${esc(M.title)}</h1><span class="muted">${esc(M.subtitle)} · 예시: ${esc(M.subject)} 「${esc(M.topic)}」</span></div>
      <div class="slide-dots"></div>
      <div class="slide-stage" tabindex="-1"></div>
      <div class="slide-nav"><button class="btn ghost sp">← 이전 장면</button><span class="sc"></span><button class="btn ghost sf">⛶ 크게</button><button class="btn sn">다음 장면 →</button></div>
      <div class="talk"></div>
    </section>`);
    $app.append(root);
    const stage = root.querySelector(".slide-stage"), talk = root.querySelector(".talk"), dots = root.querySelector(".slide-dots");
    const keyRow = (k) => `<div class="key-line"><span class="kn">${k.n}</span><span class="kh">${esc(k.head)}</span><span class="kt">${esc(k.text)}</span></div>`;

    const SCENE = {
      overview: () => `<div class="ov4">${[["📖", "읽기", "본문을 두 번 읽고 밑줄"], ["✏️", "요점 정리", "짧게 · 번호 · 5개로"], ["🧩", "기억법", "두문자어 · 연상 이미지"], ["🏛️", "기억의 궁전", "장소에 하나씩 넣고 꺼내기"]].map(([i, a, b], n) => `${n ? '<span class="ov-arrow">→</span>' : ""}<div class="ov-box"><div class="ov-i">${i}</div><b>${n + 1}. ${a}</b><span>${b}</span></div>`).join("")}</div>
        <p class="sl-topic">오늘의 본문: ${esc(M.subject)} 「${esc(M.topic)}」</p>`,
      passage: () => `<div class="sl-passage">${M.passage.map((p) => `<p>${plain(p)}</p>`).join("")}</div>`,
      underline: (sl) => `<div class="sl-passage">${M.passage.map((p) => `<p>${marked(p)}</p>`).join("")}</div>
        <div class="ul-rules">${sl.rules.map((r) => `<span>✏️ ${esc(r)}</span>`).join("")}</div>`,
      rules: (sl) => `<div class="ba"><div class="ba-b"><small>본문 문장</small>${esc(sl.before)}</div><div class="ba-arrow">⬇ 줄이기</div><div class="ba-a"><small>요점</small>${esc(sl.after)}</div></div>
        <ol class="rule-list">${sl.rules.map((r) => `<li>${esc(r)}</li>`).join("")}</ol>`,
      keys: () => `<div class="key-sheet"><div class="ks-title">📒 암기장 · ${esc(M.topic)}</div>${M.keys.map(keyRow).join("")}</div>`,
      acro: () => `<div class="acro-row">${M.keys.map((k) => `<div class="acro-cell"><div class="acro-big">${esc(k.acro)}</div><div class="acro-sub">${esc(k.k[0])}</div><div class="acro-head">${esc(k.head)}</div></div>`).join("")}</div>
        <div class="acro-phrase">“부한 · 의명정”</div><p class="sl-note">↑ 리듬을 붙여 세 번 소리 내어 읽기</p>`,
      assoc: () => `<div class="own-notice"><b>⚠️ 아래 장면은 예시입니다.</b> 내가 아는 것으로 바꿔 직접 만들어야 내 기억이 됩니다.</div>
        <div class="assoc-list">${M.keys.map((k, i) => `<div class="assoc-item"><div class="ai-key">${k.n} ${esc(k.head)} <small>${esc(k.text)}</small></div><div class="ai-scene">🎬 ${esc(M.scenes[i])}</div></div>`).join("")}</div>`,
      palaces: () => `<div class="pal-grid">${M.palaces.map((p) => `<div class="pal-card ${p.id === "body" ? "pick" : ""}"><div class="pal-name">${p.icon} ${esc(p.name)}${p.id === "body" ? ' <span class="pal-tag">오늘 사용</span>' : ""}</div>
          <div class="pal-places">${p.places.map((x, i) => `<span>${i + 1} ${esc(x)}</span>`).join("")}</div><p>${esc(p.why)}</p></div>`).join("")}</div>`,
      place: () => `<div class="place-wrap"><div class="body-box">${bodySVG("all")}</div>
        <div class="place-list">${M.keys.map((k, i) => `<div class="pl-item"><span class="pl-n">${i + 1}</span><div><b>${esc(M.palaces[0].places[i])}</b> ← ${k.n} ${esc(k.head)}<div class="pl-scene">${esc(M.bodyPlace[i])}</div></div></div>`).join("")}</div></div>`,
      link: () => `<div class="link-table"><div class="lt-head"><span>🏛️ 장소</span><span>🔤 글자</span><span>🎬 연상 장면</span><span>📒 요점</span></div>
        ${M.keys.map((k, i) => `<div class="lt-row"><span class="lt-place">${esc(M.palaces[0].places[i])}</span><span class="lt-acro">${esc(k.acro)}</span><span class="lt-scene">${esc(M.bodyPlace[i])}</span><span class="lt-key">${esc(k.text)}</span></div>`).join("")}</div>
        <p class="acro-phrase small">머리부터 발까지 “부 · 한 · 의 · 명 · 정”</p>`,
      recall: () => `<div class="recall-wrap"><div class="body-box">${bodySVG(null)}</div>
        <div class="rc-list">${M.keys.map((k, i) => `<label class="rc-item"><span class="rc-cue">${i + 1}. <b class="cue" hidden>${esc(M.palaces[0].places[i])} · ${esc(k.acro)}</b></span><input type="text" data-i="${i}" placeholder="${i + 1}번째 요점" value="${esc(st.rc[i] || "")}"><span class="rc-ans" hidden>${esc(k.text)}</span></label>`).join("")}
        <div class="row" style="margin-top:10px"><button class="btn soft sm cue-btn">💡 단서 보기 (장소·글자)</button><button class="btn sm ans-btn">정답 보기</button></div><div class="rc-score"></div></div></div>`,
      wrap: () => `<div class="ov4 small">${["📖 읽기", "✏️ 요점 정리", "🧩 기억법", "🏛️ 궁전"].map((x, n) => `${n ? '<span class="ov-arrow">→</span>' : ""}<div class="ov-box"><b>${x}</b></div>`).join("")}</div>
        <div class="review3"><div><b>오늘 저녁</b><span>몸 짚으며 1번</span></div><div><b>내일</b><span>5칸 적기</span></div><div><b>일주일 뒤</b><span>거꾸로 말하기</span></div></div>`,
    };

    function show() {
      const i = st.i, sl = M.slides[i];
      save();
      renderStrip(SLIDE_STAGE[sl.kind] || null);
      dots.innerHTML = M.slides.map((x, n) => `<button class="sdot ${n === i ? "on" : ""} ${(SLIDE_STAGE[x.kind] || ["none"])[0]}" data-n="${n}" title="${esc(x.title)}">${n + 1}</button>`).join("");
      dots.querySelectorAll(".sdot").forEach((b) => (b.onclick = () => { st.i = +b.dataset.n; show(); }));
      stage.innerHTML = `<div class="sl-count">장면 ${i + 1} / ${M.slides.length}</div><h2 class="sl-title">${esc(sl.title)}</h2>${SCENE[sl.kind](sl)}`;
      talk.innerHTML = `<div class="talk-head">🎤 선생님 설명</div>${sl.talk.map((t) => `<p>${esc(t)}</p>`).join("")}${sl.ask ? `<div class="talk-ask">🙋 ${esc(sl.ask)}</div>` : ""}`;
      root.querySelector(".sc").textContent = `${i + 1} / ${M.slides.length}`;
      root.querySelector(".sp").disabled = i === 0;
      root.querySelector(".sn").disabled = i === M.slides.length - 1;
      if (sl.kind === "recall") {
        stage.querySelectorAll("input").forEach((inp) => inp.addEventListener("input", () => { st.rc[+inp.dataset.i] = inp.value; save(); }));
        stage.querySelector(".cue-btn").onclick = () => stage.querySelectorAll(".cue").forEach((c) => (c.hidden = false));
        stage.querySelector(".ans-btn").onclick = () => {
          let ok = 0;
          stage.querySelectorAll(".rc-item").forEach((row, n) => {
            const v = norm(row.querySelector("input").value);
            const hit = v && M.keys[n].k.some((w) => v.includes(norm(w)));
            if (hit) ok++;
            row.classList.toggle("hit", !!hit); row.classList.toggle("miss", !hit);
            row.querySelector(".rc-ans").hidden = false;
          });
          stage.querySelector(".rc-score").innerHTML = `<div class="score-line">${ok} / 5 꺼냈어요 ${ok === 5 ? "🎉" : "— 틀린 칸은 장면을 더 크게 바꿔 보세요"}</div>`;
        };
      }
    }
    root.querySelector(".sp").onclick = () => { if (st.i > 0) { st.i--; show(); } };
    root.querySelector(".sn").onclick = () => { if (st.i < M.slides.length - 1) { st.i++; show(); } };
    root.querySelector(".sf").onclick = () => { try { (stage.requestFullscreen || stage.webkitRequestFullscreen).call(stage); } catch (e) { /* 전체 화면 불가 */ } };
    const onKey = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      if (e.key === "ArrowRight" && st.i < M.slides.length - 1) { st.i++; show(); }
      if (e.key === "ArrowLeft" && st.i > 0) { st.i--; show(); }
    };
    document.addEventListener("keydown", onKey);
    cleanup = () => document.removeEventListener("keydown", onKey);
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
  function revealGate(d, label, buildContent, hasOwn, opt) {
    hasOwn = hasOwn || (() => String(d.s || "").trim());
    opt = opt || {};
    const wrap = h(`<div class="gate"><button class="btn soft gate-btn">👀 ${esc(label)}</button><div class="gate-msg"></div><div class="gate-body" hidden></div></div>`);
    const btn = wrap.querySelector(".gate-btn"), body = wrap.querySelector(".gate-body"), msg = wrap.querySelector(".gate-msg");
    const open = () => {
      btn.remove(); msg.innerHTML = ""; body.hidden = false;
      body.append(h(`<div class="ref-head">${opt.head || "📎 참고 예시 — 외우지 마세요! 만드는 <b>방법</b>만 가져가세요"}</div>`));
      buildContent(body);
      if (opt.after !== "") body.append(h(`<div class="after-ref">✏️ 이제 예시에서 배운 방법으로 <b>위의 내 것을 더 과장해서 고쳐</b> 보세요. 내 장면이 예시보다 이상하고 재미있으면 성공!</div>`));
      d[opt.flag || "opened"] = true; save();
    };
    btn.onclick = () => {
      if (!hasOwn() && !btn.dataset.warned) {
        btn.dataset.warned = "1"; btn.textContent = "👀 그래도 예시 보기";
        msg.innerHTML = `<div class="feedback bad">먼저 위 칸에 한 줄이라도 <b>내 것</b>을 적어 보세요. 서툴러도 괜찮아요!</div>`;
        return;
      }
      open();
    };
    if (d[opt.flag || "opened"]) open();
    return wrap;
  }

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

  /* =====================================================================
     단계 화면 (기초 · 중급 · 고급) — 먼저 보기 + 훈련 고르기
     ===================================================================== */
  const keyList = (keys, cls) => `<div class="key-sheet ${cls || ""}">${keys.map((k, i) => `<div class="key-line"><span class="kn">${i + 1}</span><span class="kh">${esc(k.head)}</span><span class="kt">${esc(k.text || "")}</span></div>`).join("")}</div>`;
  const passageHTML = (text) => `<div class="sl-passage">${text.map((p) => `<p>${esc(p)}</p>`).join("")}</div>`;
  const acroOf = (k) => k.acro || firstChar(k.head);
  const palById = (id) => PAL.find((p) => p.id === id) || PAL[0];
  const techsFor = (n) => TECHS.filter((t) => TR[t.id] && TR[t.id][n]);

  function demoView(n, techId) {
    const D = LV[n].demo, pal = palById(D.palace.id);
    const assoc = `<div class="assoc-list">${D.keys.map((k, i) => `<div class="assoc-item"><div class="ai-key">${i + 1}. ${esc(k.head)} <small>${esc(k.text)}</small></div><div class="ai-scene">🎬 ${esc(D.assoc[i])}</div></div>`).join("")}</div>`;
    const palace = `<p class="demo-pal">${pal.icon} <b>${esc(pal.name)}</b> 궁전 사용 — ${D.palace.places.map(esc).join(" → ")}</p>
      <div class="place-list">${D.keys.map((k, i) => `<div class="pl-item"><span class="pl-n">${i + 1}</span><div><b>${esc(D.palace.places[i])}</b> ← ${esc(k.head)}<div class="pl-scene">${esc(D.palace.scenes[i])}</div></div></div>`).join("")}</div>`;
    const acro = `<div class="acro-row">${D.keys.map((k) => `<div class="acro-cell"><div class="acro-big">${esc(acroOf(k))}</div><div class="acro-sub">${esc(k.head)}</div></div>`).join("")}</div>
      <div class="acro-phrase small">“${esc(D.acro.phrase)}”</div><p class="sl-note">${esc(D.acro.note)}</p>`;
    const combo = `<div class="acro-phrase small">🔤 “${esc(D.acro.phrase)}”</div>
      <div class="link-table"><div class="lt-head"><span>🏛️ 장소</span><span>🔤 글자</span><span>🎬 장면</span><span>📒 요점</span></div>
      ${D.keys.map((k, i) => `<div class="lt-row"><span class="lt-place">${esc(D.palace.places[i])}</span><span class="lt-acro">${esc(acroOf(k))}</span><span class="lt-scene">${esc(D.palace.scenes[i])}</span><span class="lt-key">${esc(k.head)} — ${esc(k.text)}</span></div>`).join("")}</div>
      <p class="sl-note">두문자어가 순서와 개수를, 궁전이 꺼낼 위치를, 장면이 내용을 지켜 줍니다.</p>`;
    return { assoc, palace, acro, combo }[techId];
  }

  function renderLevel(n) {
    const L = LV[n], D = L.demo;
    const tabs = [["assoc", "🖼️ 연상 이미지"], ["palace", "🏛️ 기억의 궁전"], ["acro", "🔤 두문자어"], ["combo", "🧩 3가지 함께"]];
    const cards = techsFor(n).map((t) => {
      const T2 = TR[t.id][n], done = store.done[`${t.id}-${n}`];
      return `<a class="tr-card" style="--c:${t.color}" href="#/t/${t.id}/${n}">
        <span class="tr-icon">${t.icon}</span>
        <div class="tr-body"><b>${esc(t.name)}</b><span class="tr-title">${esc(T2.title)}</span>
          <span class="tr-subj">${T2.passages.map((P) => { const s = subj(P.subject); return `<i style="--sc:${s.color}">${s.icon} ${esc(P.subject)} · ${esc(P.title)}</i>`; }).join("")}</span></div>
        <span class="check">${done ? "✅" : "›"}</span></a>`;
    }).join("");
    const root = h(`<section>
      <a class="back" href="#/">← 처음으로</a>
      <div class="lv-head" style="--lc:${L.color}"><span class="lv-badge">${L.level}</span><div><h1>${L.level} 훈련</h1><p class="muted">${esc(L.desc)}</p></div></div>

      <div class="card demo-card">
        <h2>👀 먼저 보기 — 같은 본문을 기억법으로 바꾸는 과정</h2>
        <p class="muted">${esc(D.subject)} 「${esc(D.title)}」로 ① 본문 → ② 요점 정리 → ③ 기억법 순서를 먼저 봅니다. 아래 장면은 방법을 보여 주는 예시예요.</p>
        <div class="demo-step"><span class="ds-n write">① 본문</span>${passageHTML(D.text)}</div>
        <div class="demo-step"><span class="ds-n write">② 요점 정리</span>${keyList(D.keys)}</div>
        <div class="demo-step"><span class="ds-n store">③ 기억법 적용</span>
          <div class="demo-tabs">${tabs.map(([id, nm], i) => `<button class="demo-tab ${i ? "" : "on"}" data-t="${id}">${nm}</button>`).join("")}</div>
          <div class="demo-body">${demoView(n, "assoc")}</div></div>
      </div>

      <h2 style="margin-top:28px">✏️ 훈련 고르기</h2>
      <p class="muted">각 훈련은 <b>사용법 먼저 보기 → ① 본문 읽기 → ② 요점 정리 → ③ 기억법 적용 → ④ 꺼내기</b> 순서로 진행됩니다.</p>
      <div class="tr-list">${cards}</div>
      ${LV[n + 1] ? `<a class="btn ghost" style="margin-top:18px" href="#/lv/${n + 1}">${LV[n + 1].level} 단계로 →</a>` : ""}
    </section>`);
    root.querySelectorAll(".demo-tab").forEach((b) => (b.onclick = () => {
      root.querySelectorAll(".demo-tab").forEach((x) => x.classList.toggle("on", x === b));
      root.querySelector(".demo-body").innerHTML = demoView(n, b.dataset.t);
    }));
    $app.append(root);
  }

  /* =====================================================================
     훈련: 사용법 → ① 본문 읽기 → ② 요점 정리 → ③ 기억법 적용 → ④ 꺼내기
     ===================================================================== */
  const LSTEP = {
    howto: { name: "사용법 먼저 보기", st: null },
    read: { name: "① 본문 읽기", st: ["write"] },
    keys: { name: "② 요점 정리", st: ["write"] },
    apply: { name: "③ 기억법 적용", st: ["store"] },
    recall: { name: "④ 꺼내기", st: ["recall"] },
  };

  function renderLesson(techId, n) {
    const tech = techById(techId), TD = TR[techId][n], L = LV[n];
    const steps = [{ t: "howto" }];
    TD.passages.forEach((P, pi) => ["read", "keys", "apply", "recall"].forEach((t) => steps.push({ t, P, pi })));
    let idx = 0;
    const root = h(`<section>
      <a class="back" href="#/lv/${n}">← ${L.level} 훈련</a>
      <div class="lesson-top"><b style="color:${L.color}">${L.level}</b><div class="progress"><i></i></div><span class="muted pc"></span></div>
      <h2>${tech.icon} ${esc(tech.name)} · ${esc(TD.title)}</h2>
      <p class="muted">🎯 ${esc(TD.goal)}</p>
      <div class="track"></div>
      <div class="card stage" tabindex="-1"></div>
      <div class="lesson-nav"><button class="btn ghost prev">이전</button><button class="btn next">다음</button></div>
    </section>`);
    $app.style.setProperty("--c", tech.color);
    $app.append(root);
    const stage = root.querySelector(".stage"), bar = root.querySelector(".progress > i"), pc = root.querySelector(".pc");
    const prev = root.querySelector(".prev"), next = root.querySelector(".next"), track = root.querySelector(".track");
    const goStep = (i) => { idx = i; show(); window.scrollTo({ top: 0, behavior: "smooth" }); };

    function show() {
      const S = steps[idx], meta = LSTEP[S.t];
      bar.style.width = ((idx + 1) / (steps.length + 1)) * 100 + "%";
      pc.textContent = `${idx + 1} / ${steps.length}`;
      prev.disabled = idx === 0;
      next.textContent = idx === steps.length - 1 ? "완료하기 ✓" : S.t === "recall" ? "다음 훈련 →" : "다음";
      renderStrip(meta.st);
      stage.style.setProperty("--stc", meta.st ? `var(--st-${meta.st[0]})` : "var(--line)");
      if (S.P) {
        const s = subj(S.P.subject);
        track.innerHTML = `<div class="tr-label" style="--sc:${s.color}">훈련 ${S.pi + 1} / ${TD.passages.length} · <span class="ex-subj">${s.icon} ${esc(S.P.subject)}</span> 「${esc(S.P.title)}」</div>
          <div class="track-steps">${["read", "keys", "apply", "recall"].map((t) => `<span class="${LSTEP[t].st[0]} ${t === S.t ? "on" : ""}">${LSTEP[t].name}</span>`).join("")}</div>`;
      } else track.innerHTML = "";
      stage.innerHTML = "";
      const key = S.P ? `${techId}-${n}-${S.pi}` : `${techId}-${n}-howto`;
      const d = store.drafts[key] || (store.drafts[key] = {});
      STEP[S.t](stage, { S, P: S.P, d, tech, techId, n, TD, goStep, idx });
    }
    function finish() {
      store.done[`${techId}-${n}`] = true; save();
      bar.style.width = "100%"; renderStrip(null);
      const list = techsFor(n), nextT = list[list.findIndex((t) => t.id === techId) + 1];
      stage.innerHTML = "";
      stage.append(h(`<div class="done-box"><div class="big">🎉</div><h2>${esc(tech.name)} ${L.level} 훈련 완료!</h2>
        <p class="muted">💡 오늘 저녁, 내일, 일주일 뒤에 요점을 한 번씩 다시 꺼내 보세요. 세 번 꺼내면 오래 남습니다.</p>
        <div class="row" style="justify-content:center"><a class="btn ghost" href="#/lv/${n}">${L.level} 목록으로</a>
        ${nextT ? `<a class="btn" href="#/t/${nextT.id}/${n}">다음: ${esc(nextT.name)} →</a>` : LV[n + 1] ? `<a class="btn" href="#/lv/${n + 1}">${LV[n + 1].level} 단계로 →</a>` : `<a class="btn" href="#/notes">내 기억 노트 →</a>`}</div></div>`));
      track.innerHTML = "";
      root.querySelector(".lesson-nav").style.display = "none";
      pc.textContent = "완료";
    }
    prev.onclick = () => { if (idx > 0) goStep(idx - 1); };
    next.onclick = () => { if (idx < steps.length - 1) goStep(idx + 1); else finish(); };
    show();
  }

  const STEP = {
    howto(el, { techId, n, TD }) {
      const D = LV[n].demo;
      el.append(h(`<div><span class="stage-tag kind">사용법 먼저 보기</span>
        <h3 style="margin-top:8px">${esc(TECHS.find((t) => t.id === techId).name)}은(는) 이렇게 씁니다</h3>
        ${TD.howto.body.map((p) => `<p>${esc(p)}</p>`).join("")}
        <div class="tips">${TD.howto.tips.map((t) => `<div>✔ ${esc(t)}</div>`).join("")}</div>
        ${techId === "palace" || techId === "combo" ? `<h4 style="margin:18px 0 8px">🏛️ 궁전으로 쓸 수 있는 장소</h4><div class="pal-grid">${PAL.map((p) => `<div class="pal-card"><div class="pal-name">${p.icon} ${esc(p.name)}</div><div class="pal-places">${p.places.map((x, i) => `<span>${i + 1} ${esc(x)}</span>`).join("")}</div></div>`).join("")}</div>` : ""}
        <div class="howto-demo"><h4>👀 예시로 보기 — ${esc(D.subject)} 「${esc(D.title)}」</h4>
          <div class="demo-step"><span class="ds-n write">요점</span>${keyList(D.keys, "compact")}</div>
          <div class="demo-step"><span class="ds-n store">기억법 적용</span>${demoView(n, techId)}</div></div>
        <p class="own-title" style="margin-top:14px">이제 다음 화면부터 직접 해 봅니다. 본문 → 요점 정리 → 기억법 → 꺼내기!</p></div>`));
    },

    read(el, { P, d }) {
      d.hl = d.hl || [];
      let w = 0;
      const paras = P.text.map((p) => `<p>${p.split(" ").map((x) => `<span class="w ${d.hl.includes(w) ? "hl" : ""}" data-w="${w++}">${esc(x)}</span>`).join(" ")}</p>`).join("");
      const box = h(`<div>
        <div class="howread">📖 <b>두 번 읽으세요.</b> 처음엔 흐름만, 두 번째엔 <b>연필로 중요한 단어에 밑줄</b>을 긋습니다. 화면에서는 단어를 눌러 형광펜으로 표시할 수 있어요.
          <div class="muted" style="margin-top:4px">밑줄 기준: 이름(용어·사람·장소) · 숫자(연도) · 하는 일 · 결과</div></div>
        <h3>${esc(P.title)}</h3>
        <div class="sl-passage read-passage">${paras}</div>
        <p class="muted hl-count"></p></div>`);
      const cnt = box.querySelector(".hl-count");
      const upd = () => (cnt.textContent = d.hl.length ? `형광펜 ${d.hl.length}개 — 밑줄은 한 문장에 2~3개면 충분해요.` : "");
      box.querySelectorAll(".w").forEach((s) => (s.onclick = () => {
        const i = +s.dataset.w, k = d.hl.indexOf(i);
        if (k >= 0) d.hl.splice(k, 1); else d.hl.push(i);
        s.classList.toggle("hl"); save(); upd();
      }));
      upd();
      el.append(box);
    },

    keys(el, { P, d }) {
      d.my = d.my || [];
      const N = P.keys.length;
      const box = h(`<div>
        <details class="ref-mini"><summary>📖 본문 다시 보기</summary>${passageHTML(P.text)}</details>
        <h3 style="margin-top:12px">요점 ${N}개를 정리하세요</h3>
        <div class="rule-mini">✂️ 짧게 (이름만 남기기) · 🔢 번호 붙이기 · 🏷️ 앞에 머리말 · 📦 비슷한 것끼리 묶기</div>
        <div class="my-keys">${Array.from({ length: N }, (_, i) => `<label class="mk"><span>${i + 1}</span><input type="text" data-i="${i}" placeholder="머리말 — 핵심 내용" value="${esc(d.my[i] || "")}"></label>`).join("")}</div>
        <div class="gate-slot"></div></div>`);
      box.querySelectorAll(".mk input").forEach((inp) => inp.addEventListener("input", () => { d.my[+inp.dataset.i] = inp.value; save(); }));
      box.querySelector(".gate-slot").append(revealGate(d, "모범 요점과 비교하기", (bd) => {
        bd.append(h(`<div>${keyList(P.keys)}<p class="sl-note">내 요점과 비교해 빠진 것을 공책에 보충하세요. 다음 단계부터는 이 요점을 기억법으로 바꿉니다.</p></div>`));
      }, () => d.my.some((x) => String(x || "").trim()), { head: "📒 모범 요점", after: "", flag: "openedKeys" }));
      el.append(box);
    },

    apply(el, ctx) {
      const { P, d, techId } = ctx;
      const N = P.keys.length;
      d.sc = d.sc || [];
      const box = h(`<div><h3>요점을 기억법으로 바꾸기</h3>
        <div class="apply-keys"><div class="ak-title">📒 외울 요점</div>${keyList(P.keys, "compact")}</div>
        ${OWN_NOTICE}<div class="builder"></div>
        <div class="hint">💡 힌트 <small>(내가 아는 것으로 바꿔서 쓰세요)</small><br>${esc(P.hint)}</div>
        <div class="gate-slot"></div>
        <div class="row" style="margin-top:14px"><button class="btn soft sv">📒 내 기억 노트에 저장</button><span class="saved-msg"></span></div></div>`);
      const B = box.querySelector(".builder");

      const acroPart = () => {
        d.ord = d.ord && d.ord.length === N ? d.ord : P.keys.map((_, i) => i);
        const w = h(`<div class="b-sec"><div class="b-title">🔤 두문자어 만들기</div>
          <div class="letters"></div>
          <div class="row"><span class="muted ord-note">${P.order === false ? "순서가 상관없는 목록이에요. 섞어서 소리 내기 쉬운 조합을 찾아보세요." : "순서가 중요한 목록이에요. 순서를 바꾸지 마세요."}</span>${P.order === false ? `<button class="btn soft sm shf">🔀 순서 섞기</button>` : ""}</div>
          <label class="field">내가 만든 두문자어 · 문장</label><input type="text" class="ph" placeholder="글자를 리듬 있게 끊거나, 내가 아는 말로 문장을 만들어 보세요" value="${esc(d.ph || "")}"></div>`);
        const draw = () => (w.querySelector(".letters").innerHTML = d.ord.map((i) => `<div class="acro-cell"><div class="acro-big sm">${esc(acroOf(P.keys[i]))}</div><div class="acro-sub">${esc(P.keys[i].head)}</div></div>`).join(""));
        draw();
        const sh = w.querySelector(".shf");
        if (sh) sh.onclick = () => { d.ord = shuffle(d.ord); save(); draw(); };
        w.querySelector(".ph").addEventListener("input", (e) => { d.ph = e.target.value; save(); });
        return w;
      };
      const palacePart = () => {
        d.pal = d.pal || P.palace || "body";
        if (!d.pl || d.pl.length !== N) d.pl = d.pal === P.palace && P.places ? P.places.slice() : palById(d.pal).places.slice(0, N);
        const w = h(`<div class="b-sec"><div class="b-title">🏛️ 궁전 고르기 → 장소마다 장면 붙이기</div>
          <div class="pal-pick">${PAL.map((p) => `<button class="pp ${p.id === d.pal ? "on" : ""}" data-p="${p.id}">${p.icon} ${esc(p.name)}</button>`).join("")}</div>
          <div class="pal-rows">${P.keys.map((k, i) => `<div class="pal-row"><input type="text" class="pl" data-i="${i}" value="${esc(d.pl[i] || "")}" placeholder="장소"><span class="pr-key">← ${i + 1}. ${esc(k.head)}</span>
            <textarea class="scn" data-i="${i}" placeholder="이 장소에 '${esc(k.head)}'이(가) 직접 닿는 과장된 장면">${esc(d.sc[i] || "")}</textarea></div>`).join("")}</div></div>`);
        w.querySelectorAll(".pp").forEach((b) => (b.onclick = () => {
          d.pal = b.dataset.p;
          const p = palById(d.pal);
          d.pl = d.pal === P.palace && P.places ? P.places.slice() : p.places.slice(0, N);
          while (d.pl.length < N) d.pl.push("");
          save(); B.innerHTML = ""; build();
        }));
        w.querySelectorAll(".pl").forEach((x) => x.addEventListener("input", () => { d.pl[+x.dataset.i] = x.value; save(); }));
        w.querySelectorAll(".scn").forEach((x) => x.addEventListener("input", () => { d.sc[+x.dataset.i] = x.value; save(); }));
        return w;
      };
      const assocPart = () => {
        const w = h(`<div class="b-sec"><div class="b-title">🖼️ 요점마다 장면 만들기 ${n2story(ctx.n)}</div>
          ${P.keys.map((k, i) => `<div class="as-row"><div class="as-key">${i + 1}. ${esc(k.head)} <small>${esc(k.text || "")}</small></div>
          <textarea class="scn" data-i="${i}" placeholder="내가 아는 것으로 크게·움직이게·이상하게">${esc(d.sc[i] || "")}</textarea></div>`).join("")}</div>`);
        w.querySelectorAll(".scn").forEach((x) => x.addEventListener("input", () => { d.sc[+x.dataset.i] = x.value; save(); }));
        return w;
      };
      function build() {
        if (techId === "assoc") B.append(assocPart());
        if (techId === "palace") B.append(palacePart());
        if (techId === "acro") B.append(acroPart());
        if (techId === "combo") B.append(acroPart(), palacePart());
      }
      build();
      box.querySelector(".gate-slot").append(revealGate(d, "예시 참고하기", (bd) => {
        bd.append(h(Array.isArray(P.example) ? `<ol class="ex-list">${P.example.map((x) => `<li>${esc(x)}</li>`).join("")}</ol>` : `<p class="ex-text">${esc(P.example)}</p>`));
      }, () => (d.sc || []).some((x) => String(x || "").trim()) || String(d.ph || "").trim()));
      box.querySelector(".sv").onclick = () => {
        const lines = P.keys.map((k, i) => `${i + 1}. ${k.head}${d.pl ? ` @${d.pl[i] || ""}` : ""}${d.sc && d.sc[i] ? ` — ${d.sc[i]}` : ""}`);
        addNote(TECHS.find((t) => t.id === techId), `${TECHS.find((t) => t.id === techId).name} · ${P.subject}`, P.title, `${d.ph ? `🔤 ${d.ph}\n` : ""}${lines.join("\n")}`, `${techId}-${ctx.n}-${ctx.S.pi}`);
        savedFlash(box);
      };
      el.append(box);
    },

    recall(el, { P, d, techId, goStep, idx }) {
      d.rc = d.rc || [];
      const N = P.keys.length;
      const cueOf = (i) => {
        if ((techId === "palace" || techId === "combo") && d.pl) return `${d.pl[i] || ""}${techId === "combo" ? " · " + acroOf(P.keys[i]) : ""}`;
        if (techId === "acro") { const o = d.ord && d.ord.length === N ? d.ord : P.keys.map((_, j) => j); return acroOf(P.keys[o[i]]); }
        const s = (d.sc && d.sc[i]) || ""; return s ? s.slice(0, 14) + "…" : `${i + 1}번째 장면`;
      };
      const box = h(`<div><h3>💡 보지 말고 꺼내기</h3>
        <p>본문과 요점을 보지 말고, 기억법을 떠올리며 요점 ${N}개를 적어 보세요. 막히면 '단서 보기'를 누르세요.</p>
        <div class="rc-list">${Array.from({ length: N }, (_, i) => `<label class="rc-item"><span class="rc-cue">${i + 1}. <b class="cue" hidden>${esc(cueOf(i))}</b></span><input type="text" data-i="${i}" value="${esc(d.rc[i] || "")}" placeholder="${i + 1}번째 요점"></label>`).join("")}</div>
        <div class="row" style="margin-top:12px"><button class="btn soft cue-btn">🔑 단서 보기</button><button class="btn chk">채점하기</button></div>
        <div class="rc-out"></div></div>`);
      box.querySelectorAll(".rc-item input").forEach((x) => x.addEventListener("input", () => { d.rc[+x.dataset.i] = x.value; save(); }));
      box.querySelector(".cue-btn").onclick = () => box.querySelectorAll(".cue").forEach((c) => (c.hidden = false));
      box.querySelector(".chk").onclick = () => {
        const answers = d.rc.map(norm).filter(Boolean);
        const hits = P.keys.map((k) => (k.k || [k.head]).some((w) => answers.some((a) => a.includes(norm(w)))));
        const ok = hits.filter(Boolean).length;
        d.score = ok; save();
        const out = box.querySelector(".rc-out");
        out.innerHTML = `<div class="score-line">${ok} / ${N}개 꺼냈어요 ${ok === N ? "🎉" : ""}</div>
          <div class="rc-result">${P.keys.map((k, i) => `<div class="${hits[i] ? "hit" : "miss"}">${hits[i] ? "✅" : "❌"} <b>${esc(k.head)}</b> ${esc(k.text || "")}</div>`).join("")}</div>
          ${ok < N ? `<p class="muted">❌ 표시된 요점은 장면을 더 크게, 더 이상하게 바꿔 다시 저장해 보세요.</p>` : `<p class="muted">완벽해요! 내일 한 번 더 꺼내 보면 오래 남습니다.</p>`}`;
        if (ok < N) {
          const back = h(`<button class="btn ghost sm">← 기억법 다시 고치기</button>`);
          back.onclick = () => goStep(idx - 1);
          out.append(back);
        }
      };
      el.append(box);
    },
  };
  const n2story = (n) => (n === 2 ? `<small class="muted">— 앞 장면의 물건이 다음 장면에 다시 나오게 이야기로 이어 보세요</small>` : "");

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
