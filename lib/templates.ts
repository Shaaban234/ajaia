/**
 * Starter templates. Content only uses formatting the editor supports
 * (headings, paragraphs, bold/italic/underline, lists, quotes, rules), so a
 * template is just a pre-filled document: fully editable, nothing special.
 */
export interface Template {
  id: string;
  name: string;
  variant: string;
  title: string;
  accent: string;
  html: string;
}

export const TEMPLATES: Template[] = [
  {
    id: "meeting-notes",
    name: "Meeting notes",
    variant: "Weekly sync",
    title: "Meeting notes",
    accent: "#0b57d0",
    html: `<h1>Weekly team sync</h1>
<p><strong>Date:</strong> Monday · <strong>Attendees:</strong> Alice, Bob, Carol</p>
<h2>Agenda</h2>
<ol><li><p>Wins from last week</p></li><li><p>Blockers and risks</p></li><li><p>Priorities for this week</p></li></ol>
<h2>Notes</h2>
<p>Summarize the discussion here. Keep it short and link to details.</p>
<h2>Decisions</h2>
<ul><li><p><strong>Decided:</strong> what was agreed and why</p></li></ul>
<h2>Action items</h2>
<ul><li><p><strong>Owner</strong> — task — due date</p></li><li><p><strong>Owner</strong> — task — due date</p></li></ul>`,
  },
  {
    id: "project-proposal",
    name: "Project proposal",
    variant: "One-pager",
    title: "Project proposal",
    accent: "#188038",
    html: `<h1>Project name</h1>
<p><em>One-line description of what this project is and who it is for.</em></p>
<hr>
<h2>Problem</h2>
<p>What is broken or missing today? Who feels it, and how often?</p>
<h2>Proposal</h2>
<p>What we will build, in plain language. Describe the smallest version that solves the problem.</p>
<h2>Goals</h2>
<ul><li><p>Measurable goal one</p></li><li><p>Measurable goal two</p></li></ul>
<h2>Non-goals</h2>
<ul><li><p>What we are deliberately <u>not</u> doing in this phase</p></li></ul>
<h2>Timeline</h2>
<ol><li><p><strong>Week 1–2:</strong> discovery and design</p></li><li><p><strong>Week 3–5:</strong> build and test</p></li><li><p><strong>Week 6:</strong> launch and measure</p></li></ol>
<h2>Risks</h2>
<ul><li><p>Risk — mitigation</p></li></ul>`,
  },
  {
    id: "product-brief",
    name: "Product brief",
    variant: "PRD",
    title: "Product requirements",
    accent: "#a142f4",
    html: `<h1>Feature name — product brief</h1>
<p><strong>Owner:</strong> Name · <strong>Status:</strong> Draft · <strong>Target release:</strong> Q1</p>
<h2>Background</h2>
<p>Why now? Link to research, customer quotes or metrics.</p>
<blockquote><p>"Quote from a customer that captures the pain point."</p></blockquote>
<h2>User stories</h2>
<ul><li><p>As a <strong>team lead</strong>, I want to … so that …</p></li><li><p>As a <strong>new user</strong>, I want to … so that …</p></li></ul>
<h2>Requirements</h2>
<h3>Must have</h3>
<ul><li><p>Requirement</p></li></ul>
<h3>Nice to have</h3>
<ul><li><p>Requirement</p></li></ul>
<h2>Success metrics</h2>
<ul><li><p>Metric and target</p></li></ul>
<h2>Open questions</h2>
<ol><li><p>Question to resolve before build</p></li></ol>`,
  },
  {
    id: "status-report",
    name: "Status report",
    variant: "Weekly",
    title: "Weekly status report",
    accent: "#e8710a",
    html: `<h1>Weekly status report</h1>
<p><strong>Team:</strong> Platform · <strong>Week of:</strong> date · <strong>Overall:</strong> <u>On track</u></p>
<h2>Highlights</h2>
<ul><li><p>Shipped …</p></li><li><p>Unblocked …</p></li></ul>
<h2>Progress against goals</h2>
<ol><li><p><strong>Goal one</strong> — 70% complete</p></li><li><p><strong>Goal two</strong> — 40% complete</p></li></ol>
<h2>Risks and blockers</h2>
<ul><li><p><strong>Risk:</strong> description — <em>help needed from …</em></p></li></ul>
<h2>Next week</h2>
<ul><li><p>Planned work</p></li></ul>`,
  },
  {
    id: "resume",
    name: "Resume",
    variant: "Classic",
    title: "Resume",
    accent: "#1a73e8",
    html: `<h1>Your Name</h1>
<p>City, Country · email@example.com · linkedin.com/in/you · github.com/you</p>
<hr>
<h2>Summary</h2>
<p>Two or three sentences on who you are, what you build, and the impact you have had.</p>
<h2>Experience</h2>
<h3>Job title — Company</h3>
<p><em>Month 20XX – Present · City</em></p>
<ul><li><p>Achievement with a measurable result</p></li><li><p>Achievement with a measurable result</p></li></ul>
<h3>Job title — Company</h3>
<p><em>Month 20XX – Month 20XX · City</em></p>
<ul><li><p>Achievement with a measurable result</p></li></ul>
<h2>Education</h2>
<p><strong>Degree</strong> — University, 20XX</p>
<h2>Skills</h2>
<p>Languages · Frameworks · Tools</p>`,
  },
  {
    id: "letter",
    name: "Letter",
    variant: "Formal",
    title: "Letter",
    accent: "#00897b",
    html: `<p><strong>Your Name</strong><br>Street address<br>City, Postcode<br>email@example.com</p>
<p>Date</p>
<p><strong>Recipient Name</strong><br>Title, Company<br>Street address<br>City, Postcode</p>
<p>Dear Recipient Name,</p>
<p>Open with the purpose of your letter in one or two sentences.</p>
<p>Use the middle paragraphs to give the context, details and any request you are making. Keep each paragraph focused on one idea.</p>
<p>Close by stating the next step you expect, and thank the reader for their time.</p>
<p>Sincerely,</p>
<p><strong>Your Name</strong></p>`,
  },
  {
    id: "retrospective",
    name: "Retrospective",
    variant: "Sprint",
    title: "Sprint retrospective",
    accent: "#d93025",
    html: `<h1>Sprint retrospective</h1>
<p><strong>Sprint:</strong> # · <strong>Facilitator:</strong> Name</p>
<h2>What went well</h2>
<ul><li><p>…</p></li></ul>
<h2>What did not go well</h2>
<ul><li><p>…</p></li></ul>
<h2>What we learned</h2>
<ul><li><p>…</p></li></ul>
<h2>Actions for next sprint</h2>
<ol><li><p><strong>Owner</strong> — action</p></li></ol>`,
  },
];

export function findTemplate(id: string): Template | undefined {
  return TEMPLATES.find((t) => t.id === id);
}
