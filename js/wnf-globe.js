(function () {
  const canvas = document.getElementById("wnfGlobe");
  if (!canvas) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    canvas.classList.add("wnf-globe--fallback");
    return;
  }

  let width = 0;
  let phi = 0;
  let running = true;
  let booted = false;

  function measure() {
    const parent = canvas.parentElement;
    width = Math.min(260, Math.max(200, parent ? parent.clientWidth : 240));
    canvas.width = width * 2;
    canvas.height = width * 2;
    canvas.style.width = width + "px";
    canvas.style.height = width + "px";
  }

  function boot(createGlobe) {
    if (booted) return;
    booted = true;
    measure();
    createGlobe(canvas, {
      devicePixelRatio: 2,
      width: width * 2,
      height: width * 2,
      phi: 0,
      theta: 0.22,
      dark: 1,
      diffuse: 1.4,
      mapSamples: 16000,
      mapBrightness: 5.8,
      baseColor: [0.1, 0.16, 0.3],
      markerColor: [0.3, 0.6, 1],
      glowColor: [0.2, 0.48, 1],
      markers: [
        { location: [21.03, 105.85], size: 0.07 },
        { location: [37.09, -95.71], size: 0.09 },
        { location: [51.5, -0.12], size: 0.055 },
        { location: [35.68, 139.69], size: 0.055 },
        { location: [48.86, 2.35], size: 0.05 },
        { location: [1.35, 103.82], size: 0.045 }
      ],
      onRender: function (state) {
        state.width = width * 2;
        state.height = width * 2;
        if (running) {
          state.phi = phi;
          phi += 0.0038;
        }
      }
    });

    window.addEventListener("resize", measure, { passive: true });
    document.addEventListener("visibilitychange", function () {
      running = document.visibilityState === "visible";
    });
  }

  function load() {
    import("https://esm.sh/cobe@0.6.3")
      .then(function (mod) {
        boot(mod.default || mod);
      })
      .catch(function () {
        canvas.classList.add("wnf-globe--fallback");
      });
  }

  const host = canvas.closest(".why-no-free") || canvas.parentElement;
  if (host && "IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      function (entries) {
        const visible = !!(entries[0] && entries[0].isIntersecting);
        if (visible) {
          if (!booted) load();
          running = document.visibilityState === "visible";
        } else {
          running = false;
        }
      },
      { rootMargin: "200px 0px", threshold: 0.01 }
    );
    io.observe(host);
  } else {
    load();
  }
})();
