import { at } from '../clock.js'

export default {
  id: 'outage',
  title: '3 AM Outage',
  client: 'Chai & Co. (production)',
  difficulty: 'Hard',
  brief: 'Checkout is down in production. Every minute costs revenue. Get it back up.',
  blurb: 'The pager goes off at 3 AM. Decide who to wake up — every minute down costs $40.',
  start: at(1, 2, 58),
  deadline: at(1, 14, 0),
  budget: 16000,
  kickoff: false,
  scoring: 'outage',
  finishOn: 'pm',
  outage: { revenuePerMin: 40 },
  site: { name: 'Chai & Co.', tagline: 'Back online. Sorry about that.', accent: '#e08a3c', bg: '#24160f', ink: '#fff4e6', nav: ['Status', 'Menu', 'Order'] },
  events: [
    { at: at(1, 3, 0), kind: 'alarm' },
    { at: at(1, 3, 1), kind: 'page', agent: 'dev', delay: 14 },
  ],
  tickets: [
    ['triage', 'Triage the alerts', 'ops', 20, [], 3, { fast: true }],
    ['logs', 'Dig through error logs', 'backend', 40, ['triage'], 3, { fast: true }],
    ['deploys', 'Bisect recent deploys', 'ops', 30, ['triage'], 2, { fast: true }],
    ['fix', 'Hotfix: DB connection pool', 'backend', 50, ['logs', 'deploys'], 3, { fast: true }],
    ['rollout', 'Roll out the hotfix', 'ops', 15, ['fix'], 3, { fast: true, resolves: true }],
    ['pm', 'Write the postmortem', 'product', 60, ['rollout'], 2, { fast: true }],
  ],
}
