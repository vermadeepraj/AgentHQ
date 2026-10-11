// Who works at AgentHQ: the core team, hireable contractors, and pay rates.

export const TEAMS = {
  product: { label: 'Product', color: '#ffb547' },
  design: { label: 'Design', color: '#ff6fd8' },
  eng: { label: 'Engineering', color: '#5ee7ff' },
  qa: { label: 'Quality', color: '#54ffb0' },
  ops: { label: 'DevOps', color: '#a98bff' },
}

export const SKIN = ['#f3cfb1', '#e2b08a', '#c98e65', '#a96f4a', '#8a5638', '#603d27']
export const HAIR = ['#17110d', '#2c1d14', '#4b301d', '#73502f', '#b48a4f', '#272a33', '#8b8b92']

/** Hourly pay in $. Overtime ×1.5, night pages ×2. */
export const RATES = { product: 60, design: 55, eng: 70, qa: 50, ops: 65, contractor: 110 }

const look = (skin, hair, hairStyle, shirt, pants, height = 1, build = 1) => ({
  skin, hair, hairStyle, shirt, pants, shoes: '#1d1d22', height, build,
})

export const ROSTER = [
  {
    id: 'priya', name: 'Priya Sharma', role: 'Product Manager', team: 'product', primary: 'product',
    desk: 'product-0', skills: { product: 0.95, design: 0.35, qa: 0.3 }, reviews: ['design', 'product'],
    speed: 1, quality: 1.05, trait: 'Organised and protective of the team',
    look: look(1, 0, 'long', '#b5543c', '#2b2f3a', 0.96, 0.95),
  },
  {
    id: 'arjun', name: 'Arjun Mehta', role: 'Business Analyst', team: 'product', primary: 'product',
    desk: 'product-1', skills: { product: 0.85, design: 0.3, qa: 0.35 },
    speed: 1, quality: 1, trait: 'Asks "why" five times',
    look: look(2, 1, 'short', '#3f6f8f', '#3a3a3f', 1.02),
  },
  {
    id: 'meera', name: 'Meera Iyer', role: 'UX Designer', team: 'design', primary: 'design',
    desk: 'design-0', skills: { design: 0.95, product: 0.45 },
    speed: 1, quality: 1.05, trait: 'Sketches everything first',
    look: look(2, 0, 'bun', '#e9e2d4', '#4a5160', 0.95, 0.92),
  },
  {
    id: 'kabir', name: 'Kabir Rao', role: 'Visual Designer', team: 'design', primary: 'design',
    desk: 'design-1', skills: { design: 0.9, frontend: 0.3 },
    speed: 1.05, quality: 1, trait: 'Pixel-perfect, slightly dramatic',
    look: look(3, 1, 'curly', '#202328', '#5b4636', 1.03),
  },
  {
    id: 'ananya', name: 'Ananya Das', role: 'Tech Lead', team: 'eng', primary: 'backend', lead: true,
    desk: 'eng-7', skills: { backend: 0.85, frontend: 0.75, ops: 0.55 },
    speed: 1, quality: 1.08, trait: 'Calm in every fire',
    look: look(1, 0, 'bob', '#5a6b4e', '#26272c', 0.97, 0.95),
  },
  {
    id: 'rohan', name: 'Rohan Verma', role: 'Frontend Engineer', team: 'eng', primary: 'frontend',
    desk: 'eng-0', skills: { frontend: 0.9, backend: 0.3, design: 0.25 },
    speed: 1.05, quality: 0.97, trait: 'Ships fast, refactors later',
    look: look(3, 0, 'short', '#d0d4dc', '#2f3b52', 1.04),
  },
  {
    id: 'sara', name: 'Sara Khan', role: 'Frontend Engineer', team: 'eng', primary: 'frontend',
    desk: 'eng-4', skills: { frontend: 0.85, backend: 0.35 },
    speed: 1, quality: 1.03, trait: 'Accessibility champion',
    look: look(0, 2, 'long', '#7b4b8f', '#2a2a30', 0.97, 0.92),
  },
  {
    id: 'vikram', name: 'Vikram Singh', role: 'Backend Engineer', team: 'eng', primary: 'backend',
    desk: 'eng-10', skills: { backend: 0.9, ops: 0.45, frontend: 0.3 },
    speed: 0.98, quality: 1.04, trait: 'Writes the tests nobody asked for',
    look: look(4, 0, 'buzz', '#8c3b3b', '#33363d', 1.06, 1.08),
  },
  {
    id: 'neha', name: 'Neha Joshi', role: 'QA Engineer', team: 'qa', primary: 'qa',
    desk: 'qa-0', skills: { qa: 0.95, product: 0.35 },
    speed: 1, quality: 1, trait: 'Finds the bug in the bug fix',
    look: look(1, 1, 'ponytail', '#2f7a6a', '#30333a', 0.95, 0.93),
  },
  {
    id: 'dev', name: 'Dev Patel', role: 'DevOps / SRE', team: 'ops', primary: 'ops',
    desk: 'ops-0', skills: { ops: 0.95, backend: 0.45 },
    speed: 1, quality: 1.02, trait: 'Has a runbook for that',
    look: look(2, 5, 'short', '#2e2e36', '#3d4250', 1.01, 1.02),
  },
]

export const CONTRACTORS = {
  frontend: { role: 'Contract Frontend Dev', team: 'eng', primary: 'frontend', skills: { frontend: 0.8, backend: 0.3 } },
  backend: { role: 'Contract Backend Dev', team: 'eng', primary: 'backend', skills: { backend: 0.8, ops: 0.4 } },
  design: { role: 'Contract Designer', team: 'design', primary: 'design', skills: { design: 0.8 } },
  qa: { role: 'Contract QA', team: 'qa', primary: 'qa', skills: { qa: 0.8 } },
}

export const CONTRACTOR_PEOPLE = [
  { name: 'Lucas Silva', look: look(2, 3, 'short', '#c9a227', '#2f3440', 1.03) },
  { name: 'Mei Chen', look: look(0, 0, 'bob', '#6d8fb3', '#2b2b31', 0.94, 0.92) },
  { name: 'Omar Haddad', look: look(3, 0, 'curly', '#5f7f5a', '#363a44', 1.05) },
  { name: 'Elena Petrova', look: look(0, 4, 'ponytail', '#9b4d6a', '#2c2f38', 0.98, 0.93) },
  { name: 'Kenji Watanabe', look: look(1, 5, 'short', '#40464f', '#4a4036', 1) },
  { name: 'Aisha Bello', look: look(5, 0, 'bun', '#d1803d', '#2d2d33', 0.97, 0.94) },
]
