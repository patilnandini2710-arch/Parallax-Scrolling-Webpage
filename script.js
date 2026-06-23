/* ============================================================
   AETHERIA — Parallax Future-of-Technology Landing Page
   JavaScript
   ============================================================
   Sections:
   1. Utilities & state
   2. Custom cursor
   3. Scroll progress bar + signature spine
   4. Nav behaviour (scrolled state + mobile menu)
   5. Parallax engine (scroll-speed layers)
   6. Mouse-parallax engine (data-mouse layers)
   7. Starfield canvases (hero + cosmos)
   8. GSAP ScrollTrigger reveals
   9. Card tilt interaction
   10. Magnetic CTA button + toast
   11. Theme toggle (dark/light)
   12. Sound toggle (Web Audio UI feedback)
   ============================================================ */

(() => {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isTouch = window.matchMedia('(hover: none)').matches;

  /* ---------- 1. Utilities ---------- */
  const lerp = (a, b, n) => a + (b - a) * n;
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

  let scrollY = window.scrollY;
  let docHeight = 1;
  const recalcDocHeight = () => {
    docHeight = document.documentElement.scrollHeight - window.innerHeight;
  };
  recalcDocHeight();
  window.addEventListener('resize', recalcDocHeight);

  // Shared pointer position (mouse OR touch) so the custom cursor and the
  // interactive starfields all react to the same coordinate, in sync.
  // Starts off-screen so nothing reacts until the person actually moves.
  const pointer = { x: -9999, y: -9999, active: false, lastMove: 0 };
  window.addEventListener('pointermove', (e) => {
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    pointer.active = true;
    pointer.lastMove = performance.now();
  }, { passive: true });
  window.addEventListener('pointerleave', () => { pointer.active = false; });
  // If the pointer hasn't moved in a while (or this is a touch device that
  // just lifted off), let the starfield relax back to ambient drift.
  function isPointerLive() {
    return pointer.active && (performance.now() - pointer.lastMove) < 2200;
  }

  /* ============================================================
     2. CUSTOM CURSOR
     ============================================================ */
  if (!isTouch) {
    const dot = document.querySelector('.cursor-dot');
    const ring = document.querySelector('.cursor-ring');
    let ringX = pointer.x, ringY = pointer.y;

    window.addEventListener('pointermove', (e) => {
      dot.style.left = e.clientX + 'px';
      dot.style.top = e.clientY + 'px';
    }, { passive: true });

    function animateCursor() {
      ringX = lerp(ringX, pointer.x, 0.18);
      ringY = lerp(ringY, pointer.y, 0.18);
      ring.style.left = ringX + 'px';
      ring.style.top = ringY + 'px';
      requestAnimationFrame(animateCursor);
    }
    animateCursor();

    document.querySelectorAll('.interactive').forEach((el) => {
      el.addEventListener('mouseenter', () => ring.classList.add('hovering'));
      el.addEventListener('mouseleave', () => ring.classList.remove('hovering'));
    });

    // Whenever a star drifts close enough to "merge" into the cursor
    // (dispatched from the starfield engine below), give the ring a
    // happy little pulse — the visual payoff of the merge.
    let mergePulseTimer;
    document.addEventListener('aetheria:starmerge', () => {
      ring.classList.add('merging');
      clearTimeout(mergePulseTimer);
      mergePulseTimer = setTimeout(() => ring.classList.remove('merging'), 260);
    });
  } else {
    document.querySelector('.cursor').style.display = 'none';
  }

  /* ============================================================
     3. SCROLL PROGRESS BAR + SIGNATURE SPINE
     ============================================================ */
  const progressFill = document.getElementById('progressFill');
  const spinePath = document.getElementById('spinePath');
  const spineComet = document.getElementById('spineComet');
  const spineSvg = document.getElementById('spineSvg');
  const spineLength = spinePath ? spinePath.getTotalLength() : 0;
  if (spinePath) spinePath.style.strokeDasharray = spineLength;

  let spineFullLength = spineLength;

  function recalcSpineGeometry() {
    if (!spinePath || window.innerWidth <= 900) return;
    const fullHeight = document.documentElement.scrollHeight;
    spineSvg.style.height = fullHeight + 'px';
    spineSvg.setAttribute('viewBox', `0 0 100 ${fullHeight}`);
    spinePath.setAttribute('d', `M50,0 L50,${fullHeight}`);
    spineFullLength = spinePath.getTotalLength();
    spinePath.style.strokeDasharray = spineFullLength;
  }
  recalcSpineGeometry();
  window.addEventListener('resize', recalcSpineGeometry);

  function updateProgressAndSpine() {
    const pct = clamp(scrollY / docHeight, 0, 1);
    progressFill.style.width = (pct * 100) + '%';

    if (spinePath && spineComet && window.innerWidth > 900) {
      spinePath.style.strokeDashoffset = spineFullLength - spineFullLength * pct;
      const point = spinePath.getPointAtLength(spineFullLength * pct);
      spineComet.setAttribute('cx', point.x);
      spineComet.setAttribute('cy', point.y);
    }
  }

  /* ============================================================
     4. NAV BEHAVIOUR
     ============================================================ */
  const nav = document.getElementById('siteNav');
  const navLinks = document.querySelector('.nav-links');
  const hamburger = document.getElementById('navHamburger');

  function updateNavState() {
    nav.classList.toggle('scrolled', scrollY > 40);
  }

  hamburger.addEventListener('click', () => {
    navLinks.classList.toggle('open');
  });
  navLinks.querySelectorAll('a').forEach((a) => {
    a.addEventListener('click', () => navLinks.classList.remove('open'));
  });

  /* ============================================================
     5. PARALLAX ENGINE — elements with [data-speed]
     ============================================================
     Each layer scrolls at (1 - speed) relative ratio so that a
     speed close to 0 feels almost fixed (far background) and a
     speed close to 1 moves with the page (foreground/content).
  */
  const speedLayers = Array.from(document.querySelectorAll('[data-speed]')).map((el) => ({
    el,
    speed: parseFloat(el.dataset.speed),
    sectionTop: 0
  }));

  function recalcSectionOffsets() {
    speedLayers.forEach((layer) => {
      const section = layer.el.closest('.section');
      layer.sectionTop = section ? section.offsetTop : 0;
    });
  }
  recalcSectionOffsets();
  window.addEventListener('resize', recalcSectionOffsets);

  function updateParallax() {
    speedLayers.forEach((layer) => {
      // Distance scrolled relative to the layer's own section start.
      const relative = (scrollY - layer.sectionTop) * layer.speed;
      layer.el.style.transform = `translate3d(0, ${relative}px, 0)`;
    });
  }

  /* ============================================================
     6. MOUSE-PARALLAX ENGINE — elements with [data-mouse]
     ============================================================ */
  const mouseLayers = Array.from(document.querySelectorAll('[data-mouse]')).map((el) => ({
    el,
    strength: parseFloat(el.dataset.mouse),
    x: 0, y: 0, tx: 0, ty: 0
  }));

  if (!isTouch && !reduceMotion) {
    window.addEventListener('mousemove', (e) => {
      const nx = (e.clientX / window.innerWidth) - 0.5;
      const ny = (e.clientY / window.innerHeight) - 0.5;
      mouseLayers.forEach((l) => {
        l.tx = nx * l.strength;
        l.ty = ny * l.strength;
      });
    });
  }

  function updateMouseParallax() {
    mouseLayers.forEach((l) => {
      l.x = lerp(l.x, l.tx, 0.06);
      l.y = lerp(l.y, l.ty, 0.06);
      // Combine with existing scroll transform by writing a CSS variable
      l.el.style.setProperty('--mx', l.x + 'px');
      l.el.style.setProperty('--my', l.y + 'px');
      l.el.style.translate = `${l.x}px ${l.y}px`;
    });
  }

  /* ============================================================
     MASTER SCROLL/RAF LOOP
     ============================================================ */
  window.addEventListener('scroll', () => { scrollY = window.scrollY; }, { passive: true });

  function masterLoop() {
    updateProgressAndSpine();
    updateNavState();
    updateParallax();
    updateMouseParallax();
    requestAnimationFrame(masterLoop);
  }
  masterLoop();

  /* ============================================================
     7. STARFIELD CANVASES — interactive: stars drift on their own,
        get pulled toward the pointer when it's nearby, and "merge"
        (pop into a tiny spark + respawn elsewhere) when they touch it.
     ============================================================ */
  const MERGE_COLORS = ['#00f0ff', '#a855f7', '#ff3fb0'];

  function initStarfield(canvasId, density) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let stars = [];
    let sparks = []; // transient burst particles from a merge
    let w, h, rect;

    function spawnStar(fadeIn) {
      return {
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.12,
        vy: (Math.random() - 0.5) * 0.12,
        r: Math.random() * 1.5 + 0.4,
        baseAlpha: Math.random() * 0.6 + 0.35,
        alpha: fadeIn ? 0 : (Math.random() * 0.6 + 0.35),
        twinkleSpeed: Math.random() * 0.02 + 0.005,
        phase: Math.random() * Math.PI * 2
      };
    }

    function resize() {
      w = canvas.width = canvas.offsetWidth;
      h = canvas.height = canvas.offsetHeight;
      const count = Math.floor((w * h) / density);
      stars = Array.from({ length: count }, () => spawnStar(false));
      rect = canvas.getBoundingClientRect();
    }

    function spawnSparks(x, y, color) {
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI * 2 * i) / 6 + Math.random() * 0.5;
        const speed = Math.random() * 1.6 + 0.6;
        sparks.push({
          x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
          life: 1, color
        });
      }
      // Let the custom cursor know a merge just happened nearby.
      document.dispatchEvent(new CustomEvent('aetheria:starmerge'));
    }

    let t = 0;
    const ATTRACT_RADIUS = 130;
    const MERGE_RADIUS = 13;

    function draw() {
      t += 1;
      ctx.clearRect(0, 0, w, h);

      // Refresh the canvas's viewport rect occasionally — cheap enough to
      // do every frame here since each section only has one canvas.
      rect = canvas.getBoundingClientRect();
      const live = isPointerLive() && pointer.x >= rect.left && pointer.x <= rect.right
                   && pointer.y >= rect.top && pointer.y <= rect.bottom;
      const px = pointer.x - rect.left;
      const py = pointer.y - rect.top;

      stars.forEach((s, i) => {
        // Ambient drift, wrapping around the edges so the field feels alive.
        s.x += s.vx; s.y += s.vy;
        if (s.x < -5) s.x = w + 5; if (s.x > w + 5) s.x = -5;
        if (s.y < -5) s.y = h + 5; if (s.y > h + 5) s.y = -5;

        if (live) {
          const dx = px - s.x, dy = py - s.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < MERGE_RADIUS) {
            // Merge into the cursor: pop a little spark and respawn.
            spawnSparks(s.x, s.y, MERGE_COLORS[i % MERGE_COLORS.length]);
            stars[i] = spawnStar(true);
            return;
          }
          if (dist < ATTRACT_RADIUS) {
            const pull = 1 - dist / ATTRACT_RADIUS;
            s.x += dx * pull * 0.05;
            s.y += dy * pull * 0.05;
          }
        }

        // Fade newly-respawned stars back in smoothly.
        s.alpha = lerp(s.alpha, s.baseAlpha, 0.04);
        const twinkle = Math.sin(t * s.twinkleSpeed + s.phase) * 0.25;
        ctx.globalAlpha = clamp(s.alpha + twinkle, 0, 1);
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      });

      // Draw + advance the little merge sparks.
      ctx.globalAlpha = 1;
      sparks = sparks.filter((sp) => sp.life > 0.02);
      sparks.forEach((sp) => {
        sp.x += sp.vx; sp.y += sp.vy; sp.life *= 0.92;
        ctx.globalAlpha = sp.life;
        ctx.fillStyle = sp.color;
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, 1.8 * sp.life + 0.4, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;

      requestAnimationFrame(draw);
    }

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();
    if (reduceMotion) {
      // Single static render — no drift, no pointer attraction, no rAF loop.
      ctx.fillStyle = '#ffffff';
      stars.forEach((s) => {
        ctx.globalAlpha = s.baseAlpha;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;
    } else {
      draw();
    }
  }
  initStarfield('starCanvas', 3200);
  initStarfield('cosmosCanvas', 2600);
  initStarfield('journeyStarCanvas', 3800);
  initStarfield('ctaStarCanvas', 3600);

  /* ============================================================
     8. GSAP SCROLLTRIGGER REVEALS
     ============================================================ */
  if (window.gsap && window.ScrollTrigger) {
    gsap.registerPlugin(ScrollTrigger);

    // Hero title lines: slide up + fade on load.
    gsap.from('.hero-title .line', {
      yPercent: 110, opacity: 0, duration: 1.1, ease: 'power3.out', stagger: 0.12, delay: 0.2
    });
    gsap.from('.hero-sub, .scroll-indicator', {
      opacity: 0, y: 20, duration: 1, ease: 'power2.out', delay: 0.7
    });

    // Generic section title / lede reveal for every section after hero.
    document.querySelectorAll('.section:not(.hero) .eyebrow, .section:not(.hero) .section-title, .section:not(.hero) .section-lede').forEach((el) => {
      gsap.fromTo(el, { opacity: 0, y: 40 }, {
        opacity: 1, y: 0, duration: 0.9, ease: 'power3.out',
        scrollTrigger: { trigger: el, start: 'top 85%' }
      });
    });

    // Journey story lines reveal one by one.
    gsap.utils.toArray('.reveal-line').forEach((line, i) => {
      gsap.fromTo(line, { opacity: 0, y: 30 }, {
        opacity: 1, y: 0, color: 'var(--white)', duration: 0.8, ease: 'power2.out',
        scrollTrigger: { trigger: line, start: 'top 88%' }
      });
    });

    // Innovation cards: staggered scale + fade reveal.
    gsap.fromTo('.tilt-card', { opacity: 0, y: 60, scale: 0.92 }, {
      opacity: 1, y: 0, scale: 1, duration: 0.8, ease: 'power3.out', stagger: 0.12,
      scrollTrigger: { trigger: '.card-grid', start: 'top 80%' }
    });

    // Cosmos planets drift in with a scale pop.
    gsap.utils.toArray('.planet').forEach((p, i) => {
      gsap.fromTo(p, { opacity: 0, scale: 0.6 }, {
        opacity: 1, scale: 1, duration: 1, ease: 'back.out(1.4)', delay: i * 0.1,
        scrollTrigger: { trigger: '.cosmos', start: 'top 70%' }
      });
    });

    // CTA button pop + ring fade.
    gsap.fromTo('.magnetic-btn', { opacity: 0, y: 30 }, {
      opacity: 1, y: 0, duration: 0.9, ease: 'power3.out',
      scrollTrigger: { trigger: '.cta', start: 'top 60%' }
    });
    gsap.fromTo('.cta-ring', { opacity: 0, scale: 0.7 }, {
      opacity: 1, scale: 1, duration: 1.2, ease: 'power2.out',
      scrollTrigger: { trigger: '.cta', start: 'top 70%' }
    });
  }

  /* ============================================================
     9. CARD TILT INTERACTION (mouse-responsive 3D cards)
     ============================================================ */
  if (!isTouch && !reduceMotion) {
    document.querySelectorAll('.tilt-card').forEach((card) => {
      const inner = card.querySelector('.tilt-inner');
      card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const px = (e.clientX - rect.left) / rect.width - 0.5;
        const py = (e.clientY - rect.top) / rect.height - 0.5;
        inner.style.transform = `rotateY(${px * 14}deg) rotateX(${-py * 14}deg) translateZ(10px)`;
      });
      card.addEventListener('mouseleave', () => {
        inner.style.transform = 'rotateY(0) rotateX(0) translateZ(0)';
      });
    });
  }

  /* ============================================================
     10. MAGNETIC CTA BUTTON + TOAST
     ============================================================ */
  const ctaButton = document.getElementById('ctaButton');
  const toast = document.getElementById('toast');

  if (!isTouch && !reduceMotion) {
    ctaButton.addEventListener('mousemove', (e) => {
      const rect = ctaButton.getBoundingClientRect();
      const mx = (e.clientX - rect.left - rect.width / 2) * 0.3;
      const my = (e.clientY - rect.top - rect.height / 2) * 0.4;
      ctaButton.style.transform = `translate(${mx}px, ${my}px)`;
    });
    ctaButton.addEventListener('mouseleave', () => {
      ctaButton.style.transform = 'translate(0,0)';
    });
  }

  let toastTimer;
  ctaButton.addEventListener('click', () => {
    playUiSound('confirm');
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2400);
    const rect = ctaButton.getBoundingClientRect();
    confettiBurst(rect.left + rect.width / 2, rect.top + rect.height / 2, 18);
  });

  /* ============================================================
     11. THEME TOGGLE
     ============================================================ */
  const themeToggle = document.getElementById('themeToggle');
  const htmlEl = document.documentElement;

  themeToggle.addEventListener('click', () => {
    const isLight = htmlEl.getAttribute('data-theme') === 'light';
    htmlEl.setAttribute('data-theme', isLight ? 'dark' : 'light');
    themeToggle.querySelector('.icon-moon').hidden = isLight;
    themeToggle.querySelector('.icon-sun').hidden = !isLight;
    playUiSound('click');
  });

  /* ============================================================
     12. SOUND TOGGLE — light Web Audio UI feedback (no external files)
     ============================================================ */
  let soundOn = false;
  let audioCtx = null;
  const soundToggle = document.getElementById('soundToggle');

  function ensureAudioCtx() {
    if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) audioCtx = new AC();
    }
    return audioCtx;
  }

  function playUiSound(type) {
    if (!soundOn) return;
    const ctx = ensureAudioCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    const now = ctx.currentTime;
    if (type === 'click') {
      osc.frequency.setValueAtTime(660, now);
      gain.gain.setValueAtTime(0.06, now);
    } else if (type === 'confirm') {
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.linearRampToValueAtTime(880, now + 0.15);
      gain.gain.setValueAtTime(0.08, now);
    } else {
      osc.frequency.setValueAtTime(520, now);
      gain.gain.setValueAtTime(0.05, now);
    }
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);
    osc.start(now);
    osc.stop(now + 0.26);
  }

  soundToggle.addEventListener('click', () => {
    soundOn = !soundOn;
    soundToggle.querySelector('.icon-on').hidden = !soundOn;
    soundToggle.querySelector('.icon-off').hidden = soundOn;
    if (soundOn) { ensureAudioCtx(); playUiSound('click'); }
  });

  // Subtle hover tick on interactive elements when sound is enabled.
  document.querySelectorAll('.interactive').forEach((el) => {
    el.addEventListener('mouseenter', () => playUiSound('hover'));
  });

  /* ============================================================
     13. CLICK CONFETTI — a little burst of color wherever you click.
     ============================================================ */
  function confettiBurst(x, y, count) {
    if (reduceMotion) return;
    for (let i = 0; i < count; i++) {
      const bit = document.createElement('div');
      bit.className = 'confetti-bit';
      const color = MERGE_COLORS[i % MERGE_COLORS.length];
      bit.style.background = color;
      bit.style.boxShadow = `0 0 6px ${color}`;
      document.body.appendChild(bit);

      const angle = Math.random() * Math.PI * 2;
      const dist = 40 + Math.random() * 70;
      const dx = Math.cos(angle) * dist;
      const dy = Math.sin(angle) * dist - 20; // slight upward bias
      const rot = (Math.random() - 0.5) * 480;

      bit.style.left = x + 'px';
      bit.style.top = y + 'px';
      bit.style.opacity = '1';
      bit.style.transform = 'translate(-50%, -50%) scale(1) rotate(0deg)';
      bit.style.transition = `transform ${600 + Math.random() * 300}ms cubic-bezier(.16,.84,.32,1), opacity 700ms ease`;

      requestAnimationFrame(() => {
        bit.style.transform = `translate(${dx - 3.5}px, ${dy - 3.5}px) scale(0.3) rotate(${rot}deg)`;
        bit.style.opacity = '0';
      });
      setTimeout(() => bit.remove(), 1000);
    }
  }

  // A gentle sparkle on most clicks…
  let lastBurst = 0;
  document.addEventListener('click', (e) => {
    const now = performance.now();
    if (now - lastBurst < 150) return; // throttle rapid clicks
    lastBurst = now;
    confettiBurst(e.clientX, e.clientY, 5);
  });

  // …and a happy little bounce when the logo is clicked.
  const navLogo = document.getElementById('navLogo');
  navLogo.addEventListener('click', () => {
    navLogo.classList.remove('bounce');
    requestAnimationFrame(() => navLogo.classList.add('bounce'));
  });

  // The scroll indicator is now a real shortcut down to the next chapter.
  document.querySelector('.scroll-indicator').addEventListener('click', () => {
    document.getElementById('journey').scrollIntoView({ behavior: 'smooth' });
  });

  /* ---------- Recalculate layout-dependent values on resize ---------- */
  window.addEventListener('resize', () => {
    recalcDocHeight();
    recalcSectionOffsets();
  });

  window.addEventListener('load', () => {
    recalcDocHeight();
    recalcSectionOffsets();
    recalcSpineGeometry();
  });
  // Fonts can shift layout slightly after first paint.
  setTimeout(() => {
    recalcDocHeight();
    recalcSectionOffsets();
    recalcSpineGeometry();
  }, 800);
})();
