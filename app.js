(() => {
  document.documentElement.classList.add('js');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Lordicon loops autoplay per section (sequenced via delay attributes).
  // Under reduced motion, keep icons hover-only instead of looping.
  if (reduceMotion) {
    document.querySelectorAll('lord-icon[trigger="loop"]').forEach((el) => el.setAttribute('trigger', 'hover'));
  }

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

  // ASCII planet hero: packed frame tiers under assets/planet (see README).
  // Poster frame is inlined in the HTML; JS fits it, then hydrates playback.
  const planetStage = document.getElementById('planetStage');
  const planetPre = document.getElementById('planetPre');
  if (planetStage && planetPre) {
    const TIERS = [
      { max: 640, name: 'low', cols: 97 },
      { max: 1200, name: 'medium', cols: 126 },
      { max: Infinity, name: 'high', cols: 154 },
    ];
    const saveData = navigator.connection && navigator.connection.saveData;
    const stageW = planetStage.clientWidth || window.innerWidth;
    const tier = saveData ? TIERS[0] : TIERS.find((t) => stageW < t.max);
    const fit = () => {
      const minF = planetStage.clientWidth < 560 ? 12 : 9;
      const fs = Math.max(planetStage.clientWidth / (tier.cols * 0.6), minF);
      planetPre.style.fontSize = fs.toFixed(2) + 'px';
    };
    fit();
    if ('ResizeObserver' in window) new ResizeObserver(fit).observe(planetStage);
    else window.addEventListener('resize', fit);
    if (!reduceMotion) {
      let frames = null;
      let idx = 0;
      let timer = null;
      let visible = true;
      const tick = () => {
        idx = (idx + 1) % frames.length;
        planetPre.textContent = frames[idx];
      };
      const play = () => {
        if (!timer && frames && visible && !document.hidden) timer = setInterval(tick, 1000 / 15);
      };
      const stop = () => {
        if (timer) { clearInterval(timer); timer = null; }
      };
      document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); else play(); });
      if ('IntersectionObserver' in window) {
        new IntersectionObserver((es) => {
          visible = es[0].isIntersecting;
          if (visible) play(); else stop();
        }).observe(planetStage);
      }
      fetch(`assets/planet/${tier.name}.json`)
        .then((r) => { if (!r.ok) throw new Error('planet tier missing'); return r.json(); })
        .then((d) => {
          if (d && Array.isArray(d.frames) && d.frames.length > 0) { frames = d.frames; play(); }
        })
        .catch(() => { /* poster frame stays */ });
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
