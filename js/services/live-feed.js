/* ==========================================================================
   Live Feed Service — Deep Multi-Sport Live Data Integration
   - Football: ESPN Scoreboards (EPL, UCL, La Liga, Serie A, Bundesliga, Global)
               + Match Summary enrichment (Stats, Timeline, Commentary) + News
   - Cricket:  Optional CricAPI key, ESPNcricinfo JSON, ESPNcricinfo Live RSS,
               ESPN Cricket Scoreboard + News
   - Formula 1: OpenF1 Latest Session Telemetry (Positions, Gaps, Laps, Tyres,
                Race Control, Weather) + ESPN F1 + Jolpica-F1 fallback + News
   ========================================================================== */

(function (root) {
  "use strict";

  const Apex = (root.ApexSports = root.ApexSports || {});

  const SOCCER_LEAGUES = [
    { code: "uefa.nations", key: "UNL", name: "UEFA Nations League" },
    { code: "uefa.champions", key: "UCL", name: "Champions League" },
    { code: "uefa.europa", key: "UEL", name: "Europa League" },
    { code: "eng.1", key: "EPL", name: "Premier League" },
    { code: "esp.1", key: "LALIGA", name: "La Liga" },
    { code: "ita.1", key: "SERIEA", name: "Serie A" },
    { code: "ger.1", key: "BUNDESLIGA", name: "Bundesliga" },
    { code: "fifa.worldq.uefa", key: "WCQ", name: "WC Qualifiers UEFA" },
    { code: "fifa.worldq.conmebol", key: "WCQ", name: "WC Qualifiers CONMEBOL" },
    { code: "fifa.friendly", key: "INTL", name: "International Friendly" },
    { code: "concacaf.nations", key: "INTL", name: "CONCACAF Nations League" }
  ];

  const TEAM_COLORS = {
    ARS: ["#b91c1c", "#f8fafc"],
    MCI: ["#0284c7", "#bae6fd"],
    LIV: ["#be123c", "#fde047"],
    CHE: ["#1d4ed8", "#ffffff"],
    MUN: ["#b91c1c", "#facc15"],
    TOT: ["#1e293b", "#f8fafc"],
    NEW: ["#0f172a", "#f8fafc"],
    AVL: ["#7c2d12", "#7dd3fc"],
    RMA: ["#334155", "#f59e0b"],
    BAR: ["#1e3a8a", "#dc2626"],
    ATM: ["#991b1b", "#f8fafc"],
    BAY: ["#dc2626", "#ffffff"],
    BVB: ["#ca8a04", "#0f172a"],
    PSG: ["#0f172a", "#ef4444"],
    INT: ["#1d4ed8", "#0f172a"],
    MIL: ["#991b1b", "#111827"],
    JUV: ["#1e293b", "#f8fafc"],
    IND: ["#0284c7", "#f97316"],
    AUS: ["#ca8a04", "#166534"],
    ENG: ["#1e3a8a", "#ef4444"],
    RSA: ["#15803d", "#facc15"],
    PAK: ["#166534", "#bbf7d0"],
    NZL: ["#111827", "#94a3b8"],
    SL: ["#1d4ed8", "#facc15"],
    WI: ["#7f1d1d", "#facc15"],
    BAN: ["#14532d", "#ef4444"],
    AFG: ["#1d4ed8", "#ef4444"],
    IRE: ["#15803d", "#f8fafc"],
    ZIM: ["#dc2626", "#facc15"],
    SCO: ["#1e3a8a", "#e2e8f0"],
    NED: ["#ea580c", "#1e3a8a"],
    NAM: ["#1d4ed8", "#dc2626"],
    NEP: ["#1e3a8a", "#dc2626"],
    UAE: ["#0f172a", "#dc2626"],
    USA: ["#1e3a8a", "#ef4444"],
    CAN: ["#dc2626", "#f8fafc"],
    OMN: ["#dc2626", "#16a34a"],
    CSK: ["#eab308", "#1d4ed8"],
    MI: ["#1d4ed8", "#facc15"],
    RCB: ["#b91c1c", "#facc15"],
    KKR: ["#581c87", "#facc15"],
    SRH: ["#ea580c", "#111827"],
    RR: ["#db2777", "#1d4ed8"],
    DC: ["#1d4ed8", "#dc2626"],
    PBKS: ["#dc2626", "#cbd5e1"],
    GT: ["#0f172a", "#ca8a04"],
    LSG: ["#0284c7", "#ea580c"]
  };

  let proxyAvailable = null;

  function isHttpOrigin() {
    return root.location && (root.location.protocol === "http:" || root.location.protocol === "https:");
  }

  async function checkLocalProxy() {
    if (!isHttpOrigin()) {
      proxyAvailable = false;
      return false;
    }
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 1800);
      const res = await fetch("/api/health", { signal: controller.signal, cache: "no-store" });
      clearTimeout(timer);
      proxyAvailable = res.ok;
      return proxyAvailable;
    } catch (_) {
      proxyAvailable = false;
      return false;
    }
  }

  async function fetchResource(proxyPath, directUrl, mode) {
    const useProxy = proxyAvailable === true && Boolean(proxyPath);
    const urls = useProxy ? [proxyPath] : [directUrl];
    let lastError = null;

    for (const url of urls) {
      if (!url) continue;
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 7000);
        const res = await fetch(url, { signal: controller.signal, cache: "no-store" });
        clearTimeout(timer);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return mode === "text" ? await res.text() : await res.json();
      } catch (err) {
        lastError = err;
      }
    }
    throw lastError || new Error("Request failed");
  }

  function mapStatus(statusObj) {
    const type = (statusObj && statusObj.type) || {};
    const state = type.state;
    const name = type.name || "";
    const shortDetail = type.shortDetail || type.description || "";
    if (name === "STATUS_HALFTIME" || shortDetail === "HT") return { status: "HT", clock: "HT" };
    if (state === "in") {
      return {
        status: "LIVE",
        clock: (statusObj && statusObj.displayClock) || shortDetail || "LIVE"
      };
    }
    if (state === "post") return { status: "FT", clock: shortDetail || "FT" };
    return { status: "PRE", clock: shortDetail || "UPCOMING" };
  }

  function formatKickoffClock(isoDate, fallbackClock) {
    if (!isoDate) return fallbackClock || "UPCOMING";
    const dt = new Date(isoDate);
    if (Number.isNaN(dt.getTime())) return fallbackClock || "UPCOMING";
    return dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
  }

  function formatPreviousDateLabel(isoDate, baseBadge) {
    const label = baseBadge || "FT";
    if (!isoDate) return label;
    const dt = new Date(isoDate);
    if (Number.isNaN(dt.getTime())) return label;
    const now = new Date();
    const sameDay =
      dt.getFullYear() === now.getFullYear() &&
      dt.getMonth() === now.getMonth() &&
      dt.getDate() === now.getDate();
    if (sameDay) return label;
    const shortDate = dt.toLocaleDateString([], { month: "short", day: "numeric" });
    return `${label} • ${shortDate}`;
  }

  function getRecentUtcDateStrings(daysBack) {
    const list = [];
    const now = new Date();
    for (let d = 1; d <= daysBack; d += 1) {
      const target = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - d));
      const yyyy = target.getUTCFullYear();
      const mm = String(target.getUTCMonth() + 1).padStart(2, "0");
      const dd = String(target.getUTCDate()).padStart(2, "0");
      list.push(`${yyyy}${mm}${dd}`);
    }
    return list;
  }

  function extractStat(compObj, statName, fallback) {
    const list = Array.isArray(compObj && compObj.statistics) ? compObj.statistics : [];
    const match = list.find((s) => s && s.name === statName);
    if (!match) return fallback;
    const parsed = parseFloat(match.displayValue);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function inferSoccerLeague(ev, payload, defaultMeta) {
    if (defaultMeta.code !== "all") return defaultMeta;
    const rawLeague =
      (ev.league && (ev.league.name || ev.league.shortName || ev.league.abbreviation)) ||
      (ev.season && ev.season.displayName) ||
      (payload && Array.isArray(payload.leagues) && payload.leagues[0] && payload.leagues[0].name) ||
      "";
    const slug = String((ev.league && ev.league.slug) || (ev.season && ev.season.slug) || "").toLowerCase();
    const linkHref = String((ev.links && ev.links[0] && ev.links[0].href) || "").toLowerCase();
    const combined = `${rawLeague} ${slug} ${linkHref}`.toLowerCase();

    if (combined.includes("nations") && combined.includes("uefa")) {
      return { code: "uefa.nations", key: "UNL", name: rawLeague || "UEFA Nations League" };
    }
    if (combined.includes("champions")) {
      return { code: "uefa.champions", key: "UCL", name: rawLeague || "Champions League" };
    }
    if (combined.includes("europa")) {
      return { code: "uefa.europa", key: "UEL", name: rawLeague || "Europa League" };
    }
    if (combined.includes("friendly") || combined.includes("world") || combined.includes("concacaf") || combined.includes("nations")) {
      return { code: "all", key: "INTL", name: rawLeague || "International" };
    }
    if (combined.includes("premier league") || combined.includes("eng.1")) {
      return { code: "eng.1", key: "EPL", name: rawLeague || "Premier League" };
    }
    if (combined.includes("laliga") || combined.includes("la liga") || combined.includes("esp.1")) {
      return { code: "esp.1", key: "LALIGA", name: rawLeague || "La Liga" };
    }
    if (combined.includes("serie a") || combined.includes("ita.1")) {
      return { code: "ita.1", key: "SERIEA", name: rawLeague || "Serie A" };
    }
    if (combined.includes("bundesliga") || combined.includes("ger.1")) {
      return { code: "ger.1", key: "BUNDESLIGA", name: rawLeague || "Bundesliga" };
    }
    return { code: "all", key: "ALL", name: rawLeague || defaultMeta.name };
  }

  function parseSoccerEvents(payload, leagueMeta) {
    const events = Array.isArray(payload && payload.events) ? payload.events : [];
    return events.map((ev) => {
      const resolvedMeta = inferSoccerLeague(ev, payload, leagueMeta);
      const comp = (ev.competitions && ev.competitions[0]) || {};
      const competitors = Array.isArray(comp.competitors) ? comp.competitors : [];
      const homeObj = competitors.find((c) => c.homeAway === "home") || competitors[0] || {};
      const awayObj = competitors.find((c) => c.homeAway === "away") || competitors[1] || {};
      const homeTeam = homeObj.team || {};
      const awayTeam = awayObj.team || {};
      const homeAbbr = (homeTeam.abbreviation || "HOM").toUpperCase();
      const awayAbbr = (awayTeam.abbreviation || "AWY").toUpperCase();
      const mappedStatus = mapStatus(comp.status);

      const details = Array.isArray(comp.details) ? comp.details : [];
      const parsedEvents = details.map((d) => {
        const clock = (d.clock && d.clock.displayValue) || "";
        const athlete =
          (d.athletesInvolved && d.athletesInvolved[0] && d.athletesInvolved[0].displayName) || "Player";
        const isGoal = Boolean(d.scoringPlay);
        const type = isGoal ? "GOAL" : d.redCard ? "RED" : "CARD";
        const teamId = d.team && d.team.id;
        const teamAbbr = teamId === homeTeam.id ? homeAbbr : awayAbbr;
        return {
          minute: clock || "-",
          team: teamAbbr,
          type,
          text: `${isGoal ? "GOAL" : type === "RED" ? "RED CARD" : "BOOKING"}: ${athlete}${clock ? ` (${clock})` : ""}`
        };
      });

      const homeCardsYellow = parsedEvents.filter((x) => x.type === "CARD" && x.team === homeAbbr).length;
      const awayCardsYellow = parsedEvents.filter((x) => x.type === "CARD" && x.team === awayAbbr).length;
      const homeCardsRed = parsedEvents.filter((x) => x.type === "RED" && x.team === homeAbbr).length;
      const awayCardsRed = parsedEvents.filter((x) => x.type === "RED" && x.team === awayAbbr).length;

      const homePalette = TEAM_COLORS[homeAbbr] || ["#1e293b", "#10b981"];
      const awayPalette = TEAM_COLORS[awayAbbr] || ["#334155", "#38bdf8"];

      const homePoss = extractStat(homeObj, "possessionPct", 50);
      const awayPoss = extractStat(awayObj, "possessionPct", 100 - homePoss);
      const homeSot = extractStat(homeObj, "shotsOnTarget", 0);
      const awaySot = extractStat(awayObj, "shotsOnTarget", 0);
      const homeShots = extractStat(homeObj, "totalShots", 0);
      const awayShots = extractStat(awayObj, "totalShots", 0);

      const clockDisplay =
        mappedStatus.status === "PRE"
          ? formatKickoffClock(ev.date, mappedStatus.clock)
          : mappedStatus.status === "FT"
            ? formatPreviousDateLabel(ev.date, mappedStatus.clock)
            : mappedStatus.clock;

      return {
        id: `espn-fb-${ev.id}`,
        rawEventId: String(ev.id),
        eventTimestamp: ev.date ? Date.parse(ev.date) || 0 : 0,
        leagueCode: resolvedMeta.code,
        league: resolvedMeta.key,
        leagueName: resolvedMeta.name,
        venue: (comp.venue && comp.venue.fullName) || "Stadium",
        status: mappedStatus.status,
        minute: parseInt(mappedStatus.clock, 10) || 0,
        clock: clockDisplay,
        home: {
          name: homeTeam.shortDisplayName || homeTeam.displayName || homeAbbr,
          abbr: homeAbbr,
          logo: homeTeam.logo || "",
          color: homePalette[0],
          accent: homePalette[1],
          score: parseInt(homeObj.score, 10) || 0,
          yellowCards: homeCardsYellow,
          redCards: homeCardsRed,
          scorers: parsedEvents
            .filter((x) => x.type === "GOAL" && x.team === homeAbbr)
            .map((x) => x.text.replace(/^GOAL:\s*/, ""))
        },
        away: {
          name: awayTeam.shortDisplayName || awayTeam.displayName || awayAbbr,
          abbr: awayAbbr,
          logo: awayTeam.logo || "",
          color: awayPalette[0],
          accent: awayPalette[1],
          score: parseInt(awayObj.score, 10) || 0,
          yellowCards: awayCardsYellow,
          redCards: awayCardsRed,
          scorers: parsedEvents
            .filter((x) => x.type === "GOAL" && x.team === awayAbbr)
            .map((x) => x.text.replace(/^GOAL:\s*/, ""))
        },
        stats: {
          possession: [Math.round(homePoss), Math.round(awayPoss)],
          shotsOnTarget: [homeSot, awaySot],
          totalShots: [homeShots, awayShots],
          xg: [0, 0]
        },
        latestEvent:
          parsedEvents.length > 0
            ? parsedEvents[parsedEvents.length - 1].text
            : (comp.status && comp.status.type && comp.status.type.detail) ||
              (mappedStatus.status === "PRE" ? `Kickoff ${clockDisplay}` : "Live feed connected"),
        events: parsedEvents,
        commentary: [],
        lineups: null
      };
    });
  }

  async function fetchFootballMatchSummary(match) {
    if (!match || !match.rawEventId || !match.leagueCode) return null;
    try {
      const proxyPath = `/api/espn/soccer/${match.leagueCode}/summary?event=${encodeURIComponent(match.rawEventId)}`;
      const remoteUrl = `https://site.api.espn.com/apis/site/v2/sports/soccer/${match.leagueCode}/summary?event=${encodeURIComponent(match.rawEventId)}`;
      const data = await fetchResource(proxyPath, remoteUrl, "json");

      const headerComp = data && data.header && data.header.competitions && data.header.competitions[0];
      const boxTeams = (data && data.boxscore && data.boxscore.teams) || [];
      const findBoxStat = (teamIdx, name) => {
        const statsArr = (boxTeams[teamIdx] && boxTeams[teamIdx].statistics) || [];
        const found = statsArr.find((s) => s.name === name);
        return found ? parseFloat(found.displayValue) : null;
      };

      const poss0 = findBoxStat(0, "possessionPct");
      const poss1 = findBoxStat(1, "possessionPct");
      const sot0 = findBoxStat(0, "shotsOnTarget");
      const sot1 = findBoxStat(1, "shotsOnTarget");
      const corners0 = findBoxStat(0, "wonCorners");
      const corners1 = findBoxStat(1, "wonCorners");

      const keyEvents = Array.isArray(data && data.keyEvents) ? data.keyEvents : [];
      const goalMinutesById = new Map();
      const assistMinutesById = new Map();
      const subOutById = new Map();
      const subInById = new Map();

      const addMinuteEntry = (map, athleteId, val) => {
        if (!athleteId) return;
        const key = String(athleteId);
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(val);
      };

      const richEvents = keyEvents.map((ke) => {
        const clk = (ke.clock && ke.clock.displayValue) || "-";
        const teamName = (ke.team && ke.team.abbreviation) || (ke.team && ke.team.displayName) || "";
        const typeTxt = (ke.type && ke.type.text) || "EVENT";
        const typeKey = String((ke.type && ke.type.type) || typeTxt).toLowerCase();
        const parts = Array.isArray(ke.participants) ? ke.participants : [];

        if (ke.scoringPlay || typeKey.includes("goal")) {
          const scorerId = parts[0] && parts[0].athlete && parts[0].athlete.id;
          addMinuteEntry(goalMinutesById, scorerId, clk);
          if (parts.length > 1 && /assist/i.test(ke.text || "")) {
            const assisterId = parts[1] && parts[1].athlete && parts[1].athlete.id;
            addMinuteEntry(assistMinutesById, assisterId, clk);
          }
        } else if (typeKey.includes("substitution") && parts.length >= 2) {
          const inAth = parts[0] && parts[0].athlete;
          const outAth = parts[1] && parts[1].athlete;
          if (inAth && inAth.id) {
            subInById.set(String(inAth.id), {
              minute: clk,
              otherName: (outAth && (outAth.shortName || outAth.displayName)) || ""
            });
          }
          if (outAth && outAth.id) {
            subOutById.set(String(outAth.id), {
              minute: clk,
              otherName: (inAth && (inAth.shortName || inAth.displayName)) || ""
            });
          }
        }

        return {
          minute: clk,
          team: String(teamName).slice(0, 3).toUpperCase() || "-",
          type: typeTxt.toUpperCase().includes("GOAL")
            ? "GOAL"
            : typeTxt.toUpperCase().includes("RED")
            ? "RED"
            : typeKey.includes("substitution")
            ? "SUB"
            : "EVENT",
          text: ke.text || ke.shortText || typeTxt
        };
      });

      const commentaryRaw = Array.isArray(data && data.commentary) ? data.commentary : [];
      const commentary = commentaryRaw
        .slice(-12)
        .reverse()
        .map((c) => ({
          minute: (c.time && c.time.displayValue) || "-",
          text: c.text || ""
        }))
        .filter((c) => c.text);

      const getPlayerStat = (player, statName) => {
        const list = Array.isArray(player && player.stats) ? player.stats : [];
        const found = list.find((s) => s && s.name === statName);
        return found && Number.isFinite(Number(found.value)) ? Number(found.value) : 0;
      };

      const rostersRaw = Array.isArray(data && data.rosters) ? data.rosters : [];
      const orderedRosters = [...rostersRaw].sort((a, b) => {
        const rank = (r) => (r.homeAway === "home" ? 0 : r.homeAway === "away" ? 1 : 2);
        return rank(a) - rank(b);
      });

      const lineups = orderedRosters.length
        ? orderedRosters.map((r) => {
            const players = Array.isArray(r.roster) ? r.roster : [];
            const mappedPlayers = players.map((p) => {
              const ath = p.athlete || {};
              const athId = ath.id ? String(ath.id) : "";
              const fullName = ath.displayName || ath.fullName || "Player";
              const shortName = ath.shortName || fullName;
              const goalMins = goalMinutesById.get(athId) || [];
              const assistMins = assistMinutesById.get(athId) || [];
              const subInInfo = subInById.get(athId) || null;
              const subOutInfo = subOutById.get(athId) || null;
              const goals = Math.max(getPlayerStat(p, "totalGoals"), goalMins.length);
              const assists = Math.max(getPlayerStat(p, "goalAssists"), assistMins.length);

              return {
                id: athId,
                name: fullName,
                shortName,
                jersey: p.jersey ? String(p.jersey) : "",
                pos: (p.position && (p.position.abbreviation || p.position.displayName)) || "",
                formationPlace: parseInt(p.formationPlace, 10) || 99,
                starter: Boolean(p.starter),
                subbedIn: Boolean(p.subbedIn || getPlayerStat(p, "subIns") > 0 || subInInfo),
                subbedOut: Boolean(p.subbedOut || subOutInfo),
                subInMinute: subInInfo ? subInInfo.minute : "",
                subOutMinute: subOutInfo ? subOutInfo.minute : "",
                swappedWith: subInInfo ? subInInfo.otherName : subOutInfo ? subOutInfo.otherName : "",
                goals,
                assists,
                goalMinutes: goalMins,
                assistMinutes: assistMins,
                ownGoals: getPlayerStat(p, "ownGoals"),
                yellowCards: getPlayerStat(p, "yellowCards"),
                redCards: getPlayerStat(p, "redCards")
              };
            });

            const startingXI = mappedPlayers
              .filter((p) => p.starter)
              .sort((a, b) => a.formationPlace - b.formationPlace);
            const substitutes = mappedPlayers
              .filter((p) => !p.starter)
              .sort((a, b) => {
                if (a.subbedIn !== b.subbedIn) return a.subbedIn ? -1 : 1;
                return (parseInt(a.jersey, 10) || 99) - (parseInt(b.jersey, 10) || 99);
              });

            return {
              team: (r.team && (r.team.shortDisplayName || r.team.displayName)) || "Team",
              abbr: (r.team && r.team.abbreviation) || "",
              formation: r.formation || "",
              startingXI,
              substitutes,
              starters: startingXI.map((p) => p.name)
            };
          })
        : null;

      return {
        possession: poss0 !== null && poss1 !== null ? [Math.round(poss0), Math.round(poss1)] : null,
        shotsOnTarget: sot0 !== null && sot1 !== null ? [sot0, sot1] : null,
        corners: corners0 !== null && corners1 !== null ? [corners0, corners1] : null,
        events: richEvents.length ? richEvents : null,
        commentary,
        lineups,
        venue: (data && data.gameInfo && data.gameInfo.venue && data.gameInfo.venue.fullName) ||
          (headerComp && headerComp.venue && headerComp.venue.fullName) || null
      };
    } catch (_) {
      return null;
    }
  }

  const INTL_MENS_ABBR_MAP = {
    "india": "IND",
    "australia": "AUS",
    "england": "ENG",
    "south africa": "RSA",
    "new zealand": "NZL",
    "pakistan": "PAK",
    "sri lanka": "SL",
    "west indies": "WI",
    "bangladesh": "BAN",
    "afghanistan": "AFG",
    "ireland": "IRE",
    "zimbabwe": "ZIM",
    "scotland": "SCO",
    "netherlands": "NED",
    "namibia": "NAM",
    "nepal": "NEP",
    "oman": "OMN",
    "papua new guinea": "PNG",
    "united arab emirates": "UAE",
    "u.a.e.": "UAE",
    "usa": "USA",
    "united states": "USA",
    "united states of america": "USA",
    "canada": "CAN",
    "hong kong": "HKG",
    "uganda": "UGA",
    "kenya": "KEN",
    "jersey": "JER",
    "italy": "ITA",
    "bermuda": "BER",
    "malaysia": "MAL",
    "singapore": "SGP",
    "kuwait": "KUW",
    "qatar": "QAT",
    "bahrain": "BAH",
    "saudi arabia": "KSA"
  };

  const IPL_ABBR_MAP = {
    "chennai super kings": "CSK",
    "mumbai indians": "MI",
    "royal challengers bengaluru": "RCB",
    "royal challengers bangalore": "RCB",
    "kolkata knight riders": "KKR",
    "sunrisers hyderabad": "SRH",
    "rajasthan royals": "RR",
    "delhi capitals": "DC",
    "punjab kings": "PBKS",
    "gujarat titans": "GT",
    "lucknow super giants": "LSG"
  };

  const CRICKET_EXCLUDED_RE = /\b(women|woman|womens|women's|wpl|wbbl|ladies|girls|under-?19|under\s+19|u-?19|u19|u-?23|u23|u-?17|youth|academy|emerging|legends|masters|over-?40|over-?50|over-?60|seniors|blind|deaf|first-class|list\s+a|sheffield\s+shield|county\s+championship|plunket|ranji|duleep|deodhar|vijay\s+hazare|syed\s+mushtaq|ford\s+trophy|vitality\s+blast|t20\s+blast|big\s+bash|bbl|psl|cpl|sa20|ilt20|bpl|lpl|mlc|the\s+hundred|abu\s+dhabi\s+t10|nepal\s+premier\s+league|max60|xi|invitational|presidents?\s+xi)\b/i;

  function deriveTeamAbbr(name, fallback) {
    const clean = String(name || "").trim();
    if (!clean) return fallback || "TM";
    const lower = clean.toLowerCase();
    if (INTL_MENS_ABBR_MAP[lower]) return INTL_MENS_ABBR_MAP[lower];
    if (IPL_ABBR_MAP[lower]) return IPL_ABBR_MAP[lower];
    const words = clean.split(/\s+/).filter(Boolean);
    if (words.length >= 2) {
      return words.map((w) => w[0]).join("").slice(0, 4).toUpperCase();
    }
    return clean.slice(0, 3).toUpperCase();
  }

  function isExcludedCricketParticipant(teamName, teamAbbr) {
    const n = String(teamName || "").trim();
    const a = String(teamAbbr || "").trim();
    if (CRICKET_EXCLUDED_RE.test(n)) return true;
    if (/\s+(?:A|B|XI|II)$/i.test(n)) return true;
    if (/(?:-(?:A|W|XI)|19)$/i.test(a)) return true;
    return false;
  }

  function isActiveIplWindow(status, dateIso, endDateIso) {
    if (status === "LIVE") return true;
    const startTs = dateIso ? Date.parse(dateIso) : NaN;
    const endTs = endDateIso ? Date.parse(endDateIso) : startTs;
    if (Number.isNaN(startTs)) return false;
    const now = Date.now();
    const DAY = 86400000;
    if (status === "PRE") {
      return startTs - now <= 14 * DAY && startTs - now >= -2 * DAY;
    }
    if (status === "FT") {
      return now - (Number.isNaN(endTs) ? startTs : endTs) <= 3 * DAY;
    }
    return false;
  }

  function isMensIntlOrIplMatch(info) {
    const metaText = `${info.leagueName || ""} ${info.series || ""} ${info.matchTitle || ""} ${info.format || ""}`;
    if (CRICKET_EXCLUDED_RE.test(metaText)) return false;
    if (isExcludedCricketParticipant(info.team1Name, info.team1Abbr)) return false;
    if (isExcludedCricketParticipant(info.team2Name, info.team2Abbr)) return false;

    const isIpl =
      String(info.leagueId || "") === "8048" ||
      /\bindian premier league\b/i.test(`${info.leagueName || ""} ${info.series || ""}`);
    if (isIpl) {
      return isActiveIplWindow(info.status, info.dateIso, info.endDateIso);
    }

    if (info.intlClassId !== undefined && info.intlClassId !== null && String(info.intlClassId).trim() !== "") {
      return ["1", "2", "3"].includes(String(info.intlClassId).trim());
    }

    const t1 = String(info.team1Name || "").trim().toLowerCase();
    const t2 = String(info.team2Name || "").trim().toLowerCase();
    return Boolean(INTL_MENS_ABBR_MAP[t1] && INTL_MENS_ABBR_MAP[t2]);
  }

  function oversToDecimal(ovStr) {
    const first = String(ovStr || "").split("/")[0].trim();
    if (!first || !/^\d+(?:\.\d+)?$/.test(first)) return 0;
    const parts = first.split(".");
    const whole = parseInt(parts[0], 10) || 0;
    const balls = parts[1] ? parseInt(parts[1].charAt(0), 10) || 0 : 0;
    return whole + balls / 6;
  }

  function computeCricketRates(runs, ovStr, format, target) {
    const dec = oversToDecimal(ovStr);
    const crr = dec > 0 && Number.isFinite(runs) && runs >= 0 ? (runs / dec).toFixed(2) : "-";
    let rrr = null;
    const fmt = String(format || "").toUpperCase();
    const maxOvers = fmt === "ODI" ? 50 : fmt === "T20I" || fmt === "IPL" || fmt === "T20" ? 20 : 0;
    if (target && maxOvers > 0 && dec > 0) {
      const ovToken = String(ovStr || "").split("/")[0].trim().split(".");
      const bowledBalls = (parseInt(ovToken[0], 10) || 0) * 6 + (ovToken[1] ? parseInt(ovToken[1].charAt(0), 10) || 0 : 0);
      const remBalls = maxOvers * 6 - bowledBalls;
      if (remBalls > 0 && target > runs) {
        rrr = (((target - runs) / remBalls) * 6).toFixed(2);
      }
    }
    return { crr, rrr };
  }

  function splitEspnCricketScore(rawScore, status, linescores) {
    let text = String(rawScore || "").trim();
    let overs = "-";
    let target = null;
    let hasActiveOvers = false;

    const parenMatch = text.match(/\(([^)]*)\)\s*$/);
    if (parenMatch) {
      const inside = parenMatch[1];
      const ovMatch = inside.match(/(\d+(?:\.\d+)?(?:\/\d+)?)\s*ov\b/i);
      const targetMatch = inside.match(/target\s+(\d+)/i);
      if (ovMatch) {
        overs = ovMatch[1];
        hasActiveOvers = true;
      }
      if (targetMatch) {
        target = parseInt(targetMatch[1], 10);
      }
      if (ovMatch || targetMatch) {
        text = text.slice(0, parenMatch.index).trim();
      }
    }

    const lsArray = Array.isArray(linescores) ? linescores : [];
    const currentLs = lsArray.find((ls) => Number(ls.isCurrent) === 1 && ls.isBatting);
    const activeLs = currentLs || [...lsArray].reverse().find((ls) => ls.isBatting && Number(ls.runs) >= 0 && Number(ls.overs) > 0);
    if (activeLs && overs === "-" && activeLs.overs) {
      overs = String(activeLs.overs);
    }
    if (currentLs && currentLs.target && Number(currentLs.target) > 0) {
      target = Number(currentLs.target);
    }

    let lastRuns = 0;
    let lastWickets = 0;
    const inningsMatches = Array.from(text.matchAll(/(\d+)(?:\/(\d+))?/g));
    if (inningsMatches.length) {
      const last = inningsMatches[inningsMatches.length - 1];
      lastRuns = parseInt(last[1], 10) || 0;
      lastWickets = last[2] !== undefined ? parseInt(last[2], 10) : 10;
    } else if (activeLs) {
      lastRuns = Number(activeLs.runs) || 0;
      lastWickets = activeLs.wickets !== undefined ? Number(activeLs.wickets) : 0;
    }

    return {
      runs: lastRuns,
      wickets: lastWickets,
      scoreDisplay: text || (status === "PRE" ? "-" : "Yet to bat"),
      overs,
      target,
      hasActiveOvers,
      isCurrentBatting: Boolean(currentLs)
    };
  }

  function formatCricketClock(statusObj, sessionText, eventDateIso) {
    const type = (statusObj && statusObj.type) || {};
    const state = type.state;
    const desc = String(type.description || type.shortDetail || "").trim();
    const sess = String(sessionText || "").trim();

    if (state === "in") {
      if (sess && desc && desc.toLowerCase() !== "live") return `${sess} • ${desc}`;
      if (desc && desc.toLowerCase() !== "live") return desc.toUpperCase();
      return sess || "LIVE";
    }
    if (state === "post") {
      return formatPreviousDateLabel(eventDateIso, "FINAL");
    }
    if (eventDateIso) {
      const dt = new Date(eventDateIso);
      if (!Number.isNaN(dt.getTime())) {
        const diffMs = dt.getTime() - Date.now();
        const hm = dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
        if (Math.abs(diffMs) > 16 * 3600000) {
          const dayStr = dt.toLocaleDateString([], { month: "short", day: "numeric" });
          return `${dayStr} • ${hm}`;
        }
        return hm;
      }
    }
    return "UPCOMING";
  }

  function buildEspnCricketMatch(ev, leagueMeta) {
    const comp = (ev && ev.competitions && ev.competitions[0]) || {};
    const competitors = Array.isArray(comp.competitors) ? comp.competitors : [];
    if (competitors.length < 2) return null;

    const c1 = competitors[0] || {};
    const c2 = competitors[1] || {};
    const t1 = c1.team || {};
    const t2 = c2.team || {};
    const classObj = comp.class || {};

    const mapped = mapStatus(comp.status);
    const leagueId = String((leagueMeta && leagueMeta.id) || "");
    const leagueName = String((leagueMeta && leagueMeta.name) || ev.name || "International Cricket");
    const rawFormat = String(classObj.generalClassCard || classObj.eventType || "CRICKET").toUpperCase();
    const isIpl = leagueId === "8048" || /\bindian premier league\b/i.test(leagueName);
    const format = isIpl ? "IPL" : rawFormat;

    const name1 = t1.displayName || t1.shortDisplayName || t1.name || "Team 1";
    const name2 = t2.displayName || t2.shortDisplayName || t2.name || "Team 2";
    const abbr1 = String(t1.abbreviation || deriveTeamAbbr(name1, "T1")).toUpperCase();
    const abbr2 = String(t2.abbreviation || deriveTeamAbbr(name2, "T2")).toUpperCase();

    const allowed = isMensIntlOrIplMatch({
      leagueId,
      leagueName,
      series: ev.description || leagueName,
      matchTitle: ev.name || "",
      format,
      intlClassId: classObj.internationalClassId,
      team1Name: name1,
      team2Name: name2,
      team1Abbr: abbr1,
      team2Abbr: abbr2,
      status: mapped.status,
      dateIso: comp.date || ev.date,
      endDateIso: comp.endDate || ev.endDate
    });
    if (!allowed) return null;

    const s1 = splitEspnCricketScore(c1.score, mapped.status, c1.linescores);
    const s2 = splitEspnCricketScore(c2.score, mapped.status, c2.linescores);
    const battingTeamId = comp.status && comp.status.battingTeamId ? String(comp.status.battingTeamId) : "";

    let bat1 = Boolean(battingTeamId && t1.id && String(t1.id) === battingTeamId) || s1.isCurrentBatting;
    let bat2 = Boolean(battingTeamId && t2.id && String(t2.id) === battingTeamId) || s2.isCurrentBatting;
    if (mapped.status === "LIVE" && !bat1 && !bat2) {
      if (s1.hasActiveOvers && !s2.hasActiveOvers) bat1 = true;
      else if (s2.hasActiveOvers && !s1.hasActiveOvers) bat2 = true;
    }

    const activeSide = bat1 ? s1 : bat2 ? s2 : null;
    const rates = activeSide
      ? computeCricketRates(activeSide.runs, activeSide.overs, format, s1.target || s2.target)
      : { crr: "-", rrr: null };

    const pal1 = TEAM_COLORS[abbr1] || [t1.color ? `#${String(t1.color).replace(/^#/, "")}` : "#0284c7", "#facc15"];
    const pal2 = TEAM_COLORS[abbr2] || [t2.color ? `#${String(t2.color).replace(/^#/, "")}` : "#15803d", "#f8fafc"];

    const venueName =
      (comp.venue && (comp.venue.fullName || comp.venue.shortName || (comp.venue.address && comp.venue.address.city))) || "";
    const matchDesc = comp.description ? `${comp.description} • ` : "";
    const seriesText = `${matchDesc}${leagueName}${venueName ? ` • ${venueName}` : ""}`;

    const summaryLink =
      Array.isArray(ev.links) &&
      (ev.links.find((l) => Array.isArray(l.rel) && l.rel.includes("summary")) || ev.links[0]);

    const equation =
      (comp.status && (comp.status.summary || (comp.status.type && comp.status.type.detail))) ||
      ev.description ||
      "Scheduled fixture";

    return {
      id: `espn-cr-${ev.id}`,
      rawEventId: String(ev.id || ""),
      leagueId,
      eventTimestamp: comp.date || ev.date ? Date.parse(comp.date || ev.date) || 0 : 0,
      format,
      series: seriesText,
      venue: venueName,
      status: mapped.status,
      clock: formatCricketClock(comp.status, comp.status && comp.status.session, comp.date || ev.date),
      equation,
      crr: rates.crr,
      rrr: rates.rrr,
      target: s1.target || s2.target || null,
      partnership: "-",
      externalUrl: (summaryLink && summaryLink.href) || "",
      team1: {
        id: String(t1.id || ""),
        name: name1,
        abbr: abbr1,
        logo: (t1.logos && t1.logos[0] && t1.logos[0].href) || t1.logo || "",
        color: pal1[0],
        accent: pal1[1],
        runs: s1.runs,
        wickets: s1.wickets,
        scoreDisplay: s1.scoreDisplay,
        overs: s1.overs,
        isBatting: mapped.status === "LIVE" && bat1
      },
      team2: {
        id: String(t2.id || ""),
        name: name2,
        abbr: abbr2,
        logo: (t2.logos && t2.logos[0] && t2.logos[0].href) || t2.logo || "",
        color: pal2[0],
        accent: pal2[1],
        runs: s2.runs,
        wickets: s2.wickets,
        scoreDisplay: s2.scoreDisplay,
        overs: s2.overs,
        isBatting: mapped.status === "LIVE" && bat2
      },
      batters: [],
      bowler: null,
      recentBalls: [],
      recentNotes: [],
      lastBallNote: equation,
      isLiveFeed: true
    };
  }

  function parseEspnCricketScorepanel(payload) {
    const out = [];
    const seenLeagueIds = new Set();

    if (payload && Array.isArray(payload.scores)) {
      payload.scores.forEach((group) => {
        const lg = (group.leagues && group.leagues[0]) || {};
        if (lg.id) seenLeagueIds.add(String(lg.id));
        const evs = Array.isArray(group.events) ? group.events : [];
        evs.forEach((ev) => {
          const parsed = buildEspnCricketMatch(ev, lg);
          if (parsed) out.push(parsed);
        });
      });
    } else if (payload && Array.isArray(payload.events)) {
      const lg = (payload.leagues && payload.leagues[0]) || {};
      if (lg.id) seenLeagueIds.add(String(lg.id));
      payload.events.forEach((ev) => {
        const parsed = buildEspnCricketMatch(ev, lg);
        if (parsed) out.push(parsed);
      });
    }

    return { matches: out, seenLeagueIds };
  }

  function extractCandidateLeagueIdsFromHeader(headerPayload, seenLeagueIds) {
    const leagues =
      (headerPayload &&
        headerPayload.sports &&
        headerPayload.sports[0] &&
        Array.isArray(headerPayload.sports[0].leagues) &&
        headerPayload.sports[0].leagues) ||
      [];

    const candidateIds = [];
    leagues.forEach((lg) => {
      const id = String(lg.id || "");
      if (!id || (seenLeagueIds && seenLeagueIds.has(id))) return;
      const lgText = `${lg.name || ""} ${lg.abbreviation || ""}`;
      if (CRICKET_EXCLUDED_RE.test(lgText)) return;

      if (id === "8048") {
        candidateIds.push(id);
        return;
      }

      const events = Array.isArray(lg.events) ? lg.events : [];
      const hasIntlSignal = events.some((ev) => {
        const evName = `${ev.name || ""} ${ev.shortName || ""}`;
        if (CRICKET_EXCLUDED_RE.test(evName)) return false;
        const notes = Array.isArray(ev.notes) ? ev.notes : [];
        const hasClassNote = notes.some((n) => {
          const href = String(n.href || "");
          const txt = String(n.text || "");
          return /class=[123](?:&|$)/.test(href) || /^(?:Test|ODI|T20I)\s+no\./i.test(txt);
        });
        if (hasClassNote) return true;
        const parts = String(ev.name || "").split(/\s+v(?:s\.?)?\s+/i);
        return (
          parts.length === 2 &&
          INTL_MENS_ABBR_MAP[parts[0].trim().toLowerCase()] &&
          INTL_MENS_ABBR_MAP[parts[1].trim().toLowerCase()]
        );
      });

      if (hasIntlSignal) candidateIds.push(id);
    });

    return candidateIds.slice(0, 6);
  }

  function cleanCricketEntityText(str) {
    return String(str || "")
      .replace(/&dagger;/gi, "†")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim();
  }

  function extractCricketPlayerStatMap(lsObj) {
    const map = {};
    const cats =
      (lsObj && lsObj.statistics && Array.isArray(lsObj.statistics.categories) && lsObj.statistics.categories) || [];
    cats.forEach((cat) => {
      (cat.stats || []).forEach((st) => {
        if (st && st.name) {
          map[st.name] = {
            value: Number(st.value),
            displayValue: st.displayValue !== undefined ? String(st.displayValue) : ""
          };
        }
      });
    });
    return map;
  }

  function buildCricketInningsAndSquads(sum, match) {
    const rosters = Array.isArray(sum && sum.rosters) ? sum.rosters : [];
    const squads = Array.isArray(sum && sum.squads) ? sum.squads : [];
    const cards = Array.isArray(sum && sum.matchcards) ? sum.matchcards : [];
    const compComps =
      (sum && sum.header && sum.header.competitions && sum.header.competitions[0] && sum.header.competitions[0].competitors) ||
      [];

    // Map squad role metadata (keeper/captain) & matchcard batting order hints
    const keeperIds = new Set();
    const captainIds = new Set();
    const squadByTeamId = new Map();
    squads.forEach((sq) => {
      const tid = sq.team && sq.team.id ? String(sq.team.id) : "";
      const athList = Array.isArray(sq.athletes) ? sq.athletes : [];
      if (tid) squadByTeamId.set(tid, athList);
      athList.forEach((a) => {
        if (a && a.id) {
          if (a.keeper) keeperIds.add(String(a.id));
          if (a.captain) captainIds.add(String(a.id));
        }
      });
    });

    const cardOrderByPlayerName = new Map();
    cards.forEach((mc) => {
      if (String(mc.headline || "").toLowerCase() === "batting" && Array.isArray(mc.playerDetails)) {
        mc.playerDetails.forEach((pd, idx) => {
          const key = `${String(mc.teamName || "").toLowerCase()}:${String(pd.playerName || "").toLowerCase()}`;
          if (!cardOrderByPlayerName.has(key)) cardOrderByPlayerName.set(key, idx + 1);
        });
      }
    });

    const inningsMap = new Map();
    const teamSummaries = [];

    if (rosters.length) {
      // Build ordered team squads with aggregated batting & bowling summaries
      rosters.forEach((r, rIdx) => {
        const tm = r.team || {};
        const teamId = String(tm.id || "");
        const teamName = tm.displayName || tm.name || (rIdx === 0 ? match.team1.name : match.team2.name);
        const teamAbbr = (tm.abbreviation || deriveTeamAbbr(teamName, "TM")).toUpperCase();
        const players = Array.isArray(r.roster) ? r.roster : [];

        const playerSummaries = players.map((p, pIdx) => {
          const ath = p.athlete || {};
          const athId = String(ath.id || "");
          const name = ath.displayName || ath.battingName || ath.name || "Player";
          const role = (ath.position && ath.position.name) || (p.position && p.position.name) || "";
          const isCaptain = Boolean(p.captain || captainIds.has(athId));
          const isKeeper = keeperIds.has(athId) || /keeper/i.test(role);

          let bestBatPos = 999;
          const inningsBatParts = [];
          let bowlOversDec = 0;
          let bowlRuns = 0;
          let bowlMaidens = 0;
          let bowlWkts = 0;
          let bowlBallsTotal = 0;
          let inningsBowledCount = 0;

          (p.linescores || []).forEach((ls) => {
            const st = extractCricketPlayerStatMap(ls);
            const bPos = st.battingPosition && st.battingPosition.value;
            if (bPos > 0 && bPos < bestBatPos) bestBatPos = bPos;
            const batted = (st.batted && st.batted.value === 1) || Boolean(ls.statistics && ls.statistics.batting);
            if (batted) {
              const rVal = st.runs ? st.runs.value : 0;
              const bVal = st.ballsFaced ? st.ballsFaced.value : 0;
              const notOut = st.notouts && st.notouts.value === 1;
              inningsBatParts.push(`${rVal}${notOut ? "*" : ""} (${bVal}b)`);
            }
            const ovStr = st.overs && st.overs.displayValue;
            const ovDec = oversToDecimal(ovStr);
            if (ovDec > 0 || (st.inningsBowled && st.inningsBowled.value === 1)) {
              inningsBowledCount += 1;
              bowlOversDec += ovDec;
              const bOv = String(ovStr || "0").split(".");
              bowlBallsTotal += (parseInt(bOv[0], 10) || 0) * 6 + (bOv[1] ? parseInt(bOv[1].charAt(0), 10) || 0 : 0);
              bowlRuns += st.conceded && Number.isFinite(st.conceded.value) ? st.conceded.value : 0;
              bowlMaidens += st.maidens && Number.isFinite(st.maidens.value) ? st.maidens.value : 0;
              bowlWkts += st.wickets && Number.isFinite(st.wickets.value) ? st.wickets.value : 0;
            }
          });

          if (bestBatPos === 999) {
            const cardPos = cardOrderByPlayerName.get(`${teamName.toLowerCase()}:${name.toLowerCase()}`);
            bestBatPos = cardPos || 100 + pIdx;
          }

          const totalOversStr =
            bowlBallsTotal > 0 ? `${Math.floor(bowlBallsTotal / 6)}${bowlBallsTotal % 6 ? `.${bowlBallsTotal % 6}` : ".0"}` : "";
          const totalEcon = bowlOversDec > 0 ? (bowlRuns / bowlOversDec).toFixed(2) : "-";
          const totalBowlAvg = bowlWkts > 0 ? (bowlRuns / bowlWkts).toFixed(2) : "-";

          return {
            id: athId,
            name,
            role: role && role !== "Unknown" ? role : "",
            captain: isCaptain,
            keeper: isKeeper,
            batOrder: bestBatPos,
            rosterIdx: pIdx,
            batSummary: inningsBatParts.length ? inningsBatParts.join(" & ") : "Yet to bat",
            bowled: inningsBowledCount > 0 || bowlBallsTotal > 0,
            bowlSummary:
              inningsBowledCount > 0 || bowlBallsTotal > 0
                ? `${bowlWkts}/${bowlRuns} (${totalOversStr} ov) • Econ ${totalEcon} • Avg ${totalBowlAvg}`
                : "",
            bowlStats:
              inningsBowledCount > 0 || bowlBallsTotal > 0
                ? {
                    overs: totalOversStr,
                    maidens: bowlMaidens,
                    runs: bowlRuns,
                    wickets: bowlWkts,
                    econ: totalEcon,
                    avg: totalBowlAvg
                  }
                : null
          };
        });

        const sortedXI = [...playerSummaries].sort((a, b) => a.batOrder - b.batOrder || a.rosterIdx - b.rosterIdx);
        const xiIds = new Set(sortedXI.map((x) => x.id).filter(Boolean));
        const sqAthletes = squadByTeamId.get(teamId) || [];
        const bench = sqAthletes
          .filter((a) => a && a.id && !xiIds.has(String(a.id)))
          .map((a) => ({
            id: String(a.id),
            name: a.displayName || a.name || "Player",
            role: (a.position && a.position.name) || "",
            captain: Boolean(a.captain),
            keeper: Boolean(a.keeper)
          }));

        teamSummaries.push({
          teamId,
          teamName,
          teamAbbr,
          playingXI: sortedXI,
          bench
        });
      });
    } else if (squads.length) {
      squads.forEach((sq) => {
        const tm = sq.team || {};
        const athList = Array.isArray(sq.athletes) ? sq.athletes : [];
        if (!athList.length) return;
        teamSummaries.push({
          teamId: String(tm.id || ""),
          teamName: tm.displayName || tm.name || "Team",
          teamAbbr: (tm.abbreviation || deriveTeamAbbr(tm.name, "TM")).toUpperCase(),
          playingXI: athList.map((a, idx) => ({
            id: String(a.id || idx),
            name: a.displayName || a.name || "Player",
            role: (a.position && a.position.name) || "",
            captain: Boolean(a.captain),
            keeper: Boolean(a.keeper),
            batOrder: idx + 1,
            batSummary: "Squad announced",
            bowled: false,
            bowlSummary: ""
          })),
          bench: []
        });
      });
    }

    if (rosters.length) {
      // Map player order once across both teams for innings periods
      const periodsSet = new Set();
      rosters.forEach((r) => {
        (r.roster || []).forEach((p) => {
          (p.linescores || []).forEach((ls) => {
            if (ls && ls.period) periodsSet.add(Number(ls.period));
          });
        });
      });
      const periods = Array.from(periodsSet).sort((a, b) => a - b);

      const bestBatOrderById = new Map();
      teamSummaries.forEach((ts) => {
        ts.playingXI.forEach((pl, idx) => {
          if (pl.id) bestBatOrderById.set(pl.id, idx + 1);
        });
      });

      // Build complete per-innings batting & bowling cards
      periods.forEach((period) => {
        let batRosterIdx = -1;
        rosters.forEach((r, rIdx) => {
          const hasBatted = (r.roster || []).some((p) => {
            const ls = (p.linescores || []).find((x) => Number(x.period) === period);
            if (!ls) return false;
            const st = extractCricketPlayerStatMap(ls);
            return (st.batted && st.batted.value === 1) || Boolean(ls.statistics && ls.statistics.batting);
          });
          if (hasBatted) batRosterIdx = rIdx;
        });

        if (batRosterIdx === -1) return;
        const bowlRosterIdx = batRosterIdx === 0 ? 1 : 0;
        const batTeam = rosters[batRosterIdx];
        const bowlTeam = rosters[bowlRosterIdx];
        const batTeamName =
          (batTeam.team && (batTeam.team.displayName || batTeam.team.name)) || `Team ${batRosterIdx + 1}`;
        const bowlTeamName =
          (bowlTeam && bowlTeam.team && (bowlTeam.team.displayName || bowlTeam.team.name)) || "Bowling Team";

        const headerCompObj =
          compComps.find((c) => c.team && batTeam.team && String(c.team.id) === String(batTeam.team.id)) || null;
        const headerLs =
          headerCompObj && Array.isArray(headerCompObj.linescores)
            ? headerCompObj.linescores.find((l) => Number(l.period) === period)
            : null;
        const innScoreStr = headerLs
          ? `${headerLs.score || `${headerLs.runs ?? 0}/${headerLs.wickets ?? 0}`}${headerLs.overs ? ` (${headerLs.overs} ov)` : ""}`
          : "";

        const battersList = (batTeam.roster || [])
          .map((p, idx) => {
            const ath = p.athlete || {};
            const athId = String(ath.id || "");
            const ls = (p.linescores || []).find((x) => Number(x.period) === period) || {};
            const st = extractCricketPlayerStatMap(ls);
            const batted = (st.batted && st.batted.value === 1) || Boolean(ls.statistics && ls.statistics.batting);
            const posInInn = st.battingPosition && st.battingPosition.value;
            const order = posInInn > 0 ? posInInn : 100 + (bestBatOrderById.get(athId) || idx + 1);
            const runs = batted && st.runs ? st.runs.value : 0;
            const balls = batted && st.ballsFaced ? st.ballsFaced.value : 0;
            const fours = batted && st.fours ? st.fours.value : 0;
            const sixes = batted && st.sixes ? st.sixes.value : 0;
            const sr = batted
              ? (st.strikeRate && st.strikeRate.displayValue) || (balls > 0 ? ((runs / balls) * 100).toFixed(1) : "0.0")
              : "-";
            const outShort =
              ls.statistics && ls.statistics.batting && ls.statistics.batting.outDetails && ls.statistics.batting.outDetails.shortText
                ? cleanCricketEntityText(ls.statistics.batting.outDetails.shortText)
                : "";
            const notOut = batted && ((st.notouts && st.notouts.value === 1) || !outShort);
            const activeRole = p.active ? p.activeName || "batting" : "";

            return {
              order,
              name: ath.displayName || ath.battingName || "Batter",
              captain: Boolean(p.captain || captainIds.has(athId)),
              keeper: keeperIds.has(athId),
              batted,
              notOut,
              activeRole,
              dismissal: batted ? (outShort || "not out") : "Yet to bat",
              runs,
              balls,
              fours,
              sixes,
              sr
            };
          })
          .sort((a, b) => a.order - b.order);

        const bowlersList =
          bowlTeam && Array.isArray(bowlTeam.roster)
            ? bowlTeam.roster
                .map((p, idx) => {
                  const ath = p.athlete || {};
                  const ls = (p.linescores || []).find((x) => Number(x.period) === period) || {};
                  const st = extractCricketPlayerStatMap(ls);
                  const ovStr = st.overs ? st.overs.displayValue : "";
                  const ovDec = oversToDecimal(ovStr);
                  const bowled = ovDec > 0 || (st.inningsBowled && st.inningsBowled.value === 1);
                  if (!bowled) return null;
                  const runsConceded = st.conceded && Number.isFinite(st.conceded.value) ? st.conceded.value : 0;
                  const wkts = st.wickets && Number.isFinite(st.wickets.value) ? st.wickets.value : 0;
                  const maidens = st.maidens && Number.isFinite(st.maidens.value) ? st.maidens.value : 0;
                  const econVal =
                    (st.economyRate && st.economyRate.displayValue && st.economyRate.displayValue !== "-"
                      ? st.economyRate.displayValue
                      : null) || (ovDec > 0 ? (runsConceded / ovDec).toFixed(2) : "-");
                  const avgVal = wkts > 0 ? (runsConceded / wkts).toFixed(2) : "-";
                  const pos = st.bowlingPosition && st.bowlingPosition.value ? st.bowlingPosition.value : 50 + idx;

                  return {
                    order: pos,
                    name: ath.displayName || ath.fieldingName || "Bowler",
                    overs: ovStr || "0",
                    maidens,
                    runs: runsConceded,
                    wickets: wkts,
                    econ: String(econVal),
                    avg: avgVal,
                    dots: st.dots && Number.isFinite(st.dots.value) ? st.dots.value : 0,
                    wides: st.wides && Number.isFinite(st.wides.value) ? st.wides.value : 0,
                    noballs: st.noballs && Number.isFinite(st.noballs.value) ? st.noballs.value : 0,
                    isActive: /\.[1-5]$/.test(String(ovStr || ""))
                  };
                })
                .filter(Boolean)
                .sort((a, b) => a.order - b.order)
            : [];

        inningsMap.set(period, {
          period,
          batTeamName,
          bowlTeamName,
          scoreText: innScoreStr,
          title: `${batTeamName}${innScoreStr ? ` — ${innScoreStr}` : ""}`,
          batters: battersList,
          bowlers: bowlersList
        });
      });
    }

    const inningsCards = Array.from(inningsMap.values()).sort((a, b) => a.period - b.period);

    // Fallback to matchcards if rosters were empty
    if (!inningsCards.length && cards.length) {
      const cardPeriods = Array.from(new Set(cards.map((c) => Number(c.inningsNumber || 1)))).sort((a, b) => a - b);
      cardPeriods.forEach((pNum) => {
        const bCard = cards.find((c) => String(c.headline || "").toLowerCase() === "batting" && Number(c.inningsNumber) === pNum);
        const wCard = cards.find((c) => String(c.headline || "").toLowerCase() === "bowling" && Number(c.inningsNumber) === pNum);
        if (!bCard && !wCard) return;
        const battersList = ((bCard && bCard.playerDetails) || []).map((p, idx) => {
          const batted = p.runs !== "" && p.runs !== undefined;
          const r = parseInt(p.runs, 10) || 0;
          const b = parseInt(p.ballsFaced, 10) || 0;
          const dis = cleanCricketEntityText(p.dismissal || "");
          return {
            order: idx + 1,
            name: p.playerName || "Batter",
            batted,
            notOut: batted && (!dis || /not out/i.test(dis)),
            dismissal: batted ? dis || "not out" : "Yet to bat",
            runs: r,
            balls: b,
            fours: parseInt(p.fours, 10) || 0,
            sixes: parseInt(p.sixes, 10) || 0,
            sr: batted && b > 0 ? ((r / b) * 100).toFixed(1) : "-"
          };
        });
        const bowlersList = ((wCard && wCard.playerDetails) || []).map((bw, idx) => {
          const runs = parseInt(bw.conceded, 10) || 0;
          const wkts = parseInt(bw.wickets, 10) || 0;
          return {
            order: idx + 1,
            name: bw.playerName || "Bowler",
            overs: String(bw.overs || "0"),
            maidens: parseInt(bw.maidens, 10) || 0,
            runs,
            wickets: wkts,
            econ: bw.economyRate ? Number(bw.economyRate).toFixed(2) : "-",
            avg: wkts > 0 ? (runs / wkts).toFixed(2) : "-"
          };
        });
        inningsCards.push({
          period: pNum,
          batTeamName: (bCard && bCard.teamName) || "Batting",
          bowlTeamName: (wCard && wCard.teamName) || "Bowling",
          scoreText: "",
          title: `${(bCard && bCard.teamName) || "Innings"} (Inn ${pNum})`,
          batters: battersList,
          bowlers: bowlersList
        });
      });
    }

    return { inningsCards, teamSummaries };
  }

  async function fetchCricketMatchSummary(match) {
    if (!match || !match.leagueId || !match.rawEventId) return null;
    try {
      const sum = await fetchResource(
        `/api/cricket/espn-summary/${match.leagueId}?event=${match.rawEventId}`,
        `https://site.web.api.espn.com/apis/site/v2/sports/cricket/${match.leagueId}/summary?contentorigin=espn&event=${match.rawEventId}&lang=en&region=in`,
        "json"
      );

      const comp = sum && sum.header && sum.header.competitions && sum.header.competitions[0];
      if (comp) {
        const mapped = mapStatus(comp.status);
        match.status = mapped.status;
        match.clock = formatCricketClock(comp.status, comp.status && comp.status.session, comp.date);
        if (comp.status && comp.status.summary) match.equation = comp.status.summary;

        const comps = Array.isArray(comp.competitors) ? comp.competitors : [];
        const batTeamId = comp.status && comp.status.battingTeamId ? String(comp.status.battingTeamId) : "";
        [match.team1, match.team2].forEach((teamObj, idx) => {
          const cObj = comps.find((c) => c.team && String(c.team.id) === String(teamObj.id)) || comps[idx];
          if (!cObj) return;
          const parsed = splitEspnCricketScore(cObj.score, mapped.status, cObj.linescores);
          teamObj.runs = parsed.runs;
          teamObj.wickets = parsed.wickets;
          teamObj.scoreDisplay = parsed.scoreDisplay;
          if (parsed.overs && parsed.overs !== "-") teamObj.overs = parsed.overs;
          if (parsed.target && !match.target) match.target = parsed.target;
          teamObj.isBatting =
            mapped.status === "LIVE" &&
            (Boolean(batTeamId && String(teamObj.id) === batTeamId) || parsed.isCurrentBatting);
        });

        const battingTeam = match.team1.isBatting ? match.team1 : match.team2.isBatting ? match.team2 : null;
        if (battingTeam) {
          const rates = computeCricketRates(battingTeam.runs, battingTeam.overs, match.format, match.target);
          match.crr = rates.crr;
          match.rrr = rates.rrr;
        }
      }

      if (sum && sum.gameInfo && sum.gameInfo.venue && sum.gameInfo.venue.fullName) {
        const vCity = sum.gameInfo.venue.address && sum.gameInfo.venue.address.city;
        match.venue = vCity ? `${sum.gameInfo.venue.fullName}, ${vCity}` : sum.gameInfo.venue.fullName;
      }

      const structured = buildCricketInningsAndSquads(sum, match);
      if (structured.inningsCards.length) {
        match.inningsCards = structured.inningsCards;
        const latestInn = structured.inningsCards[structured.inningsCards.length - 1];
        const battedInLatest = latestInn.batters.filter((b) => b.batted);
        const notOutInLatest = battedInLatest.filter((b) => b.notOut);
        const heroBatters = (notOutInLatest.length ? notOutInLatest : battedInLatest.slice(-2)).slice(0, 2);
        if (heroBatters.length) {
          match.batters = heroBatters.map((b, idx) => ({
            name: b.name,
            runs: b.runs,
            balls: b.balls,
            fours: b.fours,
            sixes: b.sixes,
            sr: b.sr,
            striker: b.activeRole ? b.activeRole === "striker" : idx === 0
          }));
        }
        if (latestInn.bowlers.length) {
          const activeBw = latestInn.bowlers.find((bw) => bw.isActive) || latestInn.bowlers[latestInn.bowlers.length - 1];
          match.bowler = activeBw;
        }
      }
      if (structured.teamSummaries.length) {
        match.squads = structured.teamSummaries;
      }

      const rawNotes = Array.isArray(sum && sum.notes) ? sum.notes : [];
      const matchNotes = rawNotes
        .filter((n) => n && n.type === "matchnote" && n.text)
        .slice(-5)
        .reverse()
        .map((n) => cleanCricketEntityText(n.text));
      const preNotes = rawNotes
        .filter((n) => n && (n.type === "toss" || n.type === "hoursofplay" || n.type === "matchdays") && n.text)
        .map((n) => cleanCricketEntityText(n.text));

      match.recentNotes = matchNotes.length ? matchNotes : preNotes;
      if (match.recentNotes.length) {
        match.lastBallNote = match.recentNotes[0];
      }
      match._summaryEnriched = true;
      return match;
    } catch (_) {
      return null;
    }
  }

  function parseCricinfoMatches(payload) {
    const matches =
      (payload && payload.content && Array.isArray(payload.content.matches) && payload.content.matches) ||
      (payload &&
        payload.props &&
        payload.props.pageProps &&
        payload.props.pageProps.data &&
        payload.props.pageProps.data.content &&
        Array.isArray(payload.props.pageProps.data.content.matches) &&
        payload.props.pageProps.data.content.matches) ||
      (Array.isArray(payload && payload.matches) && payload.matches) ||
      [];

    return matches
      .map((m) => {
        const teams = Array.isArray(m.teams) ? m.teams : [];
        const t1 = teams[0] || {};
        const t2 = teams[1] || {};
        const tm1 = t1.team || {};
        const tm2 = t2.team || {};
        const name1 = tm1.longName || tm1.name || "Team 1";
        const name2 = tm2.longName || tm2.name || "Team 2";
        const abbr1 = (tm1.abbreviation || deriveTeamAbbr(name1, "T1")).toUpperCase();
        const abbr2 = (tm2.abbreviation || deriveTeamAbbr(name2, "T2")).toUpperCase();
        const rawState = String(m.state || m.stage || "").toUpperCase();
        const status = rawState === "LIVE" ? "LIVE" : rawState === "POST" || rawState === "RESULT" ? "FT" : "PRE";
        const seriesName = (m.series && (m.series.longName || m.series.name)) || m.title || "International Cricket";
        const format = String(m.format || m.matchType || "CRICKET").toUpperCase();

        if (
          !isMensIntlOrIplMatch({
            leagueId: m.series && m.series.objectId,
            leagueName: seriesName,
            series: seriesName,
            matchTitle: m.title || "",
            format,
            intlClassId: m.internationalNumber ? (format === "TEST" ? "1" : format === "ODI" ? "2" : "3") : "",
            team1Name: name1,
            team2Name: name2,
            team1Abbr: abbr1,
            team2Abbr: abbr2,
            status,
            dateIso: m.startDate || m.startTime
          })
        ) {
          return null;
        }

        const score1Str = String(t1.score || "").trim();
        const score2Str = String(t2.score || "").trim();
        const num1 = score1Str.match(/(\d+)(?:\/(\d+))?/);
        const num2 = score2Str.match(/(\d+)(?:\/(\d+))?/);
        const pal1 = TEAM_COLORS[abbr1] || ["#0284c7", "#facc15"];
        const pal2 = TEAM_COLORS[abbr2] || ["#15803d", "#f8fafc"];
        const eqText =
          m.statusText ||
          (m.scoreInfo && (m.scoreInfo.current || m.scoreInfo.reason || m.scoreInfo.status)) ||
          m.status ||
          "Live match update";

        return {
          id: `ci-cr-${m.objectId || m.id}`,
          format,
          series: seriesName,
          status,
          clock: m.status || (status === "LIVE" ? "LIVE" : status),
          equation: eqText,
          crr: "-",
          rrr: null,
          target: null,
          partnership: "-",
          externalUrl:
            m.slug && m.series && m.series.slug && m.series.objectId && m.objectId
              ? `https://www.espncricinfo.com/series/${m.series.slug}-${m.series.objectId}/${m.slug}-${m.objectId}/live-cricket-score`
              : "",
          team1: {
            name: name1,
            abbr: abbr1,
            color: pal1[0],
            accent: pal1[1],
            runs: num1 ? parseInt(num1[1], 10) : 0,
            wickets: num1 && num1[2] !== undefined ? parseInt(num1[2], 10) : 0,
            scoreDisplay: score1Str || (status === "PRE" ? "-" : "Yet to bat"),
            overs: t1.scoreInfo ? String(t1.scoreInfo).replace(/,?\s*T:\d+.*$/i, "").trim() : "-",
            isBatting: Boolean(t1.isLive)
          },
          team2: {
            name: name2,
            abbr: abbr2,
            color: pal2[0],
            accent: pal2[1],
            runs: num2 ? parseInt(num2[1], 10) : 0,
            wickets: num2 && num2[2] !== undefined ? parseInt(num2[2], 10) : 0,
            scoreDisplay: score2Str || (status === "PRE" ? "-" : "Yet to bat"),
            overs: t2.scoreInfo ? String(t2.scoreInfo).replace(/,?\s*T:\d+.*$/i, "").trim() : "-",
            isBatting: Boolean(t2.isLive)
          },
          batters: [],
          bowler: null,
          recentBalls: [],
          lastBallNote: eqText,
          isLiveFeed: true
        };
      })
      .filter(Boolean)
      .slice(0, 12);
  }

  function parseCricapiMatches(payload) {
    const data = Array.isArray(payload && payload.data) ? payload.data : [];
    return data
      .map((m) => {
        const info1 = (m.teamInfo && m.teamInfo[0]) || {};
        const info2 = (m.teamInfo && m.teamInfo[1]) || {};
        const sc1 = (m.score && m.score[0]) || {};
        const sc2 = (m.score && m.score[1]) || {};
        const name1 = info1.name || (m.teams && m.teams[0]) || "Team 1";
        const name2 = info2.name || (m.teams && m.teams[1]) || "Team 2";
        const abbr1 = (info1.shortname || deriveTeamAbbr(name1, "T1")).toUpperCase();
        const abbr2 = (info2.shortname || deriveTeamAbbr(name2, "T2")).toUpperCase();
        const status = m.matchStarted && !m.matchEnded ? "LIVE" : m.matchEnded ? "FT" : "PRE";
        const format = String(m.matchType || "CRICKET").toUpperCase();
        const series = m.name || m.venue || "Live Cricket";

        if (
          !isMensIntlOrIplMatch({
            leagueName: series,
            series,
            matchTitle: m.name || "",
            format,
            team1Name: name1,
            team2Name: name2,
            team1Abbr: abbr1,
            team2Abbr: abbr2,
            status,
            dateIso: m.dateTimeGMT || m.date
          })
        ) {
          return null;
        }

        const pal1 = TEAM_COLORS[abbr1] || ["#0284c7", "#facc15"];
        const pal2 = TEAM_COLORS[abbr2] || ["#15803d", "#f8fafc"];

        return {
          id: `ca-cr-${m.id}`,
          format,
          series,
          status,
          clock: status === "LIVE" ? "LIVE" : status === "FT" ? "FINAL" : "UPCOMING",
          equation: m.status || "Live score active",
          crr: "-",
          rrr: null,
          target: null,
          partnership: "-",
          team1: {
            name: name1,
            abbr: abbr1,
            logo: info1.img || "",
            color: pal1[0],
            accent: pal1[1],
            runs: sc1.r !== undefined ? sc1.r : 0,
            wickets: sc1.w !== undefined ? sc1.w : 0,
            scoreDisplay: sc1.r !== undefined ? `${sc1.r}/${sc1.w ?? 0}` : status === "PRE" ? "-" : "Yet to bat",
            overs: sc1.o !== undefined ? String(sc1.o) : "-",
            isBatting: status === "LIVE" && !sc2.r
          },
          team2: {
            name: name2,
            abbr: abbr2,
            logo: info2.img || "",
            color: pal2[0],
            accent: pal2[1],
            runs: sc2.r !== undefined ? sc2.r : 0,
            wickets: sc2.w !== undefined ? sc2.w : 0,
            scoreDisplay: sc2.r !== undefined ? `${sc2.r}/${sc2.w ?? 0}` : status === "PRE" ? "-" : "Yet to bat",
            overs: sc2.o !== undefined ? String(sc2.o) : "-",
            isBatting: status === "LIVE" && Boolean(sc2.r)
          },
          batters: [],
          bowler: null,
          recentBalls: [],
          lastBallNote: m.status || m.venue || "",
          isLiveFeed: true
        };
      })
      .filter(Boolean)
      .slice(0, 12);
  }

  function stripXmlHtml(str) {
    return String(str || "")
      .replace(/<[^>]+>/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, " ")
      .trim();
  }

  function parseCricketRss(xmlText) {
    if (!xmlText || typeof DOMParser === "undefined") return [];
    const doc = new DOMParser().parseFromString(xmlText, "text/xml");
    const items = Array.from(doc.querySelectorAll("item"));
    const parsed = items
      .map((item, idx) => {
        const titleRaw = stripXmlHtml(item.querySelector("title") && item.querySelector("title").textContent);
        const descRaw = stripXmlHtml(item.querySelector("description") && item.querySelector("description").textContent);
        const link = ((item.querySelector("link") && item.querySelector("link").textContent) || "").trim();

        const scoreLine =
          /\s+v(?:s\.?)?\s+/i.test(descRaw) && /\d/.test(descRaw)
            ? descRaw
            : titleRaw || descRaw || "";

        if (!/\s+v(?:s\.?)?\s+/i.test(scoreLine)) return null;
        const sides = scoreLine.split(/\s+v(?:s\.?)?\s+/i);
        if (sides.length < 2) return null;

        const parseSide = (raw, fallbackAbbr) => {
          const str = String(raw || "").trim();
          const isBatting = str.includes("*");
          let clean = str.replace(/\*/g, "").trim();

          let overs = "-";
          const ovMatch = clean.match(/\(([^)]*(?:ov|overs)[^)]*)\)/i);
          if (ovMatch) {
            overs = ovMatch[1].replace(/\s*overs?/i, "").trim();
            clean = clean.replace(ovMatch[0], "").trim();
          }

          const scoreStart = clean.search(/\s+\d+(?:\/\d+)?(?:\s*[d&]\s*\d+(?:\/\d+)?)*\s*$/);
          let nameOnly = clean;
          let scoreDisplay = "";

          if (scoreStart !== -1) {
            nameOnly = clean.slice(0, scoreStart).trim();
            scoreDisplay = clean.slice(scoreStart).trim();
          } else {
            const firstDigit = clean.search(/\s+\d/);
            if (firstDigit > 0) {
              nameOnly = clean.slice(0, firstDigit).trim();
              scoreDisplay = clean.slice(firstDigit).replace(/,.*$/, "").trim();
            } else {
              nameOnly = clean.replace(/,.*$/, "").trim();
            }
          }

          nameOnly = nameOnly.replace(/^[\d\w]+:\s*/, "").trim() || fallbackAbbr;
          const abbr = deriveTeamAbbr(nameOnly, fallbackAbbr);
          const pal = TEAM_COLORS[abbr] || ["#0284c7", "#f8fafc"];
          const firstScoreNums = scoreDisplay.match(/(\d+)(?:\/(\d+))?/);

          return {
            name: nameOnly,
            abbr,
            color: pal[0],
            accent: pal[1],
            runs: firstScoreNums ? parseInt(firstScoreNums[1], 10) : 0,
            wickets: firstScoreNums && firstScoreNums[2] !== undefined ? parseInt(firstScoreNums[2], 10) : 0,
            scoreDisplay,
            overs,
            isBatting
          };
        };

        const t1 = parseSide(sides[0], "TM1");
        const t2 = parseSide(sides[1], "TM2");
        const anyScore = Boolean(t1.scoreDisplay || t2.scoreDisplay);
        const isLive = scoreLine.includes("*") || /\d+\/\d+/.test(scoreLine) || /\bov\b/i.test(scoreLine);
        const status = isLive ? "LIVE" : "PRE";

        if (
          !isMensIntlOrIplMatch({
            leagueName: titleRaw,
            series: titleRaw,
            matchTitle: scoreLine,
            format: "",
            team1Name: t1.name,
            team2Name: t2.name,
            team1Abbr: t1.abbr,
            team2Abbr: t2.abbr,
            status
          })
        ) {
          return null;
        }

        if (!t1.scoreDisplay) t1.scoreDisplay = anyScore ? "Yet to bat" : "-";
        if (!t2.scoreDisplay) t2.scoreDisplay = anyScore ? "Yet to bat" : "-";
        const isIpl = Boolean(IPL_ABBR_MAP[t1.name.toLowerCase()] || IPL_ABBR_MAP[t2.name.toLowerCase()]);

        return {
          id: `rss-cr-${idx}-${t1.abbr}-${t2.abbr}`,
          format: isIpl ? "IPL" : isLive ? "INTL" : "FIXTURE",
          series: isIpl ? "Indian Premier League" : "Men's International Cricket",
          status,
          clock: isLive ? "LIVE" : "SCHEDULED",
          equation: descRaw && descRaw !== titleRaw ? descRaw : scoreLine,
          crr: "-",
          rrr: null,
          target: null,
          partnership: "-",
          externalUrl: link,
          team1: t1,
          team2: t2,
          batters: [],
          bowler: null,
          recentBalls: [],
          lastBallNote: scoreLine,
          isLiveFeed: true
        };
      })
      .filter(Boolean);

    return parsed.sort((a, b) => (a.status === "LIVE" ? 0 : 1) - (b.status === "LIVE" ? 0 : 1));
  }

  function formatSecondsToLap(sec) {
    const n = Number(sec);
    if (!Number.isFinite(n) || n <= 0) return "-";
    const mins = Math.floor(n / 60);
    const rem = (n % 60).toFixed(3).padStart(6, "0");
    return `${mins}:${rem}`;
  }

  async function fetchOpenF1Snapshot() {
    const [sessionsRes, driversRes, positionsRes, stintsRes, rcRes, weatherRes] = await Promise.allSettled([
      fetchResource("/api/openf1/sessions", "https://api.openf1.org/v1/sessions?session_key=latest", "json"),
      fetchResource("/api/openf1/drivers", "https://api.openf1.org/v1/drivers?session_key=latest", "json"),
      fetchResource("/api/openf1/position", "https://api.openf1.org/v1/position?session_key=latest", "json"),
      fetchResource("/api/openf1/stints", "https://api.openf1.org/v1/stints?session_key=latest", "json"),
      fetchResource("/api/openf1/race_control", "https://api.openf1.org/v1/race_control?session_key=latest", "json"),
      fetchResource("/api/openf1/weather", "https://api.openf1.org/v1/weather?session_key=latest", "json")
    ]);

    const sessions = sessionsRes.status === "fulfilled" && Array.isArray(sessionsRes.value) ? sessionsRes.value : [];
    const drivers = driversRes.status === "fulfilled" && Array.isArray(driversRes.value) ? driversRes.value : [];
    if (!sessions.length || !drivers.length) return null;

    const sess = sessions[sessions.length - 1];
    const positions = positionsRes.status === "fulfilled" && Array.isArray(positionsRes.value) ? positionsRes.value : [];
    const stints = stintsRes.status === "fulfilled" && Array.isArray(stintsRes.value) ? stintsRes.value : [];
    const rcList = rcRes.status === "fulfilled" && Array.isArray(rcRes.value) ? rcRes.value : [];
    const weatherList = weatherRes.status === "fulfilled" && Array.isArray(weatherRes.value) ? weatherRes.value : [];

    // Latest position per driver
    const latestPos = {};
    positions.forEach((p) => {
      latestPos[p.driver_number] = p.position;
    });

    // Latest stint per driver & max lap
    const latestStint = {};
    let maxLap = 1;
    stints.forEach((st) => {
      if (st.lap_end && st.lap_end > maxLap) maxLap = st.lap_end;
      const prev = latestStint[st.driver_number];
      if (!prev || (st.stint_number || 0) >= (prev.stint_number || 0)) {
        latestStint[st.driver_number] = st;
      }
    });

    // Fetch only the latest 2 laps from OpenF1 for fast lap timing
    let lapsList = [];
    try {
      const minLap = Math.max(1, maxLap - 1);
      lapsList = await fetchResource(
        `/api/openf1/laps?minLap=${minLap}`,
        `https://api.openf1.org/v1/laps?session_key=latest&lap_number%3E=${minLap}`,
        "json"
      );
    } catch (_) {
      lapsList = [];
    }

    const latestLapByDriver = {};
    let fastestLapOwner = "";
    let fastestLapSec = Infinity;

    if (Array.isArray(lapsList)) {
      lapsList.forEach((l) => {
        if (l.lap_number && l.lap_number > maxLap) maxLap = l.lap_number;
        if (l.lap_duration) {
          latestLapByDriver[l.driver_number] = l.lap_duration;
          if (l.lap_duration < fastestLapSec) {
            fastestLapSec = l.lap_duration;
            const drv = drivers.find((d) => d.driver_number === l.driver_number);
            if (drv) fastestLapOwner = drv.name_acronym || "";
          }
        }
      });
    }

    const mappedDrivers = drivers
      .map((d) => {
        const st = latestStint[d.driver_number] || {};
        const compRaw = String(st.compound || "M").toUpperCase();
        const tyreCode = compRaw.startsWith("S") ? "S" : compRaw.startsWith("H") ? "H" : compRaw.startsWith("I") ? "I" : compRaw.startsWith("W") ? "W" : "M";
        const stintAge = st.lap_end && st.lap_start ? Math.max(1, st.lap_end - st.lap_start + (st.tyre_age_at_start || 0)) : (st.tyre_age_at_start || 0);
        const pits = Math.max(0, (st.stint_number || 1) - 1);
        return {
          pos: latestPos[d.driver_number] || 99,
          delta: 0,
          code: (d.name_acronym || "DRV").toUpperCase(),
          name: d.full_name || d.broadcast_name || d.name_acronym || "Driver",
          team: d.team_name || "F1 Team",
          color: d.team_colour ? `#${d.team_colour}` : "#e11d48",
          gap: (latestPos[d.driver_number] || 99) === 1 ? "LEADER" : "-",
          lastLap: formatSecondsToLap(latestLapByDriver[d.driver_number]),
          tyre: tyreCode,
          tyreAge: stintAge,
          pits
        };
      })
      .sort((a, b) => a.pos - b.pos)
      .slice(0, 14);

    // Derive track flag from latest race control item
    let trackStatus = "GREEN";
    const recentRc = rcList.slice(-6).reverse();
    const flagItem = recentRc.find((r) => r.flag || r.category === "SafetyCar");
    if (flagItem) {
      const f = String(flagItem.flag || flagItem.message || "").toUpperCase();
      if (f.includes("RED")) trackStatus = "RED";
      else if (f.includes("VIRTUAL") || f.includes("VSC")) trackStatus = "VSC";
      else if (f.includes("SAFETY CAR")) trackStatus = "SC";
      else if (f.includes("YELLOW")) trackStatus = "YELLOW";
    }

    const latestW = weatherList.length ? weatherList[weatherList.length - 1] : null;
    const weather = latestW
      ? {
          airTemp: `${Math.round(latestW.air_temperature)}°C`,
          trackTemp: `${Math.round(latestW.track_temperature)}°C`,
          wind: `${Number(latestW.wind_speed || 0).toFixed(1)} m/s`
        }
      : { airTemp: "-", trackTemp: "-", wind: "-" };

    const rawSessName = String(sess.session_name || "SESSION").toUpperCase();
    const sessEndMs = sess.date_end ? Date.parse(sess.date_end) : NaN;
    const isPreviousResult = Number.isFinite(sessEndMs) && Date.now() > sessEndMs + 15 * 60000;

    return {
      id: `openf1-${sess.session_key}`,
      isPreviousResult,
      grandPrix: `${(sess.country_name || sess.location || "FORMULA 1").toUpperCase()} GRAND PRIX`,
      circuit: `${sess.circuit_short_name || sess.location || "Circuit"} • ${sess.session_name || "Session"}`,
      session: isPreviousResult ? `${rawSessName} RESULT` : rawSessName,
      lap: maxLap,
      totalLaps: maxLap,
      trackStatus,
      weather,
      fastestLapOwner: fastestLapOwner || (mappedDrivers[0] ? mappedDrivers[0].code : ""),
      fastestLapTime: Number.isFinite(fastestLapSec) ? formatSecondsToLap(fastestLapSec) : "-",
      drivers: mappedDrivers,
      raceControlNotes: recentRc.length
        ? recentRc.map((r) => `${r.lap_number ? `Lap ${r.lap_number}: ` : ""}${r.message || r.flag || r.category}`)
        : [`OpenF1 connected: ${sess.location || "Grand Prix"} (${sess.session_name || "Session"})`]
    };
  }

  function parseJolpiF1(payload) {
    const races = payload && payload.MRData && payload.MRData.RaceTable && payload.MRData.RaceTable.Races;
    if (!Array.isArray(races) || !races.length) return null;
    const race = races[0];
    const results = Array.isArray(race.Results) ? race.Results : [];
    if (!results.length) return null;

    let fastestOwner = "";
    let fastestLap = "-";
    const drivers = results.slice(0, 14).map((r) => {
      const drv = r.Driver || {};
      const ctor = r.Constructor || {};
      const isFastest = r.FastestLap && r.FastestLap.rank === "1";
      if (isFastest) {
        fastestOwner = drv.code || (drv.familyName || "").slice(0, 3).toUpperCase();
        fastestLap = (r.FastestLap.Time && r.FastestLap.Time.time) || "-";
      }
      return {
        pos: parseInt(r.position, 10) || 0,
        delta: (parseInt(r.grid, 10) || 0) - (parseInt(r.position, 10) || 0),
        code: (drv.code || (drv.familyName || "DRV").slice(0, 3)).toUpperCase(),
        name: `${drv.givenName || ""} ${drv.familyName || ""}`.trim(),
        team: ctor.name || "F1 Team",
        color: "#e11d48",
        gap: r.position === "1" ? "WINNER" : (r.Time && r.Time.time) || r.status || "-",
        lastLap: (r.FastestLap && r.FastestLap.Time && r.FastestLap.Time.time) || "-",
        tyre: "M",
        tyreAge: 0,
        pits: 0
      };
    });

    return {
      id: `jolpi-f1-${race.season}-${race.round}`,
      isPreviousResult: true,
      grandPrix: String(race.raceName || "FORMULA 1 GRAND PRIX").toUpperCase(),
      circuit: (race.Circuit && race.Circuit.circuitName) || "F1 Circuit",
      session: "RACE RESULT",
      lap: parseInt(results[0].laps, 10) || 50,
      totalLaps: parseInt(results[0].laps, 10) || 50,
      trackStatus: "GREEN",
      weather: { airTemp: "-", trackTemp: "-", wind: "-" },
      fastestLapOwner: fastestOwner || (drivers[0] ? drivers[0].code : ""),
      fastestLapTime: fastestLap,
      drivers,
      raceControlNotes: [
        `Round ${race.round} (${race.date}) — Winner: ${drivers[0] ? drivers[0].name : "-"}`
      ]
    };
  }

  function parseEspnF1(payload) {
    const events = Array.isArray(payload && payload.events) ? payload.events : [];
    if (!events.length) return null;
    const ev = events[0];
    const competitions = Array.isArray(ev.competitions) ? ev.competitions : [];
    const raceComp = competitions[competitions.length - 1] || competitions[0];
    if (!raceComp || !Array.isArray(raceComp.competitors) || !raceComp.competitors.length) return null;

    const drivers = raceComp.competitors.slice(0, 14).map((c, idx) => {
      const ath = c.athlete || {};
      const shortName = ath.shortName || ath.displayName || `DRV${idx + 1}`;
      const code = (ath.abbreviation || shortName.slice(0, 3)).toUpperCase();
      return {
        pos: c.order || idx + 1,
        delta: 0,
        code,
        name: ath.displayName || shortName,
        team: (c.vehicle && c.vehicle.manufacturer) || "F1 Team",
        color: "#e11d48",
        gap: idx === 0 ? "LEADER" : (c.status && c.status.displayValue) || "-",
        lastLap: c.lapTime || "-",
        tyre: "M",
        tyreAge: 0,
        pits: 0
      };
    });

    return {
      id: `espn-f1-${ev.id}`,
      grandPrix: (ev.name || "FORMULA 1 GRAND PRIX").toUpperCase(),
      circuit: (ev.circuit && ev.circuit.fullName) || "Grand Prix Circuit",
      session: (raceComp.type && raceComp.type.abbreviation) || "SESSION",
      lap: (raceComp.status && raceComp.status.period) || 1,
      totalLaps: 50,
      trackStatus: "GREEN",
      weather: { airTemp: "-", trackTemp: "-", wind: "-" },
      fastestLapOwner: drivers[0] ? drivers[0].code : "",
      fastestLapTime: drivers[0] ? drivers[0].lastLap : "-",
      drivers,
      raceControlNotes: [
        (raceComp.status && raceComp.status.type && raceComp.status.type.detail) || "Live ESPN F1 feed connected"
      ]
    };
  }

  const CRICKET_NEWS_EXCLUDED_RE = /\b(women|woman|womens|women's|wpl|wbbl|under-?19|u-?19|u19|sheffield shield|county championship|big bash|bbl|sa20|psl|cpl|the hundred)\b/i;

  function extractNewsTickerItems(newsPayload, sport, targetType, targetId) {
    let articles = Array.isArray(newsPayload && newsPayload.articles) ? newsPayload.articles : [];
    if (sport === "cricket") {
      articles = articles.filter((a) => !CRICKET_NEWS_EXCLUDED_RE.test(`${a.headline || ""} ${a.description || ""}`));
    }
    return articles.slice(0, 4).map((a, idx) => ({
      id: `news-${sport}-${idx}-${(a.dataSourceIdentifier || a.headline || "").slice(0, 12)}`,
      sport,
      tag: sport === "football" ? "FOOTBALL WIRE" : sport === "cricket" ? "CRICKET WIRE" : "F1 WIRE",
      time: a.published ? formatKickoffClock(a.published, "NOW") : "NOW",
      targetType,
      targetId,
      text: a.headline || a.description || "Latest sports headline"
    }));
  }

  async function fetchLiveSnapshot(currentState, options) {
    const opts = options || {};
    await checkLocalProxy();

    const feedReport = {
      proxy: Boolean(proxyAvailable),
      footballSource: "None",
      cricketSource: "None",
      f1Source: "None"
    };

    // 1. Football: Always fetch current leagues + global slate + recent previous days
    const pastFbDates = getRecentUtcDateStrings(3);
    const pastFbTargets = [
      ...pastFbDates.map((d) => ({ code: "all", key: "ALL", name: "International / Club", date: d })),
      { code: "uefa.nations", key: "UNL", name: "UEFA Nations League", date: pastFbDates[0] },
      { code: "eng.1", key: "EPL", name: "Premier League", date: pastFbDates[0] }
    ];

    const [leagueResults, globalRes, pastFbResults] = await Promise.all([
      Promise.allSettled(
        SOCCER_LEAGUES.map(async (lg) => {
          const data = await fetchResource(
            `/api/espn/soccer/${lg.code}`,
            `https://site.api.espn.com/apis/site/v2/sports/soccer/${lg.code}/scoreboard`,
            "json"
          );
          return parseSoccerEvents(data, lg);
        })
      ),
      fetchResource(
        "/api/espn/soccer/all",
        "https://site.api.espn.com/apis/site/v2/sports/soccer/all/scoreboard",
        "json"
      ).catch(() => null),
      Promise.allSettled(
        pastFbTargets.map(async (t) => {
          const data = await fetchResource(
            `/api/espn/soccer/${t.code}?dates=${t.date}`,
            `https://site.api.espn.com/apis/site/v2/sports/soccer/${t.code}/scoreboard?dates=${t.date}`,
            "json"
          );
          return parseSoccerEvents(data, t);
        })
      )
    ]);

    const footballById = new Map();
    leagueResults.forEach((res) => {
      if (res.status === "fulfilled") {
        res.value.forEach((m) => {
          if (!footballById.has(m.id)) footballById.set(m.id, m);
        });
      }
    });

    if (globalRes) {
      const globalMatches = parseSoccerEvents(globalRes, { code: "all", key: "ALL", name: "International / Club" });
      globalMatches.forEach((gm) => {
        if (!footballById.has(gm.id)) footballById.set(gm.id, gm);
      });
    }

    pastFbResults.forEach((res) => {
      if (res.status === "fulfilled") {
        res.value.forEach((pm) => {
          if (!footballById.has(pm.id)) footballById.set(pm.id, pm);
        });
      }
    });

    // Partition active/upcoming vs previous results before slicing so previous games are never truncated
    const activePriority = { LIVE: 0, HT: 1, PRE: 2 };
    const allFootball = Array.from(footballById.values());
    const activeFootball = allFootball
      .filter((m) => m.status !== "FT")
      .sort((a, b) => {
        const pDiff = (activePriority[a.status] ?? 9) - (activePriority[b.status] ?? 9);
        if (pDiff !== 0) return pDiff;
        if (a.status === "PRE" && b.status === "PRE") {
          return (a.eventTimestamp || 0) - (b.eventTimestamp || 0);
        }
        return 0;
      })
      .slice(0, 40);

    const previousFootball = allFootball
      .filter((m) => m.status === "FT")
      .sort((a, b) => (b.eventTimestamp || 0) - (a.eventTimestamp || 0))
      .slice(0, 45);

    const footballMatches = [...activeFootball, ...previousFootball];
    if (footballMatches.length > 0) {
      const liveFbCount = activeFootball.filter((m) => m.status === "LIVE" || m.status === "HT").length;
      feedReport.footballSource = `ESPN (${liveFbCount} live, ${previousFootball.length} prev / ${footballMatches.length} total)`;
    }

    // 2. Cricket: Optional CricAPI -> ESPN Cricket Scorepanel + Header + IPL (8048) -> Cricinfo/RSS fallback
    // Filtered strictly to Men's International Cricket (Test/ODI/T20I) and active/upcoming IPL.
    let cricketMatches = [];
    let cricketFetchOk = false;
    const cricApiKey = opts.cricApiKey || "";

    if (cricApiKey) {
      try {
        const ca = await fetchResource(
          `/api/cricket/cricapi?apikey=${encodeURIComponent(cricApiKey)}`,
          `https://api.cricapi.com/v1/currentMatches?apikey=${encodeURIComponent(cricApiKey)}&offset=0`,
          "json"
        );
        if (ca && ca.status !== "failure") cricketFetchOk = true;
        cricketMatches = parseCricapiMatches(ca);
        if (cricketMatches.length) {
          feedReport.cricketSource = `CricAPI (${cricketMatches.length} Men's Intl & IPL)`;
        }
      } catch (_) {
        // Fall through to free ESPN Cricket sources
      }
    }

    if (!cricketMatches.length) {
      const pastCrDates = getRecentUtcDateStrings(6);
      const [spRes, hdRes, iplRes, pastSpResults] = await Promise.all([
        fetchResource(
          "/api/cricket/espn-scorepanel",
          "https://site.web.api.espn.com/apis/site/v2/sports/cricket/scorepanel",
          "json"
        ).catch(() => null),
        fetchResource(
          "/api/cricket/espn-header",
          "https://site.api.espn.com/apis/personalized/v2/scoreboard/header?sport=cricket&lang=en&region=in",
          "json"
        ).catch(() => null),
        fetchResource(
          "/api/cricket/espn-ipl",
          "https://site.web.api.espn.com/apis/site/v2/sports/cricket/8048/scoreboard",
          "json"
        ).catch(() => null),
        Promise.allSettled(
          pastCrDates.map((d) =>
            fetchResource(
              `/api/cricket/espn-scorepanel?dates=${d}`,
              `https://site.web.api.espn.com/apis/site/v2/sports/cricket/scorepanel?dates=${d}`,
              "json"
            )
          )
        )
      ]);

      const espnById = new Map();
      const seenLeagueIds = new Set(["8048"]);

      if (spRes) {
        cricketFetchOk = true;
        const parsedSp = parseEspnCricketScorepanel(spRes);
        parsedSp.seenLeagueIds.forEach((lid) => seenLeagueIds.add(lid));
        parsedSp.matches.forEach((m) => espnById.set(m.id, m));
      }

      if (iplRes) {
        cricketFetchOk = true;
        const parsedIpl = parseEspnCricketScorepanel(iplRes);
        parsedIpl.matches.forEach((m) => {
          if (!espnById.has(m.id)) espnById.set(m.id, m);
        });
      }

      if (hdRes) {
        cricketFetchOk = true;
        const missingLeagueIds = extractCandidateLeagueIdsFromHeader(hdRes, seenLeagueIds);
        if (missingLeagueIds.length) {
          const extraBoards = await Promise.allSettled(
            missingLeagueIds.map((lid) =>
              fetchResource(
                `/api/cricket/espn-league/${lid}`,
                `https://site.web.api.espn.com/apis/site/v2/sports/cricket/${lid}/scoreboard`,
                "json"
              )
            )
          );
          extraBoards.forEach((eb) => {
            if (eb.status === "fulfilled" && eb.value) {
              const parsedExtra = parseEspnCricketScorepanel(eb.value);
              parsedExtra.matches.forEach((m) => {
                if (!espnById.has(m.id)) espnById.set(m.id, m);
              });
            }
          });
        }
      }

      pastSpResults.forEach((res) => {
        if (res.status === "fulfilled" && res.value) {
          cricketFetchOk = true;
          const parsedPast = parseEspnCricketScorepanel(res.value);
          parsedPast.matches.forEach((m) => {
            if (!espnById.has(m.id)) espnById.set(m.id, m);
          });
        }
      });

      const allCricket = Array.from(espnById.values());
      const activeCricket = allCricket
        .filter((m) => m.status !== "FT")
        .sort((a, b) => {
          if (a.status !== b.status) return a.status === "LIVE" ? -1 : 1;
          if (a.status === "PRE" && b.status === "PRE") {
            return (a.eventTimestamp || 0) - (b.eventTimestamp || 0);
          }
          return 0;
        })
        .slice(0, 16);

      const previousCricket = allCricket
        .filter((m) => m.status === "FT")
        .sort((a, b) => (b.eventTimestamp || 0) - (a.eventTimestamp || 0))
        .slice(0, 16);

      cricketMatches = [...activeCricket, ...previousCricket];

      if (cricketFetchOk) {
        const liveCrCount = activeCricket.filter((m) => m.status === "LIVE").length;
        feedReport.cricketSource =
          cricketMatches.length > 0
            ? `ESPN Cricket (${liveCrCount} live, ${previousCricket.length} prev / ${cricketMatches.length} Men's Intl & IPL)`
            : "ESPN Cricket (0 Men's Intl / IPL matches)";
      }
    }

    if (!cricketFetchOk && !cricketMatches.length) {
      try {
        const ci = await fetchResource(
          "/api/cricket/cricinfo",
          "https://hs-consumer-api.espncricinfo.com/v1/pages/matches/current?lang=en&latest=true",
          "json"
        );
        cricketFetchOk = true;
        cricketMatches = parseCricinfoMatches(ci);
        if (cricketMatches.length) feedReport.cricketSource = `ESPNcricinfo API (${cricketMatches.length} Men's Intl & IPL)`;
      } catch (_) {
        // Fall through to RSS
      }
    }

    if (!cricketFetchOk && !cricketMatches.length) {
      try {
        const rssXml = await fetchResource(
          "/api/cricket/rss",
          "https://static.cricinfo.com/rss/livescores.xml",
          "text"
        );
        if (rssXml && rssXml.includes("<item>")) cricketFetchOk = true;
        cricketMatches = parseCricketRss(rssXml);
        if (cricketMatches.length) feedReport.cricketSource = `Cricinfo RSS (${cricketMatches.length} Men's Intl & IPL)`;
      } catch (_) {
        // Preserve error reporting
      }
    }

    // 3. Formula 1: OpenF1 -> Jolpica-F1 -> ESPN F1
    let f1Session = null;
    try {
      f1Session = await fetchOpenF1Snapshot();
      if (f1Session) feedReport.f1Source = `OpenF1 (${f1Session.session})`;
    } catch (_) {
      f1Session = null;
    }

    if (!f1Session) {
      try {
        const jolpiData = await fetchResource(
          "/api/jolpi/f1",
          "https://api.jolpi.ca/ergast/f1/current/last/results.json",
          "json"
        );
        f1Session = parseJolpiF1(jolpiData);
        if (f1Session) feedReport.f1Source = "Jolpica F1 (Latest GP)";
      } catch (_) {
        f1Session = null;
      }
    }

    if (!f1Session) {
      try {
        const espnF1 = await fetchResource(
          "/api/espn/f1",
          "https://site.api.espn.com/apis/site/v2/sports/racing/f1/scoreboard",
          "json"
        );
        f1Session = parseEspnF1(espnF1);
        if (f1Session) feedReport.f1Source = "ESPN F1";
      } catch (_) {
        f1Session = null;
      }
    }

    // 4. Enrich featured football + cricket match summaries & fetch live news headlines for ticker
    const spotlightFb = footballMatches.find((m) => m.id === opts.featuredFootballId) || footballMatches[0];
    const spotlightCr = cricketMatches.find((m) => m.id === opts.featuredCricketId) || cricketMatches[0];
    const crToEnrich = [];
    if (spotlightCr && spotlightCr.leagueId && spotlightCr.rawEventId) crToEnrich.push(spotlightCr);
    cricketMatches.forEach((m) => {
      if (crToEnrich.length < 2 && m !== spotlightCr && m.status === "LIVE" && m.leagueId && m.rawEventId) {
        crToEnrich.push(m);
      }
    });

    const [summaryRes, crSummaryResults, fbNewsRes, crNewsRes, f1NewsRes] = await Promise.all([
      spotlightFb ? fetchFootballMatchSummary(spotlightFb).catch(() => null) : Promise.resolve(null),
      Promise.allSettled(crToEnrich.map((cm) => fetchCricketMatchSummary(cm))),
      fetchResource("/api/espn/soccer/news", "https://site.api.espn.com/apis/site/v2/sports/soccer/all/news?limit=10", "json").catch(() => null),
      fetchResource("/api/cricket/news", "https://site.api.espn.com/apis/site/v2/sports/cricket/news?limit=8", "json").catch(() => null),
      fetchResource("/api/espn/f1/news", "https://site.api.espn.com/apis/site/v2/sports/racing/f1/news?limit=8", "json").catch(() => null)
    ]);

    if (spotlightFb && summaryRes) {
      if (summaryRes.possession) spotlightFb.stats.possession = summaryRes.possession;
      if (summaryRes.shotsOnTarget) spotlightFb.stats.shotsOnTarget = summaryRes.shotsOnTarget;
      if (summaryRes.events) spotlightFb.events = summaryRes.events;
      if (summaryRes.commentary && summaryRes.commentary.length) {
        spotlightFb.commentary = summaryRes.commentary;
        spotlightFb.latestEvent = `${summaryRes.commentary[0].minute} ${summaryRes.commentary[0].text}`;
      }
      if (summaryRes.lineups) spotlightFb.lineups = summaryRes.lineups;
      if (summaryRes.venue) spotlightFb.venue = summaryRes.venue;
    }

    const connectedCount =
      (footballMatches.length > 0 ? 1 : 0) +
      (cricketFetchOk || cricketMatches.length > 0 ? 1 : 0) +
      (f1Session ? 1 : 0);

    if (connectedCount === 0) {
      throw new Error(
        proxyAvailable === false
          ? "Local live proxy not detected and direct browser CORS failed."
          : "No live upstream sports endpoints responded."
      );
    }

    // 5. Build Live Breaking & Wire Ticker Updates
    const liveTicker = [];
    const emittedBreaking = [];

    // Compare football score diffs against previous state
    footballMatches.forEach((m) => {
      const prev = (currentState.football || []).find((x) => x.id === m.id);
      if (prev && (prev.home.score !== m.home.score || prev.away.score !== m.away.score)) {
        const alert = {
          id: `live-goal-${Date.now()}-${m.id}`,
          sport: "football",
          tag: "GOAL / SCORE",
          time: m.clock || "LIVE",
          targetType: "football",
          targetId: m.id,
          text: `${m.home.name} ${m.home.score}-${m.away.score} ${m.away.name} (${m.leagueName})`
        };
        liveTicker.push(alert);
        emittedBreaking.push(alert);
      } else if (m.status === "LIVE" || m.status === "HT") {
        liveTicker.push({
          id: `live-fb-${m.id}-${m.home.score}-${m.away.score}`,
          sport: "football",
          tag: m.status === "HT" ? "HT" : "LIVE SCORE",
          time: m.clock || "LIVE",
          targetType: "football",
          targetId: m.id,
          text: `${m.home.name} ${m.home.score}-${m.away.score} ${m.away.name} — ${m.latestEvent}`
        });
      }
    });

    // Spotlight football live commentary into ticker
    if (spotlightFb && spotlightFb.commentary && spotlightFb.commentary.length) {
      spotlightFb.commentary.slice(0, 2).forEach((c, idx) => {
        liveTicker.push({
          id: `fb-comm-${spotlightFb.id}-${idx}`,
          sport: "football",
          tag: `${spotlightFb.home.abbr} v ${spotlightFb.away.abbr}`,
          time: c.minute,
          targetType: "football",
          targetId: spotlightFb.id,
          text: c.text
        });
      });
    }

    // Cricket live score updates into ticker
    cricketMatches.slice(0, 6).forEach((c) => {
      const s1 = Apex.utils.formatCricketScore(c.team1);
      const s2 = Apex.utils.formatCricketScore(c.team2);
      const prev = (currentState.cricket || []).find((x) => x.id === c.id);
      const prevS1 = prev ? Apex.utils.formatCricketScore(prev.team1) : "";
      const prevS2 = prev ? Apex.utils.formatCricketScore(prev.team2) : "";
      const changed = Boolean(prev && (prevS1 !== s1 || prevS2 !== s2 || prev.equation !== c.equation));
      const scoreSlug = `${s1}-${s2}`.replace(/[^a-zA-Z0-9]+/g, "_");
      const scoreText =
        c.status === "PRE" && s1 === "-" && s2 === "-"
          ? `${c.team1.name} vs ${c.team2.name} — ${c.equation}`
          : `${c.team1.abbr} ${s1} vs ${c.team2.abbr} ${s2} — ${c.equation}`;
      const item = {
        id: `live-cr-${c.id}-${scoreSlug}`,
        sport: "cricket",
        tag: changed ? "CRICKET UPDATE" : c.status === "LIVE" ? `${c.format} LIVE` : c.format,
        time: c.clock || c.format,
        targetType: "cricket",
        targetId: c.id,
        text: scoreText
      };
      liveTicker.push(item);
      if (changed) emittedBreaking.push(item);
    });

    // F1 status & fastest lap into ticker
    if (f1Session && f1Session.drivers && f1Session.drivers.length) {
      const p1 = f1Session.drivers[0];
      liveTicker.push({
        id: `live-f1-${f1Session.id}-${f1Session.lap}`,
        sport: "f1",
        tag: f1Session.session,
        time: `L${f1Session.lap}`,
        targetType: "f1",
        targetId: f1Session.id,
        text: `${f1Session.grandPrix} — P1 ${p1.name} (${p1.team})${f1Session.fastestLapOwner ? ` • Fastest: ${f1Session.fastestLapOwner} ${f1Session.fastestLapTime}` : ""}`
      });
    }

    // Add ESPN live wire headlines across all three sports
    if (fbNewsRes) {
      liveTicker.push(
        ...extractNewsTickerItems(fbNewsRes, "football", "football", footballMatches[0] ? footballMatches[0].id : "")
      );
    }
    if (crNewsRes) {
      liveTicker.push(
        ...extractNewsTickerItems(crNewsRes, "cricket", "cricket", cricketMatches[0] ? cricketMatches[0].id : "")
      );
    }
    if (f1NewsRes) {
      liveTicker.push(
        ...extractNewsTickerItems(f1NewsRes, "f1", "f1", f1Session ? f1Session.id : "f1-gp")
      );
    }

    const hadLiveCricket = (currentState.cricket || []).some((m) => Boolean(m.isLiveFeed));

    return {
      football: footballMatches.length > 0 ? footballMatches : currentState.football,
      cricket: cricketFetchOk || cricketMatches.length > 0 ? cricketMatches : hadLiveCricket ? currentState.cricket : [],
      f1: f1Session || currentState.f1,
      ticker: liveTicker.length > 0 ? liveTicker.slice(0, 26) : currentState.ticker,
      emittedBreaking,
      feedReport
    };
  }

  Apex.liveFeed = {
    fetchLiveSnapshot,
    fetchFootballMatchSummary,
    fetchCricketMatchSummary
  };
})(window);
