import { chatIntro, chatFarewell, resumeClue } from './data.js?v=chat-intent-95';
import { requestChatReply } from './chat-api.js?v=chat-intent-95';
import { isCasualChat } from './chat-intent.js?v=chat-intent-95';
import {
  getPortfolioAnswer,
  portfolioUnavailableReply,
} from './portfolio-answers.js?v=chat-intent-95';
import { isResumeActivation, isResumeActivationQuestion } from './resume-command.js?v=chat-56';
import { activateResume } from './resume.js?v=chat-56';
import { enableChatAttachments, createVoicePlayer } from './chat-media.js?v=structure-40';

const introDelay = 3000;
const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export function enableRobinerChat() {
  const launcher = document.querySelector('#robiner-chat-launcher');
  const panel = document.querySelector('#robiner-chat-panel');
  const form = panel.querySelector('form');
  const input = panel.querySelector('#robiner-chat-input');
  const send = panel.querySelector('.chat-send');
  const log = panel.querySelector('.chat-log');
  const reset = panel.querySelector('.chat-reset');
  const status = panel.querySelector('.chat-status');
  const emojiToggle = panel.querySelector('.chat-emoji-toggle');
  const emojiPicker = panel.querySelector('.chat-emoji-picker');
  // HTML formatting whitespace should not appear as message indentation.
  // Only normalize the static greeting; visitor/AI line breaks stay intact.
  const greetingNode = log.querySelector('.chat-assistant');
  const greeting = greetingNode.textContent.replace(/\s+/g, ' ').trim();
  greetingNode.textContent = greeting;
  const history = [];
  panel.dataset.chatVersion = 'chat-intent-95';
  panel.dataset.chatPhase = 'intro-ready';
  let pending = false;
  let finishing = false;
  let introShown = false;
  let customIntroShown = false;
  let selection = { start: 0, end: 0 };
  let media;

  function updateControls() {
    send.disabled =
      pending ||
      finishing ||
      (!media?.canFinish &&
        ((media && !media.ready) || (!input.value.trim() && !media?.hasAttachments)));
    reset.disabled = pending || finishing;
    panel.querySelectorAll('[data-chat-question]').forEach((button) => {
      button.disabled = pending || finishing;
    });
    form.setAttribute('aria-busy', String(pending || finishing));
  }
  media = enableChatAttachments(panel, {
    onChange: updateControls,
    onStatus: (content) => {
      status.textContent = content;
    },
    onPhotoReady: () => form.requestSubmit(),
  });
  function setEmojiPicker(open) {
    emojiPicker.hidden = !open;
    emojiToggle.setAttribute('aria-expanded', String(open));
  }
  function rememberSelection() {
    selection = {
      start: input.selectionStart ?? input.value.length,
      end: input.selectionEnd ?? input.value.length,
    };
  }
  input.addEventListener('input', () => {
    rememberSelection();
    updateControls();
  });
  ['select', 'keyup', 'click', 'blur'].forEach((event) =>
    input.addEventListener(event, rememberSelection),
  );
  emojiToggle.addEventListener('click', () => setEmojiPicker(emojiPicker.hidden));
  emojiPicker.querySelectorAll('[data-emoji]').forEach((button) => {
    button.addEventListener('click', () => {
      const emoji = button.dataset.emoji;
      if (input.value.length - (selection.end - selection.start) + emoji.length > input.maxLength) {
        status.textContent = 'Your message can contain up to 800 characters.';
        return;
      }
      input.setRangeText(emoji, selection.start, selection.end, 'end');
      rememberSelection();
      setEmojiPicker(false);
      updateControls();
      input.focus();
    });
  });

  // Keep the composer inside the visible screen when a phone keyboard opens.
  function fitVisibleViewport() {
    const viewport = window.visualViewport;
    const height = viewport?.height || window.innerHeight;
    const keyboardOffset = Math.max(0, window.innerHeight - height - (viewport?.offsetTop || 0));
    document.documentElement.style.setProperty('--chat-visible-height', `${height}px`);
    document.documentElement.style.setProperty('--chat-keyboard-offset', `${keyboardOffset}px`);
    panel.closest('.robiner-chat').classList.toggle('chat-compact', height < 500);
  }
  fitVisibleViewport();
  window.addEventListener('resize', fitVisibleViewport);
  window.visualViewport?.addEventListener('resize', fitVisibleViewport);
  window.visualViewport?.addEventListener('scroll', fitVisibleViewport);

  function toggle(open) {
    panel.hidden = !open;
    launcher.setAttribute('aria-expanded', String(open));
    if (open && matchMedia('(hover: hover)').matches) input.focus();
    else if (!open) {
      media.stop();
      setEmojiPicker(false);
      launcher.focus();
    }
  }
  function message(role, content, attachments = []) {
    const bubble = document.createElement('div');
    bubble.className = `chat-message chat-${role}`;
    const hasPhoto = role === 'user' && attachments.some((item) => item.type === 'image');
    if (hasPhoto) bubble.classList.add('chat-user-photo');
    for (const attachment of attachments) {
      const element =
        attachment.type === 'audio'
          ? createVoicePlayer(attachment, (content) => {
              status.textContent = content;
            })
          : document.createElement('img');
      if (attachment.type === 'image') {
        element.src = `data:${attachment.mimeType};base64,${attachment.data}`;
        element.alt = 'Photo sent for analysis';
      }
      bubble.append(element);
      if (attachment.type === 'audio') {
        const transcript = document.createElement('details');
        const summary = document.createElement('summary');
        summary.textContent = 'Voice transcript';
        const words = document.createElement('p');
        words.textContent = attachment.transcript;
        transcript.append(summary, words);
        bubble.append(transcript);
      }
    }
    if (content) {
      const paragraph = document.createElement('p');
      paragraph.className = 'chat-message-text';
      paragraph.textContent = content;
      bubble.append(paragraph);
    }
    if (hasPhoto) {
      const delivery = document.createElement('small');
      delivery.className = 'chat-message-delivery';
      delivery.textContent = 'Sending…';
      bubble.append(delivery);
    }
    log.appendChild(bubble);
    log.scrollTop = log.scrollHeight;
    return bubble;
  }
  launcher.addEventListener('click', () => toggle(panel.hidden));
  reset.addEventListener('click', () => {
    if (pending || finishing) return;
    history.length = 0;
    media.clear();
    introShown = false;
    customIntroShown = false;
    panel.dataset.chatPhase = 'intro-ready';
    log.querySelectorAll('audio').forEach((audio) => audio.pause());
    log.replaceChildren();
    message('assistant', greeting);
    input.value = '';
    selection = { start: 0, end: 0 };
    status.textContent = '';
    setEmojiPicker(false);
    updateControls();
    input.focus();
  });
  panel.querySelector('.chat-close').addEventListener('click', () => toggle(false));
  panel.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    if (!emojiPicker.hidden) {
      setEmojiPicker(false);
      emojiToggle.focus();
    } else toggle(false);
  });
  panel.querySelectorAll('[data-chat-question]').forEach((button) => {
    button.addEventListener('click', () => {
      if (pending || finishing) return;
      input.value = button.dataset.chatQuestion;
      form.requestSubmit();
    });
  });
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (pending || finishing) return;
    if (media.canFinish) {
      finishing = true;
      updateControls();
      let completed;
      try {
        completed = await media.finish();
      } finally {
        finishing = false;
        updateControls();
      }
      if (!completed || panel.hidden || !media.ready || !media.hasAttachments) return;
    }
    const content = input.value.trim();
    const attachments = media.snapshot();
    if ((!content && !attachments.length) || pending || !media.ready) {
      updateControls();
      return;
    }
    const prompt = content || 'Analyze the attached photo and/or the words in my voice note.';
    const sentMessage = message('user', content, attachments);
    media.clear();
    input.value = '';
    selection = { start: 0, end: 0 };
    pending = true;
    media.setBusy(true);
    setEmojiPicker(false);
    updateControls();
    let timeout;
    try {
      if (!attachments.length && isResumeActivation(content)) {
        activateResume();
        const reply = message('assistant', 'Resume is already activated!!');
        const link = document.createElement('a');
        link.href = '/resume';
        link.className = 'chat-resume-link';
        link.textContent = 'View resume';
        reply.append(link);
        introShown = true;
        return;
      }
      if (!attachments.length && isResumeActivationQuestion(content)) {
        panel.dataset.chatPhase = 'resume-help-thinking';
        status.textContent = 'Thinking…';
        await wait(introDelay);
        message('assistant', resumeClue);
        introShown = true;
        return;
      }
      const casual = !attachments.length && isCasualChat(content);
      const publicAnswer =
        !attachments.length && !casual ? getPortfolioAnswer(content, { history }) : null;
      if (publicAnswer) {
        introShown = true;
        history.push(
          { role: 'user', content },
          { role: 'assistant', content: publicAnswer.slice(0, 1500) },
        );
        history.splice(0, Math.max(0, history.length - 6));
        message('assistant', publicAnswer);
        return;
      }
      if (casual && !customIntroShown) {
        panel.dataset.chatPhase = 'intro-thinking';
        for (const reply of chatIntro) {
          status.textContent = 'Thinking…';
          await wait(introDelay);
          message('assistant', reply);
        }
        introShown = true;
        customIntroShown = true;
        panel.dataset.chatPhase = 'awaiting-question';
        // Wait for another visitor message; never automatically call the AI here.
        return;
      }
      if (casual && customIntroShown) {
        panel.dataset.chatPhase = 'farewell-thinking';
        status.textContent = 'Thinking…';
        await wait(introDelay);
        message('assistant', chatFarewell);
        return;
      }
      introShown = true;
      panel.dataset.chatPhase = 'answer-thinking';
      status.textContent = attachments.length ? 'Analyzing your attachment…' : 'Thinking…';
      const controller = new AbortController();
      timeout = setTimeout(() => controller.abort(), 45000);
      // Scripted intro/follow-up messages stay out of AI context.
      const data = await requestChatReply(
        [...history.slice(-6), { role: 'user', content: prompt }],
        attachments,
        { signal: controller.signal },
      );
      const delivery = sentMessage.querySelector('.chat-message-delivery');
      if (delivery) delivery.textContent = 'Sent';
      // Keep text summaries in context, not repeated large media blobs.
      const summary = attachments.some((item) => item.type === 'audio')
        ? `${prompt}\nVoice transcript: ${attachments.find((item) => item.type === 'audio').transcript}`
        : prompt;
      history.push(
        { role: 'user', content: summary.slice(0, 1500) },
        { role: 'assistant', content: data.reply.slice(0, 1500) },
      );
      history.splice(0, Math.max(0, history.length - 6));
      message('assistant', data.reply);
    } catch (error) {
      const delivery = sentMessage.querySelector('.chat-message-delivery');
      if (delivery) delivery.textContent = 'Not sent';
      if (attachments.length) {
        media.restore(attachments);
        if (!input.value) input.value = content;
      }
      message(
        'assistant',
        ['AbortError', 'TimeoutError'].includes(error.name)
          ? 'That took too long. Please try again in a moment.'
          : attachments.length
            ? error.message
            : portfolioUnavailableReply,
      );
    } finally {
      clearTimeout(timeout);
      pending = false;
      media.setBusy(false);
      if (introShown) panel.dataset.chatPhase = 'awaiting-question';
      updateControls();
      status.textContent = introShown ? 'Ready for your next question.' : '';
      // Do not reopen a phone keyboard if the visitor moved focus while waiting.
      if (!panel.hidden && document.activeElement === send) input.focus();
    }
  });
  updateControls();
}
