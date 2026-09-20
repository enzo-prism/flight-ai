/* Progressive enhancements: all product and release content is static HTML. */
(() => {
  // Remember the filtered index when returning from a release article.
  const returnLink = document.querySelector('[data-updates-return]');
  if (returnLink) {
    try {
      const saved = sessionStorage.getItem('mach1.updates.return');
      const target = saved ? new URL(saved, location.origin) : null;
      if (target && target.origin === location.origin && /^\/updates(?:\.html)?$/.test(target.pathname)) returnLink.href = target.href;
    } catch { /* Storage is optional; the normal Updates link still works. */ }
  }
  const search = document.querySelector('#releaseSearch');
  if (!search) return;
  const tools = document.querySelector('.release-tools');
  const count = document.querySelector('.result-count');
  const rows = [...document.querySelectorAll('.release-row')];
  const filters = [...document.querySelectorAll('[data-filter]')];
  const params = new URLSearchParams(location.search);
  let category = filters.some(button => button.dataset.filter === params.get('type')) ? params.get('type') : 'All';
  search.value = params.get('q') || '';
  filters.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.filter === category)));
  function filter() {
    const query = search.value.trim().toLowerCase();
    let visible = 0;
    rows.forEach((row) => {
      row.hidden = !((category === 'All' || row.dataset.category === category) && row.dataset.search.toLowerCase().includes(query));
      if (!row.hidden) visible++;
    });
    count.textContent = `${visible} ${visible === 1 ? 'release' : 'releases'}`;
    document.querySelector('#noResults').hidden = visible > 0;
    const url = new URL(location.href);
    if (search.value.trim()) url.searchParams.set('q', search.value.trim()); else url.searchParams.delete('q');
    if (category !== 'All') url.searchParams.set('type', category); else url.searchParams.delete('type');
    history.replaceState(history.state, '', url);
    try { sessionStorage.setItem('mach1.updates.return', url.pathname + url.search); } catch { /* Optional enhancement. */ }
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
