/* ORAV project page — interactions (v5) */
(() => {
  "use strict";

  const D = window.ORAV_DATA;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const hasIO = "IntersectionObserver" in window;

  const MOD = { image: "img", video: "vid", audio: "aud" };
  const ROLE_MOD = {
    subject: "image", prop: "image", scene: "image", style: "image",
    motion: "video", camera: "video", vfx: "video", speech: "audio", music: "audio",
  };
  const MODELS = D.models;
  const modelById = Object.fromEntries(MODELS.map((m) => [m.id, m]));
  const caseById = Object.fromEntries(D.showcase.map((c) => [c.id, c]));

  /* ---------------------------------------------------------------- helpers */

  const esc = (s) => String(s).replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]);
  const signed = (s) => String(s).replace(/^-/, "\u2212");
  const pad2 = (n) => String(n).padStart(2, "0");
  const icon = (id) => `<svg class="i" aria-hidden="true"><use href="#${id}"/></svg>`;
  const modVar = (modality) => `var(--${MOD[modality]})`;
  const clock = (t, tenths = false) => {
    const v = Math.max(0, t || 0);
    const m = Math.floor(v / 60);
    const s = v - m * 60;
    return `${pad2(m)}:${tenths ? s.toFixed(1).padStart(4, "0") : pad2(Math.floor(s))}`;
  };
  const curly = (s) => s.replace(/"([^"]+)"/g, "\u201C$1\u201D").replace(/(\w)'(\w)/g, "$1\u2019$2");
  const tokens = (s) =>
    esc(curly(s)).replace(/@(image|video|audio)(\d+)/g, (_, kind, n) =>
      `<span class="tok" data-h="@${kind}${n}" data-m="${kind}">@${kind}${n}</span>`);

  function fadeSwap(parts, apply, delay = 240) {
    parts.forEach((p) => p.classList.add("is-fading"));
    window.setTimeout(() => {
      apply();
      requestAnimationFrame(() => parts.forEach((p) => p.classList.remove("is-fading")));
    }, delay);
  }

  function waveSVG(peaks, { bars = 80, h = 24, cls = "" } = {}) {
    if (!peaks || !peaks.length) return "";
    const n = Math.min(bars, peaks.length);
    const step = peaks.length / n;
    const w = 100 / n;
    let rects = "";
    for (let i = 0; i < n; i += 1) {
      const a = Math.floor(i * step);
      const b = Math.max(a + 1, Math.floor((i + 1) * step));
      let v = 0;
      for (let k = a; k < b; k += 1) v = Math.max(v, peaks[k]);
      const bh = Math.max(0.07, v / 100) * h;
      rects += `<rect x="${(i * w + w * 0.2).toFixed(3)}" y="${((h - bh) / 2).toFixed(2)}" width="${(w * 0.6).toFixed(3)}" height="${bh.toFixed(2)}"/>`;
    }
    return `<svg class="wave ${cls}" viewBox="0 0 100 ${h}" preserveAspectRatio="none" aria-hidden="true">${rects}</svg>`;
  }

  /* ---------------------------------------------------------------- reference plates */

  function plateHTML(ref) {
    const label = `${ref.role} reference ${ref.handle}`;
    let media;
    if (ref.modality === "image") {
      media = `<img src="${ref.file}" alt="${esc(label)}" class="zoomable" loading="lazy" decoding="async">`;
    } else if (ref.modality === "video") {
      media = `<video src="${ref.file}" poster="${ref.poster}" muted loop playsinline preload="none" aria-label="${esc(label)}"></video>`;
    } else {
      media = `<div class="plate-audio">${waveSVG(ref.wave, { bars: 44, h: 40 })}<button type="button" class="plate-play" data-src="${ref.file}" aria-label="Play ${esc(ref.handle)}">${icon("i-play")}</button></div>`;
    }
    return `<figure class="plate" data-h="${ref.handle}" data-m="${ref.modality}" style="--m:${modVar(ref.modality)}"><div class="plate-media">${media}</div><figcaption class="plate-cap"><b>${ref.handle}</b><span>${esc(ref.role)}</span></figcaption></figure>`;
  }

  const plateObserver = hasIO
    ? new IntersectionObserver((entries) => {
        entries.forEach((e) => {
          const v = e.target;
          if (e.isIntersecting && !reduceMotion && !document.hidden) {
            v.preload = "auto";
            v.play().catch(() => {});
          } else {
            v.pause();
          }
        });
      }, { threshold: 0.2 })
    : null;

  function watchPlates(root) {
    $$(".plate video", root).forEach((v) => (plateObserver ? plateObserver.observe(v) : null));
  }

  function unwatchPlates(root) {
    $$(".plate video", root).forEach((v) => {
      if (plateObserver) plateObserver.unobserve(v);
      v.pause();
    });
  }

  const refAudio = new Audio();
  let refAudioBtn = null;
  function setRefButton(btn) {
    if (refAudioBtn) refAudioBtn.innerHTML = icon("i-play");
    refAudioBtn = btn;
    if (btn) btn.innerHTML = icon("i-pause");
  }
  refAudio.addEventListener("ended", () => setRefButton(null));
  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".plate-play");
    if (!btn) return;
    if (refAudioBtn === btn && !refAudio.paused) {
      refAudio.pause();
      setRefButton(null);
      return;
    }
    refAudio.src = btn.dataset.src;
    refAudio.play().catch(() => {});
    setRefButton(btn);
  });

  function linkScope(root) {
    const set = (h, on) => $$(`[data-h="${h}"]`, root).forEach((el) => el.classList.toggle("is-linked", on));
    root.addEventListener("mouseover", (e) => {
      const t = e.target.closest("[data-h]");
      if (t) set(t.dataset.h, true);
    });
    root.addEventListener("mouseout", (e) => {
      const t = e.target.closest("[data-h]");
      if (t && !t.contains(e.relatedTarget)) set(t.dataset.h, false);
    });
  }

  /* ---------------------------------------------------------------- masthead */

  const masthead = $("#masthead");
  const heroEl = $(".hero");
  const navLinks = $$(".mh-nav a");

  if (hasIO) {
    new IntersectionObserver(([entry]) => masthead.classList.toggle("is-solid", !entry.isIntersecting), {
      rootMargin: "-84px 0px 0px 0px",
    }).observe(heroEl);

    const navObserver = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        const id = e.target === heroEl ? "" : `#${e.target.id}`;
        navLinks.forEach((a) => a.classList.toggle("is-active", a.getAttribute("href") === id));
      });
    }, { rootMargin: "-42% 0px -56% 0px" });
    navObserver.observe(heroEl);
    navLinks.forEach((a) => {
      const sec = $(a.getAttribute("href"));
      if (sec) navObserver.observe(sec);
    });
  } else {
    masthead.classList.add("is-solid");
  }

  const inkSections = $$(".sec--dark");
  let inkQueued = false;
  const updateInk = () => {
    inkQueued = false;
    const line = masthead.offsetHeight / 2;
    masthead.classList.toggle(
      "is-ink",
      inkSections.some((sec) => {
        const r = sec.getBoundingClientRect();
        return r.top <= line && r.bottom > line;
      })
    );
  };
  window.addEventListener(
    "scroll",
    () => {
      if (!inkQueued) {
        inkQueued = true;
        requestAnimationFrame(updateInk);
      }
    },
    { passive: true }
  );
  updateInk();

  /* ---------------------------------------------------------------- hero drum */

  const MOD_ORDER = { image: 0, video: 1, audio: 2 };
  const REELS = 4;
  const PER_REEL = 10;
  const FW = 640;
  const FH = 360;
  const GAP = 18;
  const STEP = 360 / PER_REEL;
  const RADIUS = (FW + GAP) / (2 * Math.tan(Math.PI / PER_REEL));
  const CRUISE = 1.7;
  const DEG = Math.PI / 180;
  const INTRO = { flat: 1.2, bend: 2.6, push: 120, slide: 16 };
  const INTRO_T = INTRO.flat + INTRO.bend;
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

  function bezier(x1, y1, x2, y2) {
    const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
    const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
    return (x) => {
      let t = x;
      for (let i = 0; i < 8; i++) {
        const dx = (3 * ax * t + 2 * bx) * t + cx;
        if (Math.abs(dx) < 1e-6) break;
        t = clamp(t - (((ax * t + bx) * t + cx) * t - x) / dx, 0, 1);
      }
      return ((ay * t + by) * t + cy) * t;
    };
  }
  const bendEase = bezier(0.62, 0, 0.18, 1);
  const glideEase = bezier(0.3, 0, 0.2, 1);

  const drumStage = $("#drumStage");
  const drumEl = $("#drum");
  const heroContent = $(".hero-content");
  const card = $("#drumCard");
  const toggle = $("#drumToggle");
  const drum = {
    reels: [], frames: [], W: 1440, H: 860, P: 1150, depth: 0, zc: 0, s0: 0.6, curve: 0, progress: 0,
    intro: { t: 0, started: false, done: false },
    paused: reduceMotion, visible: true, raf: 0, last: 0, culled: 0, hover: null, drag: null,
    tilt: { x: 0, y: 0, tx: 0, ty: 0 },
  };

  const rolesOf = (refs) => {
    const seen = new Set();
    return refs
      .slice()
      .sort((a, b) => MOD_ORDER[a.modality] - MOD_ORDER[b.modality])
      .filter((r) => !seen.has(r.role) && seen.add(r.role));
  };

  function frameHTML(t, k) {
    const out = t.outputs[k];
    const dots = rolesOf(t.refs).map((r) => `<i style="--m:${modVar(r.modality)}"></i>`).join("");
    return `<figure class="frame${t.showcase != null ? " is-link" : ""}">
      <video muted loop playsinline preload="none" data-src="${out.video}"></video>
      <img class="frame-poster" src="${out.poster}" alt="" decoding="async">
      <figcaption class="frame-cap"><span>${esc(modelById[out.model].name)}</span><span class="frame-dots">${dots}</span></figcaption>
    </figure>`;
  }

  for (let r = 0; r < REELS; r++) {
    const tasks = D.drum.filter((t) => t.reel === r).sort((a, b) => a.col - b.col);
    const el = document.createElement("div");
    el.className = "reel";
    el.innerHTML = [0, 1].map((k) => tasks.map((t) => frameHTML(t, k)).join("")).join("");
    drumEl.appendChild(el);
    const dir = r % 2 ? -1 : 1;
    const reel = { el, index: r, dir, y: (r - (REELS - 1) / 2) * (FH + GAP), angle: r % 2 ? STEP / 2 : 0, view: 0, vel: reduceMotion ? 0 : dir * CRUISE, hold: false };
    $$(".frame", el).forEach((f, i) => {
      drum.frames.push({
        el: f, reel, base: i * STEP, task: tasks[i % tasks.length], out: Math.floor(i / tasks.length),
        video: $("video", f), img: $(".frame-poster", f), X: 0, vis: false, away: false, live: false, loaded: false, decoded: false, shown: false,
      });
    });
    drum.reels.push(reel);
  }

  const frameOf = (el) => drum.frames.find((f) => f.el === el) || null;
  const degPerPx = () => 180 / Math.PI / (drum.s0 * RADIUS);
  const drumActive = () => drum.visible && !document.hidden && !drum.paused;

  function layoutDrum() {
    drum.W = drumStage.clientWidth;
    drum.H = drumStage.clientHeight;
    drum.P = Math.round(clamp(drum.W * 0.8, 950, 1500));
    drum.s0 = (drum.H * 1.04) / (REELS * FH + (REELS - 1) * GAP);
    drum.depth = drum.P + RADIUS - drum.P / drum.s0;
    drumEl.style.perspective = `${drum.P}px`;
  }

  // curve 0 lays every reel out flat at the far-wall depth; curve 1 bends it into the drum.
  // The per-frame angle keeps each polygon side at FW + GAP, so neighbours never intersect
  // (intersecting 3D layers get split by the compositor and drop out or z-fight).
  function placeFrames() {
    const P = drum.P;
    const half = drum.W / 2 + 160;
    const k = Math.max(drum.curve, 1e-4);
    const rho = RADIUS / k;
    const step = 2 * Math.atan(Math.tan(Math.PI / PER_REEL) * k);
    drum.frames.forEach((f) => {
      const phi = (((((f.reel.view + f.base) % 360) + 540) % 360 - 180) / STEP) * step;
      const x = -rho * Math.sin(phi);
      const z = -RADIUS + 2 * rho * Math.sin(phi / 2) ** 2;
      f.el.style.transform = `translate3d(${x.toFixed(1)}px, 0, ${z.toFixed(1)}px) rotateY(${(phi / DEG).toFixed(3)}deg)`;
      const depth = P - (drum.zc + z);
      let vis = false;
      if (depth > 40 && depth * Math.cos(phi) - x * Math.sin(phi) > 0) {
        const hx = (FW / 2) * Math.cos(phi);
        const hz = (FW / 2) * Math.sin(phi);
        const ends = [[x + hx, depth + hz], [x - hx, depth - hz]].map(([ex, ed]) => (ed > 1 ? (ex * P) / ed : Math.sign(ex) * 1e6));
        vis = Math.max(...ends) > -half && Math.min(...ends) < half;
      }
      f.X = (x * P) / Math.max(depth, 1);
      f.vis = vis;
      if (!vis !== f.away) {
        f.away = !vis;
        f.el.classList.toggle("is-away", f.away);
      }
    });
  }

  function showFrame(f, delay = 0) {
    if (f.shown) return;
    f.shown = true;
    f.el.style.transitionDelay = delay ? `${delay.toFixed(2)}s` : "";
    f.el.classList.add("is-shown");
  }

  function loadVideo(f) {
    const v = f.video;
    f.loaded = true;
    v.preload = "auto";
    v.src = v.dataset.src;
    v.addEventListener("playing", () => {
      const reveal = () => f.el.classList.add("is-live");
      if (v.requestVideoFrameCallback) v.requestVideoFrameCallback(reveal);
      else window.setTimeout(reveal, 120);
    }, { once: true });
  }

  function cull() {
    drum.culled = performance.now();
    const on = drumActive();
    const queue = [];
    drum.frames.forEach((f) => {
      if (drum.intro.done && !f.loaded && f.vis) queue.push(f);
      const live = on && f.loaded && f.vis;
      if (live !== f.live) {
        f.live = live;
        if (live) f.video.play().catch(() => {});
        else f.video.pause();
      }
    });
    queue
      .sort((a, b) => Math.abs(a.X) - Math.abs(b.X))
      .slice(0, 2)
      .forEach(loadVideo);
  }

  function finishIntro() {
    Object.assign(drum.intro, { t: INTRO_T, started: true, done: true });
    drum.curve = 1;
    drum.frames.forEach((f) => f.decoded && showFrame(f));
  }

  function startIntro() {
    if (drum.intro.started) return;
    drum.intro.started = true;
    const half = drum.W / 2;
    drum.frames.forEach((f) => {
      if (f.decoded) showFrame(f, f.vis ? 0.05 + 0.5 * Math.min(1, Math.abs(f.X) / half) + 0.05 * Math.abs(f.reel.index - 1.5) : 0);
    });
    kick();
  }

  function tick(now) {
    drum.raf = 0;
    const dt = drum.last ? Math.min(0.05, (now - drum.last) / 1000) : 0;
    drum.last = now;
    const intro = drum.intro;
    if (intro.started && !intro.done) {
      intro.t += dt;
      if (intro.t >= INTRO_T) finishIntro();
    }
    if (!intro.done) drum.curve = bendEase(clamp((intro.t - INTRO.flat) / INTRO.bend, 0, 1));
    const rest = intro.done ? 0 : 1 - glideEase(clamp(intro.t / INTRO_T, 0, 1));
    const dragging = drum.drag && drum.drag.captured;
    drum.reels.forEach((reel) => {
      const target = drum.paused || reel.hold ? 0 : reel.dir * CRUISE;
      const k = 1 - Math.exp(-dt / (reel.hold ? 0.45 : 1.4));
      reel.vel = dragging ? 0 : reel.vel + (target - reel.vel) * k;
      reel.angle += reel.vel * dt;
      reel.view = reel.angle - reel.dir * INTRO.slide * rest;
    });
    const t = drum.tilt;
    const kt = 1 - Math.exp(-dt / 0.45);
    t.x += (t.tx - t.x) * kt;
    t.y += (t.ty - t.y) * kt;
    drumEl.style.perspectiveOrigin = `${(t.x * drum.W * 0.06).toFixed(1)}px ${(t.y * drum.H * 0.06).toFixed(1)}px`;
    drum.zc = drum.depth - INTRO.push * rest - drum.progress * 420;
    const lift = `translateZ(${drum.zc.toFixed(1)}px) rotateX(${(drum.progress * 9).toFixed(2)}deg)`;
    drum.reels.forEach((reel) => (reel.el.style.transform = `${lift} translateY(${reel.y}px)`));
    placeFrames();
    heroContent.style.transform = drum.progress ? `translateY(${-drum.progress * 90}px)` : "";
    heroContent.style.opacity = drum.progress ? String(clamp(1 - drum.progress * 1.4, 0, 1)) : "";
    if (now - drum.culled > 160) cull();
    const moving = drumActive() || dragging || (intro.started && !intro.done) || Math.abs(t.tx - t.x) > 0.001 || Math.abs(t.ty - t.y) > 0.001 ||
      drum.reels.some((r) => Math.abs(r.vel) > 0.01);
    if (drum.visible && !document.hidden && moving) drum.raf = requestAnimationFrame(tick);
  }

  function kick() {
    if (drum.raf || !drum.visible || document.hidden) return;
    drum.last = 0;
    drum.raf = requestAnimationFrame(tick);
  }

  function fillCard(f) {
    const t = f.task;
    const out = t.outputs[f.out];
    const roles = rolesOf(t.refs).map((r) => `<span style="--m:${modVar(r.modality)}">${esc(r.role)}</span>`).join("");
    const refs = t.refs
      .map((r) => `<span class="dc-ref" style="--m:${modVar(r.modality)}">${r.thumb ? `<img src="${r.thumb}" alt="">` : icon("i-wave")}</span>`)
      .join("");
    card.innerHTML = `<div class="dc-head"><span class="dc-model">${esc(modelById[out.model].name)}</span><span class="dc-roles">${roles}</span></div>
      <div class="dc-refs">${refs}</div>
      <p class="dc-prompt">${tokens(t.excerpt)}</p>
      ${t.showcase != null ? `<p class="dc-go">Click to open this case${icon("i-arrow")}</p>` : ""}`;
  }

  function placeCard(e) {
    const box = heroEl.getBoundingClientRect();
    const w = card.offsetWidth;
    const h = card.offsetHeight;
    const x = clamp(e.clientX - box.left + 22, 16, box.width - w - 16);
    let y = e.clientY - box.top + 22;
    if (y + h > box.height - 72) y = e.clientY - box.top - h - 22;
    card.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  }

  function setHover(f, e) {
    if (f !== drum.hover) {
      if (drum.hover) drum.hover.reel.hold = false;
      drum.hover = f;
      if (f) {
        f.reel.hold = true;
        fillCard(f);
      }
      card.classList.toggle("is-on", !!f);
      kick();
    }
    if (f && e) placeCard(e);
  }

  function openFrame(f) {
    if (!f || f.task.showcase == null) return;
    renderCase(f.task.showcase, true);
    $("#cases").scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" });
  }

  heroEl.addEventListener("pointermove", (e) => {
    const box = heroEl.getBoundingClientRect();
    drum.tilt.tx = clamp(((e.clientX - box.left) / box.width - 0.5) * 2, -1, 1);
    drum.tilt.ty = clamp(((e.clientY - box.top) / box.height - 0.5) * 2, -1, 1);
    kick();
    if (drum.drag) return;
    const el = e.target.closest(".frame");
    setHover(el && !el.classList.contains("is-away") ? frameOf(el) : null, e);
  });
  heroEl.addEventListener("pointerleave", () => {
    drum.tilt.tx = 0;
    drum.tilt.ty = 0;
    setHover(null);
  });

  drumStage.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    drum.drag = { id: e.pointerId, last: e.clientX, t: performance.now(), v: 0, moved: 0, captured: false, frame: frameOf(e.target.closest(".frame")) };
  });
  window.addEventListener("pointermove", (e) => {
    const d = drum.drag;
    if (!d || e.pointerId !== d.id) return;
    const dx = e.clientX - d.last;
    const now = performance.now();
    d.moved += Math.abs(dx);
    if (!d.captured && d.moved > 6) {
      d.captured = true;
      drumStage.setPointerCapture(e.pointerId);
      drumStage.classList.add("is-dragging");
      setHover(null);
    }
    if (d.captured) {
      const deg = -dx * degPerPx();
      drum.reels.forEach((r) => (r.angle += deg));
      d.v = 0.7 * d.v + 0.3 * ((deg / Math.max(8, now - d.t)) * 1000);
      kick();
    }
    d.last = e.clientX;
    d.t = now;
  });
  const endDrag = (e) => {
    const d = drum.drag;
    if (!d || e.pointerId !== d.id) return;
    drum.drag = null;
    drumStage.classList.remove("is-dragging");
    if (d.captured) {
      const v = performance.now() - d.t > 90 ? 0 : clamp(d.v, -160, 160);
      drum.reels.forEach((r) => (r.vel = v));
      kick();
    } else if (e.type === "pointerup") {
      openFrame(d.frame);
    }
  };
  window.addEventListener("pointerup", endDrag);
  window.addEventListener("pointercancel", endDrag);

  drumStage.addEventListener("wheel", (e) => {
    if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
    e.preventDefault();
    const deg = e.deltaX * degPerPx();
    drum.reels.forEach((r) => (r.angle += deg));
    kick();
  }, { passive: false });

  let lastScroll = window.scrollY;
  window.addEventListener("scroll", () => {
    const y = window.scrollY;
    const dy = Math.abs(y - lastScroll);
    lastScroll = y;
    drum.progress = clamp(y / heroEl.offsetHeight, 0, 1);
    if (dy) setHover(null);
    if (drumActive()) drum.reels.forEach((r) => (r.vel = clamp(r.vel + r.dir * dy * 0.08, -60, 60)));
    kick();
  }, { passive: true });

  function setPaused(paused) {
    drum.paused = paused;
    if (paused && !drum.intro.done) finishIntro();
    toggle.setAttribute("aria-pressed", String(paused));
    toggle.innerHTML = paused ? `${icon("i-play")}<span>Play motion</span>` : `${icon("i-pause")}<span>Pause motion</span>`;
    cull();
    kick();
  }
  toggle.addEventListener("click", () => setPaused(!drum.paused));

  if (hasIO) {
    new IntersectionObserver(([e]) => {
      drum.visible = e.isIntersecting;
      if (!e.isIntersecting && !drum.intro.started) finishIntro();
      cull();
      kick();
    }).observe(heroEl);
  }
  document.addEventListener("visibilitychange", () => {
    cull();
    kick();
  });
  window.addEventListener("resize", () => {
    layoutDrum();
    kick();
  });

  layoutDrum();
  setPaused(drum.paused);
  tick(performance.now());
  requestAnimationFrame(() => requestAnimationFrame(() => heroEl.classList.add("is-ready")));

  const opening = [];
  drum.frames.forEach((f) => {
    const done = () => {
      f.decoded = true;
      if (drum.intro.started) showFrame(f);
    };
    const decoded = (f.img.decode ? f.img.decode() : Promise.resolve()).then(done, done);
    if (f.vis) opening.push(decoded);
  });
  if (!drum.intro.done) {
    Promise.race([Promise.all(opening), new Promise((done) => window.setTimeout(done, 2500))]).then(startIntro);
  }

  /* ---------------------------------------------------------------- screening room */

  const stage = { idx: 0, lang: "en", solo: null, playing: false, rate: 1, raf: 0, scrubbing: false };
  const caseIndex = $("#caseIndex");
  const caseOutputs = $("#caseOutputs");
  const caseVideos = () => $$("video", caseOutputs);

  caseIndex.innerHTML = D.showcase
    .map((c, i) => `<button type="button" role="tab" class="case-tab" data-i="${i}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}"><span class="ct-no">${pad2(i + 1)}</span><span class="ct-title">${esc(c.title)}</span><span class="ct-roles">${c.roles.map((r) => `<span style="--m:${modVar(r.modality)}">${esc(r.label.toLowerCase())}</span>`).join("")}</span></button>`)
    .join("");

  function outCard(c, m) {
    const wave = c.waves[m.id];
    const waveHTML = wave
      ? waveSVG(wave, { bars: 110, h: 22, cls: "w-base" }) + waveSVG(wave, { bars: 110, h: 22, cls: "w-played" })
      : "<span>No audio track</span>";
    const solo = wave
      ? `<button type="button" class="out-solo" data-model="${m.id}" aria-pressed="false">${icon("i-sound")}<span>Listen</span></button>`
      : "";
    return `<article class="out-card" data-model="${m.id}">
      <div class="out-media"><video src="${c.outputs[m.id]}" poster="${c.posters[m.id]}" muted playsinline preload="metadata" aria-label="${esc(m.name)} output"></video></div>
      <div class="out-meta"><span class="out-name">${esc(m.name)}<small>#${m.rank}</small></span>${solo}</div>
      <div class="out-wave${wave ? "" : " is-empty"}">${waveHTML}</div>
    </article>`;
  }

  function deckHTML(c) {
    return `<aside class="deck" aria-label="Shared playback">
      <div class="deck-top"><span class="eyebrow">Shared clock</span>
        <div class="switch switch--dark" id="deckRate" role="group" aria-label="Playback speed">
          <button type="button" data-rate="0.5" aria-pressed="${stage.rate === 0.5}">0.5×</button>
          <button type="button" data-rate="1" aria-pressed="${stage.rate === 1}">1×</button>
        </div>
      </div>
      <p class="deck-clock"><span id="deckNow">00:00.0</span><span class="deck-total"> / ${clock(c.seconds, true)}</span></p>
      <input type="range" class="scrub" id="deckScrub" min="0" max="1000" step="1" value="0" aria-label="Playback position" />
      <div class="deck-bottom">
        <div class="deck-btns">
          <button type="button" class="deck-btn is-primary" id="deckPlay">${icon("i-play")}<span>Play all</span></button>
          <button type="button" class="deck-btn" id="deckRestart" aria-label="Back to start">${icon("i-restart")}</button>
        </div>
        <span class="deck-listen" id="deckListen"></span>
      </div>
    </aside>`;
  }

  function setDeckButton() {
    const b = $("#deckPlay");
    if (b) b.innerHTML = `${icon(stage.playing ? "i-pause" : "i-play")}<span>${stage.playing ? "Pause" : "Play all"}</span>`;
  }

  function caseUI() {
    const vs = caseVideos();
    if (!vs.length) return;
    const c = D.showcase[stage.idx];
    const t = vs[0].currentTime || 0;
    const frac = Math.min(1, t / c.seconds);
    const now = $("#deckNow");
    const scrub = $("#deckScrub");
    if (now) now.textContent = clock(t, true);
    if (scrub) {
      if (!stage.scrubbing) scrub.value = String(Math.round(frac * 1000));
      scrub.style.setProperty("--p", `${(frac * 100).toFixed(2)}%`);
    }
    $$(".out-card", caseOutputs).forEach((card) => {
      const v = $("video", card);
      const d = v.duration || c.seconds;
      card.style.setProperty("--p", Math.min(1, (v.currentTime || 0) / d).toFixed(4));
    });
  }

  function caseTick() {
    stage.raf = 0;
    caseUI();
    const vs = caseVideos();
    if (!stage.playing || !vs.length) return;
    const master = vs[0];
    const t = master.currentTime;
    if (!stage.scrubbing) {
      vs.slice(1).forEach((v) => {
        if (!v.paused && !v.ended && Math.abs(v.currentTime - t) > 0.2) v.currentTime = t;
      });
    }
    if (master.ended || t >= D.showcase[stage.idx].seconds - 0.03) {
      casePause();
      return;
    }
    stage.raf = requestAnimationFrame(caseTick);
  }

  function caseSeek(t) {
    const c = D.showcase[stage.idx];
    caseVideos().forEach((v) => {
      const d = v.duration || c.seconds;
      v.currentTime = Math.min(t, Math.max(0, d - 0.05));
    });
  }

  function casePlay() {
    const vs = caseVideos();
    if (!vs.length) return;
    const c = D.showcase[stage.idx];
    let t = vs[0].currentTime || 0;
    if (t >= c.seconds - 0.1) t = 0;
    vs.forEach((v) => {
      v.playbackRate = stage.rate;
      if (Math.abs((v.currentTime || 0) - t) > 0.04) v.currentTime = t;
      v.play().catch(() => {});
    });
    stage.playing = true;
    setDeckButton();
    if (!stage.raf) stage.raf = requestAnimationFrame(caseTick);
  }

  function casePause() {
    caseVideos().forEach((v) => v.pause());
    stage.playing = false;
    setDeckButton();
  }

  function applySolo() {
    $$(".out-card", caseOutputs).forEach((card) => {
      const on = card.dataset.model === stage.solo;
      card.classList.toggle("is-solo", on);
      $("video", card).muted = !on;
      const b = $(".out-solo", card);
      if (b) {
        b.setAttribute("aria-pressed", String(on));
        $("span", b).textContent = on ? "Listening" : "Listen";
      }
    });
    const listen = $("#deckListen");
    if (listen) {
      listen.innerHTML = stage.solo
        ? `Listening to <b>${esc(modelById[stage.solo].name)}</b>`
        : "Muted · pick a soundtrack";
    }
  }

  function bindDeck(c) {
    $("#deckPlay").addEventListener("click", () => (stage.playing ? casePause() : casePlay()));
    $("#deckRestart").addEventListener("click", () => {
      caseSeek(0);
      caseUI();
    });
    const scrub = $("#deckScrub");
    scrub.addEventListener("input", () => {
      stage.scrubbing = true;
      caseSeek((Number(scrub.value) / 1000) * c.seconds);
      caseUI();
    });
    scrub.addEventListener("change", () => {
      stage.scrubbing = false;
    });
    $$("#deckRate button").forEach((b) =>
      b.addEventListener("click", () => {
        stage.rate = Number(b.dataset.rate);
        caseVideos().forEach((v) => (v.playbackRate = stage.rate));
        $$("#deckRate button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      }));
  }

  function renderPrompt() {
    const c = D.showcase[stage.idx];
    const el = $("#casePrompt");
    el.lang = stage.lang === "zh" ? "zh" : "en";
    el.innerHTML = tokens(stage.lang === "zh" ? c.prompt_zh : c.prompt_en);
    $$("#langSwitch button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.lang === stage.lang)));
  }

  function renderCase(i, animate = false) {
    casePause();
    stage.idx = i;
    const c = D.showcase[i];
    $$(".case-tab", caseIndex).forEach((b, k) => {
      b.setAttribute("aria-selected", String(k === i));
      b.tabIndex = k === i ? 0 : -1;
    });

    const apply = () => {
      $("#caseMeta").textContent = `Case ${pad2(i + 1)} · ${c.references.length} references · ${Math.round(c.seconds)} s`;
      renderPrompt();
      $("#caseNote").innerHTML = tokens(c.note);
      const src = $("#caseSources");
      unwatchPlates(src);
      src.style.setProperty("--n", c.references.length);
      src.innerHTML = c.references.map(plateHTML).join("");
      watchPlates(src);
      if (stage.solo && !c.waves[stage.solo]) stage.solo = null;
      caseOutputs.innerHTML = MODELS.map((m) => outCard(c, m)).join("") + deckHTML(c);
      bindDeck(c);
      applySolo();
      caseUI();
    };

    if (animate) fadeSwap([$(".case-brief"), $("#caseSources"), caseOutputs], apply, 220);
    else apply();
  }

  caseIndex.addEventListener("click", (e) => {
    const b = e.target.closest(".case-tab");
    if (b && Number(b.dataset.i) !== stage.idx) renderCase(Number(b.dataset.i), true);
  });

  caseIndex.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const n = D.showcase.length;
    const next = (stage.idx + (e.key === "ArrowRight" ? 1 : -1) + n) % n;
    renderCase(next, true);
    $$(".case-tab", caseIndex)[next].focus();
    e.preventDefault();
  });

  caseOutputs.addEventListener("click", (e) => {
    const b = e.target.closest(".out-solo");
    if (!b) return;
    stage.solo = stage.solo === b.dataset.model ? null : b.dataset.model;
    applySolo();
    if (stage.solo && !stage.playing) casePlay();
  });

  $("#langSwitch").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-lang]");
    if (!b || b.dataset.lang === stage.lang) return;
    stage.lang = b.dataset.lang;
    renderPrompt();
  });

  if (hasIO) {
    new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) casePause();
    }).observe($("#cases"));
  }

  linkScope($(".case-stage"));
  renderCase(0);

  /* ---------------------------------------------------------------- forest plots */

  const xPct = (v, [a, b]) => ((v - a) / (b - a)) * 100;

  function plotGrid(domain, ticks, ref) {
    const grid = ticks.map((t) => `<span class="f-grid" style="left:${xPct(t, domain)}%"></span>`).join("");
    return grid + (ref != null ? `<span class="f-ref" style="left:${xPct(ref, domain)}%"></span>` : "");
  }

  function axisRow(domain, ticks, label) {
    return `<div class="f-axis" aria-hidden="true"><span></span><div class="f-ticks">${ticks
      .map((t) => `<span style="left:${xPct(t, domain)}%">${t}</span>`)
      .join("")}</div><span class="f-axis-label">${label}</span></div>`;
  }

  const ciText = (ci) => `[${ci[0].toFixed(2)}, ${ci[1].toFixed(2)}]`;

  /* validation */

  const VAL_DOMAIN = [30, 90];
  const VAL_TICKS = [30, 40, 50, 60, 70, 80, 90];
  const VAL_CAPTIONS = {
    nonTie:
      "Agreement on non-tied judgments over 76 held-out instances and 729 candidate pairs ranked by ten expert annotators. Instances weigh equally; whiskers are 95% intervals from 2,000 whole-instance bootstrap resamples. Dashed: human–human agreement.",
    strict:
      "Strict agreement keeps ties as judgments, so a system that ties where humans prefer, or the reverse, is counted as disagreeing. Same instances, pairs, and bootstrap; no human–human reference is reported for this metric.",
  };

  function renderValidation(metric) {
    const human = D.evaluators.find((e) => e.isHuman);
    const ref = metric === "nonTie" ? human.nonTie : null;
    const rows = D.evaluators
      .filter((e) => e[metric] != null)
      .map((e) => {
        const name = e.primary ? "ORAV Judge" : e.isHuman ? "Human–human" : e.name;
        const sub = e.cov != null ? `${e.backbone} · ${e.cov.toFixed(2)}% AB/BA coverage` : "Ten expert annotators";
        const ci = e[`${metric}Ci`];
        const cls = e.primary ? "is-primary" : e.isHuman ? "is-human" : "";
        return `<div class="f-row ${cls}"><div class="f-name"><b>${esc(name)}</b><small>${esc(sub)}</small></div><div class="f-plot">${plotGrid(VAL_DOMAIN, VAL_TICKS, ref)}<span class="f-ci" style="left:${xPct(ci[0], VAL_DOMAIN)}%;width:${xPct(ci[1], VAL_DOMAIN) - xPct(ci[0], VAL_DOMAIN)}%"></span><span class="f-dot" style="left:${xPct(e[metric], VAL_DOMAIN)}%"></span></div><div class="f-val">${e[metric].toFixed(2)}%<small>${ciText(ci)}</small></div></div>`;
      })
      .join("");
    $("#valChart").innerHTML = rows + axisRow(VAL_DOMAIN, VAL_TICKS, "agreement, %");
    $("#valCaption").textContent = VAL_CAPTIONS[metric];
    $$("#valSwitch button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.metric === metric)));
  }

  $("#valSwitch").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-metric]");
    if (b) renderValidation(b.dataset.metric);
  });
  renderValidation("nonTie");

  $("#altTable tbody").innerHTML = MODELS.map(
    (m) => `<tr><td>${esc(m.name)}</td><td class="r">${m.winRate.toFixed(2)}</td><td class="r">${m.altWinRate.toFixed(2)}</td></tr>`
  ).join("");

  /* role leaderboard */

  const ROLE_DOMAIN = [0, 100];
  const ROLE_TICKS = [0, 25, 50, 75, 100];
  const board = $("#roleBoard");
  let roleKey = "overall";

  $("#roleChips").innerHTML = D.roles
    .map((r, i) => {
      const color = r.key === "overall" ? "var(--ink)" : modVar(r.modality);
      const sep = i === 1 ? '<span class="chip-sep" aria-hidden="true"></span>' : "";
      return `${sep}<button type="button" class="chip" data-role="${r.key}" aria-pressed="${r.key === roleKey}" style="--m:${color}">${esc(r.label)}</button>`;
    })
    .join("");

  board.innerHTML =
    MODELS.map(
      (m) => `<div class="f-row" data-model="${m.id}"><div class="f-name"><b><span class="f-rank"></span>${esc(m.name)}</b></div><div class="f-plot">${plotGrid(ROLE_DOMAIN, ROLE_TICKS, 50)}<span class="f-ci"></span><span class="f-dot"></span></div><div class="f-val"><span class="v"></span><small></small></div></div>`
    ).join("") + axisRow(ROLE_DOMAIN, ROLE_TICKS, "win rate, %");

  function renderBoard(animate) {
    const role = D.roles.find((r) => r.key === roleKey);
    $("#roleDesc").textContent = role.desc;
    const rows = new Map($$(".f-row", board).map((el) => [el.dataset.model, el]));
    const before = new Map([...rows].map(([id, el]) => [id, el.getBoundingClientRect().top]));
    const sorted = MODELS.slice().sort((a, b) => role.scores[b.id].val - role.scores[a.id].val);
    const axis = $(".f-axis", board);

    sorted.forEach((m, rank) => {
      const s = role.scores[m.id];
      const el = rows.get(m.id);
      const ci = s.ci;
      el.classList.toggle("is-primary", rank === 0);
      $(".f-rank", el).textContent = pad2(rank + 1);
      $(".f-ci", el).style.cssText = `left:${xPct(ci[0], ROLE_DOMAIN)}%;width:${xPct(ci[1], ROLE_DOMAIN) - xPct(ci[0], ROLE_DOMAIN)}%`;
      $(".f-dot", el).style.left = `${xPct(s.val, ROLE_DOMAIN)}%`;
      $(".v", el).textContent = `${s.val.toFixed(2)}%`;
      $("small", $(".f-val", el)).textContent = `[${ci[0].toFixed(1)}, ${ci[1].toFixed(1)}]`;
      board.insertBefore(el, axis);
    });

    if (!animate || reduceMotion) return;
    rows.forEach((el, id) => {
      const dy = before.get(id) - el.getBoundingClientRect().top;
      if (!dy) return;
      el.style.transition = "none";
      el.style.transform = `translateY(${dy}px)`;
      requestAnimationFrame(() => {
        el.style.transition = "transform 0.55s var(--ease-out)";
        el.style.transform = "";
      });
    });
  }

  $("#roleChips").addEventListener("click", (e) => {
    const b = e.target.closest(".chip");
    if (!b || b.dataset.role === roleKey) return;
    roleKey = b.dataset.role;
    $$(".chip", e.currentTarget).forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    renderBoard(true);
  });
  renderBoard(false);

  /* ---------------------------------------------------------------- heat tables */

  const heatAlpha = (p) => Math.pow(Math.max(0, Math.min(1, (p - 10) / 80)), 1.15) * 0.9;
  const heatCell = (p, extra = "") => {
    const a = heatAlpha(p);
    const cls = [a > 0.46 ? "is-dark" : "", extra].filter(Boolean).join(" ");
    return `<td style="--a:${a.toFixed(3)}"${cls ? ` class="${cls}"` : ""}>`;
  };

  $("#matrixTable").innerHTML =
    `<thead><tr><th class="corner" scope="col"><span class="eyebrow">Row vs. column</span></th>${MODELS.map((m) => `<th scope="col">${esc(m.name)}</th>`).join("")}</tr></thead><tbody>` +
    MODELS.map(
      (m, i) =>
        `<tr><th scope="row">${esc(m.name)}</th>${D.pairwiseMatrix[i]
          .map((cell) => (cell ? `${heatCell(cell.p)}${cell.p.toFixed(1)}<small>${cell.w}–${cell.l}–${cell.t}</small></td>` : '<td class="is-self" aria-label="same system"></td>'))
          .join("")}</tr>`
    ).join("") +
    "</tbody>";

  const comboHTML = (name) =>
    `<span class="combo-row">${name
      .split(" + ")
      .map((r) => `<span class="r" style="--m:${modVar(ROLE_MOD[r] || "image")}">${esc(r)}</span>`)
      .join("<i>+</i>")}</span>`;

  $("#compTable").innerHTML =
    `<thead><tr><th scope="col" class="corner"><span class="eyebrow">Composition</span></th><th scope="col" class="n">n</th>${MODELS.map((m) => `<th scope="col">${esc(m.name)}</th>`).join("")}</tr></thead><tbody>` +
    D.compositions
      .map((c) => {
        const lead = Math.max(...c.vals);
        const tag = c.highlight ? '<span class="tag">reversal</span>' : "";
        return `<tr${c.highlight ? ' class="is-reversal"' : ""}><th scope="row">${comboHTML(c.name)}${tag}</th><th class="n">${c.n}</th>${c.vals
          .map((v) => `${heatCell(v, v === lead ? "is-lead" : "")}${v < 0.1 ? "&lt;0.1" : v.toFixed(1)}</td>`)
          .join("")}</tr>`;
      })
      .join("") +
    "</tbody>";

  /* ---------------------------------------------------------------- tables */

  {
    const yes = '<span class="dot-yes" role="img" aria-label="included"></span>';
    const no = '<span class="dim" aria-label="not included">–</span>';
    const mark = (v) => (v === true ? yes : v === "†" ? `${yes}<sup>†</sup>` : no);
    const text = (s) => (s === "—" ? no : esc(s).replace(/†/g, "<sup>†</sup>").replace(/ \+ /g, "\u2009+\u2009"));
    $("#benchmarkTable tbody").innerHTML = D.benchmarks
      .map((b) => {
        const name = esc(b.name.replace(" (Ours)", "")) + (b.mark ? `<sup>${b.mark}</sup>` : "") + (b.ours ? ' <span class="dim">(ours)</span>' : "");
        return `<tr${b.ours ? ' class="is-ours"' : ""}><td>${name}</td><td class="c">${b.out}</td><td class="c">${text(b.refs)}</td><td class="c">${mark(b.c)}</td><td class="c">${mark(b.d)}</td><td class="c">${mark(b.a)}</td><td class="c">${text(b.joint)}</td></tr>`;
      })
      .join("");
  }

  {
    const cols = [["compZ", 1], ["tq", 1], ["ap", 1], ["subj", 1], ["scene", 1], ["pq", 1], ["voice", 1], ["cer", -1], ["wer", -1], ["winRate", 1]];
    const num = (s) => parseFloat(String(s).replace("*", ""));
    const best = Object.fromEntries(
      cols.map(([k, dir]) => {
        const vals = D.diagnostics.filter((d) => !String(d[k]).includes("*")).map((d) => num(d[k]));
        return [k, dir > 0 ? Math.max(...vals) : Math.min(...vals)];
      })
    );
    $("#diagTable tbody").innerHTML = D.diagnostics
      .map(
        (d) =>
          `<tr><td>${esc(d.name)}</td>${cols
            .map(([k]) => {
              const raw = String(d[k]);
              const txt = k === "winRate" ? num(raw).toFixed(2) : signed(raw);
              return `<td>${!raw.includes("*") && num(raw) === best[k] ? `<strong>${txt}</strong>` : txt}</td>`;
            })
            .join("")}</tr>`
      )
      .join("");
  }

  $("#resultTabs").addEventListener("click", (e) => {
    const t = e.target.closest(".tab");
    if (!t) return;
    $$(".tab", e.currentTarget).forEach((b) => b.setAttribute("aria-selected", String(b === t)));
    $$("#results .pane").forEach((p) => {
      p.hidden = p.id !== t.dataset.pane;
    });
  });

  /* ---------------------------------------------------------------- findings charts */

  {
    const L = D.compositions.find((c) => c.name === "subject + speech");
    const R = D.compositions.find((c) => c.name === "subject + motion + speech");
    const W = 560;
    const H = 370;
    const top = 48;
    const bottom = 18;
    const xL = 150;
    const xR = W - 150;
    const y = (v) => top + (1 - v / 100) * (H - top - bottom);
    const focus = { "minimax-h3": "var(--aud)", "seedance-2.5": "var(--ink)" };
    let s = `<svg class="chart-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Slope chart: expected win rate in subject plus speech versus subject plus motion plus speech">`;
    s += `<text class="t-head" x="${xL}" y="16" text-anchor="middle">subject + speech</text>`;
    s += `<text class="t-head" x="${xR}" y="16" text-anchor="middle">subject + motion + speech</text>`;
    s += `<line class="axis" x1="${xL}" x2="${xL}" y1="${y(100)}" y2="${y(0)}"/><line class="axis" x1="${xR}" x2="${xR}" y1="${y(100)}" y2="${y(0)}"/>`;
    s += `<line class="parity" x1="${xL}" x2="${xR}" y1="${y(50)}" y2="${y(50)}"/>`;
    s += `<text class="t-dim" x="${(xL + xR) / 2}" y="${y(50) + 15}" text-anchor="middle">50% parity</text>`;
    const order = MODELS.map((m, i) => ({ m, i })).sort((a, b) => (focus[a.m.id] ? 1 : 0) - (focus[b.m.id] ? 1 : 0));
    order.forEach(({ m, i }) => {
      const a = L.vals[i];
      const b = R.vals[i];
      const color = focus[m.id];
      const stroke = color ? `stroke:${color};stroke-width:2` : "stroke:var(--ink-4);stroke-width:1.25;opacity:.7";
      const fill = color || "var(--ink-4)";
      const r = color ? 4 : 2.75;
      s += `<g><title>${esc(m.name)}: ${a.toFixed(1)}% → ${b.toFixed(1)}%</title>`;
      s += `<line x1="${xL}" y1="${y(a)}" x2="${xR}" y2="${y(b)}" style="${stroke}" stroke-linecap="round"/>`;
      s += `<circle cx="${xL}" cy="${y(a)}" r="${r}" style="fill:${fill}"/><circle cx="${xR}" cy="${y(b)}" r="${r}" style="fill:${fill}"/>`;
      if (color) {
        s += `<text x="${xL - 12}" y="${y(a) + 4}" text-anchor="end"><tspan class="t-dim">${esc(m.name)}</tspan><tspan class="t-strong" dx="8">${a.toFixed(1)}</tspan></text>`;
      }
      s += `<text x="${xR + 12}" y="${y(b) + 4}"><tspan class="${color ? "t-strong" : "t-dim"}">${b.toFixed(1)}</tspan><tspan class="t-dim" dx="8">${esc(m.name)}</tspan></text>`;
      s += "</g>";
    });
    s += "</svg>";
    $("#slopeChart").innerHTML = s;
  }

  {
    const rows = D.failures;
    const W = 560;
    const left = 120;
    const right = 92;
    const top = 40;
    const rowH = 42;
    const H = top + rows.length * rowH + 26;
    const x = (v) => left + (v / 60) * (W - left - right);
    let s = `<svg class="chart-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Usability veto rate without and with a video reference">`;
    s += `<circle cx="${left + 4}" cy="12" r="4" style="fill:var(--paper);stroke:var(--ink-3);stroke-width:1.5"/><text x="${left + 14}" y="16">without video reference</text>`;
    s += `<circle cx="${left + 178}" cy="12" r="4" style="fill:var(--vid)"/><text x="${left + 188}" y="16">with video reference</text>`;
    [0, 20, 40, 60].forEach((t) => {
      s += `<line class="grid" x1="${x(t)}" x2="${x(t)}" y1="${top - 6}" y2="${H - 24}"/>`;
      s += `<text class="t-dim" x="${x(t)}" y="${H - 8}" text-anchor="middle">${t}${t === 60 ? "%" : ""}</text>`;
    });
    rows.forEach((r, i) => {
      const cy = top + i * rowH + rowH / 2;
      const strong = r.name === "Wan3.0-Video";
      const hi = Math.max(r.noVideoRef, r.videoRef);
      s += `<g><title>${esc(r.name)}: ${r.noVideoRef.toFixed(1)}% without, ${r.videoRef.toFixed(1)}% with a video reference</title>`;
      s += `<text x="0" y="${cy + 4}" class="${strong ? "t-strong" : ""}">${esc(r.name)}</text>`;
      s += `<line x1="${x(r.noVideoRef)}" x2="${x(r.videoRef)}" y1="${cy}" y2="${cy}" style="stroke:${strong ? "var(--ink-2)" : "var(--ink-4)"};stroke-width:1.5"/>`;
      s += `<circle cx="${x(r.noVideoRef)}" cy="${cy}" r="4.25" style="fill:var(--paper);stroke:var(--ink-3);stroke-width:1.5"/>`;
      s += `<circle cx="${x(r.videoRef)}" cy="${cy}" r="4.25" style="fill:var(--vid)"/>`;
      s += `<text x="${x(hi) + 12}" y="${cy + 4}" class="${strong ? "t-strong" : "t-dim"}">${r.noVideoRef.toFixed(1)} → ${r.videoRef.toFixed(1)}</text>`;
      s += "</g>";
    });
    s += "</svg>";
    $("#vetoChart").innerHTML = s;
  }

  /* ---------------------------------------------------------------- lightbox, copy, reveal */

  const lb = $("#lightbox");
  const lbImg = $("#lightboxImg");
  function closeLightbox() {
    lb.classList.remove("is-open");
    document.body.style.overflow = "";
    window.setTimeout(() => {
      lb.hidden = true;
      lbImg.removeAttribute("src");
    }, 250);
  }
  document.addEventListener("click", (e) => {
    const img = e.target.closest("img.zoomable");
    if (!img) return;
    lbImg.src = img.currentSrc || img.src;
    lbImg.alt = img.alt;
    lb.hidden = false;
    document.body.style.overflow = "hidden";
    requestAnimationFrame(() => lb.classList.add("is-open"));
  });
  lb.addEventListener("click", closeLightbox);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !lb.hidden) closeLightbox();
  });

  function copyFallback(text) {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.cssText = "position:fixed;opacity:0;pointer-events:none";
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch (_) {
      ok = false;
    }
    ta.remove();
    return ok;
  }
  $$("[data-copy]").forEach((btn) =>
    btn.addEventListener("click", () => {
      const text = $(`#${btn.dataset.copy}`).innerText;
      const done = () => {
        btn.textContent = "Copied";
        btn.classList.add("is-done");
        window.setTimeout(() => {
          btn.textContent = "Copy";
          btn.classList.remove("is-done");
        }, 1600);
      };
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(done, () => copyFallback(text) && done());
      } else if (copyFallback(text)) {
        done();
      }
    }));

  if (hasIO && !reduceMotion) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.classList.add("is-in");
        io.unobserve(e.target);
      });
    }, { rootMargin: "0px 0px -6% 0px", threshold: 0.04 });
    $$(".sec-head, .prose, .stats, .fig, .roles, .tbl, .steps, .validation, .tabs, .finding, .fig-pair, .code-grid, .case-index, .case-stage")
      .filter((el) => !el.parentElement.closest(".fig-pair"))
      .forEach((el) => {
        el.classList.add("reveal");
        io.observe(el);
      });
  }
})();
