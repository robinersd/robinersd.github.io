import { createCommunityClient } from './community-api.js?v=community-phone-84';

function renderCommunityAvatars() {
  // Decorative illustrations, never presented as actual visitor identities.
  return [
    'M7 15 6 7l7-3 9 4 3 7-6-5-5 2-4-1Z',
    'M6 20V11C6 1 26 1 26 11v9l-5-7-5-2-5 3Z',
    'M5 13 8 5l6 2 5-3 7 6-3 7-3-7-6 3-3-3-2 6Z',
    'M6 17V9l5-5 10 1 5 6-3 8-2-7-4-3-5 2-3 8Z',
  ]
    .map(
      (hair) =>
        `<span class="community-avatar"><svg viewBox="0 0 32 32" fill="none"><path d="M3 32c0-11 26-11 26 0" fill="#555"/><ellipse cx="16" cy="16" rx="8" ry="10" fill="#eee"/><path d="${hair}" fill="#252525"/><path d="M11 17h2m6 0h2m-8 6q3 2 6 0" stroke="#333" stroke-linecap="round"/></svg></span>`,
    )
    .join('');
}

export function renderCommunityVisitors() {
  return `<div class="footer-visitors" aria-label="Portfolio total visits">
    <div class="community-avatar-stack" aria-hidden="true">${renderCommunityAvatars()}</div>
    <div class="community-visit-pill">Visited by <strong data-community-total>—</strong> people</div>
  </div>`;
}

export function renderCommunityPanel() {
  return `<section class="community-panel" aria-label="Portfolio visitors and rating">
    <div class="community-avatar-stack" aria-hidden="true">${renderCommunityAvatars()}</div>
    <div class="community-visit-pill">Visited by <strong data-community-total>—</strong> people</div>
    <div class="community-viewing"><i class="community-live-dot" aria-hidden="true"></i><strong data-community-live>—</strong> viewing now</div>
    <div class="community-rating-summary"><strong data-community-rating>—</strong><span data-community-rating-count>Portfolio rating</span></div>
    <button type="button" class="button community-feedback-open" data-feedback-open aria-haspopup="dialog" aria-controls="portfolio-feedback">Leave feedback</button>
    <div class="community-inquiries">
      <p class="community-inquiries-text">For work inquiries, projects, and everything else — feel free to contact me at email:</p>
      <a class="community-inquiries-email" href="mailto:dahaprobiner@gmail.com">
        <svg class="community-email-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="m4 7 8 6 8-6"/></svg>dahaprobiner@gmail.com
      </a>
    </div>
    <span class="community-availability visually-hidden" data-community-availability>Loading visitor statistics.</span>
  </section>`;
}

export function renderFeedbackDialog() {
  const star = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2.8 2.8 5.7 6.3.9-4.6 4.5 1.1 6.3-5.6-3-5.6 3 1.1-6.3L3 9.4l6.2-.9Z"/></svg>`;
  return `<dialog id="portfolio-feedback" class="feedback-dialog" aria-labelledby="feedback-title" aria-describedby="feedback-description">
    <button type="button" class="feedback-close" data-feedback-close aria-label="Close feedback">×</button>
    <span class="eyebrow">Thanks for looking around</span>
    <h2 id="feedback-title">How was your visit?</h2>
    <p id="feedback-description">Your rating helps me improve this portfolio. Only the average stars and rating count are public. Your comment stays private.</p>
    <form class="feedback-form">
      <fieldset class="feedback-rating"><legend>Your rating</legend><div class="feedback-stars">
        ${[1, 2, 3, 4, 5].map((rating) => `<label data-rating-value="${rating}"><input class="visually-hidden" type="radio" name="rating" value="${rating}" required /><span class="visually-hidden">${rating} ${rating === 1 ? 'star' : 'stars'}</span>${star}</label>`).join('')}
      </div></fieldset>
      <label class="feedback-comment-label" for="feedback-comment">What could I improve? <span>(optional)</span></label>
      <textarea id="feedback-comment" name="comment" rows="4" maxlength="1500" placeholder="Share a suggestion…" aria-describedby="feedback-private-note"></textarea>
      <p id="feedback-private-note" class="feedback-private-note">Only Robiner can read your comment. Please leave out sensitive information.</p>
      <div class="feedback-honeypot" aria-hidden="true"><label for="feedback-website">Leave this blank</label><input id="feedback-website" name="website" type="text" tabindex="-1" autocomplete="off" /></div>
      <div class="feedback-actions"><button type="button" class="button" data-feedback-close>Skip</button><button type="submit" class="button primary feedback-submit">Send feedback</button></div>
    </form>
    <div class="feedback-thanks" hidden><p>Thank you! Your rating has been added. Your comment is private.</p><button type="button" class="button primary" data-feedback-close>Done</button></div>
    <p class="feedback-status" role="status" aria-live="polite"></p>
  </dialog>`;
}

export function enablePortfolioCommunity(config) {
  const panel = document.querySelector('.community-panel');
  const dialog = document.querySelector('#portfolio-feedback');
  if (!panel || !dialog) return { refreshRoute() {}, destroy() {} };
  let storage;
  try {
    storage = window.sessionStorage;
  } catch {
    /* In-memory session if storage is blocked. */
  }
  const read = (key) => {
    try {
      return storage?.getItem(key);
    } catch {
      return null;
    }
  };
  const write = (key, value) => {
    try {
      storage?.setItem(key, value);
    } catch {
      /* Keep memory state. */
    }
  };
  let client;
  try {
    client = createCommunityClient(config, { storage });
  } catch {
    // Unsupported browser/config: show unavailable stats without breaking the page.
    client = null;
  }
  const totals = [...document.querySelectorAll('[data-community-total]')];
  const live = panel.querySelector('[data-community-live]');
  const rating = panel.querySelector('[data-community-rating]');
  const ratingCount = panel.querySelector('[data-community-rating-count]');
  const availability = panel.querySelector('[data-community-availability]');
  const openButton = panel.querySelector('[data-feedback-open]');
  const form = dialog.querySelector('form');
  const radios = [...form.querySelectorAll('[name="rating"]')];
  const labels = [...form.querySelectorAll('[data-rating-value]')];
  const starGroup = form.querySelector('.feedback-stars');
  const comment = form.querySelector('[name="comment"]');
  const honeypot = form.querySelector('[name="website"]');
  const submit = form.querySelector('[type="submit"]');
  const status = dialog.querySelector('.feedback-status');
  const thanks = dialog.querySelector('.feedback-thanks');
  let seen = read('robiner.feedback.seen.v1') === 'true';
  let submitted = read('robiner.feedback.submitted.v1') === 'true';
  let reviewed = read('robiner.feedback.reviewed.v1') === 'true';
  let pendingPrompt = false;
  let previousY = window.scrollY;
  let connected = false;
  let running = false;
  let sending = false;
  let stopped = false;
  let timer = 0;
  let frame = 0;
  let failures = 0;
  let opener;
  const listeners = [];
  function listen(target, type, callback, options) {
    target.addEventListener(type, callback, options);
    listeners.push(() => target.removeEventListener(type, callback, options));
  }
  function unavailable() {
    connected = false;
    totals.forEach((total) => {
      total.textContent = '—';
    });
    live.textContent = rating.textContent = '—';
    ratingCount.textContent = 'Portfolio rating';
    panel.dataset.live = 'false';
    availability.textContent = 'Visitor statistics are temporarily unavailable.';
  }
  function updateStats(stats) {
    if (
      !stats ||
      !['totalVisits', 'liveVisitors', 'ratingCount'].every(
        (key) => Number.isSafeInteger(stats[key]) && stats[key] >= 0,
      ) ||
      (stats.ratingCount > 0 && stats.averageRating === null) ||
      (stats.averageRating !== null &&
        (!Number.isFinite(stats.averageRating) ||
          stats.averageRating < 1 ||
          stats.averageRating > 5))
    )
      throw new Error('Invalid statistics');
    connected = true;
    totals.forEach((total) => {
      total.textContent = stats.totalVisits.toLocaleString();
    });
    live.textContent = stats.liveVisitors.toLocaleString();
    rating.textContent = stats.ratingCount
      ? `★ ${stats.averageRating.toFixed(1)} / 5`
      : 'No ratings yet';
    ratingCount.textContent = stats.ratingCount
      ? `${stats.ratingCount.toLocaleString()} ${stats.ratingCount === 1 ? 'rating' : 'ratings'}`
      : 'Be the first to rate';
    panel.dataset.live = String(stats.liveVisitors > 0);
    availability.textContent = 'Live viewers are an estimate of active browser sessions.';
    schedule();
  }
  function blockers() {
    return (
      [...document.querySelectorAll('dialog[open]')].some(
        (item) => item !== dialog && !item.classList.contains('is-spotify-mini'),
      ) ||
      document.querySelector('#robiner-chat-panel')?.hidden === false ||
      Boolean(
        document.activeElement?.closest?.('input, textarea, select, [contenteditable="true"]'),
      )
    );
  }
  function openFeedback(manual = false) {
    if (stopped || !client || dialog.open || (!manual && (seen || !connected || blockers())))
      return;
    opener = manual ? openButton : document.activeElement;
    seen = true;
    write('robiner.feedback.seen.v1', 'true');
    pendingPrompt = false;
    form.hidden = submitted;
    thanks.hidden = !submitted;
    status.textContent = '';
    dialog.showModal();
    document.documentElement.classList.add('feedback-open');
  }
  function checkJourney() {
    frame = 0;
    if (stopped || document.hidden || !client) return;
    const main = document.querySelector('#main');
    const home = main?.querySelector('#intro');
    if (!home) {
      previousY = window.scrollY;
      return;
    }
    const currentY = window.scrollY;
    if (!seen && currentY > 200 && main.getBoundingClientRect().bottom <= window.innerHeight + 60) {
      reviewed = true;
      write('robiner.feedback.reviewed.v1', 'true');
    }
    if (!seen && reviewed && currentY <= 120 && currentY < previousY) pendingPrompt = true;
    previousY = currentY;
    if (pendingPrompt && currentY <= 120) openFeedback();
  }
  function schedule() {
    if (!frame && !stopped && !document.hidden) frame = requestAnimationFrame(checkJourney);
  }
  function paintStars(value = Number(radios.find((radio) => radio.checked)?.value) || 0) {
    labels.forEach((label) => {
      label.dataset.filled = String(Number(label.dataset.ratingValue) <= value);
    });
  }
  async function refresh() {
    clearTimeout(timer);
    if (stopped || running || document.hidden || !client) return;
    running = true;
    try {
      const result = await client.heartbeat(true);
      if (stopped) return;
      updateStats(result.stats);
      failures = 0;
    } catch {
      if (!stopped) unavailable();
      failures++;
    } finally {
      running = false;
      if (!stopped && !document.hidden)
        timer = setTimeout(refresh, failures ? Math.min(120000, failures * 30000) : 25000);
      else if (!stopped && client) client.heartbeat(false, true).catch(() => {});
    }
  }
  function markInactive() {
    clearTimeout(timer);
    if (!running && connected) client?.heartbeat(false, true).catch(() => {});
  }
  if (!client) {
    unavailable();
    openButton.disabled = true;
    openButton.title = 'Feedback is temporarily unavailable';
  }
  listen(openButton, 'click', () => openFeedback(true));
  dialog
    .querySelectorAll('[data-feedback-close]')
    .forEach((button) => listen(button, 'click', () => dialog.close()));
  listen(dialog, 'close', () => {
    document.documentElement.classList.remove('feedback-open');
    if (opener?.isConnected) opener.focus({ preventScroll: true });
  });
  listen(dialog, 'click', (event) => {
    if (event.target === dialog) {
      const rect = dialog.getBoundingClientRect();
      if (
        event.clientX < rect.left ||
        event.clientX > rect.right ||
        event.clientY < rect.top ||
        event.clientY > rect.bottom
      )
        dialog.close();
    }
  });
  listen(starGroup, 'change', () => paintStars());
  listen(starGroup, 'pointerover', (event) => {
    const label = event.target.closest?.('[data-rating-value]');
    if (label) paintStars(Number(label.dataset.ratingValue));
  });
  listen(starGroup, 'pointerleave', () => paintStars());
  listen(form, 'submit', async (event) => {
    event.preventDefault();
    if (sending || submitted || !client) return;
    const selectedRating = Number(radios.find((radio) => radio.checked)?.value);
    if (!Number.isInteger(selectedRating) || selectedRating < 1 || selectedRating > 5) {
      status.textContent = 'Please choose a star rating.';
      radios[0]?.focus();
      return;
    }
    sending = true;
    submit.disabled = true;
    status.textContent = 'Sending…';
    try {
      const result = await client.submit(selectedRating, comment.value.trim(), honeypot.value);
      if (stopped) return;
      updateStats(result.stats);
      submitted = true;
      write('robiner.feedback.submitted.v1', 'true');
      form.hidden = true;
      thanks.hidden = false;
      status.textContent = '';
      if (dialog.open) thanks.querySelector('button')?.focus({ preventScroll: true });
    } catch (error) {
      if (!stopped)
        status.textContent =
          error.status === 429
            ? 'Too many requests. Please try again later.'
            : 'Could not send your feedback. Please try again.';
    } finally {
      sending = false;
      submit.disabled = false;
    }
  });
  listen(window, 'scroll', schedule, { passive: true });
  listen(window, 'resize', schedule, { passive: true });
  listen(document, 'click', schedule);
  listen(document, 'close', schedule, true);
  listen(document, 'visibilitychange', () => {
    if (document.hidden) markInactive();
    else {
      refresh();
      schedule();
    }
  });
  listen(window, 'pagehide', markInactive);
  listen(window, 'pageshow', (event) => {
    if (event.persisted) refresh();
  });
  refresh();
  paintStars();
  return {
    refreshRoute() {
      previousY = window.scrollY;
      if (!document.querySelector('#intro')) pendingPrompt = false;
      schedule();
    },
    destroy() {
      stopped = true;
      clearTimeout(timer);
      if (frame) cancelAnimationFrame(frame);
      listeners.forEach((remove) => remove());
      document.documentElement.classList.remove('feedback-open');
    },
  };
}
