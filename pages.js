/* Progressive enhancements: all product and release content is static HTML. */
(() => {
  const nav = document.querySelector('.nav');
  const button = document.querySelector('.menu-btn');
  const menu = document.querySelector('#mobileMenu');
  const setMenu = (open) => {
    nav.classList.toggle('open', open);
    button.setAttribute('aria-expanded', String(open));
    menu.hidden = !open;
  };
  button?.addEventListener('click', () => setMenu(button.getAttribute('aria-expanded') !== 'true'));
  menu?.addEventListener('click', (event) => { if (event.target.closest('a')) setMenu(false); });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && nav.classList.contains('open')) { setMenu(false); button.focus(); }
  });
  const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 8);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  const search = document.querySelector('#releaseSearch');
  if (!search) return;
  const tools = document.querySelector('.release-tools');
  const count = document.querySelector('.result-count');
  const rows = [...document.querySelectorAll('.release-row')];
  const filters = [...document.querySelectorAll('[data-filter]')];
  let category = 'All';
  function filter() {
    const query = search.value.trim().toLowerCase();
    let visible = 0;
    rows.forEach((row) => {
      row.hidden = !((category === 'All' || row.dataset.category === category) && row.dataset.search.toLowerCase().includes(query));
      if (!row.hidden) visible++;
    });
    count.textContent = `${visible} ${visible === 1 ? 'release' : 'releases'}`;
    document.querySelector('#noResults').hidden = visible > 0;
  }
  filters.forEach((button) => button.addEventListener('click', () => {
    category = button.dataset.filter;
    filters.forEach((item) => item.setAttribute('aria-pressed', String(item === button)));
    filter();
  }));
  search.addEventListener('input', filter);
  tools.hidden = false;
  count.hidden = false;
  filter();
})();
