(function () {
  'use strict';

  var WIDGET_SELECTOR = '.cwc_yotpo-reviews__widget .yotpo-widget-instance';
  var RETRY_DELAY = 300;
  var MAX_RETRIES = 20;

  /*
    Yotpo's loader scans the DOM once, on its own load. A section added or
    re-rendered by the Theme Editor arrives after that scan, so the placeholder
    stays empty until the widget container is asked to re-initialize.
  */
  function refreshWidgets() {
    var container = window.yotpoWidgetsContainer;
    if (!container || typeof container.initWidgets !== 'function') return false;

    container.initWidgets();
    return true;
  }

  function refreshWhenReady(attempt) {
    var tries = attempt || 0;
    if (refreshWidgets()) return;
    if (tries >= MAX_RETRIES) return;

    window.setTimeout(function () {
      refreshWhenReady(tries + 1);
    }, RETRY_DELAY);
  }

  function initSection(sectionEl) {
    if (!sectionEl) return;

    var widget = sectionEl.querySelector(WIDGET_SELECTOR);
    if (!widget) return;

    refreshWhenReady(0);
  }

  function initAllSections() {
    document.querySelectorAll('.cwc_yotpo-reviews').forEach(initSection);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAllSections);
  } else {
    initAllSections();
  }

  document.addEventListener('shopify:section:load', function (event) {
    var section = event.target.querySelector('.cwc_yotpo-reviews');
    if (section) initSection(section);
  });
})();
