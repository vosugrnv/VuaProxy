/* LoHa-style dark hero: particles, parallax, dashboard tabs */
(function initHeroDark() {
  const root = document.getElementById("heroDark");
  if (!root) return;

  const particlesHost = document.getElementById("heroParticles");
  if (particlesHost && !particlesHost.childElementCount) {
    const positions = [
      [5, 11, 1, 9, 0, 0.1, 6],
      [42, 64, 2, 10, 0.7, 0.15, -6],
      [79, 17, 3, 11, 1.4, 0.2, 6],
      [16, 70, 1, 12, 2.1, 0.25, -6],
      [53, 23, 2, 13, 2.8, 0.1, 6],
      [90, 76, 3, 14, 3.5, 0.15, -6],
      [27, 29, 1, 9, 4.2, 0.2, 6],
      [64, 82, 2, 10, 4.9, 0.25, -6],
      [1, 35, 3, 11, 0, 0.1, 6],
      [38, 88, 1, 12, 0.7, 0.15, -6],
      [75, 41, 2, 13, 1.4, 0.2, 6],
      [12, 94, 3, 14, 2.1, 0.25, -6],
      [49, 47, 1, 9, 2.8, 0.1, 6],
      [86, 0, 2, 10, 3.5, 0.15, -6]
    ];
    const frag = document.createDocumentFragment();
    positions.forEach(([left, top, size, dur, delay, opacity, x]) => {
      const span = document.createElement("span");
      span.className = "hero-particle";
      span.style.cssText = `left:${left}%;top:${top}%;width:${size}px;height:${size}px;--p-d:${dur}s;--p-delay:${delay}s;--p-o:${opacity};--p-x:${x}px`;
      frag.appendChild(span);
    });
    particlesHost.appendChild(frag);
  }

  const bars = root.querySelectorAll("#heroChartBars span");
  bars.forEach((el, i) => {
    el.style.setProperty("--i", String(i));
  });

  const nav = document.getElementById("heroDashNav");
  const main = document.getElementById("heroDashMain");
  if (nav && main) {
    const panels = [...main.querySelectorAll(".hero-panel")];
    const activate = (id) => {
      nav.querySelectorAll("button[data-panel]").forEach((b) => {
        b.classList.toggle("is-active", b.dataset.panel === id);
      });
      panels.forEach((p) => {
        const on = p.dataset.panel === id;
        p.classList.toggle("is-active", on);
        if (on) p.removeAttribute("hidden");
        else p.setAttribute("hidden", "");
      });
    };
    nav.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-panel]");
      if (!btn) return;
      activate(btn.dataset.panel);
    });
  }

  const stack = document.getElementById("heroIsoStack");
  const iso = document.getElementById("heroIso");
  const visual = document.getElementById("heroVisual");
  if (iso && visual && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    let raf = 0;
    let targetX = 0;
    let targetY = 0;
    let curX = 0;
    let curY = 0;

    visual.addEventListener("pointermove", (e) => {
      const rect = visual.getBoundingClientRect();
      const nx = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
      const ny = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
      targetX = nx * 8;
      targetY = ny * 6;
    });
    visual.addEventListener("pointerleave", () => {
      targetX = 0;
      targetY = 0;
    });

    const tick = () => {
      curX += (targetX - curX) * 0.06;
      curY += (targetY - curY) * 0.06;
      iso.style.transform = `translate3d(${curX}px, ${curY}px, 0)`;
      if (stack) {
        stack.style.setProperty("--parallax-y", `${curX * 0.15}deg`);
        stack.style.setProperty("--parallax-x", `${curY * -0.12}deg`);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    window.addEventListener("pagehide", () => cancelAnimationFrame(raf), { once: true });
  }

  const track = document.getElementById("trustMarqueeTrack");
  const marquee = document.getElementById("trustMarquee");
  if (track && marquee) {
    const nudge = (dir) => {
      const win = marquee.querySelector(".trust-marquee-window");
      if (!win) return;
      track.style.animationPlayState = "paused";
      win.scrollLeft = Math.max(0, win.scrollLeft - dir * 164);
      clearTimeout(nudge._t);
      nudge._t = setTimeout(() => {
        track.style.animationPlayState = "";
        win.scrollLeft = 0;
      }, 1200);
    };
    const prev = marquee.querySelector(".trust-marquee-arrow--prev");
    const next = marquee.querySelector(".trust-marquee-arrow--next");
    if (prev) prev.addEventListener("click", () => nudge(1));
    if (next) next.addEventListener("click", () => nudge(-1));
  }
})();
