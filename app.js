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

  // ASCII mail hero: packed frame tiers under assets/mail (see README).
  // Poster frame is inlined in the HTML; JS fits it, then hydrates playback.
  const mailStage = document.getElementById('mailStage');
  const mailPre = document.getElementById('mailPre');
  if (mailStage && mailPre) {
    const TIERS = [
      { max: 450, name: 'low', cols: 91, rows: 29 },
      { max: 800, name: 'medium', cols: 118, rows: 38 },
      { max: Infinity, name: 'high', cols: 146, rows: 46 },
    ];
    const saveData = navigator.connection && navigator.connection.saveData;
    const stageW = mailStage.clientWidth || window.innerWidth;
    const tier = saveData ? TIERS[0] : TIERS.find((t) => stageW < t.max);
    let advanceRatio = 0.6;
    const measureAdvance = () => {
      try {
        const cs = getComputedStyle(mailPre);
        const cx = document.createElement('canvas').getContext('2d');
        cx.font = cs.font;
        const w = cx.measureText('0'.repeat(100)).width;
        const fs = parseFloat(cs.fontSize);
        if (w > 0 && fs > 0) advanceRatio = (w / 100) / fs;
      } catch (_) { /* keep 0.6 estimate */ }
    };
    const fit = () => {
      const fw = mailStage.clientWidth / (tier.cols * advanceRatio);
      const fh = mailStage.clientHeight / tier.rows;
      mailPre.style.fontSize = (Math.max(Math.min(fw, fh), 5) * 0.99).toFixed(2) + 'px';
    };
    measureAdvance();
    fit();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { measureAdvance(); fit(); });
    if ('ResizeObserver' in window) new ResizeObserver(fit).observe(mailStage);
    else window.addEventListener('resize', fit);
    if (!reduceMotion) {
      let frames = null;
      let idx = 0;
      let timer = null;
      let visible = true;
      const tick = () => {
        idx = (idx + 1) % frames.length;
        mailPre.textContent = frames[idx];
      };
      const play = () => {
        if (!timer && frames && visible && !document.hidden) timer = setInterval(tick, 1000 / 12);
      };
      const stop = () => {
        if (timer) { clearInterval(timer); timer = null; }
      };
      document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); else play(); });
      if ('IntersectionObserver' in window) {
        new IntersectionObserver((es) => {
          visible = es[0].isIntersecting;
          if (visible) play(); else stop();
        }).observe(mailStage);
      }
      fetch(`assets/mail/${tier.name}.json`)
        .then((r) => { if (!r.ok) throw new Error('mail tier missing'); return r.json(); })
        .then((d) => {
          if (d && Array.isArray(d.frames) && d.frames.length > 0) { frames = d.frames; play(); }
        })
        .catch(() => { /* poster frame stays */ });
    }
  }

  // Customer stories: only one interview plays at a time
  const storyVids = document.querySelectorAll('.stories video');
  storyVids.forEach((v) => {
    v.addEventListener('play', () => {
      storyVids.forEach((o) => { if (o !== v && !o.paused) o.pause(); });
    });
  });

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
