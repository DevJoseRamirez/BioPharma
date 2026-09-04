(function () {
  "use strict";

  var sectionSelector = ".cwc_labor-day-transformation";
  var phaseSelector = ".cwc_labor-day-transformation__phase";

  function setActivePhase(phases, activeIndex) {
    phases.forEach(function (phase, index) {
      var isActive = index === activeIndex;
      var isComplete = index < activeIndex;

      phase.classList.toggle(
        "cwc_labor-day-transformation__phase--active",
        isActive,
      );
      phase.classList.toggle(
        "cwc_labor-day-transformation__phase--complete",
        isComplete,
      );

      if (isActive) {
        phase.setAttribute("aria-current", "step");
      } else {
        phase.removeAttribute("aria-current");
      }
    });
  }

  function initSection(sectionEl) {
    if (!sectionEl || sectionEl.dataset.cwcTimelineInitialized === "true")
      return;

    var phases = Array.prototype.slice.call(
      sectionEl.querySelectorAll(phaseSelector),
    );
    if (!phases.length) return;

    sectionEl.dataset.cwcTimelineInitialized = "true";

    var ticking = false;

    function updateActivePhase() {
      var triggerPoint = Math.max(120, window.innerHeight * 0.45);
      var activeIndex = 0;

      phases.forEach(function (phase, index) {
        if (phase.getBoundingClientRect().top <= triggerPoint) {
          activeIndex = index;
        }
      });

      setActivePhase(phases, activeIndex);
      ticking = false;
    }

    function requestUpdate() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(updateActivePhase);
    }

    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate);
    updateActivePhase();
  }

  function initAllSections() {
    document.querySelectorAll(sectionSelector).forEach(initSection);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAllSections);
  } else {
    initAllSections();
  }

  document.addEventListener("shopify:section:load", function (event) {
    var target = event.target;
    var section = target.matches(sectionSelector)
      ? target
      : target.querySelector(sectionSelector);

    initSection(section);
  });
})();
