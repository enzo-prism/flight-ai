(() => {
  document.documentElement.classList.add('js');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Lordicon loops autoplay per section (sequenced via delay attributes).
  // Under reduced motion, keep icons hover-only instead of looping.
  if (reduceMotion) {
    document.querySelectorAll('lord-icon[trigger="loop"]').forEach((el) => el.setAttribute('trigger', 'hover'));
  }

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

  // Closing supplementary interviews should also stop their audio.
  document.querySelectorAll('.story-more').forEach((details) => {
    details.addEventListener('toggle', () => {
      if (!details.open) details.querySelectorAll('video').forEach((video) => video.pause());
    });
  });

  // Customer stories: custom player per .player (native controls stay as no-JS fallback)
  const fmtT = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  const players = [...document.querySelectorAll('.stories .player')];
  const offscreen = ('IntersectionObserver' in window) ? new IntersectionObserver((es) => {
    es.forEach((e) => {
      const v = e.target.querySelector('video');
      if (!e.isIntersecting && v && !v.paused && !v.ended) v.pause();
    });
  }, { threshold: 0.25 }) : null;

  players.forEach((root) => {
    const video = root.querySelector('video');
    if (!video) return;
    video.removeAttribute('controls');
    const big = root.querySelector('.player-big');
    const spinner = root.querySelector('.player-spinner');
    const seek = root.querySelector('.seek-in');
    const tplay = root.querySelector('.tplay');
    const ttime = root.querySelector('.ttime');
    const tmute = root.querySelector('.tmute');
    const tcc = root.querySelector('.tcc');
    const tfs = root.querySelector('.tfs');
    const status = root.querySelector('.player-status');
    const errBox = root.querySelector('.player-err');
    const baked = parseFloat(root.dataset.duration) || 0;
    const [bigPlayIcon, bigReplayIcon] = big.querySelectorAll('svg');
    const [playIcon, pauseIcon] = tplay.querySelectorAll('svg');
    const [volIcon, muteIcon] = tmute.querySelectorAll('svg');
    const [fsInIcon, fsOutIcon] = tfs.querySelectorAll('svg');
    const baseBigLabel = big.getAttribute('aria-label') || 'Play video';
    const say = (msg) => { if (status) status.textContent = msg; };
    // NB: SVG elements lack the HTMLElement.hidden IDL (assignment would be a
    // no-op expando), so toggle the content attribute everywhere instead.
    const show = (el, on) => el.toggleAttribute('hidden', !on);
    const dur = () => video.duration || baked;
    const durText = () => fmtT(Math.round(dur()));

    const syncSeek = () => {
      const d = dur();
      const cur = Math.min(video.currentTime || 0, d);
      seek.max = d;
      seek.value = cur;
      seek.style.setProperty('--val', `${d ? (cur / d) * 100 : 0}%`);
      seek.setAttribute('aria-valuetext', `${fmtT(cur)} of ${durText()}`);
      ttime.textContent = `${fmtT(cur)} / ${durText()}`;
    };
    const syncBuf = () => {
      try {
        const d = dur();
        const b = video.buffered;
        if (b && b.length && d) seek.style.setProperty('--buf', `${(b.end(b.length - 1) / d) * 100}%`);
      } catch (_) { /* ignore */ }
    };
    const setState = (st) => {
      root.dataset.state = st;
      const playing = st === 'playing';
      const ended = st === 'ended';
      show(bigPlayIcon, !ended);
      show(bigReplayIcon, ended);
      big.setAttribute('aria-label', ended ? baseBigLabel.replace(/^Play:/, 'Replay:') : baseBigLabel);
      show(playIcon, !playing);
      show(pauseIcon, playing);
      tplay.setAttribute('aria-label', playing ? 'Pause' : 'Play');
      show(spinner, st === 'buffering');
      if (!playing) root.classList.remove('hidebar');
    };

    // Idle auto-hide while playing (2.75s); focus always pins the bar via CSS
    let hideTimer = null;
    const poke = () => {
      root.classList.remove('hidebar');
      if (hideTimer) clearTimeout(hideTimer);
      if (!video.paused && !video.ended) {
        hideTimer = setTimeout(() => root.classList.add('hidebar'), 2750);
      }
    };
    ['pointermove', 'pointerdown', 'keydown', 'touchstart', 'focusin'].forEach((ev) =>
      root.addEventListener(ev, poke, { passive: true }));
    root.addEventListener('focusout', poke);

    const toggle = () => {
      if (video.ended) { video.currentTime = 0; }
      if (video.paused) video.play().catch(() => {}); else video.pause();
    };
    big.addEventListener('click', toggle);
    tplay.addEventListener('click', toggle);
    video.addEventListener('click', () => {
      if (video.paused || video.ended) toggle();
      else if (root.classList.contains('hidebar')) poke();
      else video.pause();
    });
    tmute.addEventListener('click', () => {
      video.muted = !video.muted;
      show(volIcon, !video.muted);
      show(muteIcon, video.muted);
      tmute.setAttribute('aria-label', video.muted ? 'Unmute' : 'Mute');
      say(video.muted ? 'Muted' : 'Unmuted');
    });
    const ccTrack = () => (video.textTracks && video.textTracks[0]) || null;
    try { const t = ccTrack(); if (t) t.mode = 'showing'; } catch (_) { /* ignore */ }
    tcc.addEventListener('click', () => {
      const t = ccTrack();
      if (!t) return;
      const on = t.mode !== 'showing';
      try { t.mode = on ? 'showing' : 'disabled'; } catch (_) { /* ignore */ }
      tcc.setAttribute('aria-pressed', String(on));
      say(on ? 'Captions on' : 'Captions off');
    });
    const inFs = () => document.fullscreenElement === root;
    tfs.addEventListener('click', () => {
      if (inFs()) { document.exitFullscreen().catch(() => {}); return; }
      if (root.requestFullscreen) root.requestFullscreen().catch(() => {});
      else if (video.webkitEnterFullscreen) { try { video.webkitEnterFullscreen(); } catch (_) {} }
    });
    document.addEventListener('fullscreenchange', () => {
      const fs = inFs();
      show(fsInIcon, !fs);
      show(fsOutIcon, fs);
      tfs.setAttribute('aria-label', fs ? 'Exit fullscreen' : 'Enter fullscreen');
    });

    seek.addEventListener('input', () => {
      try { video.currentTime = parseFloat(seek.value) || 0; } catch (_) {}
      syncSeek();
      poke();
    });
    seek.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return; // Home/End stay native
      e.preventDefault();
      try { video.currentTime = Math.max(0, Math.min(dur(), video.currentTime + (e.key === 'ArrowRight' ? 5 : -5))); } catch (_) {}
      syncSeek();
    });
    root.addEventListener('keydown', (e) => {
      const k = (e.key || '').toLowerCase();
      const onControl = !!e.target.closest('button, input');
      if (k === ' ') { // buttons already toggle on Space; don't double-fire
        if (!onControl) { e.preventDefault(); toggle(); }
        return;
      }
      if (onControl && e.target.matches('input')) return; // seek keeps arrows/Home/End
      if (k === 'k') toggle();
      else if (k === 'j') { try { video.currentTime = Math.max(0, video.currentTime - 10); } catch (_) {} }
      else if (k === 'l') { try { video.currentTime = Math.min(dur(), video.currentTime + 10); } catch (_) {} }
      else if (k === 'm') tmute.click();
      else if (k === 'c') tcc.click();
      else if (k === 'f') tfs.click();
    });

    video.addEventListener('play', () => {
      players.forEach((o) => { // only one interview plays at a time
        const ov = o.querySelector('video');
        if (ov && ov !== video && !ov.paused) ov.pause();
      });
      setState('playing');
      say('Playing');
      poke();
    });
    video.addEventListener('pause', () => {
      if (!video.ended) { setState('paused'); say('Paused'); }
      poke();
    });
    video.addEventListener('waiting', () => setState('buffering'));
    video.addEventListener('playing', () => setState('playing'));
    video.addEventListener('canplay', () => { if (!video.paused && !video.ended) setState('playing'); });
    video.addEventListener('ended', () => { setState('ended'); say('Ended'); });
    video.addEventListener('timeupdate', syncSeek);
    video.addEventListener('progress', syncBuf);
    video.addEventListener('loadedmetadata', () => {
      if (!ccTrack()) show(tcc, false);
      syncSeek(); syncBuf();
    });
    const onErr = () => {
      if (video.networkState === HTMLMediaElement.NETWORK_NO_SOURCE || video.error) {
        root.classList.add('has-error');
        show(errBox, true);
      }
    };
    video.addEventListener('error', onErr);
    root.querySelectorAll('source').forEach((src) => src.addEventListener('error', onErr));

    setState('idle');
    syncSeek();
    if (offscreen) offscreen.observe(root);
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
      window.location.href = 'app.html';
    });
  }
})();
