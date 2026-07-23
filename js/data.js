/* Replace this object with an API adapter later. Everything here is demonstration data. */
window.MATCHPULSE_DATA = {
  matches: [
    {
      id: "ind-aus",
      status: "live",
      statusLabel: "In progress - demo",
      series: "Border-Gavaskar Trophy - 2nd Test",
      venue: "Adelaide Oval",
      teams: [
        { name: "India", short: "IND", score: "241/6", overs: "72.4 ov" },
        { name: "Australia", short: "AUS", score: "337", overs: "87.3 ov" }
      ],
      state: "India trail by 96 runs with 4 wickets remaining",
      cardSummary: "Day 2 - Session 3",
      followTeam: "India",
      pulse: 86,
      pulseCopy: "A new ball, a narrowing deficit, and India's last recognised pair make the next hour decisive.",
      momentumTitle: "Australia still lead, but India have steadied",
      momentum: [-38, -31, -19, 8, 21, 34, 15, -12, -28, -16, 9, 18],
      momentumLabels: ["61", "62", "63", "64", "65", "66", "67", "68", "69", "70", "71", "72"],
      insights: {
        simple: {
          caption: "Bars above the line favour India; bars below favour Australia. India recovered after two quick wickets, but Australia still control the innings.",
          title: "Cummins broke the partnership just as India drew level in the session",
          copy: "Pant and Jadeja had made batting look safer. Cummins removed Pant with a short ball, exposing India's lower order to the second new ball.",
          stats: [["Win swing", "+14% AUS"], ["Stand ended", "71 runs"]]
        },
        expert: {
          caption: "Momentum index blends runs above expected, wickets, boundary rate, and control percentage across a rolling three-over window.",
          title: "The short-ball plan reversed a falling false-shot rate",
          copy: "Pant's false-shot rate had dropped to 18% after lunch. Australia went 73% short or back-of-a-length in the next spell, producing the wicket and two further miscues.",
          stats: [["Win probability", "AUS 68%"], ["Expected runs saved", "19.4"]]
        }
      },
      turningOver: "68.2 overs",
      catchUp: [
        ["Where it stands", "Australia made 337. India are 241/6 and trail by 96."],
        ["What changed", "A 71-run Pant-Jadeja stand repaired the innings before Cummins removed Pant."],
        ["What matters next", "Jadeja must shepherd the tail through the second new ball."]
      ],
      timeline: [
        ["16.4", "Early breakthrough", "Starc traps Jaiswal in front with the new ball."],
        ["31.1", "India rebuild", "Gill and Kohli settle into a patient 64-run stand."],
        ["48.5", "Double strike", "Lyon removes Kohli, then Rohit falls two overs later."],
        ["64.3", "Counterattack", "Pant reaches fifty and pushes the session India's way."],
        ["68.2", "Momentum turns", "Cummins ends the stand and exposes the lower order."]
      ]
    },
    {
      id: "eng-sa",
      status: "complete",
      statusLabel: "Completed",
      series: "ODI Series - 1st ODI",
      venue: "Headingley, Leeds",
      teams: [
        { name: "England", short: "ENG", score: "284/8", overs: "50 ov" },
        { name: "South Africa", short: "SA", score: "286/5", overs: "48.2 ov" }
      ],
      state: "South Africa won by 5 wickets",
      cardSummary: "South Africa won by 5 wickets",
      followTeam: "South Africa",
      pulse: 72,
      pulseCopy: "A composed chase turned sharply during a 94-run fourth-wicket partnership.",
      momentumTitle: "South Africa timed the chase to perfection",
      momentum: [-14, -25, -18, 6, 24, 39, 51, 35, 42, 58, 69, 82],
      momentumLabels: ["5", "10", "15", "20", "25", "30", "35", "40", "43", "45", "47", "48"],
      insights: {
        simple: { caption: "England were ahead early, but South Africa took control through the middle overs and never gave it back.", title: "Markram and Klaasen removed the asking-rate pressure", copy: "Their partnership mixed low-risk rotation with one boundary an over, leaving the lower order a simple finish.", stats: [["Win swing", "+31% SA"], ["Partnership", "94 runs"]] },
        expert: { caption: "South Africa's required rate stayed below 7.1 despite a boundary drought from overs 18 to 23.", title: "Elite strike rotation neutralised England's middle-over squeeze", copy: "The pair scored from 61% of legal balls against spin, creating favourable matchups without forcing boundary options.", stats: [["Dot-ball rate", "39%"], ["Chase efficiency", "+12.8"]] }
      },
      turningOver: "34.6 overs",
      catchUp: [["The result", "South Africa chased 285 with ten balls left."], ["What changed", "Markram and Klaasen added 94 to break England's grip."], ["The difference", "South Africa lost only one wicket between overs 20 and 40."]],
      timeline: [["8.2", "Roy starts quickly", "England race to 58 before the first wicket."], ["24.5", "Middle overs tighten", "Maharaj slows England's scoring rate."], ["49.6", "Competitive total", "England close on 284/8."], ["34.6", "Chase unlocked", "Markram takes 14 from the over."], ["48.2", "Winning runs", "Klaasen drives through cover to seal it."]]
    },
    {
      id: "nz-pak",
      status: "upcoming",
      statusLabel: "Upcoming",
      series: "T20 Tri-Series - Match 4",
      venue: "Eden Park, Auckland",
      teams: [
        { name: "New Zealand", short: "NZ", score: "Yet to bat", overs: "" },
        { name: "Pakistan", short: "PAK", score: "Yet to bat", overs: "" }
      ],
      state: "Starts Friday at 7:00 PM local time",
      cardSummary: "Fri - 7:00 PM local",
      followTeam: "New Zealand",
      pulse: 61,
      pulseCopy: "Eden Park's short straight boundaries put both teams' death bowling under pressure.",
      momentumTitle: "Pre-match matchup: powerplay bowling could decide it",
      momentum: [12, 18, -8, -22, 14, 25, 9, -16, 19, 31, -12, 7],
      momentumLabels: ["PP", "2", "3", "4", "5", "6", "7", "8", "9", "10", "15", "20"],
      insights: {
        simple: { caption: "This pre-match view compares each team's recent performance by phase. New Zealand have the stronger powerplay record.", title: "Pakistan's new-ball test", copy: "New Zealand score fastest in the first six overs, while Pakistan have conceded early boundaries in their last three matches.", stats: [["NZ powerplay", "9.1 rpo"], ["PAK powerplay", "7.8 rpo"]] },
        expert: { caption: "Pre-match index uses phase run rate, boundary percentage, wickets per over, and venue-adjusted recent form.", title: "New Zealand can target Pakistan's hard-length bias", copy: "Pakistan's quicks use a hard length on 58% of powerplay balls. At Eden Park, that zone has returned 1.6 runs more per over than the T20 baseline.", stats: [["Venue delta", "+1.6 rpo"], ["Matchup sample", "8 innings"]] }
      },
      turningOver: "Pre-match watch",
      catchUp: [["The fixture", "New Zealand face Pakistan at Eden Park on Friday."], ["The matchup", "New Zealand's powerplay batting meets Pakistan's new-ball pace."], ["What to watch", "Short straight boundaries could make yorker execution decisive."]],
      timeline: [["Powerplay", "New Zealand's edge", "Their top order has attacked from ball one."], ["Overs 7-10", "Spin matchup", "Pakistan can slow the scoring through leg spin."], ["Middle phase", "Running matters", "The square boundaries offer fewer easy options."], ["Death overs", "Execution test", "Both attacks have leaked late runs recently."], ["Final over", "Fine margins", "Eden Park often keeps chases alive until the end."]]
    }
  ],
  news: [
    { category: "India", team: "India", time: "12 min read", title: "Why Jadeja's defence is now India's most important shot", excerpt: "A closer look at how he has changed his setup against the second new ball." },
    { category: "Analysis", team: "Australia", time: "7 min read", title: "Cummins found the length Adelaide was asking for", excerpt: "Australia's captain traded swing for steep bounce at precisely the right moment." },
    { category: "World", team: "South Africa", time: "5 min read", title: "South Africa's chase was calmer than the scoreboard suggests", excerpt: "The middle order controlled risk without letting the required rate escape." },
    { category: "Preview", team: "New Zealand", time: "6 min read", title: "Three matchups that could shape New Zealand v Pakistan", excerpt: "Powerplay pace and Eden Park's dimensions sit at the heart of Friday's contest." },
    { category: "Analysis", team: "England", time: "8 min read", title: "England's middle-over squeeze needed one more wicket", excerpt: "A good defensive spell never became the attacking passage the hosts required." },
    { category: "World", team: "Pakistan", time: "4 min read", title: "Pakistan back their pace attack for Auckland test", excerpt: "A flexible bowling order may be the answer to New Zealand's fast starts." }
  ]
};
