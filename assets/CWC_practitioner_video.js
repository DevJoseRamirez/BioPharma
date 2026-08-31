/* ==============================
   CWC Practitioner Video
   ------------------------------
   Click-to-play only. The <video> is already in the markup at preload="none",
   so nothing downloads until someone asks for a clip — this just uncovers it.
   ============================== */

(function () {
  'use strict';

  function initCard(posterEl) {
    posterEl.addEventListener('click', function () {
      var media = posterEl.parentElement;
      if (!media) return;

      var video = media.querySelector('video');
      if (!video) return;

      media.classList.add('cwc_practitioner-video__media--playing');

      // Removed rather than hidden: a button left in the DOM over a playing
      // video keeps swallowing the clicks meant for the controls.
      posterEl.remove();

      video.setAttribute('controls', 'controls');

      var played = video.play();
      if (played && typeof played.catch === 'function') {
        // Autoplay policies can refuse. The controls are showing either way,
        // so the viewer can still start it themselves.
        played.catch(function () {});
      }
    });
  }

  function initSection(sectionEl) {
    if (!sectionEl) return;

    var posters = sectionEl.querySelectorAll('[data-cwc-practitioner-play]');
    if (!posters.length) return;

    posters.forEach(initCard);
  }

  function initAllSections() {
    document.querySelectorAll('.cwc_practitioner-video').forEach(initSection);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAllSections);
  } else {
    initAllSections();
  }

  document.addEventListener('shopify:section:load', function (event) {
    var section = event.target.querySelector('.cwc_practitioner-video');
    if (section) initSection(section);
  });
})();
