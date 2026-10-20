// Native canvas adaptation of Aceternity UI StarsBackground + ShootingStars.
export function renderHomeStars() {
  return '<div class="home-stars" aria-hidden="true"><canvas data-home-stars></canvas></div>';
}

export function enableHomeStars() {
  const canvas = document.querySelector('[data-home-stars]');
  if (!canvas) return;
  const context = canvas.getContext('2d');
  if (!context) return;
  const lifecycle = new AbortController();
  const options = { signal: lifecycle.signal };
  const preference = matchMedia('(prefers-reduced-motion: reduce)');
  let stars = [];
  let streaks = [];
  let width = 1;
  let height = 1;
  let frame = 0;
  let lastDraw = 0;
  let previous = 0;
  let nextShootingStar = performance.now() + 1200;
  let color;

  function theme() {
    color = document.documentElement.dataset.theme === 'dark' ? '209, 231, 226' : '63, 110, 100';
  }
  function resize() {
    width = Math.max(1, window.innerWidth);
    height = Math.max(1, window.innerHeight);
    const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    const limit = width < 600 ? 85 : 190;
    const count = Math.min(limit, Math.max(35, Math.round((width * height) / 8500)));
    stars = Array.from({ length: count }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      radius: 0.5 + Math.random() * 0.8,
      phase: Math.random() * Math.PI * 2,
      speed: 0.35 + Math.random() * 0.6,
    }));
    draw(performance.now());
  }
  function draw(time) {
    context.clearRect(0, 0, width, height);
    const seconds = time / 1000;
    stars.forEach((star) => {
      const alpha = preference.matches
        ? 0.4
        : 0.18 + (Math.sin(seconds * star.speed + star.phase) + 1) * 0.2;
      context.fillStyle = `rgba(${color}, ${alpha})`;
      context.beginPath();
      context.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
      context.fill();
    });
    streaks.forEach((star) => {
      const tailX = star.x - 100;
      const tailY = star.y - 55;
      const gradient = context.createLinearGradient(tailX, tailY, star.x, star.y);
      gradient.addColorStop(0, `rgba(${color}, 0)`);
      gradient.addColorStop(1, `rgba(${color}, 0.85)`);
      context.strokeStyle = gradient;
      context.lineWidth = 1.5;
      context.beginPath();
      context.moveTo(tailX, tailY);
      context.lineTo(star.x, star.y);
      context.stroke();
    });
  }
  function animate(time) {
    if (time - lastDraw >= 1000 / 30) {
      const elapsed = Math.min((time - previous) / 1000 || 0, 0.1);
      if (time >= nextShootingStar) {
        streaks.push({ x: Math.random() * width * 0.75, y: -100 });
        nextShootingStar = time + 4000 + Math.random() * 5000;
      }
      streaks.forEach((star) => {
        star.x += elapsed * 540;
        star.y += elapsed * 300;
      });
      streaks = streaks.filter((star) => star.x < width + 150 && star.y < height + 150);
      draw(time);
      previous = time;
      lastDraw = time;
    }
    frame = requestAnimationFrame(animate);
  }
  function sync() {
    cancelAnimationFrame(frame);
    frame = 0;
    streaks = [];
    if (document.hidden) return;
    previous = performance.now();
    lastDraw = 0;
    nextShootingStar = previous + 1200;
    draw(previous);
    if (!preference.matches) frame = requestAnimationFrame(animate);
  }
  theme();
  resize();
  sync();
  window.addEventListener('resize', resize, options);
  document.addEventListener(
    'robiner-theme-change',
    () => {
      theme();
      draw(performance.now());
    },
    options,
  );
  document.addEventListener('visibilitychange', sync, options);
  preference.addEventListener('change', sync, options);
  return () => {
    lifecycle.abort();
    cancelAnimationFrame(frame);
  };
}

export function renderSidebarStars() {
  return '<div class="sidebar-stars" aria-hidden="true"><canvas data-sidebar-stars></canvas></div>';
}

export function enableSidebarStars() {
  const canvas = document.querySelector('[data-sidebar-stars]');
  if (!canvas) return () => {};
  const context = canvas.getContext?.('2d');
  if (!context) return () => {};
  const lifecycle = new AbortController();
  const options = { signal: lifecycle.signal };
  const preference = matchMedia('(prefers-reduced-motion: reduce)');
  let stars = [];
  let shootingStars = [];
  let width = 1;
  let height = 1;
  let frame = 0;
  let lastDraw = 0;
  let previous = 0;
  let nextShootingStar = performance.now() + 1000;
  let starColor, trailColor, trailFade, twinkleColor;

  function theme() {
    const isDark = document.documentElement.dataset.theme === 'dark';
    starColor = isDark ? '#9E00FF' : '#7C3AED';
    trailColor = isDark ? 'rgba(46, 185, 223, 0.85)' : 'rgba(2, 132, 199, 0.85)';
    trailFade = isDark ? 'rgba(46, 185, 223, 0)' : 'rgba(2, 132, 199, 0)';
    twinkleColor = isDark ? '209, 231, 226' : '63, 110, 100';
  }

  function resize() {
    const sidebar = canvas.closest('.portfolio-sidebar') || canvas.parentElement;
    width = Math.max(1, sidebar?.clientWidth || 220);
    height = Math.max(1, sidebar?.clientHeight || window.innerHeight);
    const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);

    const area = width * height;
    const numStars = Math.min(50, Math.max(15, Math.floor(area * 0.00015)));
    stars = Array.from({ length: numStars }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      radius: 0.5 + Math.random() * 0.7,
      twinkleSpeed: 0.5 + Math.random() * 0.5,
      phase: Math.random() * Math.PI * 2,
    }));
    draw(performance.now());
  }

  function spawnShootingStar() {
    const side = Math.random() < 0.6 ? 0 : 3;
    const offset = side === 0 ? Math.random() * width : Math.random() * height * 0.5;
    const angle = 45;
    const speed = 120 + Math.random() * 160;
    shootingStars.push({
      x: side === 0 ? offset : 0,
      y: side === 0 ? 0 : offset,
      angle,
      scale: 1,
      speed,
      distance: 0,
    });
  }

  function draw(time) {
    context.clearRect(0, 0, width, height);
    const seconds = time / 1000;

    stars.forEach((star) => {
      const alpha = preference.matches
        ? 0.35
        : 0.2 + (Math.sin(seconds * star.twinkleSpeed + star.phase) + 1) * 0.25;
      context.fillStyle = `rgba(${twinkleColor}, ${alpha})`;
      context.beginPath();
      context.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
      context.fill();
    });

    shootingStars.forEach((star) => {
      const radians = (star.angle * Math.PI) / 180;
      const headX = star.x;
      const headY = star.y;
      const length = 36 * star.scale;
      const tailX = headX - length * Math.cos(radians);
      const tailY = headY - length * Math.sin(radians);

      const gradient = context.createLinearGradient(tailX, tailY, headX, headY);
      gradient.addColorStop(0, trailFade);
      gradient.addColorStop(0.5, trailColor);
      gradient.addColorStop(1, starColor);
      context.strokeStyle = gradient;
      context.lineWidth = 1.6;
      context.beginPath();
      context.moveTo(tailX, tailY);
      context.lineTo(headX, headY);
      context.stroke();

      context.fillStyle = starColor;
      context.beginPath();
      context.arc(headX, headY, 1.2, 0, Math.PI * 2);
      context.fill();
    });
  }

  function animate(time) {
    if (time - lastDraw >= 1000 / 30) {
      const elapsed = Math.min((time - previous) / 1000 || 0, 0.1);
      if (time >= nextShootingStar) {
        spawnShootingStar();
        nextShootingStar = time + 1400 + Math.random() * 2600;
      }
      shootingStars.forEach((star) => {
        const radians = (star.angle * Math.PI) / 180;
        star.x += elapsed * star.speed * Math.cos(radians);
        star.y += elapsed * star.speed * Math.sin(radians);
        star.distance += elapsed * star.speed;
        star.scale = 1 + star.distance / 120;
      });
      shootingStars = shootingStars.filter(
        (star) => star.x < width + 50 && star.y < height + 50,
      );
      draw(time);
      previous = time;
      lastDraw = time;
    }
    frame = requestAnimationFrame(animate);
  }

  function sync() {
    cancelAnimationFrame(frame);
    frame = 0;
    shootingStars = [];
    if (document.hidden) return;
    previous = performance.now();
    lastDraw = 0;
    nextShootingStar = previous + 1000;
    draw(previous);
    if (!preference.matches) frame = requestAnimationFrame(animate);
  }

  theme();
  resize();
  sync();
  window.addEventListener('resize', resize, options);
  document.addEventListener(
    'robiner-theme-change',
    () => {
      theme();
      draw(performance.now());
    },
    options,
  );
  document.addEventListener('visibilitychange', sync, options);
  preference.addEventListener('change', sync, options);
  return () => {
    lifecycle.abort();
    cancelAnimationFrame(frame);
  };
}
