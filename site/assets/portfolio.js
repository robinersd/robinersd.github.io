import { enableRobinerSkillPreview } from './skill-preview.js?v=chat-56';
import { enableRobinerTheme } from './theme.js?v=theme-queue-62';
import { renderStaggeredSkills, enableStaggeredSkills } from './staggered-skills.js?v=chat-56';
import { enableRobinerChat } from './chat.js?v=chat-intent-95';
import { enableSocialDock } from './social-dock.js?v=chat-56';
import { enableEncryptedName } from './encrypted-name.js?v=chat-56';
import { renderHomeStars, enableHomeStars } from './home-stars.js?v=chat-56';
import { renderResumeGate, enableResumeGate } from './resume.js?v=chat-56';
import {
  renderCertificateDialog,
  enableCertificateViewer,
} from './certificate-viewer.js?v=card-viewers-60';
import {
  profile,
  projects,
  education,
  award,
  skillIcons,
  gallery,
  spotifyPlaylists,
  spotifyQueue,
  skillPreviews,
} from './data.js?v=profile-copy-96';
import { enableRobinerMotion } from './motion.js?v=chat-56';
import { enableRobinerProjectDeck } from './project-deck.js?v=project-swipe-90';
import { enableRobinerProfile } from './profile.js?v=profile-cutout-65';
import { enableRobinerNavigation, basePath } from './navigation.js?v=v2-fix';
import { renderPixelGallery, enablePixelGallery } from './pixel-gallery.js?v=chat-56';
import { enableRobinerSpotify } from './spotify.js?v=spotify-activation-74';
import { enableSectionTracker } from './section-tracker.js?v=sidebar-contact-85';
import { enableTextType } from './text-type.js?v=spotify-hint-86';
import {
  renderCommunityPanel,
  renderCommunityVisitors,
  renderFeedbackDialog,
  enablePortfolioCommunity,
} from './community.js?v=spotify-hint-86';
import { communityConfig } from './community-config.js?v=community-live-83';

// Escape content before inserting it into the page.
function escapeHtml(value) {
  return String(value).replace(
    /[&<>"']/g,
    (character) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[character],
  );
}
const text = escapeHtml;
const externalLink = (url, label, className = '') =>
  /* HTML */ `<a
    class="${className} ${['GitHub', 'LinkedIn'].includes(label) ? 'social-link' : ''}"
    href="${text(url)}"
    target="_blank"
    rel="noopener noreferrer"
    >${['GitHub', 'LinkedIn'].includes(label) ? /* HTML */ `<img class="social-logo" src="/assets/icons/${label.toLowerCase()}.svg" alt="" width="18" height="18" />` : ''}${text(label)}
    ${['GitHub', 'LinkedIn'].includes(label) ? '' : '<span aria-hidden="true">↗</span>'}</a
  >`;
const sectionHeader = (title, link = '') =>
  /* HTML */ `<div class="section-heading">
    <h2>${title}</h2>
    ${link}
  </div>`;

// Keep the blue badge beside the last part of the name on narrow screens.
// This is a decorative profile badge, not verification by an external service.
function profileName() {
  const lastSpace = profile.name.lastIndexOf(' ');
  const prefix = lastSpace < 0 ? '' : profile.name.slice(0, lastSpace + 1);
  const ending = profile.name.slice(lastSpace + 1);
  const leading = prefix
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(
      (word) =>
        `<span class="name-word"><span class="encrypted-segment" data-encrypted-text="${text(word)}" aria-hidden="true">${text(word)}</span></span>`,
    )
    .join(' ');
  const badge = /* HTML */ `<svg
    class="profile-badge"
    viewBox="0 0 24 24"
    role="img"
    aria-label="Blue profile badge"
  >
    <title>Profile badge</title>
    <path
      fill="#1d9bf0"
      d="m12 1 3 2 3.6.4 1 3.5L22 10l-.9 3.5.3 3.6-3.2 1.8-2 3-3.6-.6-3.5.6-2-3L3 17.1l.3-3.6L2 10l2.4-3.1 1-3.5L9 3Z"
    />
    <path
      d="m7.5 12 3 3 6-6"
      fill="none"
      stroke="#fff"
      stroke-width="2.2"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </svg>`;
  return `${leading}${leading ? ' ' : ''}<span class="name-ending"><span class="encrypted-segment" data-encrypted-text="${text(ending)}" aria-hidden="true">${text(ending)}</span>${badge}</span>`;
}

function socialDock() {
  return `<nav class="social-links social-dock" data-social-dock aria-label="Social links">
    <a class="social-link dock-item" href="${text(profile.github)}" target="_blank" rel="noopener noreferrer" aria-label="GitHub" title="GitHub">
      <img class="social-logo" src="/assets/icons/github.svg" alt="" width="24" height="24" />
      <span class="dock-label">GitHub</span>
    </a>
    <a class="social-link dock-item" href="${text(profile.linkedin)}" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn" title="LinkedIn">
      <img class="social-logo" src="/assets/icons/linkedin.svg" alt="" width="24" height="24" />
      <span class="dock-label">LinkedIn</span>
    </a>
    <button class="social-link dock-item spotify-launcher" type="button" data-spotify-open aria-label="Spotify playlists" aria-haspopup="dialog" aria-controls="robiner-spotify-dialog" aria-expanded="false" title="Spotify">
      <img class="social-logo spotify-logo" src="/assets/icons/spotify.svg" alt="" width="24" height="24" />
      <span class="dock-label">Spotify</span>
    </button>
  </nav>`;
}

function animatedSkillsSection() {
  return /* HTML */ `<section id="skills" data-scroll-section="Skills">
    ${sectionHeader('Skills & tools', `<a class="text-link" href="${basePath}/tech-stack">View all</a>`)}
    ${renderStaggeredSkills(profile.skills, skillPreviews, skillIcons, text)}
  </section>`;
}

function profilePortrait() {
  const photos = [['default', profile.defaultPhoto], ...Object.entries(profile.gazePhotos)];
  const portraits = photos
    .map(([pose, image]) => {
      const layer = pose === 'default' ? 'default' : 'active';
      const loading =
        pose === 'default'
          ? 'fetchpriority="high"'
          : 'loading="eager" decoding="async" fetchpriority="low"';
      return /* HTML */ `<img
        class="profile-photo pixelated-image-card__${layer}"
        data-profile-photo="${pose}"
        data-visible="${pose === 'default'}"
        src="${text(image)}"
        alt=""
        aria-hidden="true"
        draggable="false"
        ${loading}
      />`;
    })
    .join('');
  return /* HTML */ `<button
      class="profile-portrait pixelated-image-card"
      type="button"
      aria-label="${text(profile.name)} interactive profile photo"
      aria-describedby="profile-photo-help"
    >
      ${portraits}
      <canvas class="pixelated-image-card__pixels" aria-hidden="true"></canvas></button
    ><span id="profile-photo-help" class="visually-hidden"
      >Move your mouse, or tap and drag anywhere on the page, to make the portrait look toward you.
      The artwork stays until you interact. Only the artwork reveal uses pixels; looking between
      directions switches instantly. With this photo focused, use the arrow keys to look around,
      Enter for center, or Escape for the artwork.</span
    >`;
}

function projectDeck(detailed = false) {
  return /* HTML */ `<div
    class="project-deck-shell"
    data-project-deck
    role="region"
    aria-label="Robiner’s projects"
  >
    <div class="project-grid ${detailed ? 'detailed-grid' : ''}">
      ${projects.map(projectCard).join('')}
    </div>
  </div>`;
}

function projectCard(project) {
  const cardTag = project.url ? 'a' : 'article';
  const cardLink = project.url
    ? ` href="${text(project.url)}" target="_blank" rel="noopener noreferrer" aria-label="${text(project.name)} project website (opens in a new tab)"`
    : '';
  const preview = project.image
    ? /* HTML */ `<div
        class="project-preview ${project.previewType === 'photo' ? 'project-preview--photo' : ''}"
      >
        <img
          class="project-image"
          src="${text(project.image)}"
          srcset="${text(project.imageSmall)} 480w, ${text(project.image)} 960w"
          sizes="(max-width: 600px) 280px, (max-width: 900px) 320px, 360px"
          alt="${text(project.imageAlt || project.name + ' website preview')}"
          width="${project.imageWidth}"
          height="${project.imageHeight}"
          loading="eager"
          decoding="async"
          fetchpriority="${project.id === 'alagatrack' ? 'high' : 'auto'}"
        />
      </div>`
    : /* HTML */ `<div class="project-preview project-placeholder">
        <img src="/assets/icons/chip.svg" alt="" width="44" height="44" /><span
          >Embedded systems & documentation</span
        >
      </div>`;
  return /* HTML */ `<${cardTag} class="project-card" data-project="${text(project.id)}"${cardLink}>
    ${preview}
    <div class="project-copy">
      <h3>${text(project.name)}</h3>
      <p class="project-role">${text(project.role)}</p>
      <p class="project-summary">${text(project.description)}</p>
      <p class="project-period">${text(project.category)} · ${text(project.period)}</p>
      <div
        class="project-tools"
        aria-label="${text(project.name + ' project stack: ' + project.tools.join(', ') + (project.database ? '. Database: ' + project.database : ''))}"
      >
        ${(project.tools || []).map((tool) => /* HTML */ `<img src="/assets/icons/${text(skillIcons[tool])}.svg" alt="${text(tool)}" title="${text(tool)}" width="21" height="21" />`).join('')}
      </div>
    </div>
    <div class="project-card-footer">
      ${project.url ? '<span class="project-visit text-link"><span class="project-visit-desktop">Visit site</span><span class="project-visit-phone">Double tap to visit</span> <span aria-hidden="true">↗</span></span>' : '<span class="project-note">Academic project</span>'}
    </div>
  </${cardTag}>`;
}

function educationSection() {
  return /* HTML */ `<section id="education" data-scroll-section="Education">
    ${sectionHeader('Education')}
    <div class="timeline">
      ${education
        .map(
          (item) =>
            /* HTML */ `<article class="timeline-item">
              <div>
                <h3>${text(item.school)}</h3>
                <p>${text(item.qualification)}</p>
                <span class="muted">${text(item.location)}</span>
              </div>
              <span class="date">${text(item.period)}</span>
            </article>`,
        )
        .join('')}
    </div>
  </section>`;
}

function awardSection() {
  return /* HTML */ `<section id="recognition" data-scroll-section="Recognition">
    ${sectionHeader('Recognition')}
    <article class="award-card">
      <div>
        <span class="eyebrow">Academic achievement</span>
        <h3>${text(award.title)}</h3>
        <p>${text(award.description)}</p>
        <p class="muted">${text(award.issuer)}<br />${text(award.date)}</p>
        <button
          type="button"
          class="text-link certificate-open"
          data-certificate-open
          aria-haspopup="dialog"
          aria-controls="certificate-viewer"
        >
          View certificate
        </button>
      </div>
      <button
        type="button"
        data-certificate-open
        aria-haspopup="dialog"
        aria-controls="certificate-viewer"
        class="certificate-preview"
        aria-label="Open full certificate"
      >
        <img
          src="${text(award.imageSmall || award.image)}"
          width="768"
          height="527"
          decoding="async"
          alt="Robiner Dahap’s Top 8 Object-Oriented Programming Certificate of Recognition"
          loading="lazy"
        />
      </button>
    </article>
  </section>`;
}

function contactSection() {
  return /* HTML */ `<section id="contact" class="contact-section" data-scroll-section="Contact">
    <span class="eyebrow">Let’s connect</span>
    <h2>Have a project in mind?</h2>
    <p>
      I’m interested in software development, full-stack web development, embedded systems, and
      technical documentation.
    </p>
    <a class="button primary" href="mailto:${text(profile.email)}"
      >${text(profile.email)} <span aria-hidden="true">↗</span></a
    >
    <div class="contact-links">
      ${externalLink(profile.github, 'GitHub')}${externalLink(profile.linkedin, 'LinkedIn')}<a
        href="${basePath}/resume"
        >View resume</a
      >
    </div>
  </section>`;
}

function gallerySection() {
  return /* HTML */ `<section id="gallery" data-scroll-section="Gallery">
    ${sectionHeader('Gallery', `<a class="text-link" href="${basePath}/gallery">View gallery</a>`)}
    <p class="muted gallery-intro">
      A few moments from my life, classmates, and hands-on projects.
    </p>
    ${renderPixelGallery(gallery, text)}
  </section>`;
}

function resumePage() {
  return /* HTML */ `<div class="page-intro">
      <span class="eyebrow">My background at a glance</span>
      <h1>Resume</h1>
      <p>Education, projects, skills, and academic recognition.</p>
    </div>
    ${renderResumeGate()}`;
}

function photoDialog() {
  return /* HTML */ `<dialog id="photo-viewer" aria-labelledby="photo-caption">
    <div class="photo-visual">
      <button type="button" class="photo-close" aria-label="Close photo viewer">×</button>
      <img id="photo-full" alt="" decoding="async" />
    </div>
    <p id="photo-caption" class="visually-hidden"></p>
    <span id="photo-counter" class="visually-hidden"></span>
    <button type="button" class="photo-previous" aria-label="Previous photo">‹</button>
    <button type="button" class="photo-next" aria-label="Next photo">›</button>
  </dialog>`;
}

function skillPreviewDialog() {
  return /* HTML */ `<dialog id="robiner-skill-preview" aria-label="Skill photo viewer">
    <button type="button" class="skill-preview-close" aria-label="Close skill preview">
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="m6 6 12 12M18 6 6 18"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
        />
      </svg>
    </button>
    <div class="skill-preview-visual">
      <img class="skill-preview-image" alt="" hidden />
      <div class="skill-preview-empty">
        <img class="skill-preview-logo" alt="" width="72" height="72" />
      </div>
    </div>
  </dialog>`;
}

function spotifyDialog() {
  return /* HTML */ `<dialog
    id="robiner-spotify-dialog"
    aria-labelledby="spotify-dialog-title"
    tabindex="-1"
  >
    <div class="spotify-mini">
      <button
        type="button"
        class="spotify-wave-toggle"
        aria-label="Play Spotify music"
        aria-describedby="spotify-wave-help"
        data-paused="true"
        disabled
      >
        <span class="spotify-wave" aria-hidden="true">
          <span></span><span></span><span></span><span></span><span></span><span></span>
          <span></span><span></span><span></span><span></span><span></span><span></span>
        </span>
      </button>
      <span id="spotify-wave-help" class="visually-hidden">
        Tap to pause or resume. Drag or use arrow keys to move. Home returns to the edge.
      </span>
    </div>
    <div class="spotify-heading">
      <div>
        <span class="eyebrow">A little music while you explore</span>
        <h2 id="spotify-dialog-title">
          <img
            class="spotify-logo"
            src="/assets/icons/spotify.svg"
            alt=""
            width="24"
            height="24"
          />My Spotify playlists
        </h2>
      </div>
      <button type="button" class="spotify-close" aria-label="Close Spotify playlists">
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="m6 6 12 12M18 6 6 18"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
          />
        </svg>
      </button>
    </div>
    <div class="spotify-choices">
      <p class="muted">Pick a playlist for your visit.</p>
      <div class="spotify-playlist-grid">
        ${spotifyPlaylists
          .map(
            (playlist, index) =>
              /* HTML */ `<button
                type="button"
                class="spotify-choice"
                data-spotify-playlist="${index}"
                aria-label="Choose ${text(playlist.title)}"
              >
                <img
                  class="spotify-cover"
                  src="${text(playlist.cover)}"
                  alt=""
                  loading="lazy"
                  width="180"
                  height="180"
                /><strong>${text(playlist.title)}</strong
                ><span>View playlist <span aria-hidden="true">→</span></span>
              </button>`,
          )
          .join('')}
      </div>
    </div>
    <div class="spotify-player" hidden>
      <button type="button" class="spotify-back text-link">← Choose another playlist</button>
      <h3 id="spotify-selected-title"></h3>
      <p class="muted spotify-play-help">Press Play in the Spotify player to listen.</p>
      <div class="spotify-embed"></div>
      <button type="button" class="spotify-stop text-link">Stop music</button>
      <a class="spotify-external text-link" target="_blank" rel="noopener noreferrer"
        >Open in Spotify ↗</a
      >
    </div>
  </dialog>`;
}

function chatWidget() {
  const emojis = [
    ['👋', 'Wave'],
    ['🙂', 'Smile'],
    ['😊', 'Happy'],
    ['😂', 'Laugh'],
    ['😎', 'Cool'],
    ['🤔', 'Thinking'],
    ['👍', 'Thumbs up'],
    ['❤️', 'Heart'],
    ['💻', 'Laptop'],
    ['🚀', 'Rocket'],
    ['✨', 'Sparkles'],
    ['🙌', 'Celebrate'],
  ];
  return /* HTML */ `<aside class="robiner-chat">
    <section
      id="robiner-chat-panel"
      class="chat-panel"
      aria-label="Robiner’s portfolio assistant"
      hidden
    >
      <div class="chat-heading">
        <div>
          <strong>Robiner’s assistant</strong>
          <p>Projects · Photo & voice analysis</p>
        </div>
        <div class="chat-heading-actions">
          <button class="chat-reset" type="button" aria-label="Start new chat">New chat</button>
          <button class="chat-close" type="button" aria-label="Close assistant">×</button>
        </div>
      </div>
      <div class="chat-log" role="log" aria-live="polite" aria-label="Conversation">
        <p class="chat-message chat-assistant">
          Hello! I'm Robiner's portfolio assistant. How can I help you learn more about his
          projects, skills, education, or contact information?
        </p>
      </div>
      <div class="chat-suggestions">
        <button type="button" data-chat-question="Tell me about AlagaTrack">AlagaTrack</button>
        <button type="button" data-chat-question="What are Robiner’s skills?">Skills</button>
      </div>
      <p class="chat-status" role="status"></p>
      <div class="chat-composer">
        <div class="chat-attachments" aria-label="Attachments ready to send" hidden></div>
        <input
          class="chat-photo-input"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          hidden
          aria-label="Choose photo to analyze"
        />
        <div
          id="robiner-chat-emojis"
          class="chat-emoji-picker"
          role="group"
          aria-label="Choose an emoji"
          hidden
        >
          ${emojis.map(([emoji, label]) => /* HTML */ `<button type="button" data-emoji="${emoji}" aria-label="${label} emoji">${emoji}</button>`).join('')}
        </div>
        <form novalidate>
          <button
            class="chat-attach-photo"
            type="button"
            aria-label="Attach photo"
            title="Attach a photo to analyze"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              aria-hidden="true"
            >
              <rect x="3" y="3" width="18" height="18" rx="3" />
              <circle cx="8" cy="8" r="1.5" />
              <path d="m3 17 5-5 4 4 4-6 5 7" />
            </svg>
          </button>
          <button
            class="chat-record-voice"
            type="button"
            aria-label="Record voice note"
            aria-pressed="false"
            title="Record a voice note (up to 30 seconds)"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              aria-hidden="true"
            >
              <rect x="9" y="2" width="6" height="12" rx="3" />
              <path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8" />
            </svg>
          </button>
          <button
            class="chat-discard-voice"
            type="button"
            aria-label="Delete voice note"
            title="Delete voice note"
            hidden
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              aria-hidden="true"
            >
              <path d="M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7" />
            </svg>
          </button>
          <div class="chat-voice-slot" hidden></div>
          <label class="visually-hidden" for="robiner-chat-input">Your message</label>
          <div class="chat-input-box">
            <input
              id="robiner-chat-input"
              type="text"
              maxlength="800"
              placeholder="Ask a question…"
              autocomplete="off"
              enterkeyhint="send"
            />
            <button
              class="chat-emoji-toggle"
              type="button"
              aria-label="Choose emoji"
              aria-expanded="false"
              aria-controls="robiner-chat-emojis"
            >
              <svg
                width="23"
                height="23"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="9" />
                <path d="M8 14s1 3 4 3 4-3 4-3" />
                <circle cx="8.5" cy="9" r=".8" fill="currentColor" stroke="none" />
                <circle cx="15.5" cy="9" r=".8" fill="currentColor" stroke="none" />
              </svg>
            </button>
          </div>
          <div class="chat-composer-actions">
            <button class="chat-send" type="submit" aria-label="Send message" disabled>
              <svg
                width="25"
                height="25"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  d="M3.4 2.8a.8.8 0 0 0-1.1 1L5.7 11H14a1 1 0 1 1 0 2H5.7l-3.4 7.2a.8.8 0 0 0 1.1 1l18-8.5a.8.8 0 0 0 0-1.4Z"
                />
              </svg>
            </button>
          </div>
        </form>
      </div>
    </section>
    <button
      id="robiner-chat-launcher"
      class="button primary"
      type="button"
      aria-expanded="false"
      aria-controls="robiner-chat-panel"
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        aria-hidden="true"
      >
        <path
          d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5H4l-2 2V11.5A8.5 8.5 0 0 1 10.5 3h2a8.5 8.5 0 0 1 8.5 8.5Z"
        />
        <path d="M7 11h10M7 15h6" />
      </svg>
      <span>Ask about Robiner</span>
    </button>
  </aside>`;
}

function homePage() {
  const musicHint = 'On the left side, tap the Spotify wave to stop the music.';
  const typedHint = `<span class="text-type" data-text-type="${musicHint}"><span class="text-type__sr">${musicHint}</span><span class="text-type__measure" aria-hidden="true">${musicHint}_</span><span class="text-type__content" aria-hidden="true"><span data-text-type-output>${musicHint}</span><span class="text-type__caret">&#8203;</span></span><span class="text-type__cursor text-type__cursor--underscore" aria-hidden="true" hidden><span class="text-type__blink"><span class="text-type__shape"></span></span></span></span>`;
  return /* HTML */ `${renderHomeStars()}
    <section class="hero" id="intro" data-scroll-section="Intro">
      <div class="hero-top">
        ${profilePortrait()}
        <div class="hero-copy">
          <div class="hero-heading">
            <span class="eyebrow location spotify-instruction">${typedHint}</span>
            <h1 data-encrypted-name aria-label="${text(profile.name)}">${profileName()}</h1>
            <p class="job-title">${text(profile.title)}</p>
          </div>
          <p class="introduction">${text(profile.introduction)}</p>
        </div>
      </div>
      <div class="hero-actions">
        <a class="button primary" href="${basePath}/projects">Explore projects</a
        ><a class="button" href="${basePath}/resume">View resume</a>
        ${socialDock()}
      </div>
    </section>
    <section id="about" data-scroll-section="About">
      ${sectionHeader('About me')}
      <p>${text(profile.about)}</p>
    </section>
    <section id="projects" data-scroll-section="Projects">
      ${sectionHeader('Selected projects', '<a class="text-link" href="/projects">View all</a>')}${projectDeck()}
    </section>
    ${animatedSkillsSection()}
    ${educationSection()}${awardSection()}${gallerySection()}${contactSection()}`;
}

function themeSwitch() {
  return /* HTML */ `<button
    id="theme-toggle"
    type="button"
    role="switch"
    aria-label="Dark mode"
    aria-checked="false"
  >
    <span class="theme-track" aria-hidden="true">
      <svg
        class="theme-sun"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
      >
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" />
      </svg>
      <svg
        class="theme-moon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
      >
        <path d="M20 15.6A9 9 0 0 1 8.4 4 9 9 0 1 0 20 15.6Z" />
      </svg>
      <span class="theme-thumb"></span>
    </span>
  </button>`;
}

function renderPage({ partial = false } = {}) {
  const rawPath = window.location.pathname.replace(/\/$/, '') || '/';
  const path =
    (basePath && rawPath.startsWith(basePath) ? rawPath.slice(basePath.length) : rawPath) || '/';
  const pages = {
    '/': homePage,
    '/projects': () =>
      /* HTML */ `<div class="page-intro">
          <span class="eyebrow">From requirements to real systems</span>
          <h1>Projects</h1>
          <p>A selection of community-focused, client, and academic projects.</p>
        </div>
        ${projectDeck()}${contactSection()}`,
    '/highlights': () =>
      /* HTML */ `<div class="page-intro">
          <span class="eyebrow">Milestones along the way</span>
          <h1>Highlights</h1>
          <p>Academic recognition and hands-on project work.</p>
        </div>
        ${awardSection()}
        <section>${sectionHeader('Building for the community')}${projectCard(projects[0])}</section>
        ${contactSection()}`,
    '/certifications': () => `${awardSection()}${contactSection()}`,
    '/tech-stack': () =>
      /* HTML */ `<div class="page-intro">
          <h1>Skills & tools</h1>
          <p>The technologies and practical skills I use across my projects.</p>
        </div>
        ${renderStaggeredSkills(profile.skills, skillPreviews, skillIcons, text)}${contactSection()}`,
    '/contact': contactSection,
    '/gallery': () =>
      /* HTML */ `<div class="page-intro">
          <span class="eyebrow">Life beyond the code</span>
          <h1>My gallery</h1>
          <p>Classroom memories, electronics projects, and everyday moments.</p>
        </div>
        ${gallerySection()}`,
    '/resume': resumePage,
  };
  const content = `${path !== '/' ? `<a class="back-home" href="${basePath || '/'}">← Back home</a>` : ''}${(
    pages[path] ||
    (() =>
      /* HTML */ `<div class="page-intro">
        <h1>Page not found</h1>
        <a class="text-link" href="${basePath || '/'}">Return home ↗</a>
      </div>`)
  )()}`;
  if (partial) {
    document.querySelector('#main').innerHTML = content;
    document.querySelectorAll('.nav-links a').forEach((link) => {
      const href = link.getAttribute('href');
      if (href === `${basePath}${path}` || href === path) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
  } else
    document.querySelector('#root').innerHTML = /* HTML */ ` <header>
        <nav class="container site-nav" aria-label="Main navigation">
          ${themeSwitch()}
          <button
            type="button"
            id="sidebar-toggle"
            class="sidebar-toggle"
            aria-label="Open page menu"
            aria-expanded="false"
            aria-controls="portfolio-sidebar"
          >
            <span class="sidebar-toggle-lines" aria-hidden="true"><i></i><i></i><i></i></span>
          </button>
        </nav>
      </header>
      <main class="container" id="main" tabindex="-1">${content}</main>
      <aside
        id="portfolio-sidebar"
        class="portfolio-sidebar"
        aria-label="Page menu and visitors"
        hidden
      >
        <div class="sidebar-scroll-content">
          <p class="section-tracker-heading">On this page</p>
          <nav
            id="sidebar-section-links"
            class="section-tracker-links"
            aria-label="Page sections"
          ></nav>
          ${renderCommunityPanel()}
        </div>
      </aside>
      <footer class="container">
        <div>
          <strong>${text(profile.name)}</strong>
          <p>Building, learning, and improving.</p>
        </div>
        ${renderCommunityVisitors()}
      </footer>
      ${photoDialog()}${renderCertificateDialog()}${skillPreviewDialog()}${spotifyDialog()}${chatWidget()}${renderFeedbackDialog()}`;
  document.title = `${path === '/' ? profile.name : path.slice(1).replace(/^./, (first) => first.toUpperCase()) + ' | ' + profile.name} — Portfolio`;
}

// Keep old bookmarks working after renaming the section to Projects.
if (window.location.pathname.replace(/\/$/, '') === `${basePath}/experience`) {
  window.history.replaceState(null, '', `${basePath}/projects`);
}
renderPage();
// The persistent player gets first access to the API already loading in <head>.
enableRobinerSpotify(spotifyPlaylists, spotifyQueue);

// Native dialog provides focus trapping, Escape-to-close, and focus restoration.
const viewer = document.querySelector('#photo-viewer');
let selectedPhoto = 0;
function showPhoto(index) {
  selectedPhoto = (index + gallery.length) % gallery.length;
  const photo = gallery[selectedPhoto];
  const image = document.querySelector('#photo-full');
  image.src = photo.image;
  image.alt = photo.alt;
  document.querySelector('#photo-caption').textContent = photo.caption;
  document.querySelector('#photo-counter').textContent = `${selectedPhoto + 1} / ${gallery.length}`;
}
viewer.querySelector('.photo-close').addEventListener('click', () => viewer.close());
viewer.addEventListener('close', () =>
  document.documentElement.classList.remove('photo-viewer-open'),
);
viewer
  .querySelector('.photo-previous')
  .addEventListener('click', () => showPhoto(selectedPhoto - 1));
viewer.querySelector('.photo-next').addEventListener('click', () => showPhoto(selectedPhoto + 1));
viewer.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    event.preventDefault();
    showPhoto(selectedPhoto + (event.key === 'ArrowLeft' ? -1 : 1));
  }
});
viewer.addEventListener('click', (event) => {
  if (event.target === viewer) viewer.close();
});

enableRobinerTheme();

let stopMotion;
let stopProjectDeck;
let stopProfile;
let stopGallery;
let stopSkills;
let stopResume;
let stopDock;
let stopName;
let stopStars;
let stopSectionTracker;
let stopTyping;
let community;
function initializeMain({ pageEntry = false } = {}) {
  stopTyping?.();
  stopTyping = enableTextType();
  stopSectionTracker?.();
  stopDock?.();
  stopName?.();
  stopStars?.();
  document
    .querySelector('#main')
    .classList.toggle('home-has-stars', Boolean(document.querySelector('[data-home-stars]')));
  stopDock = enableSocialDock();
  stopName = enableEncryptedName();
  stopStars = enableHomeStars();
  stopResume?.();
  stopResume = enableResumeGate();
  stopMotion?.();
  stopProjectDeck?.();
  stopProfile?.();
  stopGallery?.();
  stopSkills?.();
  stopSkills = enableStaggeredSkills();
  stopGallery = enablePixelGallery(gallery, {
    onOpen: (index, tile) => {
      showPhoto(index);
      viewer.showModal();
      document.documentElement.classList.add('photo-viewer-open');
      if (tile && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
        const origin = tile.getBoundingClientRect();
        const destination = viewer.getBoundingClientRect();
        const x = origin.left + origin.width / 2 - destination.left - destination.width / 2;
        const y = origin.top + origin.height / 2 - destination.top - destination.height / 2;
        const scale = Math.min(1, Math.max(0.18, origin.width / destination.width));
        viewer.animate(
          [
            {
              transform: `translate(${x}px, ${y}px) scale(${scale})`,
              opacity: 0.25,
            },
            { transform: 'none', opacity: 1 },
          ],
          { duration: 300, easing: 'cubic-bezier(.22,1,.36,1)' },
        );
      }
    },
  });

  stopProfile = enableRobinerProfile();
  stopProjectDeck = enableRobinerProjectDeck();
  stopMotion = enableRobinerMotion({ pageEntry });
  stopSectionTracker = enableSectionTracker();
  community?.refreshRoute();
}

enableRobinerChat();
enableCertificateViewer(award);
enableRobinerSkillPreview(skillPreviews, skillIcons);
initializeMain();
community = enablePortfolioCommunity(communityConfig);
enableRobinerNavigation({
  render: () => renderPage({ partial: true }),
  initialize: initializeMain,
  routes: new Set([
    '/',
    '/projects',
    '/experience',
    '/highlights',
    '/certifications',
    '/tech-stack',
    '/contact',
    '/gallery',
    '/resume',
  ]),
});
