/* ==============================================================================
   CWC Cart Drawer — presentation behaviour only
   ------------------------------------------------------------------------------
   Two custom elements, neither of which touches the cart. Every cart mutation
   still belongs to theme.js: LineItemQuantity for quantity and remove,
   ProductForm for the recommendation adds, CartNote for the note, and the
   drawer's own form for checkout.

   Custom elements are used rather than listeners bound on load because
   CartDrawer replaces its entire subtree on every cart change
   (`replaceChildren`). A bound listener would be thrown away with the old DOM;
   an upgraded element re-runs connectedCallback on the new one.
   ============================================================================== */

(function () {
  'use strict';

  /**
   * Kit disclosure. The components inside are a read-only description of one
   * cart line — this only shows and hides them.
   */
  class CWCCartBundle extends HTMLElement {
    connectedCallback() {
      this.toggleButton = this.querySelector('.cwc_cart__bundle-toggle');
      this.itemsElement = this.querySelector('.cwc_cart__bundle-items');

      if (!this.toggleButton || !this.itemsElement) {
        return;
      }

      this.onToggleClick = this.onToggleClick.bind(this);
      this.toggleButton.addEventListener('click', this.onToggleClick);
    }

    disconnectedCallback() {
      if (this.toggleButton && this.onToggleClick) {
        this.toggleButton.removeEventListener('click', this.onToggleClick);
      }
    }

    onToggleClick() {
      const isOpen = this.toggleButton.getAttribute('aria-expanded') === 'true';
      const nextOpen = !isOpen;

      this.toggleButton.setAttribute('aria-expanded', String(nextOpen));
      this.itemsElement.hidden = !nextOpen;

      const label = this.toggleButton.querySelector('.cwc_cart__bundle-toggle-label');
      const nextLabel = nextOpen
        ? this.toggleButton.dataset.hideLabel
        : this.toggleButton.dataset.showLabel;

      if (label && nextLabel) {
        label.textContent = nextLabel;
      }
    }
  }

  /**
   * Recommendation slider. Native scroll does the work — the arrows only nudge
   * it, so the strip stays usable by touch and keyboard with the script absent.
   */
  class CWCCartRecs extends HTMLElement {
    connectedCallback() {
      this.track = this.querySelector('[data-cwc-recs-track]');
      this.prevButton = this.querySelector('[data-cwc-recs-prev]');
      this.nextButton = this.querySelector('[data-cwc-recs-next]');

      if (!this.track) {
        return;
      }

      this.onScroll = this.onScroll.bind(this);
      this.track.addEventListener('scroll', this.onScroll, { passive: true });

      if (this.prevButton) {
        this.onPrevClick = () => this.scrollByCard(-1);
        this.prevButton.addEventListener('click', this.onPrevClick);
      }

      if (this.nextButton) {
        this.onNextClick = () => this.scrollByCard(1);
        this.nextButton.addEventListener('click', this.onNextClick);
      }

      this.updateArrows();
      this.loadRecommendations();
    }

    disconnectedCallback() {
      if (this.track && this.onScroll) {
        this.track.removeEventListener('scroll', this.onScroll);
      }

      if (this.prevButton && this.onPrevClick) {
        this.prevButton.removeEventListener('click', this.onPrevClick);
      }

      if (this.nextButton && this.onNextClick) {
        this.nextButton.removeEventListener('click', this.onNextClick);
      }
    }

    /**
     * Swap the server-rendered fallback cards for live recommendations.
     *
     * The markup arrives already built: the request re-renders this whole
     * section with Liquid's `recommendations` object populated, and only the
     * track is lifted out of it. That keeps one definition of a card — the
     * server's — instead of a second one written in JS.
     *
     * Nothing here fails loudly. A dead network, a store with no complementary
     * products configured, an API that returns only things already in the cart:
     * every one of those leaves the fallback strip exactly as rendered.
     */
    async loadRecommendations() {
      const productId = this.dataset.cwcRecsProduct;
      const sectionId = this.dataset.cwcRecsSection;

      // Absent on an empty cart and in fixed-list mode. Neither is an error.
      if (!productId || !sectionId || this.recsLoaded) {
        return;
      }

      this.recsLoaded = true;

      const intents = (this.dataset.cwcRecsIntents || 'related').split(',');

      for (let i = 0; i < intents.length; i++) {
        const cards = await this.fetchRecommendations(sectionId, productId, intents[i].trim());

        if (cards && cards.length) {
          this.replaceCards(cards);
          return;
        }
      }

      // Every intent came back empty. If there was no fallback to fall back to,
      // the element is an empty titled strip — take it out rather than show it.
      if (!this.track.childElementCount) {
        this.remove();
      }
    }

    async fetchRecommendations(sectionId, productId, intent) {
      const limit = this.dataset.cwcRecsLimit || 6;
      const root = (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) || '/';
      const url =
        root +
        'recommendations/products?product_id=' + encodeURIComponent(productId) +
        '&limit=' + encodeURIComponent(limit) +
        '&intent=' + encodeURIComponent(intent) +
        '&section_id=' + encodeURIComponent(sectionId);

      try {
        const response = await fetch(url);
        if (!response.ok) return null;

        const parsed = new DOMParser().parseFromString(await response.text(), 'text/html');
        const track = parsed.querySelector('[data-cwc-recs-track]');

        return track ? Array.from(track.children) : null;
      } catch (error) {
        return null;
      }
    }

    replaceCards(cards) {
      // Parsed in another document, so each node has to be adopted before it can
      // be inserted here.
      this.track.replaceChildren.apply(
        this.track,
        cards.map((card) => document.importNode(card, true))
      );

      this.hidden = false;

      const nav = this.querySelector('[data-cwc-recs-nav]');
      if (nav) nav.hidden = this.track.childElementCount < 2;

      this.updateArrows();
    }

    /**
     * One card plus its gap, measured from the DOM rather than hard-coded, so a
     * change to the card width in CSS does not need a matching change here.
     */
    get step() {
      const card = this.track.firstElementChild;

      if (!card) {
        return this.track.clientWidth;
      }

      const gap = parseFloat(getComputedStyle(this.track).columnGap) || 0;

      return card.getBoundingClientRect().width + gap;
    }

    scrollByCard(direction) {
      this.track.scrollBy({ left: this.step * direction, behavior: 'smooth' });
    }

    onScroll() {
      window.cancelAnimationFrame(this.scrollFrame);
      this.scrollFrame = window.requestAnimationFrame(() => this.updateArrows());
    }

    updateArrows() {
      // A one pixel tolerance: fractional scroll positions never land exactly on
      // the end, which would leave the arrow enabled with nowhere left to go.
      const maxScroll = this.track.scrollWidth - this.track.clientWidth - 1;
      const position = Math.abs(this.track.scrollLeft);

      if (this.prevButton) {
        this.prevButton.disabled = position <= 1;
      }

      if (this.nextButton) {
        this.nextButton.disabled = position >= maxScroll;
      }
    }
  }

  if (!window.customElements.get('cwc-cart-bundle')) {
    window.customElements.define('cwc-cart-bundle', CWCCartBundle);
  }

  if (!window.customElements.get('cwc-cart-recs')) {
    window.customElements.define('cwc-cart-recs', CWCCartRecs);
  }
})();
