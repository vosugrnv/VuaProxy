(function () {
  const canvas = document.getElementById("locGlobe");
  if (!canvas) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    canvas.classList.add("loc-globe--fallback");
    return;
  }

  let width = 0;
  let phi = 0;
  let running = true;
  let globe = null;

  function measure() {
    const parent = canvas.parentElement;
    width = Math.min(620, Math.max(260, parent ? parent.clientWidth : 480));
    canvas.width = width * 2;
    canvas.height = width * 2;
    canvas.style.width = width + "px";
    canvas.style.height = width + "px";
  }

  function boot(createGlobe) {
    measure();
    globe = createGlobe(canvas, {
      devicePixelRatio: 2,
      width: width * 2,
      height: width * 2,
      phi: 0,
      theta: 0.22,
      dark: 1,
      diffuse: 1.4,
      mapSamples: 18000,
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
        { location: [52.52, 13.4], size: 0.05 },
        { location: [1.35, 103.82], size: 0.045 },
        { location: [-33.87, 151.21], size: 0.045 }
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

    window.addEventListener("resize", measure);
    document.addEventListener("visibilitychange", function () {
      running = document.visibilityState === "visible";
    });
  }

  import("https://esm.sh/cobe@0.6.3")
    .then(function (mod) {
      boot(mod.default || mod);
    })
    .catch(function () {
      canvas.classList.add("loc-globe--fallback");
    });
})();
