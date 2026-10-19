import { profile, projects, education, award, chatKnowledge } from './data.js';
import { isResumeActivation, isResumeActivationQuestion } from './resume-command.js';

export const portfolioUnavailableReply = `I can help with Robiner's published projects, skills, education, awards, career interests and contact information. I don't have a confirmed answer to that question in his public portfolio or resume. Please contact him at ${profile.email} for more details.`;

const normalize = (value) => String(value).normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase();
const unique = (values) => [...new Set(values)];
const projectIn = (text) => projects.find((project) => text.includes(project.id));

// Answers use public portfolio/resume facts only. No credentials or private files are read.
export function getPortfolioAnswer(question, { history = [] } = {}) {
  if (typeof question !== 'string' || !question.trim()) return null;
  if (isResumeActivation(question) || isResumeActivationQuestion(question)) return null;
  const q = normalize(question);
  const taglish =
    /\b(?:ano|anong|sino|saan|paano|pano|kailan|niya|nya|kanyang|kasanayan|kakayahan|tungkol|ginawa|gamit|nagtapos|nag-aaral)\b/.test(
      q,
    );
  const label = (english, filipino) => (taglish ? filipino : english);
  const skills =
    /\b(?:skills?|tools?|technolog\w*|stack|programming languages?|kasanayan|kakayahan|gamit)\b/.test(
      q,
    );
  const timeline =
    /\b(?:when|kailan|date|dates|timeline|period|finish\w*|complet\w*|launch\w*|natapos)\b/.test(q);
  let project = projectIn(q);
  if (
    !project &&
    (/\b(?:it|its|that project|this project|nito|yan|ito)\b/.test(q) ||
      (!/\b(?:robiner|projects|resume|cv)\b/.test(q) &&
        /\b(?:stack|database|kailan|completion|period)\b/.test(q)))
  ) {
    for (const message of [...history].reverse()) {
      if (message.role !== 'user' || typeof message.content !== 'string') continue;
      project = projectIn(normalize(message.content));
      if (project) break;
    }
  }
  if (project) {
    if (/\b(?:url|link|live site|website|visit|buksan)\b/.test(q) && !skills)
      return project.url
        ? `${project.name}: ${project.url}`
        : `${project.name} has no public live-site URL listed in the portfolio.`;
    if (skills || /\b(?:database|built with|ginamit)\b/.test(q))
      return `${project.name}: ${project.tools.join(', ')}.${project.database ? ` ${label('Database', 'Database')}: ${project.database}.` : ''}`;
    if (timeline)
      return `${project.name} — ${label('listed development period', 'nakalistang development period')}: ${project.period}. ${chatKnowledge.timelineNotes}`;
    const responsibilities = /\b(?:role|responsibilit\w*|contribut\w*|did|ginawa|tungkulin)\b/.test(
      q,
    )
      ? chatKnowledge.projectResponsibilities[project.id] || []
      : [];
    return [
      `${project.name}: ${project.description}`,
      `${label('Role', 'Tungkulin')}: ${project.role}.`,
      `${label('Development period', 'Development period')}: ${project.period}.`,
      ...responsibilities.map((item) => `• ${item}`),
      ...(responsibilities.length
        ? []
        : [
            `${label('Tools', 'Mga gamit')}: ${project.tools.join(', ')}.${project.database ? ` Database: ${project.database}.` : ''}`,
          ]),
      ...(project.url ? [`${label('Live site', 'Live site')}: ${project.url}`] : []),
    ].join('\n');
  }
  // Explicit requests for absent details must not turn into a guessed biography.
  if (
    /\b(?:gpa|grade point|salary|sahod|birthday|birth date|age|edad|password|api key|secret key|phone number|home address)\b/.test(
      q,
    )
  )
    return label(
      `That detail isn't included in the public information I use. You can ask Robiner directly at ${profile.email}.`,
      `Wala ang detalyeng iyon sa public information na ginagamit ko. Maaari mong tanungin si Robiner sa ${profile.email}.`,
    );
  const soft = /\b(?:soft skills?|strengths?|kalakasan)\b/.test(q);
  const study =
    /\b(?:education|school|college|degree|course|stud\w*|university|icct|lapuyan|nag-aaral|nagtapos|pinag-aralan|kurso)\b/.test(
      q,
    );
  const work =
    /\b(?:projects?|experience|employment|freelanc\w*|work history|trabaho|proyekto)\b/.test(q);
  const summary = /\b(?:resume|cv|about|background|introduce|who is|sino|pakilala)\b/.test(q);
  const sections = [];
  if (summary && !skills && !soft && !study && !work)
    sections.push(`${profile.name} — ${profile.title}. ${profile.introduction}`);
  if (skills) {
    const listed = unique([
      ...profile.skills,
      ...chatKnowledge.additionalResumeSkills,
      ...chatKnowledge.webProjectStack,
    ]);
    sections.push(
      `${label('Technical skills and tools', 'Technical skills at mga gamit')}: ${listed.join(', ')}.`,
    );
    if (!/\bhard skills?\b/.test(q))
      sections.push(`${label('Soft skills', 'Soft skills')}: ${profile.strengths.join(', ')}.`);
  } else if (soft)
    sections.push(`${label('Soft skills', 'Soft skills')}: ${profile.strengths.join(', ')}.`);
  if (study || (summary && !skills && !soft && !work))
    sections.push(
      education
        .map((item) => `${item.school} — ${item.qualification}, ${item.period} (${item.location}).`)
        .join('\n'),
    );
  if (work)
    sections.push(
      [
        label(
          'His resume lists academic and freelance projects; these are not verified employment positions.',
          'Academic at freelance projects ang nasa resume niya; hindi ito listahan ng verified employment.',
        ),
        ...projects.map(
          (item) => `• ${item.name}: ${item.role} (${item.period}). ${item.description}`,
        ),
      ].join('\n'),
    );
  if (summary && !skills && !soft && !study && !work)
    sections.push(
      `${label('Projects', 'Mga proyekto')}: ${projects.map((item) => `${item.name} (${item.role})`).join('; ')}.`,
    );
  if (/\b(?:awards?|certificat\w*|recognition|achievement\w*|honors?|top 8|parangal)\b/.test(q))
    sections.push(`${award.title} — ${award.issuer}, ${award.date}. ${award.description}`);
  if (/\b(?:career|interests?|goals?|aspirations?|interes)\b/.test(q))
    sections.push(
      `${label('Career interests', 'Mga career interest')}: ${chatKnowledge.careerInterests.join(', ')}.`,
    );
  if (/\b(?:contact|email|reach|hire|inquir\w*|github|linkedin|kontak)\b/.test(q))
    sections.push(
      `Email: ${profile.email}\nGitHub: ${profile.github}\nLinkedIn: ${profile.linkedin}`,
    );
  if (/\b(?:where|location|based|taga|saan)\b/.test(q) && !study)
    sections.push(`${profile.name} — ${profile.location}.`);
  if (!sections.length) {
    const mentioned = unique([...profile.skills, ...chatKnowledge.webProjectStack]).filter(
      (skill) => q.includes(normalize(skill)),
    );
    if (mentioned.length)
      sections.push(
        `${label('Listed portfolio/resume tools', 'Mga nakalistang portfolio/resume tool')}: ${mentioned.join(', ')}. ${label('Web project stack', 'Web project stack')}: ${chatKnowledge.webProjectStack.join(', ')}.`,
      );
  }
  return sections.length ? sections.join('\n\n') : null;
}
