/* One responsive header, native links, and native disclosure with keyboard support. */
(() => {
  const header = document.querySelector('.site-header');
  if (!header) return;
  const toggle = header.querySelector('.site-toggle');
  const panel = header.querySelector('.site-navigation');
  const product = header.querySelector('.site-product');
  const mobile = window.matchMedia('(max-width: 900px)');
  header.classList.add('enhanced');
  toggle.hidden = false;
  function close({restore = false} = {}) {
    header.classList.remove('is-open');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.querySelector('.site-toggle-label').textContent = 'Menu';
    product.open = false;
    if (restore) toggle.focus();
  }
  toggle.addEventListener('click', () => {
    if (header.classList.contains('is-open')) { close(); return; }
    header.classList.add('is-open');
    toggle.setAttribute('aria-expanded', 'true');
    toggle.querySelector('.site-toggle-label').textContent = 'Close';
  });
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (product.open) { product.open = false; product.querySelector('summary').focus(); }
    else if (header.classList.contains('is-open')) close({restore:true});
  });
  document.addEventListener('click', (event) => {
    if (header.contains(event.target)) return;
    const focusInPanel = panel.contains(document.activeElement);
    const focusInProduct = product.contains(document.activeElement);
    close({restore: mobile.matches && focusInPanel});
    if (!mobile.matches && focusInProduct) product.querySelector('summary').focus();
  });
  header.addEventListener('focusout', () => {
    requestAnimationFrame(() => {
      if (!header.contains(document.activeElement)) close();
      else if (!product.contains(document.activeElement)) product.open = false;
    });
  });
  mobile.addEventListener('change', () => {
    const focusInside = panel.contains(document.activeElement);
    close();
    if (mobile.matches && focusInside) toggle.focus();
    else if (!mobile.matches && document.activeElement === toggle) header.querySelector('.site-brand').focus();
  });
  const pathKey = (path) => path.replace(/\/index(?:\.html)?\/?$/, '/').replace(/\.html$/, '').replace(/\/$/, '') || '/';
  header.addEventListener('click', (event) => {
    const link = event.target.closest('a');
    if (!link || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    const url = new URL(link.href);
    // Respect native navigation/back behavior; manage focus only for local anchors.
    if (url.origin === location.origin && pathKey(url.pathname) === pathKey(location.pathname) && url.hash) {
      const target = document.getElementById(decodeURIComponent(url.hash.slice(1)));
      if (target) {
        event.preventDefault();
        close();
        if (location.hash !== url.hash) history.pushState(null, '', url.hash);
        if (!target.hasAttribute('tabindex')) {
          target.setAttribute('tabindex', '-1');
          target.addEventListener('blur', () => target.removeAttribute('tabindex'), {once:true});
        }
        target.focus({preventScroll:true});
        target.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',block:'start'});
      }
    } else close();
  });
  // Highlight homepage sections as the visitor scrolls, including after back navigation.
  const sectionLinks = [...header.querySelectorAll('[data-site-section]')];
  function refresh() {
    header.classList.toggle('is-scrolled', window.scrollY > 8);
    if (header.dataset.sitePage !== 'home') return;
    const y = 140;
    sectionLinks.forEach((link) => {
      if (link.dataset.siteSection === 'updates') return;
      const section = document.getElementById(link.dataset.siteSection);
      const bounds = section?.getBoundingClientRect();
      if (bounds && bounds.top <= y && bounds.bottom > y) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  }
  let queued = false;
  window.addEventListener('scroll', () => {
    if (!queued) { queued = true; requestAnimationFrame(() => { refresh(); queued = false; }); }
  }, {passive:true});
  window.addEventListener('pageshow', () => { close(); refresh(); });
  refresh();
})();
