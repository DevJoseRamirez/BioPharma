(function () {
  'use strict';

  function initSection(sectionEl) {
    if (!sectionEl) return;

    var toggle = sectionEl.querySelector('[data-cwc-toggle]');
    var menu = sectionEl.querySelector('[data-cwc-menu]');
    if (!toggle || !menu) return;

    toggle.addEventListener('click', function () {
      var isOpen = menu.classList.toggle('cwc_header__links--open');
      toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });
  }

  function initAllSections() {
    document.querySelectorAll('.cwc_header').forEach(initSection);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAllSections);
  } else {
    initAllSections();
  }

  document.addEventListener('shopify:section:load', function (event) {
    var section = event.target.querySelector('.cwc_header');
    if (section) initSection(section);
  });
})();
