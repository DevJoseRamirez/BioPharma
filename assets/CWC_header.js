(function () {
  'use strict';

  var OPEN_ITEM = 'cwc_header__item--open';
  var DRAWER_OPEN = 'cwc_header__drawer--open';
  var SCRIM_VISIBLE = 'cwc_header__scrim--visible';
  var ACC_OPEN = 'cwc_header__acc--open';

  /* ==============================
     Desktop mega menu

     Hover and focus-within open the panel in CSS alone, so the menu works
     before this file has parsed and keeps working if it never does. What is
     left here is the part CSS cannot express: reflecting the open state to
     assistive tech, and closing on Escape.
     ============================== */
  function initMega(sectionEl) {
    var items = sectionEl.querySelectorAll('[data-cwc-nav-item]');
    if (!items.length) return;

    function setOpen(item, isOpen) {
      var trigger = item.querySelector('[data-cwc-nav-trigger]');
      var panel = item.querySelector('[data-cwc-mega]');

      item.classList.toggle(OPEN_ITEM, isOpen);
      if (trigger) trigger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');

      /**
       * The attribute is kept in step for assistive tech, but CSS overrides the
       * display it would normally impose — the panel animates, and display:none
       * cannot be transitioned. Visibility in the stylesheet is what actually
       * takes it out of the tab order.
       */
      if (panel) panel.hidden = !isOpen;
    }

    function closeAll() {
      items.forEach(function (item) {
        setOpen(item, false);
      });
    }

    function closeOthers(keep) {
      items.forEach(function (item) {
        if (item !== keep) setOpen(item, false);
      });
    }

    /**
     * Closing is immediate.
     *
     * An earlier version deferred it, to survive the pointer crossing a gap
     * between a trigger and its panel. There is no gap: items stretch to the
     * bar's full height and the panel's top:100% resolves against the bar's
     * padding box, which excludes its border — the two edges meet exactly.
     *
     * Deferring it was actively harmful. All panels share one strip under the
     * bar, so holding the outgoing one open while the next was arriving painted
     * the old panel over the new one for as long as the delay lasted.
     */
    items.forEach(function (item) {
      var panel = item.querySelector('[data-cwc-mega]');
      if (!panel) return;

      // Hover and focus are the CSS-driven states; mirror them onto the
      // attributes rather than driving the visuals from here.
      item.addEventListener('mouseenter', function () {
        // Any other panel gives way at once — two open at the same time is the
        // one state this strip cannot render.
        closeOthers(item);
        setOpen(item, true);
      });
      item.addEventListener('mouseleave', function () {
        setOpen(item, false);
      });
      item.addEventListener('focusin', function () {
        closeOthers(item);
        setOpen(item, true);
      });
      item.addEventListener('focusout', function (event) {
        // focusout fires before the new element has focus, so a move between
        // two links inside the same panel would otherwise close it.
        if (item.contains(event.relatedTarget)) return;
        setOpen(item, false);
      });
    });

    sectionEl.addEventListener('keydown', function (event) {
      if (event.key !== 'Escape') return;

      var open = sectionEl.querySelector('.' + OPEN_ITEM);
      if (!open) return;

      closeAll();

      // Focus goes back to the trigger, or Escape would leave the caret
      // somewhere inside a panel that is no longer visible.
      var trigger = open.querySelector('[data-cwc-nav-trigger]');
      if (trigger) trigger.focus();
    });
  }

  /* ==============================
     Mobile drawer
     ============================== */
  function initDrawer(sectionEl) {
    var toggle = sectionEl.querySelector('[data-cwc-toggle]');
    var drawer = sectionEl.querySelector('[data-cwc-drawer]');
    if (!toggle || !drawer) return;

    var scrim = sectionEl.querySelector('[data-cwc-scrim]');
    var closeButton = drawer.querySelector('[data-cwc-drawer-close]');

    function isOpen() {
      return drawer.classList.contains(DRAWER_OPEN);
    }

    function open() {
      // Unhide first, then add the class on the next frame: an element that was
      // display:none has no start value for the transform to animate from.
      drawer.hidden = false;
      if (scrim) scrim.hidden = false;

      requestAnimationFrame(function () {
        drawer.classList.add(DRAWER_OPEN);
        if (scrim) scrim.classList.add(SCRIM_VISIBLE);
      });

      drawer.setAttribute('aria-hidden', 'false');
      toggle.setAttribute('aria-expanded', 'true');
      toggle.setAttribute('aria-label', 'Close menu');
      document.body.style.overflow = 'hidden';

      if (closeButton) closeButton.focus();
    }

    function close() {
      if (!isOpen()) return;

      drawer.classList.remove(DRAWER_OPEN);
      if (scrim) scrim.classList.remove(SCRIM_VISIBLE);

      drawer.setAttribute('aria-hidden', 'true');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', 'Open menu');
      document.body.style.overflow = '';

      toggle.focus();
    }

    toggle.addEventListener('click', function () {
      if (isOpen()) {
        close();
      } else {
        open();
      }
    });

    if (closeButton) closeButton.addEventListener('click', close);
    if (scrim) scrim.addEventListener('click', close);

    /**
     * Every other link in here navigates, and the page unload is what takes this
     * drawer down. The cart link does not: it carries aria-controls, so the
     * theme's cart drawer opens over the top and nothing unloads. Closing on the
     * click hands the viewport over instead of stacking two overlays.
     *
     * Bound to the element, so it runs in the target phase — ahead of the theme's
     * delegated listener on document.body, which is what opens the cart drawer.
     */
    var cartLink = drawer.querySelector('.cwc_header__drawer-cart[aria-controls]');
    if (cartLink) cartLink.addEventListener('click', close);

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && isOpen()) close();
    });

    /**
     * A drawer left open behind a widening viewport would sit over a nav bar
     * that has already come back, with no visible control to close it.
     */
    window.addEventListener('resize', function () {
      if (isOpen() && !isCollapsed(sectionEl)) close();
    });

    /* ---- accordions ---- */
    drawer.querySelectorAll('[data-cwc-acc-toggle]').forEach(function (accToggle) {
      accToggle.addEventListener('click', function () {
        var acc = accToggle.closest('[data-cwc-acc]');
        if (!acc) return;

        var panel = acc.querySelector('[data-cwc-acc-panel]');
        var willOpen = !acc.classList.contains(ACC_OPEN);

        acc.classList.toggle(ACC_OPEN, willOpen);
        accToggle.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
        if (panel) panel.hidden = !willOpen;

        var sign = accToggle.querySelector('.cwc_header__acc-sign');
        if (sign) sign.textContent = willOpen ? '\u2212' : '+';
      });
    });
  }

  /**
   * Whether the nav has collapsed to the burger.
   *
   * The stylesheet carries a max-width query at the schema default, which is
   * what makes the collapse work before this file runs. A merchant who moves
   * the breakpoint cannot rewrite that query, so the class below overrides it —
   * and is only applied when the two would actually disagree, so the common
   * case stays pure CSS.
   */
  function isCollapsed(sectionEl) {
    var breakpoint = parseInt(sectionEl.getAttribute('data-cwc-breakpoint'), 10) || 1000;
    return window.innerWidth <= breakpoint;
  }

  function initBreakpoint(sectionEl) {
    var breakpoint = parseInt(sectionEl.getAttribute('data-cwc-breakpoint'), 10) || 1000;
    if (breakpoint === 1000) return;

    function sync() {
      var collapsed = isCollapsed(sectionEl);
      sectionEl.classList.toggle('cwc_header--collapsed', collapsed);
      sectionEl.classList.toggle('cwc_header--expanded', !collapsed);
    }

    window.addEventListener('resize', sync);
    sync();
  }

  /* ==============================
     Predictive search

     Owned by the theme, not by this file. The panel is a <header-search>
     DialogElement opened by the trigger's aria-controls, and <predictive-search>
     does the live-as-you-type fetching. Both bind themselves on upgrade, so
     there is nothing to initialise here — see snippets/CWC_header-search.liquid.
     ============================== */

  function initSection(sectionEl) {
    if (!sectionEl) return;
    // independent, so a header without a menu still gets a drawer and vice versa
    initMega(sectionEl);
    initDrawer(sectionEl);
    initBreakpoint(sectionEl);
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
