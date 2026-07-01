(function () {
  "use strict";

  const lastTargets = new WeakMap();
  const animationTokens = new WeakMap();

  function formatInteger(value, locale = "en") {
    const formatted = Math.round(value).toLocaleString(locale);
    return locale.toLowerCase().startsWith("ar")
      ? formatted.replace(/\d/g, (digit) => "٠١٢٣٤٥٦٧٨٩"[digit])
      : formatted;
  }

  /**
   * Animate a numeric value with a smooth ease-out curve.
   * A custom formatter keeps this utility reusable for compact and localized KPIs.
   */
  function animate(element, options) {
    if (!element) return;

    const {
      end = 0,
      duration = 1000,
      precision = 0,
      format = (value) => String(value)
    } = options || {};
    const start = options?.start ?? lastTargets.get(element) ?? 0;
    const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const token = Symbol("count-up");

    lastTargets.set(element, end);
    animationTokens.set(element, token);

    if (prefersReducedMotion || duration <= 0 || start === end) {
      element.textContent = format(end);
      return;
    }

    const startTime = performance.now();
    const range = end - start;

    function update(currentTime) {
      if (animationTokens.get(element) !== token) return;
      const progress = Math.min((currentTime - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const rawValue = start + range * eased;
      const factor = Math.pow(10, Math.max(0, precision));
      const current = precision > 0
        ? Math.round(rawValue * factor) / factor
        : Math.floor(rawValue);
      element.textContent = format(current);

      if (progress < 1) requestAnimationFrame(update);
      else element.textContent = format(end);
    }

    requestAnimationFrame(update);
  }

  window.CountUp = Object.freeze({ animate, formatInteger });
})();
