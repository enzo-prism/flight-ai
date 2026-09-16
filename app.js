(() => {
  document.documentElement.classList.add('js');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Sticky nav hairline on scroll
  const nav = document.querySelector('.nav');
  const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 8);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Mobile menu
  const menuBtn = document.querySelector('.menu-btn');
  const mobileMenu = document.getElementById('mobileMenu');
  const setMenu = (open) => {
    nav.classList.toggle('open', open);
    menuBtn.setAttribute('aria-expanded', String(open));
    mobileMenu.hidden = !open;
  };
  menuBtn.addEventListener('click', () => setMenu(!nav.classList.contains('open')));
  mobileMenu.addEventListener('click', (e) => {
    if (e.target.closest('a')) setMenu(false);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && nav.classList.contains('open')) {
      setMenu(false);
      menuBtn.focus();
    }
  });

  // Reveal on scroll
  const revealEls = document.querySelectorAll('.reveal');
  if (reduceMotion || !('IntersectionObserver' in window)) {
    revealEls.forEach((el) => el.classList.add('in'));
  } else {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add('in');
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    revealEls.forEach((el) => io.observe(el));
  }

  // Animated metric count-up (final values are in the HTML; JS animates from 0)
  const counters = document.querySelectorAll('[data-count]');
  const runCounter = (el) => {
    const target = parseFloat(el.dataset.count);
    const dec = parseInt(el.dataset.dec || '0', 10);
    if (reduceMotion) return; // final value already rendered
    const dur = 1200;
    const t0 = performance.now();
    const tick = (t) => {
      const p = Math.min((t - t0) / dur, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = (target * eased).toFixed(dec);
      if (p < 1) requestAnimationFrame(tick);
      else el.textContent = target.toFixed(dec);
    };
    requestAnimationFrame(tick);
  };
  if ('IntersectionObserver' in window) {
    const cio = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          runCounter(e.target);
          cio.unobserve(e.target);
        }
      });
    }, { threshold: 0.5 });
    counters.forEach((el) => cio.observe(el));
  } else {
    counters.forEach(runCounter);
  }

  // Hero route dot, driven from the real SVG path so it tracks at any width
  const path = document.getElementById('routePath');
  const dot = document.querySelector('.plane-dot');
  if (path && dot && path.getTotalLength) {
    const svg = path.ownerSVGElement;
    const len = path.getTotalLength();
    const place = (t) => {
      const pt = path.getPointAtLength(t * len);
      const r = svg.getBoundingClientRect();
      const x = (pt.x / 520) * r.width;
      const y = (pt.y / 170) * r.height;
      dot.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
    };
    if (reduceMotion) {
      place(1);
      window.addEventListener('resize', () => place(1));
    } else {
      const dur = 7000;
      const t0 = performance.now();
      const fly = (t) => {
        place(((t - t0) / dur) % 1);
        requestAnimationFrame(fly);
      };
      requestAnimationFrame(fly);
    }
  }

  // Pilot form routes into the self-serve app (mailto fallback when JS is off)
  const form = document.getElementById('pilotForm');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = document.getElementById('pilotEmail');
      if (input && !input.checkValidity()) {
        input.reportValidity();
        return;
      }
      const email = input ? input.value.trim() : '';
      window.location.href = 'app.html' + (email ? `?email=${encodeURIComponent(email)}` : '');
    });
  }
})();
