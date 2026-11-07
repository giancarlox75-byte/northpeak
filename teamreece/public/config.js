/* =========================================================================
   TEAM REECE — CAMPAIGN CONFIG
   -------------------------------------------------------------------------
   Everything that changes once you pick an office lives here.
   Edit these values and the whole site updates. No other file needs to change.
   ========================================================================= */
window.CAMPAIGN = {
  // Candidate
  firstName: "Kevin",
  lastName: "Reece",
  brand: "Team Reece",
  hometown: "Flint",
  handle: "officialreecehq",

  // Office — leave office blank until you decide. The site will read
  // "Team Reece" instead of "Reece for <Office>".
  office: "",               // e.g. "State House", "State Senate", "Congress", "Governor"
  district: "",             // e.g. "District 42"  (optional)
  state: "Michigan",

  // Election day — drives the countdown. Next Michigan general elections:
  // 2028-11-07 (State House, U.S. House, President)
  // 2030-11-05 (Governor, State Senate, U.S. Senate)
  electionDate: "2028-11-07",

  // Links
  instagram: "https://instagram.com/officialreecehq",
  donateUrl: "",            // Your ActBlue / WinRed / processor link. Blank = "coming soon"
  email: "hello@teamreece.com",

  // Legal disclaimer (required once you form a committee — Michigan Campaign
  // Finance Act / FEC rules). Replace with your committee's exact name/address.
  paidFor: "Paid for by Team Reece HQ.",

  // EXAMPLE events, shown (labeled "Example") only in the offline preview.
  // On the live site, events and volunteer shifts come from Campaign HQ → Events.
  events: [
    { title: "Team Reece Kickoff", date: "2026-12-06T18:00", end: "2026-12-06T20:00", place: "Lansing, MI", type: "Rally",
      desc: "The official launch. Meet the team, hear the vision, and sign up to build the movement." },
    { title: "Coffee & Conversation", date: "2026-12-13T09:30", end: "2026-12-13T11:00", place: "Grand Rapids, MI", type: "Town Hall",
      desc: "No speeches, just questions. Bring what matters to you and your neighborhood." },
    { title: "Volunteer Training Night", date: "2027-01-10T18:30", end: "2027-01-10T20:30", place: "Detroit, MI + Online", type: "Training",
      desc: "Learn to knock doors, phone bank, and organize your block. First-timers welcome." },
    { title: "Up North Listening Tour", date: "2027-01-24T13:00", end: "2027-01-24T16:00", place: "Traverse City, MI", type: "Tour",
      desc: "First stop on a tour of every corner of the state, from the U.P. to the Ohio line." }
  ]
};
