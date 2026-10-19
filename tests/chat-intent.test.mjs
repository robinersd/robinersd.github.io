import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isCasualChat } from '../site/assets/chat-intent.js';

test('only explicit casual messages trigger custom chat', () => {
  for (const question of [
    'Hi',
    'Hello!',
    'Hi again',
    'hello po',
    'single',
    'single ka ba?',
    'Are you single?',
    'taga saan',
    'taga saan ka?',
    'Hindi naman',
    'kamusta',
    'good morning',
  ])
    assert.equal(isCasualChat(question), true, question);
});

test('portfolio questions and greetings with meaningful questions always bypass custom chat', () => {
  for (const question of [
    'What are Robiner’s skills?',
    'Skills?',
    'React?',
    'Tell me about AlagaTrack',
    'Hi, what are Robiner’s skills?',
    'Hello! Tell me about his resume.',
    'Single-page application projects?',
    'What college does he attend?',
    'Saan nag-aaral si Robiner?',
    'Where is Robiner based professionally?',
    'What information is on his CV?',
    'What are his competencies?',
    'How do I activate the resume?',
    'activate the resume',
    'Explain a coding concept',
  ])
    assert.equal(isCasualChat(question), false, question);
});

test('blank and invalid messages are not treated as casual conversation', () => {
  for (const question of ['', '   ', null, undefined, 123])
    assert.equal(isCasualChat(question), false);
});
