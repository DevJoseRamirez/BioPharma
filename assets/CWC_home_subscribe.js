(function () {
  'use strict';

  var ACTIVE = 'cwc_home-subscribe__tier--active';

  /* Only runs when "Make tiers selectable" is on. With it off — or with JS
     disabled — the tiers stay a static price table. */

  function initSection(sectionEl) {
    if (!sectionEl) return;
    if (!sectionEl.classList.contains('cwc_home-subscribe--interactive')) return;

    var tiers = sectionEl.querySelectorAll('[data-cwc-tier]');
    if (!tiers.length) return;

    var cta = sectionEl.querySelector('[data-cwc-cta]');
    var defaultHref = cta ? cta.getAttribute('href') : null;

    function select(tier) {
      tiers.forEach(function (t) {
        t.classList.remove(ACTIVE);
        t.setAttribute('aria-pressed', 'false');
      });
      tier.classList.add(ACTIVE);
      tier.setAttribute('aria-pressed', 'true');

      if (!cta) return;
      var link = tier.getAttribute('data-cwc-tier-link');
      cta.setAttribute('href', link ? link : defaultHref || '#');
    }

    tiers.forEach(function (tier) {
      tier.setAttribute('aria-pressed', tier.classList.contains(ACTIVE) ? 'true' : 'false');

      tier.addEventListener('click', function () {
        select(tier);
      });

      tier.addEventListener('keydown', function (event) {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        select(tier);
      });
    });
  }

  function initAllSections() {
    document.querySelectorAll('.cwc_home-subscribe').forEach(initSection);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAllSections);
  } else {
    initAllSections();
  }

  document.addEventListener('shopify:section:load', function (event) {
    var section = event.target.querySelector('.cwc_home-subscribe');
    if (section) initSection(section);
  });
})();
