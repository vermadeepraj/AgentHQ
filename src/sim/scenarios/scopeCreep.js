import { at } from '../clock.js'

export default {
  id: 'scope',
  title: 'Scope Creep',
  client: 'PulseFit',
  difficulty: 'Medium',
  brief: 'Build a class-booking web app for PulseFit, a chain of boutique gyms.',
  blurb: 'Mid-sprint, the client calls with "just a few small changes". How you answer matters.',
  start: at(1, 9, 0),
  deadline: at(2, 18, 0),
  budget: 32000,
  kickoff: true,
  scoring: 'delivery',
  site: { name: 'PulseFit', tagline: 'Book your next class in two taps.', accent: '#ff4f6d', bg: '#14111c', ink: '#fdf2f5', nav: ['Classes', 'Coaches', 'Book'] },
  events: [{ at: at(1, 16, 0), kind: 'decision', decision: 'scope' }],
  decisions: {
    scope: {
      title: 'The client is on the phone',
      text: 'PulseFit loved the progress — and wants Google & Apple login, dark mode, a redesigned pricing page, and a rethink of the booking wireframes. Same deadline.',
      default: 'accept',
      options: [
        {
          id: 'accept', label: 'Accept everything',
          hint: '+3 tickets and the finished wireframes reopen. Client delighted, team deflated.',
          effects: {
            add: [
              ['social', 'Google & Apple login', 'backend', 120, ['auth'], 2],
              ['dark', 'Dark mode', 'frontend', 120, ['shell'], 1],
              ['pricing', 'Pricing page redesign', 'design', 90, ['ds'], 2],
            ],
            reopen: 'wire', clientSat: 0.05, morale: -0.08,
          },
        },
        {
          id: 'negotiate', label: 'Negotiate scope',
          hint: 'Only social login this sprint. Client a little annoyed.',
          effects: { add: [['social', 'Google & Apple login', 'backend', 120, ['auth'], 2]], clientSat: -0.15, morale: -0.02 },
        },
      ],
    },
  },
  tickets: [
    ['brief', 'Product brief', 'product', 60, [], 3],
    ['research', 'User research synthesis', 'product', 90, ['brief'], 2],
    ['flows', 'Booking flows', 'product', 80, ['brief'], 3],
    ['wire', 'Wireframes', 'design', 150, ['flows'], 3],
    ['ds', 'Design system', 'design', 150, ['brief'], 2],
    ['mock', 'Schedule & booking mockups', 'design', 180, ['wire', 'ds'], 3],
    ['profile-mock', 'Member profile mockups', 'design', 90, ['wire', 'research'], 1],
    ['ci', 'CI/CD + preview deploys', 'ops', 90, [], 2],
    ['db', 'Database & infrastructure', 'ops', 90, ['ci'], 2],
    ['auth', 'Accounts & auth API', 'backend', 150, ['db'], 3],
    ['classes', 'Classes & bookings API', 'backend', 210, ['flows', 'db'], 3],
    ['notify', 'Reminders & emails', 'backend', 120, ['classes'], 1],
    ['shell', 'App shell & navigation', 'frontend', 100, ['ci', 'ds'], 2],
    ['schedule', 'Class schedule UI', 'frontend', 180, ['mock', 'shell', 'classes'], 3],
    ['booking', 'Booking flow UI', 'frontend', 180, ['mock', 'classes', 'auth'], 3],
    ['profile', 'Member profile UI', 'frontend', 120, ['profile-mock', 'auth', 'shell'], 1],
    ['launch', 'Deploy to production', 'ops', 30, ['*'], 3, { launch: true }],
  ],
}
