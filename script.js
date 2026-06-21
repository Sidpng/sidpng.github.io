(() => {
  "use strict";
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];

  /* ---------- year ---------- */
  $("#year").textContent = new Date().getFullYear();

  /* ---------- scroll progress + nav state ---------- */
  const progress = $("#scrollProgress");
  const nav = $("#nav");
  const onScroll = () => {
    const h = document.documentElement;
    const scrolled = h.scrollTop / (h.scrollHeight - h.clientHeight);
    progress.style.width = (scrolled * 100).toFixed(2) + "%";
    nav.classList.toggle("is-scrolled", h.scrollTop > 40);
    // fade the 3D scene out past the hero so section text stays readable
    const bg = document.getElementById("bgCanvas");
    if (bg) bg.style.opacity = Math.max(0.1, 1 - h.scrollTop / (h.clientHeight * 0.85)).toFixed(3);
  };
  document.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---------- mobile nav ---------- */
  const toggle = $("#navToggle");
  const links = $("#navLinks");
  toggle.addEventListener("click", () => {
    const open = links.classList.toggle("is-open");
    toggle.classList.toggle("is-open", open);
  });
  $$("[data-link]").forEach(a => a.addEventListener("click", () => {
    links.classList.remove("is-open");
    toggle.classList.remove("is-open");
  }));

  /* ---------- reveal on scroll (with stagger) ---------- */
  const revealEls = $$("[data-reveal]");
  if ("IntersectionObserver" in window && !reduce) {
    // stagger items that share a parent
    const groups = new Map();
    revealEls.forEach(el => {
      const p = el.parentElement;
      const arr = groups.get(p) || [];
      arr.push(el); groups.set(p, arr);
    });
    groups.forEach(arr => arr.forEach((el, i) => el.style.setProperty("--d", (i * 0.08) + "s")));

    const io = new IntersectionObserver((entries, obs) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add("is-in");
          // trigger skill bars / counters when their section appears
          $$(".bar", e.target).forEach(fillBar);
          obs.unobserve(e.target);
        }
      });
    }, { threshold: 0.16, rootMargin: "0px 0px -8% 0px" });
    revealEls.forEach(el => io.observe(el));
  } else {
    revealEls.forEach(el => el.classList.add("is-in"));
  }

  /* ---------- skill bars ---------- */
  function fillBar(bar) {
    const span = $("span", bar);
    if (span && !span.dataset.done) {
      span.style.width = (bar.dataset.level || 80) + "%";
      span.dataset.done = "1";
    }
  }
  // also catch any bars not inside a reveal
  const barIO = "IntersectionObserver" in window && !reduce
    ? new IntersectionObserver((es, o) => es.forEach(e => { if (e.isIntersecting) { fillBar(e.target); o.unobserve(e.target); } }), { threshold: 0.4 })
    : null;
  $$(".bar").forEach(b => barIO ? barIO.observe(b) : fillBar(b));

  /* ---------- animated counters ---------- */
  function animateCount(el) {
    const target = +el.dataset.count;
    const suffix = el.dataset.suffix || "";
    if (reduce) { el.textContent = target + suffix; return; }
    const dur = 1600, start = performance.now();
    const step = now => {
      const t = Math.min((now - start) / dur, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = Math.round(target * eased) + suffix;
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  if ("IntersectionObserver" in window) {
    const cIO = new IntersectionObserver((es, o) => es.forEach(e => {
      if (e.isIntersecting) { animateCount(e.target); o.unobserve(e.target); }
    }), { threshold: 0.6 });
    $$("[data-count]").forEach(el => cIO.observe(el));
  } else {
    $$("[data-count]").forEach(el => el.textContent = el.dataset.count + (el.dataset.suffix || ""));
  }

  /* ---------- nav active section ---------- */
  const sections = $$("main section[id]");
  const navMap = new Map($$("[data-link]").map(a => [a.getAttribute("href").slice(1), a]));
  if ("IntersectionObserver" in window) {
    const sIO = new IntersectionObserver(entries => {
      entries.forEach(e => {
        const link = navMap.get(e.target.id);
        if (link && e.isIntersecting) {
          $$("[data-link]").forEach(a => a.classList.remove("is-active"));
          link.classList.add("is-active");
        }
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    sections.forEach(s => sIO.observe(s));
  }

  /* ---------- typed role rotator ---------- */
  const roles = ["Senior QA Engineer", "SDET", "Automation Architect", "API & Performance Tester", "AI-Paired Tester"];
  const rotator = $("#roleRotator");
  if (rotator && !reduce) {
    let ri = 0, ci = 0, deleting = false;
    const tick = () => {
      const word = roles[ri];
      ci += deleting ? -1 : 1;
      rotator.firstElementChild.textContent = word.slice(0, ci);
      let delay = deleting ? 45 : 95;
      if (!deleting && ci === word.length) { delay = 1500; deleting = true; }
      else if (deleting && ci === 0) { deleting = false; ri = (ri + 1) % roles.length; delay = 350; }
      setTimeout(tick, delay);
    };
    tick();
  } else if (rotator) {
    rotator.firstElementChild.textContent = roles[0];
  }

  /* ---------- cursor glow ---------- */
  const glow = $("#cursorGlow");
  if (glow && matchMedia("(pointer:fine)").matches) {
    window.addEventListener("pointermove", e => {
      glow.style.opacity = "1";
      glow.style.left = e.clientX + "px";
      glow.style.top = e.clientY + "px";
    }, { passive: true });
    document.addEventListener("pointerleave", () => glow.style.opacity = "0");
  }

  /* ---------- 3D tilt on project cards ---------- */
  if (!reduce && matchMedia("(pointer:fine)").matches) {
    $$("[data-tilt]").forEach(card => {
      card.addEventListener("pointermove", e => {
        const r = card.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        card.style.transform = `perspective(800px) rotateY(${px * 8}deg) rotateX(${-py * 8}deg) translateY(-4px)`;
      });
      card.addEventListener("pointerleave", () => card.style.transform = "");
    });
  }

  /* ---------- 3D holographic background is handled by scene.js (module) ---------- */
})();
