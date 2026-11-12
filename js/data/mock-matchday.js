/* ==========================================================================
   Initial Matchday Dataset & Live Simulation Pools
   Provides a full, broadcast-ready multi-sport state for Football, Cricket,
   Formula 1, and initial scrolling important match updates.
   ========================================================================== */

(function (root) {
  "use strict";

  const Apex = (root.ApexSports = root.ApexSports || {});

  function createInitialState() {
    return {
      football: [
        {
          id: "fb-ars-mci",
          league: "EPL",
          leagueName: "Premier League",
          venue: "Emirates Stadium, London",
          status: "LIVE",
          minute: 67,
          clock: "67'",
          home: {
            name: "Arsenal",
            abbr: "ARS",
            color: "#b91c1c",
            accent: "#f8fafc",
            score: 2,
            yellowCards: 1,
            redCards: 0,
            scorers: ["Saka 23'", "Odegaard 61'"]
          },
          away: {
            name: "Man City",
            abbr: "MCI",
            color: "#0284c7",
            accent: "#bae6fd",
            score: 1,
            yellowCards: 2,
            redCards: 0,
            scorers: ["Haaland 39'"]
          },
          stats: {
            possession: [48, 52],
            shotsOnTarget: [6, 4],
            xg: [1.94, 1.38]
          },
          latestEvent: "64' Raya palms away Foden's curling strike from 20 yards",
          events: [
            { minute: "23'", team: "ARS", type: "GOAL", text: "GOAL! Bukayo Saka cuts inside and fires low inside the far post." },
            { minute: "39'", team: "MCI", type: "GOAL", text: "GOAL! Erling Haaland powers home a header from De Bruyne's cross." },
            { minute: "52'", team: "MCI", type: "CARD", text: "Yellow Card — Rodri booked for tactical foul on Rice." },
            { minute: "61'", team: "ARS", type: "GOAL", text: "GOAL! Martin Odegaard volleys from the edge of the box into the top corner!" },
            { minute: "64'", team: "ARS", type: "SAVE", text: "Big stop! David Raya tips Phil Foden's curler over the crossbar." }
          ],
          lineups: [
            {
              team: "Arsenal",
              abbr: "ARS",
              formation: "4-3-3",
              startingXI: [
                { id: "a1", name: "David Raya", shortName: "D. Raya", jersey: "22", pos: "G", formationPlace: 1, starter: true, goals: 0, assists: 0, yellowCards: 0, redCards: 0 },
                { id: "a2", name: "Ben White", shortName: "B. White", jersey: "4", pos: "RB", formationPlace: 2, starter: true, goals: 0, assists: 0, yellowCards: 0, redCards: 0 },
                { id: "a3", name: "William Saliba", shortName: "W. Saliba", jersey: "2", pos: "CD", formationPlace: 3, starter: true, goals: 0, assists: 0, yellowCards: 0, redCards: 0 },
                { id: "a4", name: "Gabriel Magalhaes", shortName: "Gabriel", jersey: "6", pos: "CD", formationPlace: 4, starter: true, goals: 0, assists: 0, yellowCards: 0, redCards: 0 },
                { id: "a5", name: "Jurrien Timber", shortName: "J. Timber", jersey: "12", pos: "LB", formationPlace: 5, starter: true, subbedOut: true, subOutMinute: "62'", swappedWith: "L. Trossard", goals: 0, assists: 0, yellowCards: 0, redCards: 0 },
                { id: "a6", name: "Martin Odegaard", shortName: "M. Odegaard", jersey: "8", pos: "CM", formationPlace: 6, starter: true, goals: 1, goalMinutes: ["61'"], assists: 1, assistMinutes: ["23'"], yellowCards: 0, redCards: 0 },
                { id: "a7", name: "Declan Rice", shortName: "D. Rice", jersey: "41", pos: "DM", formationPlace: 7, starter: true, goals: 0, assists: 1, assistMinutes: ["61'"], yellowCards: 0, redCards: 0 },
                { id: "a8", name: "Mikel Merino", shortName: "M. Merino", jersey: "23", pos: "CM", formationPlace: 8, starter: true, goals: 0, assists: 0, yellowCards: 1, redCards: 0 },
                { id: "a9", name: "Bukayo Saka", shortName: "B. Saka", jersey: "7", pos: "RW", formationPlace: 9, starter: true, goals: 1, goalMinutes: ["23'"], assists: 0, yellowCards: 0, redCards: 0 },
                { id: "a10", name: "Kai Havertz", shortName: "K. Havertz", jersey: "29", pos: "CF", formationPlace: 10, starter: true, goals: 0, assists: 0, yellowCards: 0, redCards: 0 },
                { id: "a11", name: "Gabriel Martinelli", shortName: "Martinelli", jersey: "11", pos: "LW", formationPlace: 11, starter: true, goals: 0, assists: 0, yellowCards: 0, redCards: 0 }
              ],
              substitutes: [
                { id: "a12", name: "Leandro Trossard", shortName: "L. Trossard", jersey: "19", pos: "FW", starter: false, subbedIn: true, subInMinute: "62'", swappedWith: "J. Timber", goals: 0, assists: 0, yellowCards: 0, redCards: 0 },
                { id: "a13", name: "Neto", shortName: "Neto", jersey: "32", pos: "G", starter: false, subbedIn: false, goals: 0, assists: 0, yellowCards: 0, redCards: 0 },
                { id: "a14", name: "Gabriel Jesus", shortName: "G. Jesus", jersey: "9", pos: "FW", starter: false, subbedIn: false, goals: 0, assists: 0, yellowCards: 0, redCards: 0 }
              ]
            },
            {
              team: "Man City",
              abbr: "MCI",
              formation: "4-2-3-1",
              startingXI: [
                { id: "m1", name: "Ederson", shortName: "Ederson", jersey: "31", pos: "G", formationPlace: 1, starter: true, goals: 0, assists: 0, yellowCards: 0, redCards: 0 },
                { id: "m2", name: "Kyle Walker", shortName: "K. Walker", jersey: "2", pos: "RB", formationPlace: 2, starter: true, goals: 0, assists: 0, yellowCards: 0, redCards: 0 },
                { id: "m3", name: "Ruben Dias", shortName: "R. Dias", jersey: "3", pos: "CD", formationPlace: 3, starter: true, goals: 0, assists: 0, yellowCards: 0, redCards: 0 },
                { id: "m4", name: "John Stones", shortName: "J. Stones", jersey: "5", pos: "CD", formationPlace: 4, starter: true, goals: 0, assists: 0, yellowCards: 0, redCards: 0 },
                { id: "m5", name: "Josko Gvardiol", shortName: "J. Gvardiol", jersey: "24", pos: "LB", formationPlace: 5, starter: true, goals: 0, assists: 0, yellowCards: 1, redCards: 0 },
                { id: "m6", name: "Rodri", shortName: "Rodri", jersey: "16", pos: "DM", formationPlace: 6, starter: true, goals: 0, assists: 0, yellowCards: 1, redCards: 0 },
                { id: "m7", name: "Mateo Kovacic", shortName: "M. Kovacic", jersey: "8", pos: "DM", formationPlace: 7, starter: true, subbedOut: true, subOutMinute: "59'", swappedWith: "J. Doku", goals: 0, assists: 0, yellowCards: 0, redCards: 0 },
                { id: "m8", name: "Bernardo Silva", shortName: "B. Silva", jersey: "20", pos: "RW", formationPlace: 8, starter: true, goals: 0, assists: 0, yellowCards: 0, redCards: 0 },
                { id: "m9", name: "Kevin De Bruyne", shortName: "K. De Bruyne", jersey: "17", pos: "AM", formationPlace: 9, starter: true, goals: 0, assists: 1, assistMinutes: ["39'"], yellowCards: 0, redCards: 0 },
                { id: "m10", name: "Phil Foden", shortName: "P. Foden", jersey: "47", pos: "LW", formationPlace: 10, starter: true, goals: 0, assists: 0, yellowCards: 0, redCards: 0 },
                { id: "m11", name: "Erling Haaland", shortName: "E. Haaland", jersey: "9", pos: "ST", formationPlace: 11, starter: true, goals: 1, goalMinutes: ["39'"], assists: 0, yellowCards: 0, redCards: 0 }
              ],
              substitutes: [
                { id: "m12", name: "Jeremy Doku", shortName: "J. Doku", jersey: "11", pos: "LW", starter: false, subbedIn: true, subInMinute: "59'", swappedWith: "M. Kovacic", goals: 0, assists: 0, yellowCards: 0, redCards: 0 },
                { id: "m13", name: "Stefan Ortega", shortName: "S. Ortega", jersey: "18", pos: "G", starter: false, subbedIn: false, goals: 0, assists: 0, yellowCards: 0, redCards: 0 }
              ]
            }
          ]
        },
        {
          id: "fb-rma-fcb",
          league: "UCL",
          leagueName: "Champions League",
          venue: "Santiago Bernabeu, Madrid",
          status: "LIVE",
          minute: 74,
          clock: "74'",
          home: {
            name: "Real Madrid",
            abbr: "RMA",
            color: "#334155",
            accent: "#f59e0b",
            score: 2,
            yellowCards: 2,
            redCards: 0,
            scorers: ["Vinicius Jr 18'", "Bellingham 71'"]
          },
          away: {
            name: "Bayern Munich",
            abbr: "BAY",
            color: "#dc2626",
            accent: "#ffffff",
            score: 2,
            yellowCards: 1,
            redCards: 0,
            scorers: ["Kane 31' (P)", "Musiala 55'"]
          },
          stats: {
            possession: [46, 54],
            shotsOnTarget: [7, 5],
            xg: [2.15, 1.89]
          },
          latestEvent: "71' GOAL! Bellingham slots in Mbappé's cutback to level it 2-2",
          events: [
            { minute: "18'", team: "RMA", type: "GOAL", text: "GOAL! Vinicius Jr sprints clear and finishes calmly past Neuer." },
            { minute: "31'", team: "BAY", type: "GOAL", text: "PENALTY GOAL! Harry Kane converts into the bottom left corner." },
            { minute: "55'", team: "BAY", type: "GOAL", text: "GOAL! Jamal Musiala dances past two defenders and scores!" },
            { minute: "71'", team: "RMA", type: "GOAL", text: "GOAL! Jude Bellingham sweeps home from 10 yards — Bernabeu erupts!" }
          ]
        },
        {
          id: "fb-liv-che",
          league: "EPL",
          leagueName: "Premier League",
          venue: "Anfield, Liverpool",
          status: "LIVE",
          minute: 38,
          clock: "38'",
          home: {
            name: "Liverpool",
            abbr: "LIV",
            color: "#be123c",
            accent: "#fde047",
            score: 1,
            yellowCards: 0,
            redCards: 0,
            scorers: ["Salah 14'"]
          },
          away: {
            name: "Chelsea",
            abbr: "CHE",
            color: "#1d4ed8",
            accent: "#ffffff",
            score: 0,
            yellowCards: 1,
            redCards: 0,
            scorers: []
          },
          stats: {
            possession: [57, 43],
            shotsOnTarget: [4, 2],
            xg: [1.12, 0.48]
          },
          latestEvent: "35' Palmer's free kick clips the outside of the Liverpool post",
          events: [
            { minute: "14'", team: "LIV", type: "GOAL", text: "GOAL! Mohamed Salah curls into the far corner from the right channel." },
            { minute: "35'", team: "CHE", type: "CHANCE", text: "Woodwork! Cole Palmer strikes the post from 24 yards." }
          ]
        },
        {
          id: "fb-bar-atm",
          league: "LALIGA",
          leagueName: "La Liga",
          venue: "Estadi Olimpic, Barcelona",
          status: "HT",
          minute: 45,
          clock: "HT",
          home: {
            name: "Barcelona",
            abbr: "BAR",
            color: "#1e3a8a",
            accent: "#dc2626",
            score: 1,
            yellowCards: 1,
            redCards: 0,
            scorers: ["Yamal 29'"]
          },
          away: {
            name: "Atletico",
            abbr: "ATM",
            color: "#991b1b",
            accent: "#f8fafc",
            score: 1,
            yellowCards: 2,
            redCards: 0,
            scorers: ["Alvarez 44'"]
          },
          stats: {
            possession: [64, 36],
            shotsOnTarget: [5, 2],
            xg: [1.31, 0.72]
          },
          latestEvent: "HT: Alvarez equalized right before the whistle after Lamine Yamal's opener",
          events: [
            { minute: "29'", team: "BAR", type: "GOAL", text: "GOAL! Lamine Yamal bends an unstoppable strike inside the far post." },
            { minute: "44'", team: "ATM", type: "GOAL", text: "GOAL! Julian Alvarez punishes a loose backpass right before halftime." }
          ]
        },
        {
          id: "fb-int-mil",
          league: "SERIEA",
          leagueName: "Serie A",
          venue: "San Siro, Milan",
          status: "FT",
          minute: 90,
          clock: "FT",
          home: {
            name: "Inter Milan",
            abbr: "INT",
            color: "#1d4ed8",
            accent: "#0f172a",
            score: 3,
            yellowCards: 2,
            redCards: 0,
            scorers: ["Martinez 12', 78'", "Barella 52'"]
          },
          away: {
            name: "AC Milan",
            abbr: "MIL",
            color: "#991b1b",
            accent: "#111827",
            score: 1,
            yellowCards: 3,
            redCards: 1,
            scorers: ["Leao 34'"]
          },
          stats: {
            possession: [53, 47],
            shotsOnTarget: [8, 3],
            xg: [2.42, 0.96]
          },
          latestEvent: "FT: Lautaro Martinez brace seals Derby della Madonnina victory",
          events: [
            { minute: "12'", team: "INT", type: "GOAL", text: "GOAL! Lautaro Martinez heads in Dimarco's pinpoint cross." },
            { minute: "34'", team: "MIL", type: "GOAL", text: "GOAL! Rafael Leao races down the left and beats Sommer." },
            { minute: "52'", team: "INT", type: "GOAL", text: "GOAL! Nicolo Barella drives a half-volley from 22 yards." },
            { minute: "69'", team: "MIL", type: "RED", text: "RED CARD! Hernandez receives a second yellow for dissent." },
            { minute: "78'", team: "INT", type: "GOAL", text: "GOAL! Lautaro Martinez seals all three points with a neat finish." }
          ]
        },
        {
          id: "fb-psg-ars",
          league: "UCL",
          leagueName: "Champions League",
          venue: "Parc des Princes, Paris",
          status: "PRE",
          minute: 0,
          clock: "20:00",
          home: {
            name: "PSG",
            abbr: "PSG",
            color: "#0f172a",
            accent: "#ef4444",
            score: 0,
            yellowCards: 0,
            redCards: 0,
            scorers: []
          },
          away: {
            name: "Juventus",
            abbr: "JUV",
            color: "#1e293b",
            accent: "#f8fafc",
            score: 0,
            yellowCards: 0,
            redCards: 0,
            scorers: []
          },
          stats: {
            possession: [50, 50],
            shotsOnTarget: [0, 0],
            xg: [0, 0]
          },
          latestEvent: "Lineups confirmed — Kickoff under the lights at Parc des Princes",
          events: []
        }
      ],

      cricket: [
        {
          id: "cr-ind-aus",
          format: "T20I",
          series: "3rd T20I • Melbourne Cricket Ground",
          status: "LIVE",
          clock: "LIVE",
          equation: "IND need 28 runs in 15 balls",
          crr: "10.51",
          rrr: "11.20",
          target: 212,
          partnership: "46 (21)",
          team1: {
            name: "Australia",
            abbr: "AUS",
            color: "#ca8a04",
            accent: "#166534",
            runs: 211,
            wickets: 5,
            overs: "20.0",
            isBatting: false
          },
          team2: {
            name: "India",
            abbr: "IND",
            color: "#0284c7",
            accent: "#f97316",
            runs: 184,
            wickets: 4,
            overs: "17.3",
            ballsInOver: 3,
            totalOvers: 17,
            isBatting: true
          },
          batters: [
            { name: "Suryakumar Yadav", runs: 68, balls: 34, fours: 6, sixes: 4, sr: "200.0", striker: true },
            { name: "Hardik Pandya", runs: 24, balls: 11, fours: 2, sixes: 2, sr: "218.2", striker: false }
          ],
          bowler: {
            name: "Pat Cummins",
            overs: "3.3",
            maidens: 0,
            runs: 39,
            wickets: 2,
            econ: "11.14"
          },
          recentBalls: ["1", "4", "6", "W", "0", "2", "1", "4"],
          lastBallNote: "17.3: Cummins to Suryakumar, 4 runs! Whipped over backward square leg.",
          inningsCards: [
            {
              period: 1,
              batTeamName: "Australia",
              bowlTeamName: "India",
              title: "Australia — 211/5 (20.0 ov)",
              batters: [
                { order: 1, name: "Travis Head", batted: true, notOut: false, dismissal: "c Pant b Arshdeep", runs: 54, balls: 27, fours: 7, sixes: 3, sr: "200.0" },
                { order: 2, name: "Mitchell Marsh", captain: true, batted: true, notOut: false, dismissal: "b Bumrah", runs: 31, balls: 20, fours: 3, sixes: 2, sr: "155.0" },
                { order: 3, name: "Glenn Maxwell", batted: true, notOut: false, dismissal: "c Yadav b Kuldeep", runs: 62, balls: 33, fours: 5, sixes: 4, sr: "187.9" },
                { order: 4, name: "Josh Inglis", keeper: true, batted: true, notOut: true, dismissal: "not out", runs: 38, balls: 22, fours: 4, sixes: 1, sr: "172.7" }
              ],
              bowlers: [
                { name: "Jasprit Bumrah", overs: "4.0", maidens: 0, runs: 28, wickets: 2, econ: "7.00", avg: "14.00", wides: 1, noballs: 0 },
                { name: "Arshdeep Singh", overs: "4.0", maidens: 0, runs: 42, wickets: 2, econ: "10.50", avg: "21.00", wides: 2, noballs: 0 },
                { name: "Kuldeep Yadav", overs: "4.0", maidens: 0, runs: 39, wickets: 1, econ: "9.75", avg: "39.00", wides: 0, noballs: 0 }
              ]
            },
            {
              period: 2,
              batTeamName: "India",
              bowlTeamName: "Australia",
              title: "India — 184/4 (17.3 ov)",
              batters: [
                { order: 1, name: "Abhishek Sharma", batted: true, notOut: false, dismissal: "c Inglis b Hazlewood", runs: 26, balls: 14, fours: 4, sixes: 1, sr: "185.7" },
                { order: 2, name: "Sanju Samson", batted: true, notOut: false, dismissal: "b Starc", runs: 34, balls: 19, fours: 3, sixes: 2, sr: "178.9" },
                { order: 3, name: "Suryakumar Yadav", captain: true, batted: true, notOut: true, dismissal: "not out", runs: 68, balls: 34, fours: 6, sixes: 4, sr: "200.0" },
                { order: 4, name: "Tilak Varma", batted: true, notOut: false, dismissal: "c Head b Zampa", runs: 19, balls: 16, fours: 2, sixes: 0, sr: "118.8" },
                { order: 5, name: "Hardik Pandya", batted: true, notOut: true, dismissal: "not out", runs: 24, balls: 11, fours: 2, sixes: 2, sr: "218.2" },
                { order: 6, name: "Rishabh Pant", keeper: true, batted: false, notOut: false, dismissal: "Yet to bat" },
                { order: 7, name: "Axar Patel", batted: false, notOut: false, dismissal: "Yet to bat" }
              ],
              bowlers: [
                { name: "Pat Cummins", overs: "3.3", maidens: 0, runs: 39, wickets: 2, econ: "11.14", avg: "19.50", wides: 1, noballs: 0, isActive: true },
                { name: "Mitchell Starc", overs: "4.0", maidens: 0, runs: 41, wickets: 1, econ: "10.25", avg: "41.00", wides: 2, noballs: 1 },
                { name: "Adam Zampa", overs: "4.0", maidens: 0, runs: 36, wickets: 1, econ: "9.00", avg: "36.00", wides: 0, noballs: 0 }
              ]
            }
          ]
        },
        {
          id: "cr-eng-rsa",
          format: "TEST",
          series: "2nd Test • Day 2 • Lord's",
          status: "LIVE",
          clock: "DAY 2 • SESS 2",
          equation: "RSA trail by 84 runs with 4 wickets remaining",
          crr: "3.48",
          rrr: null,
          target: null,
          partnership: "58 (94)",
          team1: {
            name: "England",
            abbr: "ENG",
            color: "#1e3a8a",
            accent: "#ef4444",
            runs: 342,
            wickets: 10,
            overs: "86.4",
            isBatting: false
          },
          team2: {
            name: "South Africa",
            abbr: "RSA",
            color: "#15803d",
            accent: "#facc15",
            runs: 258,
            wickets: 6,
            overs: "74.1",
            ballsInOver: 1,
            totalOvers: 74,
            isBatting: true
          },
          batters: [
            { name: "Temba Bavuma", runs: 76, balls: 121, fours: 9, sixes: 0, sr: "62.8", striker: true },
            { name: "Marco Jansen", runs: 29, balls: 42, fours: 4, sixes: 1, sr: "69.0", striker: false }
          ],
          bowler: {
            name: "Gus Atkinson",
            overs: "16.1",
            maidens: 3,
            runs: 54,
            wickets: 3,
            econ: "3.34"
          },
          recentBalls: ["0", "0", "4", "0", "1", "0", "0"],
          lastBallNote: "74.1: Atkinson beats the outside edge — crisp seam movement off the slope."
        },
        {
          id: "cr-nzl-pak",
          format: "ODI",
          series: "1st ODI • Eden Park, Auckland",
          status: "FT",
          clock: "FINAL",
          equation: "New Zealand won by 4 wickets (11 balls remaining)",
          crr: "6.14",
          rrr: null,
          target: 292,
          partnership: "41* (28)",
          team1: {
            name: "Pakistan",
            abbr: "PAK",
            color: "#166534",
            accent: "#bbf7d0",
            runs: 291,
            wickets: 8,
            overs: "50.0",
            isBatting: false
          },
          team2: {
            name: "New Zealand",
            abbr: "NZL",
            color: "#111827",
            accent: "#94a3b8",
            runs: 295,
            wickets: 6,
            overs: "48.1",
            ballsInOver: 1,
            totalOvers: 48,
            isBatting: false
          },
          batters: [
            { name: "Daryl Mitchell", runs: 88, balls: 79, fours: 7, sixes: 2, sr: "111.4", striker: true },
            { name: "Mitchell Santner", runs: 19, balls: 12, fours: 2, sixes: 1, sr: "158.3", striker: false }
          ],
          bowler: {
            name: "Shaheen Afridi",
            overs: "9.1",
            maidens: 0,
            runs: 58,
            wickets: 2,
            econ: "6.32"
          },
          recentBalls: ["1", "2", "0", "4", "1", "4"],
          lastBallNote: "48.1: Mitchell drives through extra cover for four to seal the chase!"
        }
      ],

      f1: {
        id: "f1-gp",
        grandPrix: "LAS VEGAS GRAND PRIX",
        circuit: "Las Vegas Strip Circuit • Night Race",
        session: "RACE",
        lap: 37,
        totalLaps: 50,
        trackStatus: "GREEN",
        weather: {
          airTemp: "16°C",
          trackTemp: "19°C",
          wind: "11 km/h NW"
        },
        fastestLapOwner: "NOR",
        fastestLapTime: "1:33.418",
        drivers: [
          { pos: 1, delta: 0, code: "VER", name: "Max Verstappen", team: "Red Bull", color: "#3671C6", gap: "LEADER", lastLap: "1:33.912", tyre: "H", tyreAge: 14, pits: 1 },
          { pos: 2, delta: 1, code: "NOR", name: "Lando Norris", team: "McLaren", color: "#FF8000", gap: "+1.842", lastLap: "1:33.418", tyre: "M", tyreAge: 9, pits: 1 },
          { pos: 3, delta: -1, code: "LEC", name: "Charles Leclerc", team: "Ferrari", color: "#E8002D", gap: "+4.115", lastLap: "1:34.104", tyre: "H", tyreAge: 16, pits: 1 },
          { pos: 4, delta: 2, code: "HAM", name: "Lewis Hamilton", team: "Ferrari", color: "#E8002D", gap: "+6.590", lastLap: "1:33.890", tyre: "M", tyreAge: 11, pits: 1 },
          { pos: 5, delta: 0, code: "RUS", name: "George Russell", team: "Mercedes", color: "#27F4D2", gap: "+9.204", lastLap: "1:34.255", tyre: "H", tyreAge: 18, pits: 1 },
          { pos: 6, delta: -2, code: "PIA", name: "Oscar Piastri", team: "McLaren", color: "#FF8000", gap: "+11.773", lastLap: "1:34.340", tyre: "H", tyreAge: 15, pits: 1 },
          { pos: 7, delta: 1, code: "ANT", name: "Kimi Antonelli", team: "Mercedes", color: "#27F4D2", gap: "+15.482", lastLap: "1:34.510", tyre: "M", tyreAge: 12, pits: 1 },
          { pos: 8, delta: -1, code: "SAI", name: "Carlos Sainz", team: "Williams", color: "#64C4FF", gap: "+18.904", lastLap: "1:34.881", tyre: "H", tyreAge: 19, pits: 1 },
          { pos: 9, delta: 2, code: "ALO", name: "Fernando Alonso", team: "Aston Martin", color: "#229971", gap: "+23.112", lastLap: "1:34.990", tyre: "M", tyreAge: 8, pits: 2 },
          { pos: 10, delta: 0, code: "GAS", name: "Pierre Gasly", team: "Alpine", color: "#FF87BC", gap: "+26.840", lastLap: "1:35.204", tyre: "H", tyreAge: 21, pits: 1 }
        ],
        raceControlNotes: [
          "Lap 35: NOR sets purple overall fastest lap (1:33.418) closing gap to VER under 2 seconds",
          "Lap 33: HAM overtakes RUS into Turn 14 braking zone with DRS",
          "Lap 28: Pit window complete for top 8 runners; clean track conditions"
        ]
      },

      ticker: [
        {
          id: "tk-1",
          sport: "football",
          tag: "GOAL",
          time: "61'",
          targetType: "football",
          targetId: "fb-ars-mci",
          text: "Arsenal 2-1 Man City — Martin Odegaard volleys into top corner at the Emirates!"
        },
        {
          id: "tk-2",
          sport: "cricket",
          tag: "CHALLENGE",
          time: "17.3 ov",
          targetType: "cricket",
          targetId: "cr-ind-aus",
          text: "IND 184/4 vs AUS (211/5) — Suryakumar Yadav 68* (34); India need 28 off 15 balls at the MCG."
        },
        {
          id: "tk-3",
          sport: "f1",
          tag: "FASTEST LAP",
          time: "LAP 37/50",
          targetType: "f1",
          targetId: "f1-gp",
          text: "Las Vegas GP — Lando Norris sets 1:33.418 (Purple) and closes within 1.84s of Max Verstappen."
        },
        {
          id: "tk-4",
          sport: "football",
          tag: "UCL THRILLER",
          time: "71'",
          targetType: "football",
          targetId: "fb-rma-fcb",
          text: "Real Madrid 2-2 Bayern Munich — Jude Bellingham finishes Mbappé's cutback to equalize at the Bernabeu!"
        },
        {
          id: "tk-5",
          sport: "cricket",
          tag: "TEST MATCH",
          time: "74.1 ov",
          targetType: "cricket",
          targetId: "cr-eng-rsa",
          text: "ENG 342 vs RSA 258/6 — Temba Bavuma 76* anchors South Africa's reply at Lord's."
        },
        {
          id: "tk-6",
          sport: "f1",
          tag: "OVERTAKE",
          time: "LAP 33",
          targetType: "f1",
          targetId: "f1-gp",
          text: "Lewis Hamilton dives inside George Russell into Turn 14 for P4 on fresh Medium tyres."
        },
        {
          id: "tk-7",
          sport: "football",
          tag: "EPL LIVE",
          time: "38'",
          targetType: "football",
          targetId: "fb-liv-che",
          text: "Liverpool 1-0 Chelsea — Salah's early opener stands after Palmer rattles the Anfield post."
        }
      ]
    };
  }

  Apex.mockData = {
    createInitialState
  };
})(window);
