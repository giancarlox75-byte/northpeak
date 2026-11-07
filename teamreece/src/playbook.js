// src/playbook.js — the campaign launch checklist shown in Campaign HQ → Playbook.
// Michigan-specific items link to official sources. Always confirm dates and requirements with the
// Michigan Bureau of Elections before acting: laws and calendars change.

const SOS = 'https://www.michigan.gov/sos/elections';
const CFR = 'https://www.michigan.gov/sos/elections/disclosure/cfr/filing-dates/instructions-and-forms-candidate-committees';

export const PLAYBOOK = [
  { phase: 'Decide', items: [
    { id: 'office', title: 'Choose the office and the year', detail: 'Next Michigan general elections: Nov 7, 2028 (State House, U.S. House) and Nov 5, 2030 (Governor, State Senate, U.S. Senate). Set office, district and electionDate in public/config.js.' },
    { id: 'district', title: 'Confirm your district and its boundaries', detail: 'Look up your districts on the Michigan Voter Information Center. Lines were redrawn by the Independent Citizens Redistricting Commission.', link: 'https://mvic.sos.state.mi.us/' },
    { id: 'eligible', title: 'Confirm you meet the eligibility rules', detail: 'For example, state legislators must be at least 21 and a registered voter in the district. Michigan limits legislators to 12 years total in the Legislature (2022 Proposal 1). Verify the rules for your office.', link: SOS },
    { id: 'research', title: 'Study the district', detail: 'Past results, turnout, who holds the seat, local issues and key community leaders. The Priorities results in Campaign HQ show what visitors care about.' },
  ] },
  { phase: 'Make it official', items: [
    { id: 'committee', title: 'Form your candidate committee', detail: 'Under the Michigan Campaign Finance Act you must form a committee within 10 days of becoming a candidate, and file a Statement of Organization within 10 days of forming it. State candidates file electronically with the Bureau of Elections.', link: 'https://legislature.mi.gov/documents/mcl/pdf/MCL-169-224.pdf' },
    { id: 'treasurer', title: 'Appoint a treasurer', detail: 'Named on your Statement of Organization. Responsible for records and finance reports.', link: CFR },
    { id: 'ein', title: 'Get an EIN for the committee', detail: 'Free from the IRS. Needed to open a bank account.', link: 'https://www.irs.gov/businesses/small-businesses-self-employed/get-an-employer-identification-number' },
    { id: 'bank', title: 'Open a dedicated campaign bank account', detail: 'Never mix campaign and personal money.' },
    { id: 'donations', title: 'Set up online donations', detail: 'Choose a processor that collects the contributor information the law requires (name, address, occupation, employer). Add the link as donateUrl in public/config.js.' },
    { id: 'paidfor', title: 'Put "Paid for by" on everything', detail: 'Campaign materials must identify who paid for them. Set paidFor in public/config.js to your committee\'s exact name and address.', link: 'https://legislature.mi.gov/documents/mcl/pdf/MCL-169-247.pdf' },
    { id: 'reports', title: 'Put every finance reporting deadline on the calendar', detail: 'Get the reporting calendar for your election cycle from the Bureau of Elections.', link: CFR },
  ] },
  { phase: 'Get on the ballot', items: [
    { id: 'petitions', title: 'Nominating petitions or filing fee', detail: 'Signature requirements depend on your district. Major-party state legislative candidates may pay a $100 filing fee instead of filing petitions. Verify for your office.', link: SOS },
    { id: 'deadline', title: 'File by the deadline', detail: 'Petitions are due by 4 p.m. on the 15th Tuesday before the August primary (MCL 168.163). For 2028 that works out to April 25, 2028. Verify with the official election calendar.', link: 'https://www.legislature.mi.gov/documents/mcl/pdf/mcl-168-163.pdf' },
    { id: 'affidavit', title: 'File your affidavit of identity', detail: 'Filed with your petitions or fee.', link: SOS },
    { id: 'disclosure', title: 'File required financial disclosure', detail: 'Check personal financial disclosure requirements for your office with the Bureau of Elections.', link: SOS },
  ] },
  { phase: 'Build the team', items: [
    { id: 'manager', title: 'Hire or recruit a Campaign Manager', detail: 'Applications arrive in Team → HQ Office. Move good candidates to "interviewing".' },
    { id: 'hq-core', title: 'Fill the core HQ roles', detail: 'Treasurer, Finance, Communications, Field Director. Team shows which HQ roles are still open.' },
    { id: 'regional', title: 'Recruit a Regional Director for each region you\'re competing in', detail: 'Start with your district\'s region. Team → Regional Leadership shows coverage for all 10.' },
    { id: 'captains', title: 'Recruit County Captains', detail: 'One per county in your district.' },
    { id: 'onboard', title: 'Onboard and train volunteers', detail: 'Schedule a "Training" event in Events, and move people to "onboarded" once trained.' },
  ] },
  { phase: 'Field program', items: [
    { id: 'voterfile', title: 'Get the voter file', detail: 'The Qualified Voter File is available from the Bureau of Elections for your district. Your party or a vendor may also provide it with a canvassing app.', link: SOS },
    { id: 'canvass-app', title: 'Pick a canvassing app', detail: 'Walk lists, scripts and results on volunteers\' phones.' },
    { id: 'goals', title: 'Set door-knocking goals by region', detail: 'Field → Goals. Progress fills in as organizers file reports.' },
    { id: 'teamcode', title: 'Set the organizer access code', detail: 'Field → Settings. Share it with organizers so they can file canvass results at /team.' },
    { id: 'shifts', title: 'Schedule weekly canvass and phone bank shifts', detail: 'Create "Canvass" and "Phone Bank" events with a capacity, and organizers sign up on the website.' },
  ] },
  { phase: 'Message & media', items: [
    { id: 'photo', title: 'Professional photos', detail: 'Headshot plus candid photos in the community. Replace the KR placeholder on the site.' },
    { id: 'platform', title: 'Final review of the platform', detail: 'Read every plan on the site and make sure each line is something you\'ll defend.' },
    { id: 'domain', title: 'Domain, campaign email and email alerts', detail: 'Buy the domain, connect it in Vercel, verify it in Resend, and set NOTIFY_EMAIL.' },
    { id: 'press', title: 'Build a press list and a press kit', detail: 'Local reporters, outlets and newsletters in your district, plus a bio, photos and fact sheet.' },
    { id: 'social', title: 'Plan a weekly social and newsletter calendar', detail: 'Send updates from Newsletter in Campaign HQ.' },
  ] },
  { phase: 'Fundraising', items: [
    { id: 'budget', title: 'Write a campaign budget', detail: 'Staff, mail, digital, signs, events, and a reserve for the final month.' },
    { id: 'calltime', title: 'Build your call-time list', detail: 'Everyone you know, sorted by how much you can ask for. Block call time on your calendar every week.' },
    { id: 'launch-fund', title: 'Plan a launch fundraiser', detail: 'Create it as a "Fundraiser" event.' },
    { id: 'monthly', title: 'Start a monthly small-dollar program', detail: 'Recurring donors are the most reliable money in politics.' },
  ] },
  { phase: 'Launch & get out the vote', items: [
    { id: 'announce', title: 'Official announcement', detail: 'Set the office in config.js, send a newsletter, post everywhere, and hold a launch event.' },
    { id: 'absentee', title: 'Absentee and early voting program', detail: 'Michiganders can vote absentee without a reason and vote early in person. Build a plan to help supporters use both. Check the current rules and dates.', link: SOS },
    { id: 'gotv', title: 'Get-out-the-vote plan for the final 10 days', detail: 'Daily canvass shifts, rides to the polls, reminder texts and calls.' },
    { id: 'pollwatch', title: 'Election day coverage', detail: 'Recruit and train election challengers and poll greeters. Check Bureau of Elections rules for challengers.', link: SOS },
  ] },
];

export const PLAYBOOK_IDS = PLAYBOOK.flatMap((p) => p.items.map((i) => i.id));
