// Edit this file to update your portfolio. No build step is required.
export const profile = {
  name: 'Dahap, Robiner B.',
  initials: 'RBD',
  title: 'Computer Engineering Student · Full-Stack Developer',
  location: 'Antipolo City, Philippines',
  email: 'dahaprobiner@gmail.com',
  github: 'https://github.com/robinersd',
  linkedin: 'https://www.linkedin.com/in/dahaprobiner',
  defaultPhoto: '/assets/images/profile-rest.jpg',
  gazePhotos: {
    up: '/assets/images/profile-gaze/up.webp?v=profile-cutout-65',
    'up-right': '/assets/images/profile-gaze/up-right.webp?v=profile-cutout-65',
    right: '/assets/images/profile-gaze/right.webp?v=profile-cutout-65',
    'up-left': '/assets/images/profile-gaze/up-left.webp?v=profile-cutout-65',
    left: '/assets/images/profile-gaze/left.webp?v=profile-cutout-65',
    'down-right': '/assets/images/profile-gaze/down-right.webp?v=profile-cutout-65',
    'down-left': '/assets/images/profile-gaze/down-left.webp?v=profile-cutout-65',
    down: '/assets/images/profile-gaze/down.webp?v=profile-cutout-65',
    center: '/assets/images/profile-gaze/center.webp?v=profile-cutout-65',
  },
  resume: '/resume',
  introduction:
    'I build web applications and document the systems behind them. I’m a Computer Engineering student at ICCT with hands-on project work in full-stack development, embedded systems, and system analysis.',
  about:
    'My work brings together responsive interfaces, database integration, and clear technical documentation. I enjoy collaborating on academic and community-focused projects, turning requirements into practical software, and continuing to learn along the way.',
  skills: [
    'TypeScript',
    'Codex',
    'JavaScript',
    'Node.js',
    'HTML',
    'CSS',
    'Antigravity',
    'Tailwind CSS',
    'Supabase',
    'Vercel',
    'Git',
    'GitHub',
    'Embedded Systems',
    'System Analysis',
    'Technical Documentation',
    'Claude AI',
    'UI/UX Design',
    'Figma',
    'Canva',
    'Microsoft Excel',
    'Microsoft Word',
    'Microsoft PowerPoint',
  ],
  strengths: [
    'Teamwork & Collaboration',
    'Problem Solving',
    'Adaptability',
    'Communication',
    'Time Management',
    'Attention to Detail',
    'Critical Thinking',
    'Willingness to Learn',
  ],
};

// Default wave selection is independent of the visitor's playlist choices.
export const spotifyDefaultTrack = Object.freeze({
  type: 'track',
  id: '3QF5RsWzK1lCvf2o2cY65P',
  title: 'Dear Reader — Taylor Swift',
});

export const spotifyQueue = Object.freeze([
  spotifyDefaultTrack,
  Object.freeze({
    type: 'track',
    id: '6OcCk1dbAb7XNHsC098oEM',
    title: 'I Quit Drinking — Kelsea Ballerini & LANY',
  }),
  Object.freeze({
    type: 'track',
    id: '0WOvSEVpUGkNufX0w0M06F',
    title: '13 — LANY',
  }),
]);

// Public Spotify playlists. Update these titles/covers if you change them in Spotify.
export const spotifyPlaylists = [
  {
    id: '7usNaHtF3JeP4XFHhOUBiL',
    title: 'My playlist',
    cover:
      'https://mosaic.scdn.co/300/ab67616d00001e0200a9b7b61273b1b3378c079eab67616d00001e02ce74c70481eb8801cf2d8fb3ab67616d00001e02e1981ca6e44786f803e59bf2ab67616d00001e02e376ed67aa5fce7c06539a41',
  },
  {
    id: '55nETsdIgf3Re3DRs0WUjH',
    title: 'My playlist #2',
    cover:
      'https://mosaic.scdn.co/300/ab67616d00001e02692608e57a03a36966627bfeab67616d00001e029d63d02008e91aea1e3f158aab67616d00001e02ca852dfb68191de84c37b404ab67616d00001e02df5295e952ef1f8f522634b1',
  },
];

// Shown once per conversation; these scripted messages never enter AI history.
export const chatIntro = [
  'Before i answer your question',
  'Mahal kaba talaga nya?',
  'ay no minahal kaba talaga nya? yan ang tanong baka kasi ikaw lng nag a-asume na mahal ka nya!',
];

export const chatFarewell = "i don't want to waste tokens on that bye.";

// Only send this when the visitor explicitly asks for resume activation help.
export const resumeClue = 'to view my resume sent "activate the resume" here in the chat';

// Brand logos identify tools; outline icons represent general capabilities.
export const skillIcons = {
  TypeScript: 'typescript',
  React: 'react',
  JavaScript: 'javascript',
  'Node.js': 'nodejs',
  Vercel: 'vercel',
  HTML: 'html5',
  CSS: 'css3',
  'Tailwind CSS': 'tailwindcss',
  Codex: 'codex',
  Antigravity: 'antigravity',
  'Claude AI': 'claude',
  Vite: 'vite',
  PostgreSQL: 'postgresql',
  Supabase: 'supabase',
  Git: 'git',
  GitHub: 'github',
  Figma: 'figma',
  Canva: 'canva',
  'Microsoft Excel': 'excel',
  'Microsoft Word': 'word',
  'Microsoft PowerPoint': 'powerpoint',
  'Embedded Systems': 'chip',
  'System Analysis': 'analysis',
  'Technical Documentation': 'document',
  'UML & System Diagrams': 'diagram',
  'UI/UX Design': 'design',
};

export const gallery = [
  {
    image: '/assets/images/gallery/personal-moment.jpg',
    caption: 'Outside the classroom',
    alt: 'Robiner taking an outdoor mirror photo',
  },
  {
    image: '/assets/images/gallery/classmates.jpeg',
    caption: 'With classmates',
    alt: 'A group photo with classmates in the classroom',
  },
  {
    image: '/assets/images/gallery/circuit-prototype.jpg',
    caption: 'Circuit prototype',
    alt: 'Breadboard circuits with illuminated seven-segment displays',
  },
  {
    image: '/assets/images/gallery/hardware-project.jpg',
    caption: 'Hardware project',
    alt: 'An electronic hardware prototype in a round black enclosure with exposed wiring, a display and colored buttons',
  },
  {
    image: '/assets/images/gallery/engineering-community.jpg',
    caption: 'Engineering community',
    alt: 'A group holding their Computer Engineering membership cards',
  },
];

export const resumePages = ['/assets/images/resume-page-1.png', '/assets/images/resume-page-2.png'];

// Shared stack keeps both web project cards and chatbot facts consistent.
export const webProjectStack = Object.freeze([
  'TypeScript',
  'Tailwind CSS',
  'React',
  'Vite',
  'PostgreSQL',
  'Supabase',
]);

export const projects = [
  {
    id: 'alagatrack',
    name: 'AlagaTrack',
    category: 'Community health · Academic project',
    role: 'Programmer / Full-Stack Developer',
    period: 'Aug 2025 – Dec 2026',
    description:
      'A Community Health Worker Management System developed as an Object-Oriented Programming project at ICCT Colleges.',
    url: 'https://alagatrack.vercel.app/',
    image: '/assets/images/projects/alagatrack-960.webp',
    imageSmall: '/assets/images/projects/alagatrack-480.webp',
    imageWidth: 960,
    imageHeight: 461,
    tools: [...webProjectStack],
    database: 'PostgreSQL via Supabase',
  },
  {
    id: 'streetwear',
    name: 'StreetWear',
    category: 'Client project · Freelance',
    role: 'Freelance / Full-Stack Developer',
    period: '2025',
    description:
      'A custom web application built around client requirements, with responsive interfaces and integrated database features.',
    url: 'https://streetwear-tau.vercel.app/',
    image: '/assets/images/projects/streetwear-960.webp',
    imageSmall: '/assets/images/projects/streetwear-480.webp',
    imageWidth: 960,
    imageHeight: 457,
    tools: [...webProjectStack],
    database: 'PostgreSQL via Supabase',
  },
  {
    id: 'medicare',
    name: 'Medicare',
    category: 'Embedded systems · Academic project',
    role: 'Technical Documentation Lead',
    period: 'Mar 2025 – Jul 2026',
    description:
      'Technical documentation and system requirements for an embedded systems project at ICCT Colleges.',
    url: null,
    image: '/assets/images/projects/medicare-wide-960.webp',
    imageSmall: '/assets/images/projects/medicare-wide-480.webp',
    imageWidth: 960,
    imageHeight: 540,
    imageAlt:
      'Full Medicare prototype in a wider wooden-table composition, with enclosure, LCD display and controls',
    previewType: 'photo',
    tools: ['Embedded Systems', 'Technical Documentation', 'UML & System Diagrams'],
  },
];

export const education = [
  {
    school: 'ICCT Colleges',
    qualification: 'Computer Engineering',
    period: '2023 – Present',
    location: 'Cainta, Rizal',
  },
  {
    school: 'Lapuyan National High School',
    qualification: 'Accountancy and Business Management',
    period: '2020 – 2022',
    location: 'Lapuyan, Zamboanga del Sur',
  },
];

export const award = {
  title: 'Top 8 Student — Object-Oriented Programming',
  issuer: 'ICCT Colleges · Cainta Campus',
  date: 'November 17, 2025',
  description:
    'Certificate of Recognition for outstanding performance in COEPRO6 — Object-Oriented Programming, including OOP, data structures, algorithms, and system logic.',
  image: '/assets/images/certificates/oop-restored.webp',
  imageSmall: '/assets/images/certificates/oop-restored-768.webp',
};

// Keep chatbot facts linked to the same source data displayed on the website.
export const chatKnowledge = {
  projectTimelines: projects.map((project) => ({
    name: project.name,
    developmentPeriod: project.period,
  })),
  timelineNotes:
    'Project periods are the development periods listed in Robiner’s resume. Exact launch dates and exact completion days have not been provided.',
  additionalResumeSkills: [
    'Full-Stack Web Development',
    'Basic Circuit Design',
    'System Analysis & Design',
  ],
  webProjectStack: [...webProjectStack],
  webProjectDatabase: 'PostgreSQL via Supabase',
  webProjectNotes:
    'AlagaTrack and StreetWear use the same React, TypeScript, Tailwind CSS and Vite stack with PostgreSQL via Supabase. They are not plain HTML/CSS/JavaScript applications and do not use SQLite. React is listed in the project stacks even though it is not a separate personal Skills & Tools chip.',
  careerInterests: [
    'Software Development',
    'Full-Stack Development',
    'Web Development',
    'Embedded Systems',
    'Systems Analysis',
    'Technical Documentation',
  ],
};

// Supplied illustrations depict these tools; they are not project screenshots.
const skillPicture = (name, caption, alt) => ({
  image: `/assets/images/skills/${name}.jpg`,
  caption,
  alt,
});
export const skillPreviews = {
  Supabase: {
    image: '/assets/images/skills/supabase.webp',
    caption: 'Database tables and backend services · Tool illustration',
    alt: 'Illustration of a developer using a Supabase-style database table editor and schema panel',
  },
  'Node.js': {
    image: '/assets/images/skills/nodejs.webp',
    caption: 'JavaScript server runtime · Code illustration',
    alt: 'Illustration of a developer writing a Node.js HTTP server with a local terminal',
  },
  Vercel: {
    image: '/assets/images/skills/vercel.webp',
    caption: 'Web deployment workflow · Tool illustration',
    alt: 'Illustration of a developer viewing a successful production deployment in a Vercel-style dashboard',
  },
  Codex: {
    image: '/assets/images/skills/codex.png',
    caption: 'AI-assisted coding workflow · Tool illustration',
    alt: 'Illustration of a Codex coding workspace with a refactoring task, plan and TypeScript editor',
  },
  Antigravity: {
    image: '/assets/images/skills/antigravity.png',
    caption: 'Coding with an AI agent · Tool illustration',
    alt: 'Illustration of an Antigravity editor with a TypeScript JSX file and a plan-edit-verify agent panel',
  },
  'Claude AI': {
    image: '/assets/images/skills/claude.png',
    caption: 'AI assistance and code explanations · Tool illustration',
    alt: 'Illustration of a Claude chat explaining a typed component with a TypeScript interface example',
  },
  HTML: {
    image: '/assets/images/skills/html.png',
    caption: 'HTML structure · Code illustration',
    alt: 'Illustration of an HTML editor showing a page structure, heading, paragraph and project link',
  },
  CSS: {
    image: '/assets/images/skills/css.png',
    caption: 'Layout and hover styles · Code illustration',
    alt: 'Illustration of CSS grid layout, button colors and a hover transform in a code editor',
  },
  JavaScript: {
    image: '/assets/images/skills/javascript.png',
    caption: 'Events and theme interaction · Code illustration',
    alt: 'Illustration of JavaScript event listeners, a theme toggle and an array in a code editor',
  },
  TypeScript: {
    image: '/assets/images/skills/typescript.png',
    caption: 'Typed interfaces and functions · Code illustration',
    alt: 'Illustration of a TypeScript Project interface, a typed object and a function with a string return type',
  },
  'Tailwind CSS': {
    image: '/assets/images/skills/tailwind.png',
    caption: 'Utility classes for interface styling · Code illustration',
    alt: 'Illustration of HTML markup with Tailwind spacing, typography, color and border radius utility classes',
  },
  'Embedded Systems': {
    image: '/assets/images/embedded-architecture.jpg',
    caption: 'Embedded C code, Arduino architecture and hardware connections',
    alt: 'A developer viewing embedded C code, an Arduino system architecture, hardware connections and a circuit diagram',
  },
  'Technical Documentation': {
    image: '/assets/images/skills/system-analysis.jpg',
    caption: 'Requirements specification, system diagrams and documentation',
    alt: 'A requirements document and software system diagrams displayed alongside a specification table',
  },

  'Microsoft Word': skillPicture(
    'word',
    'Document writing · Tool illustration',
    'Illustration of a person working on a document in Microsoft Word',
  ),
  'Microsoft Excel': skillPicture(
    'excel',
    'Spreadsheets and charts · Tool illustration',
    'Illustration of a person using Excel with a spreadsheet and charts on the monitor',
  ),
  'Microsoft PowerPoint': skillPicture(
    'powerpoint',
    'Presentation design · Tool illustration',
    'Illustration of a person preparing technology slides in PowerPoint',
  ),
  Figma: skillPicture(
    'figma',
    'Interface design · Tool illustration',
    'Illustration of a person using a Figma-style interface editor with desktop and mobile designs',
  ),
  'UI/UX Design': skillPicture(
    'figma',
    'Desktop and mobile interface design · Illustration',
    'Illustration of desktop and mobile interface mockups on a design editor',
  ),
  Canva: skillPicture(
    'canva',
    'Visual design · Tool illustration',
    'Illustration of a person designing a poster in a Canva-style editor',
  ),
  Git: skillPicture(
    'git',
    'Version control · Tool illustration',
    'Illustration of Git status, commits, branches and push commands in a terminal',
  ),
  GitHub: skillPicture(
    'github',
    'Source repositories · Tool illustration',
    'Illustration of a person viewing a repository on a GitHub-style screen',
  ),
  'System Analysis': skillPicture(
    'system-analysis',
    'Requirements and system planning · Illustration',
    'Illustration of a requirements document, diagrams and a requirements table on a monitor',
  ),
};
