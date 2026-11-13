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
    // Senior men's national team competitions ("main line" international squads)
    { code: "uefa.nations", key: "UNL", name: "UEFA Nations League" },
    { code: "concacaf.nations.league", key: "INTL", name: "Concacaf Nations League" },
    { code: "fifa.world", key: "WORLD", name: "FIFA World Cup" },
    { code: "fifa.worldq.uefa", key: "WCQ", name: "WC Qualifiers UEFA" },
    { code: "fifa.worldq.conmebol", key: "WCQ", name: "WC Qualifiers CONMEBOL" },
    { code: "fifa.worldq.concacaf", key: "WCQ", name: "WC Qualifiers Concacaf" },
    { code: "fifa.worldq.afc", key: "WCQ", name: "WC Qualifiers AFC" },
    { code: "fifa.worldq.caf", key: "WCQ", name: "WC Qualifiers CAF" },
    { code: "fifa.worldq.ofc", key: "WCQ", name: "WC Qualifiers OFC" },
    { code: "uefa.euro", key: "INTL", name: "UEFA Euro" },
    { code: "uefa.euroq", key: "INTL", name: "UEFA Euro Qualifiers" },
    { code: "conmebol.america", key: "INTL", name: "Copa America" },
    { code: "concacaf.gold", key: "INTL", name: "Concacaf Gold Cup" },
    { code: "caf.nations", key: "INTL", name: "Africa Cup of Nations" },
    { code: "caf.nations_qual", key: "INTL", name: "AFCON Qualifiers" },
    { code: "afc.asian.cup", key: "INTL", name: "AFC Asian Cup" },
    { code: "afc.cupq", key: "INTL", name: "AFC Asian Cup Qualifiers" },
    { code: "fifa.friendly", key: "INTL", name: "International Friendly" },
    // Major men's club competitions
    { code: "uefa.champions", key: "UCL", name: "Champions League" },
    { code: "uefa.europa", key: "UEL", name: "Europa League" },
    { code: "uefa.europa.conf", key: "UECL", name: "Conference League" },
    { code: "eng.1", key: "EPL", name: "Premier League" },
    { code: "esp.1", key: "LALIGA", name: "La Liga" },
    { code: "ita.1", key: "SERIEA", name: "Serie A" },
    { code: "ger.1", key: "BUNDESLIGA", name: "Bundesliga" },
    { code: "fra.1", key: "LIGUE1", name: "Ligue 1" },
    { code: "usa.1", key: "MLS", name: "MLS" },
    { code: "ind.1", key: "ISL", name: "Indian Super League" }
  ];

  const ALLOWED_SOCCER_LEAGUE_CODES = new Set(SOCCER_LEAGUES.map((lg) => lg.code));

  const SOCCER_DATE_SLOTTED_TARGETS = [
    { code: "uefa.nations", key: "UNL", name: "UEFA Nations League", includeTomorrow: true },
    { code: "concacaf.nations.league", key: "INTL", name: "Concacaf Nations League", includeTomorrow: true },
    { code: "fifa.friendly", key: "INTL", name: "International Friendly", includeTomorrow: true },
    { code: "caf.nations_qual", key: "INTL", name: "AFCON Qualifiers", includeTomorrow: true },
    { code: "fifa.worldq.uefa", key: "WCQ", name: "WC Qualifiers UEFA", includeTomorrow: true },
    { code: "fifa.worldq.conmebol", key: "WCQ", name: "WC Qualifiers CONMEBOL", includeTomorrow: true },
    { code: "fifa.worldq.concacaf", key: "WCQ", name: "WC Qualifiers Concacaf", includeTomorrow: true },
    { code: "eng.1", key: "EPL", name: "Premier League", includeTomorrow: false },
    { code: "esp.1", key: "LALIGA", name: "La Liga", includeTomorrow: false },
    { code: "ita.1", key: "SERIEA", name: "Serie A", includeTomorrow: false },
    { code: "ger.1", key: "BUNDESLIGA", name: "Bundesliga", includeTomorrow: false },
    { code: "uefa.champions", key: "UCL", name: "Champions League", includeTomorrow: false },
    { code: "usa.1", key: "MLS", name: "MLS", includeTomorrow: false },
    { code: "ind.1", key: "ISL", name: "Indian Super League", includeTomorrow: false }
  ];

  const DISALLOWED_FB_WOMEN_RE =
    /\b(?:women(?:'?s)?|woman|femenin[oa]s?|feminin[eo]?|frauen|femminile|nwsl|wsl|liga\s*f|w-?league)\b|\((?:w|f)\)/i;
  const DISALLOWED_FB_YOUTH_COLLEGE_RE =
    /\b(?:u-?\s*(?:1[0-9]|2[0-3])|under-?\s*(?:1[0-9]|2[0-3])|youth|academy|junior\s+(?:world|cup|league|championship|friendly)|reserves?|next\s*pro|premier\s*league\s*2|pl2|olympic(?:s)?|ncaa|college|university|naia|njcaa|varsity|amateur|intramural|club\s+friendl(?:y|ies)|non-?league|b\s+team|second\s+team)\b/i;
  const DISALLOWED_FB_TEAM_SUFFIX_RE =
    /(?:\s+(?:ii|b|u\d{2}|u-\d{2}|xi|w)|\s*\((?:u\d{2}|r|res|b|y|w|f)\))$/i;

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

  function canDirectCorsFallback(directUrl) {
    return /^https:\/\/(?:site(?:\.web)?\.api\.espn\.com|api\.openf1\.org|api\.jolpi\.ca)\//i.test(String(directUrl || ""));
  }

  async function fetchResource(proxyPath, directUrl, mode, options) {
    const useProxy = proxyAvailable === true && Boolean(proxyPath);
    const urls = useProxy
      ? canDirectCorsFallback(directUrl)
        ? [proxyPath, directUrl]
        : [proxyPath]
      : [directUrl];
    const timeoutMs = (options && Number(options.timeoutMs)) || 8500;
    let lastError = null;

    for (const url of urls) {
      if (!url) continue;
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
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

  const cricketDatePanelCache = new Map();
  const CRICKET_EXTENDED_PANEL_TTL_MS = 15 * 60 * 1000;

  function getUtcDateOffsetList(pastDays, futureDays) {
    const list = [];
    const now = new Date();
    for (let offset = futureDays; offset >= -pastDays; offset -= 1) {
      const target = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + offset));
      const yyyy = target.getUTCFullYear();
      const mm = String(target.getUTCMonth() + 1).padStart(2, "0");
      const dd = String(target.getUTCDate()).padStart(2, "0");
      list.push({ date: `${yyyy}${mm}${dd}`, offset });
    }
    return list;
  }

  function getRecentUtcDateStrings(daysBack, includeTodayAndTomorrow) {
    const list = [];
    const now = new Date();
    const start = includeTodayAndTomorrow ? -1 : 1;
    for (let d = start; d <= daysBack; d += 1) {
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
    if (defaultMeta && defaultMeta.code && defaultMeta.code !== "all") return defaultMeta;
    const rawLeague =
      (ev.league && (ev.league.name || ev.league.shortName || ev.league.abbreviation)) ||
      (ev.season && ev.season.displayName) ||
      (payload && Array.isArray(payload.leagues) && payload.leagues[0] && payload.leagues[0].name) ||
      "";
    const slug = String(
      (ev.league && ev.league.slug) ||
        (payload && Array.isArray(payload.leagues) && payload.leagues[0] && payload.leagues[0].slug) ||
        (ev.season && ev.season.slug) ||
        ""
    ).toLowerCase();
    const linkHref = String((ev.links && ev.links[0] && ev.links[0].href) || "").toLowerCase();
    const combined = `${rawLeague} ${slug} ${linkHref}`.toLowerCase();

    const exact = SOCCER_LEAGUES.find((lg) => slug === lg.code);
    if (exact) return exact;
    if (combined.includes("nations") && combined.includes("uefa")) {
      return { code: "uefa.nations", key: "UNL", name: "UEFA Nations League" };
    }
    if (combined.includes("concacaf") && combined.includes("nations")) {
      return { code: "concacaf.nations.league", key: "INTL", name: "Concacaf Nations League" };
    }
    if (combined.includes("champions") && combined.includes("uefa")) {
      return { code: "uefa.champions", key: "UCL", name: "Champions League" };
    }
    if (combined.includes("conference league") || combined.includes("uefa.europa.conf")) {
      return { code: "uefa.europa.conf", key: "UECL", name: "Conference League" };
    }
    if (combined.includes("europa") && combined.includes("uefa")) {
      return { code: "uefa.europa", key: "UEL", name: "Europa League" };
    }
    if (combined.includes("indian super league") || combined.includes("ind.1")) {
      return { code: "ind.1", key: "ISL", name: "Indian Super League" };
    }
    if (combined.includes("major league soccer") || /\bmls\b/.test(combined) || combined.includes("usa.1")) {
      return { code: "usa.1", key: "MLS", name: "MLS" };
    }
    if (combined.includes("premier league") || combined.includes("eng.1")) {
      return { code: "eng.1", key: "EPL", name: "Premier League" };
    }
    if (combined.includes("laliga") || combined.includes("la liga") || combined.includes("esp.1")) {
      return { code: "esp.1", key: "LALIGA", name: "La Liga" };
    }
    if (combined.includes("serie a") || combined.includes("ita.1")) {
      return { code: "ita.1", key: "SERIEA", name: "Serie A" };
    }
    if (combined.includes("bundesliga") || combined.includes("ger.1")) {
      return { code: "ger.1", key: "BUNDESLIGA", name: "Bundesliga" };
    }
    if (combined.includes("ligue 1") || combined.includes("fra.1")) {
      return { code: "fra.1", key: "LIGUE1", name: "Ligue 1" };
    }
    if (combined.includes("international friendly") || combined.includes("fifa.friendly")) {
      return { code: "fifa.friendly", key: "INTL", name: "International Friendly" };
    }
    return { code: slug || "unknown", key: "ALL", name: rawLeague || (defaultMeta && defaultMeta.name) || "Football" };
  }

  function isEligibleSeniorMensFootballMatch(ev, payload, resolvedMeta, homeTeam, awayTeam, mappedStatus) {
    if (!resolvedMeta || !ALLOWED_SOCCER_LEAGUE_CODES.has(resolvedMeta.code)) return false;

    const leagueMeta = ev.league || (payload && Array.isArray(payload.leagues) && payload.leagues[0]) || {};
    const metaText = [
      resolvedMeta.name,
      resolvedMeta.code,
      ev.name,
      ev.shortName,
      ev.description,
      leagueMeta.name,
      leagueMeta.shortName,
      leagueMeta.slug,
      ev.season && ev.season.slug,
      ev.season && ev.season.displayName
    ]
      .filter(Boolean)
      .join(" ");

    const homeNames = [homeTeam.displayName, homeTeam.shortDisplayName, homeTeam.name].filter(Boolean);
    const awayNames = [awayTeam.displayName, awayTeam.shortDisplayName, awayTeam.name].filter(Boolean);
    const teamText = [...homeNames, ...awayNames].join(" ");
    const combinedText = `${metaText} ${teamText}`;

    if (DISALLOWED_FB_WOMEN_RE.test(combinedText) || DISALLOWED_FB_YOUTH_COLLEGE_RE.test(combinedText)) {
      return false;
    }
    if ([...homeNames, ...awayNames].some((nm) => DISALLOWED_FB_TEAM_SUFFIX_RE.test(String(nm).trim()))) {
      return false;
    }

    // Drop stale finals from off-season tournament endpoints (>35d old) and far-future fixtures (>45d out)
    const ts = ev.date ? Date.parse(ev.date) : NaN;
    if (Number.isFinite(ts)) {
      const ageMs = Date.now() - ts;
      if (mappedStatus.status === "FT" && ageMs > 35 * 86400000) return false;
      if (mappedStatus.status === "PRE" && -ageMs > 45 * 86400000) return false;
    }
    return true;
  }

  function parseSoccerEvents(payload, leagueMeta) {
    const events = Array.isArray(payload && payload.events) ? payload.events : [];
    const out = [];
    events.forEach((ev) => {
      const resolvedMeta = inferSoccerLeague(ev, payload, leagueMeta);
      const comp = (ev.competitions && ev.competitions[0]) || {};
      const competitors = Array.isArray(comp.competitors) ? comp.competitors : [];
      const homeObj = competitors.find((c) => c.homeAway === "home") || competitors[0] || {};
      const awayObj = competitors.find((c) => c.homeAway === "away") || competitors[1] || {};
      const homeTeam = homeObj.team || {};
      const awayTeam = awayObj.team || {};
      const mappedStatus = mapStatus(comp.status);

      if (!isEligibleSeniorMensFootballMatch(ev, payload, resolvedMeta, homeTeam, awayTeam, mappedStatus)) {
        return;
      }

      const homeAbbr = (homeTeam.abbreviation || "HOM").toUpperCase();
      const awayAbbr = (awayTeam.abbreviation || "AWY").toUpperCase();

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

      out.push({
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
      });
    });
    return out;
  }

  async function fetchFootballMatchSummary(match) {
    if (!match || !match.rawEventId || !match.leagueCode) return null;
    try {
      const proxyPath = `/api/espn/soccer/${match.leagueCode}/summary?event=${encodeURIComponent(match.rawEventId)}`;
      const remoteUrl = `https://site.web.api.espn.com/apis/site/v2/sports/soccer/${match.leagueCode}/summary?event=${encodeURIComponent(match.rawEventId)}`;
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
                club: (r.team && (r.team.displayName || r.team.shortDisplayName || r.team.name)) || "",
                headshot: (ath.headshot && ath.headshot.href) || "",
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
                redCards: getPlayerStat(p, "redCards"),
                shots: getPlayerStat(p, "totalShots"),
                shotsOnTarget: getPlayerStat(p, "shotsOnTarget"),
                saves: getPlayerStat(p, "saves"),
                foulsCommitted: getPlayerStat(p, "foulsCommitted")
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
    const leagueId = String((leagueMeta && leagueMeta.id) || (ev && ev.league && ev.league.id) || "");
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
        winner: Boolean(c1.winner),
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
        winner: Boolean(c2.winner),
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
        const lg = (group.leagues && group.leagues[0]) || group.league || {};
        if (lg.id) seenLeagueIds.add(String(lg.id));
        const evs = Array.isArray(group.events) ? group.events : [];
        evs.forEach((ev) => {
          const parsed = buildEspnCricketMatch(ev, lg);
          if (parsed) out.push(parsed);
        });
      });
    } else if (payload && Array.isArray(payload.events)) {
      const lg = (payload.leagues && payload.leagues[0]) || payload.league || {};
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

  function extractDismissalSegment(rawShort, startRe, endRe) {
    if (!rawShort || !startRe.test(rawShort)) return "";
    let rest = rawShort.replace(startRe, "").trim();
    if (endRe) {
      const idx = rest.search(endRe);
      if (idx !== -1) rest = rest.slice(0, idx).trim();
    }
    return rest;
  }

  function formatCricketDismissal(outDetails, batted, fallbackShort) {
    if (!batted) {
      return { isOut: false, notOut: false, text: "Yet to bat", fallText: "" };
    }

    const rawShort = cleanCricketEntityText((outDetails && outDetails.shortText) || fallbackShort || "");
    const card = String((outDetails && outDetails.dismissalCard) || "").trim().toLowerCase();
    const bowlerObj = outDetails && outDetails.bowler;
    const bowlerId = bowlerObj && bowlerObj.id ? String(bowlerObj.id) : "";
    const bowlerName = cleanCricketEntityText(
      (bowlerObj && (bowlerObj.displayName || bowlerObj.fullName || bowlerObj.name)) || ""
    );

    const fieldersRaw = Array.isArray(outDetails && outDetails.fielders) ? outDetails.fielders : [];
    const fielderIds = fieldersRaw
      .map((f) => (f && f.athlete && f.athlete.id ? String(f.athlete.id) : ""))
      .filter(Boolean);
    const fielderNames = fieldersRaw
      .map((f) => {
        const fn = cleanCricketEntityText(
          (f && f.athlete && (f.athlete.displayName || f.athlete.fullName || f.athlete.name)) || ""
        );
        if (!fn) return "";
        const prefix = f.isSubstitute ? "sub " : f.isKeeper ? "†" : "";
        return `${prefix}${fn}`;
      })
      .filter(Boolean);

    const detailsObj = outDetails && outDetails.details;
    const fallOv =
      detailsObj && detailsObj.over && detailsObj.over.overs !== undefined ? String(detailsObj.over.overs) : "";
    const fallRuns =
      detailsObj && detailsObj.innings && detailsObj.innings.runs !== undefined ? detailsObj.innings.runs : "";
    const fallWkts =
      detailsObj && detailsObj.innings && detailsObj.innings.wickets !== undefined ? detailsObj.innings.wickets : "";
    const fallScore = fallRuns !== "" ? `${fallRuns}${fallWkts !== "" ? `/${fallWkts}` : ""}` : "";
    const fallText = fallOv ? `Fell at ${fallScore ? `${fallScore} ` : ""}(${fallOv} ov)` : "";

    if (/retired\s+(?:hurt|not\s*out)/i.test(rawShort) || card === "retired hurt") {
      return { isOut: false, notOut: true, text: "Retired hurt", fallText };
    }

    const hasOutSignal = Boolean(
      bowlerName ||
        fielderNames.length ||
        (card && card !== "not out") ||
        (rawShort && !/^not\s*out$/i.test(rawShort))
    );
    if (!hasOutSignal || card === "not out" || /^not\s*out$/i.test(rawShort)) {
      return { isOut: false, notOut: true, text: "Not out", fallText: "" };
    }

    const isCaughtAndBowled =
      card === "c & b" ||
      /^c\s*&\s*b\b/i.test(rawShort) ||
      ((card === "c" || card === "caught") &&
        fielderIds.length === 1 &&
        bowlerId &&
        fielderIds[0] === bowlerId);

    const formatWithFielder = (prefixRe, label) => {
      const byFielder = fielderNames.length
        ? fielderNames.join(" / ")
        : extractDismissalSegment(rawShort, prefixRe, /\s+b\s+/);
      const bowledBy = bowlerName || extractDismissalSegment(rawShort, /^.*?\sb\s+/);
      return `${label}${byFielder ? ` ${byFielder}` : ""}${bowledBy ? ` • b ${bowledBy}` : ""}`;
    };

    let text = "";
    if (isCaughtAndBowled) {
      const byName = bowlerName || extractDismissalSegment(rawShort, /^c\s*&\s*b\s+/i);
      text = byName ? `Caught & Bowled ${byName}` : "Caught & Bowled";
    } else if (card === "c" || card === "caught" || /^c\s+/i.test(rawShort)) {
      text = formatWithFielder(/^c\s+/i, "Caught");
    } else if (card === "bowled" || card === "b" || /^b\s+/i.test(rawShort)) {
      const bowledBy = bowlerName || rawShort.replace(/^b\s+/i, "").trim();
      text = bowledBy ? `Bowled ${bowledBy}` : "Bowled";
    } else if (card === "lbw" || /^lbw\b/i.test(rawShort)) {
      const bowledBy = bowlerName || rawShort.replace(/^lbw(?:\s+b)?\s+/i, "").trim();
      text = bowledBy ? `LBW • b ${bowledBy}` : "LBW";
    } else if (card === "st" || card === "stumped" || /^st\s+/i.test(rawShort)) {
      text = formatWithFielder(/^st\s+/i, "Stumped");
    } else if (card === "run out" || card === "ro" || /^run\s*out/i.test(rawShort)) {
      const roMatch = rawShort.match(/\(([^)]+)\)/);
      const runOutBy = fielderNames.length ? fielderNames.join(" / ") : roMatch ? roMatch[1].trim() : "";
      text = runOutBy ? `Run out (${runOutBy})` : "Run out";
    } else if (card === "hit wicket" || card === "hw" || /^hit\s*wicket/i.test(rawShort)) {
      const bowledBy = bowlerName || rawShort.replace(/^hit\s*wicket(?:\s+b)?\s+/i, "").trim();
      text = bowledBy ? `Hit wicket • b ${bowledBy}` : "Hit wicket";
    } else if (/retired\s*out/i.test(rawShort) || card === "retired out") {
      text = "Retired out";
    } else if (rawShort) {
      text = rawShort.charAt(0).toUpperCase() + rawShort.slice(1);
    } else {
      text = bowlerName ? `Out • b ${bowlerName}` : "Out";
    }

    return { isOut: true, notOut: false, text, fallText };
  }

  function sanitizeHexColor(raw, fallback) {
    const clean = String(raw || "").replace(/^#/, "").trim();
    return /^[0-9a-f]{6}$/i.test(clean) ? `#${clean}` : fallback || "#38bdf8";
  }

  function computeCricketExtrasInfo(bCard, bowlersList, innRuns, battersList) {
    const rawExtras = cleanCricketEntityText((bCard && bCard.extras) || "");
    const batRunsSum = (battersList || []).reduce((acc, b) => acc + (b.batted ? Number(b.runs) || 0 : 0), 0);
    const bowlWides = (bowlersList || []).reduce((acc, bw) => acc + (Number(bw.wides) || 0), 0);
    const bowlNoballs = (bowlersList || []).reduce((acc, bw) => acc + (Number(bw.noballs) || 0), 0);

    let count = 0;
    if (Number.isFinite(innRuns) && innRuns >= batRunsSum) {
      count = innRuns - batRunsSum;
    } else if (rawExtras) {
      const nums = rawExtras.match(/\d+/g);
      count = nums ? nums.reduce((s, n) => s + parseInt(n, 10), 0) : 0;
    } else {
      count = bowlWides + bowlNoballs;
    }

    let detail = rawExtras;
    if (!detail && (bowlWides > 0 || bowlNoballs > 0)) {
      const parts = [];
      if (bowlWides > 0) parts.push(`w ${bowlWides}`);
      if (bowlNoballs > 0) parts.push(`nb ${bowlNoballs}`);
      detail = `(${parts.join(", ")})`;
    }

    return { extrasCount: count, extrasDetail: detail };
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
          const inningsBatEntries = [];
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
              const outObj = ls.statistics && ls.statistics.batting && ls.statistics.batting.outDetails;
              const disInfo = formatCricketDismissal(outObj, true, "");
              const notOut = disInfo.notOut || (st.notouts && st.notouts.value === 1 && !disInfo.isOut);
              const scoreText = `${rVal}${notOut ? "*" : ""} (${bVal}b)`;
              const suffix = disInfo.isOut ? disInfo.text : notOut ? "Not out" : "";
              inningsBatParts.push(suffix ? `${scoreText} • ${suffix}` : scoreText);
              inningsBatEntries.push({
                scoreText,
                isOut: disInfo.isOut,
                notOut,
                dismissalText: disInfo.text,
                fallText: disInfo.fallText
              });
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
            batEntries: inningsBatEntries,
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
            batEntries: [],
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
        const batTeamAbbr =
          ((batTeam.team && batTeam.team.abbreviation) || deriveTeamAbbr(batTeamName, "TM")).toUpperCase();
        const headerCompObj =
          compComps.find((c) => c.team && batTeam.team && String(c.team.id) === String(batTeam.team.id)) || null;
        const batTeamColor = sanitizeHexColor(
          (batTeam.team && batTeam.team.color) || (headerCompObj && headerCompObj.team && headerCompObj.team.color),
          "#38bdf8"
        );
        const bowlTeamName =
          (bowlTeam && bowlTeam.team && (bowlTeam.team.displayName || bowlTeam.team.name)) || "Bowling Team";

        const headerLs =
          headerCompObj && Array.isArray(headerCompObj.linescores)
            ? headerCompObj.linescores.find((l) => Number(l.period) === period)
            : null;
        const innOversStr = headerLs && headerLs.overs ? String(headerLs.overs) : "";
        const innScoreStr = headerLs
          ? `${headerLs.score || `${headerLs.runs ?? 0}/${headerLs.wickets ?? 0}`}${innOversStr && !String(headerLs.score || "").includes("ov") ? ` (${innOversStr} ov)` : ""}`
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
            const outObj = ls.statistics && ls.statistics.batting && ls.statistics.batting.outDetails;
            const disInfo = formatCricketDismissal(outObj, batted, "");
            const notOut = batted && (disInfo.notOut || (st.notouts && st.notouts.value === 1 && !disInfo.isOut));
            const activeRole = p.active ? p.activeName || "batting" : "";

            return {
              id: athId,
              order,
              name: ath.displayName || ath.battingName || "Batter",
              captain: Boolean(p.captain || captainIds.has(athId)),
              keeper: keeperIds.has(athId),
              batted,
              isOut: disInfo.isOut,
              notOut,
              activeRole,
              dismissal: disInfo.text,
              fallText: disInfo.fallText,
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
                  const athId = String(ath.id || "");
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
                    id: athId,
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

        const bCard = cards.find(
          (c) => String(c.headline || "").toLowerCase() === "batting" && Number(c.inningsNumber) === period
        );
        const innRunsNum =
          headerLs && headerLs.runs !== undefined && headerLs.runs !== null ? Number(headerLs.runs) : NaN;
        const innWktsNum =
          headerLs && headerLs.wickets !== undefined && headerLs.wickets !== null
            ? Number(headerLs.wickets)
            : battersList.filter((b) => b.isOut).length;
        const innOversDec = oversToDecimal(innOversStr);
        const innRunRate =
          Number.isFinite(innRunsNum) && innOversDec > 0 ? (innRunsNum / innOversDec).toFixed(2) : "";
        const { extrasCount, extrasDetail } = computeCricketExtrasInfo(bCard, bowlersList, innRunsNum, battersList);
        const fowList = Array.isArray(headerLs && headerLs.fow)
          ? headerLs.fow
              .map((fw) => ({
                wicket: fw.wicketNumber || "",
                runs: fw.runs !== undefined ? fw.runs : "",
                over: fw.wicketOver !== undefined ? String(fw.wicketOver) : "",
                batter: cleanCricketEntityText(
                  (fw.athlete && (fw.athlete.displayName || fw.athlete.shortName || fw.athlete.name)) || ""
                )
              }))
              .filter((fw) => fw.wicket !== "")
          : [];
        const scoreBadge = Number.isFinite(innRunsNum)
          ? `${innRunsNum}${innWktsNum >= 10 || (headerLs && headerLs.description === "all out") ? "" : `/${innWktsNum}`}`
          : "";

        inningsMap.set(period, {
          period,
          batTeamName,
          batTeamAbbr,
          batTeamColor,
          bowlTeamName,
          scoreText: innScoreStr,
          scoreBadge,
          runs: Number.isFinite(innRunsNum) ? innRunsNum : null,
          wickets: innWktsNum,
          overs: innOversStr,
          runRate: innRunRate,
          summaryDesc: (headerLs && headerLs.description) || "",
          extrasCount,
          extrasDetail,
          fowList,
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
          const disInfo = formatCricketDismissal(null, batted, p.dismissal || "");
          return {
            order: idx + 1,
            name: p.playerName || "Batter",
            batted,
            isOut: disInfo.isOut,
            notOut: disInfo.notOut,
            dismissal: disInfo.text,
            fallText: disInfo.fallText,
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
        const batTeamNm = (bCard && bCard.teamName) || "Batting";
        const { extrasCount, extrasDetail } = computeCricketExtrasInfo(bCard, bowlersList, NaN, battersList);
        inningsCards.push({
          period: pNum,
          batTeamName: batTeamNm,
          batTeamAbbr: deriveTeamAbbr(batTeamNm, "TM"),
          batTeamColor: "#38bdf8",
          bowlTeamName: (wCard && wCard.teamName) || "Bowling",
          scoreText: cleanCricketEntityText((bCard && bCard.total) || ""),
          scoreBadge: cleanCricketEntityText((bCard && bCard.total) || ""),
          runs: null,
          wickets: battersList.filter((b) => b.isOut).length,
          overs: "",
          runRate: bCard && bCard.runRate ? String(bCard.runRate) : "",
          summaryDesc: "",
          extrasCount,
          extrasDetail,
          fowList: [],
          title: `${batTeamNm} (Inn ${pNum})`,
          batters: battersList,
          bowlers: bowlersList
        });
      });
    }

    return { inningsCards, teamSummaries };
  }

  function formatCricketBallDelivery(item) {
    const pt = String((item && item.playType && item.playType.description) || "").toLowerCase();
    const ov = (item && item.over) || {};
    const runs = parseInt(item && item.scoreValue, 10) || 0;
    const isDismissal = Boolean((item && item.dismissal && item.dismissal.dismissal) || pt === "out" || /\bwicket\b/i.test(pt));
    const wideCount = parseInt(ov.wide, 10) || (pt.includes("wide") ? runs || 1 : 0);
    const nbCount = parseInt(ov.noBall, 10) || (pt.includes("no ball") ? runs || 1 : 0);
    const lbCount = parseInt(ov.legByes, 10) || (pt.includes("leg bye") ? runs || 1 : 0);
    const byeCount = (!lbCount && (parseInt(ov.byes, 10) || (pt === "bye" || pt.includes("byes") ? runs || 1 : 0))) || 0;

    let label = "0";
    let kind = "dot";

    if (isDismissal) {
      if (wideCount > 0) label = `${Math.max(1, runs || wideCount)}WD+W`;
      else if (nbCount > 0) label = `${Math.max(1, runs || nbCount)}NB+W`;
      else label = "W";
      kind = "wicket";
    } else if (wideCount > 0 || pt.includes("wide")) {
      label = `${Math.max(1, runs || wideCount)}WD`;
      kind = "extra";
    } else if (nbCount > 0 || pt.includes("no ball")) {
      label = `${Math.max(1, runs || nbCount)}NB`;
      kind = "extra";
    } else if (lbCount > 0 || pt.includes("leg bye")) {
      label = `${Math.max(1, runs || lbCount)}LB`;
      kind = "extra";
    } else if (byeCount > 0 || pt.includes("bye")) {
      label = `${Math.max(1, runs || byeCount)}B`;
      kind = "extra";
    } else if (runs === 6 || pt === "six") {
      label = "6";
      kind = "six";
    } else if (runs === 4 || pt === "four") {
      label = "4";
      kind = "four";
    } else if (runs > 0) {
      label = String(runs);
      kind = "run";
    }

    const overPos = ov.actual !== undefined ? `${ov.actual} ov` : "";
    const shortDesc = cleanCricketEntityText(item && (item.shortText || (item.playType && item.playType.description) || ""));
    const tooltip = [overPos, shortDesc].filter(Boolean).join(" — ");

    return {
      label,
      kind,
      tooltip,
      runs,
      isWicket: isDismissal
    };
  }

  function extractBowlerFromShortText(shortText) {
    const m = String(shortText || "").match(/^([A-Za-z][A-Za-z.'\-\s]{1,34}?)\s+to\s+[A-Za-z]/);
    return m ? m[1].trim() : "";
  }

  function buildCricketOverByOver(items, match) {
    if (!Array.isArray(items) || !items.length) return [];

    // Deduplicate real deliveries (ignore 0/0.0 pre-play or post-innings sentinels)
    const dedupMap = new Map();
    items.forEach((it) => {
      if (!it || !it.over) return;
      const ov = it.over;
      const hasDelivery = Number(ov.number) > 0 || Number(ov.ball) > 0 || Number(ov.actual) > 0;
      if (!hasDelivery) return;
      const key = `${it.period || 1}:${it.id || it.sequence}`;
      if (!dedupMap.has(key)) dedupMap.set(key, it);
    });

    const sortedItems = Array.from(dedupMap.values()).sort((a, b) => {
      const pDiff = (Number(a.period) || 1) - (Number(b.period) || 1);
      if (pDiff !== 0) return pDiff;
      const seqDiff = (Number(a.sequence) || 0) - (Number(b.sequence) || 0);
      if (seqDiff !== 0) return seqDiff;
      return (Number(a.over && a.over.actual) || 0) - (Number(b.over && b.over.actual) || 0);
    });

    const periodMap = new Map();
    sortedItems.forEach((it) => {
      const period = Number(it.period) || 1;
      const ov = it.over || {};
      const overNum = Number(ov.number) || Math.floor(Number(ov.actual || 0)) + 1;
      if (!overNum || overNum < 1) return;

      if (!periodMap.has(period)) {
        const tmName =
          (it.team && (it.team.displayName || it.team.name || it.team.abbreviation)) ||
          (it.periodText ? String(it.periodText) : `Innings ${period}`);
        const innText = it.periodText ? `${tmName} (${it.periodText})` : `${tmName} — Innings ${period}`;
        periodMap.set(period, {
          period,
          label: cleanCricketEntityText(innText),
          oversMap: new Map()
        });
      }

      const pGroup = periodMap.get(period);
      const bwName =
        (it.bowler && it.bowler.athlete && (it.bowler.athlete.shortName || it.bowler.athlete.displayName)) ||
        extractBowlerFromShortText(it.shortText);
      if (!pGroup.oversMap.has(overNum)) {
        pGroup.oversMap.set(overNum, {
          overNumber: overNum,
          bowler: cleanCricketEntityText(bwName),
          runs: 0,
          wickets: 0,
          balls: []
        });
      }

      const overEntry = pGroup.oversMap.get(overNum);
      if (!overEntry.bowler && bwName) {
        overEntry.bowler = cleanCricketEntityText(bwName);
      }

      const ballObj = formatCricketBallDelivery(it);
      overEntry.runs += ballObj.runs;
      if (ballObj.isWicket) overEntry.wickets += 1;
      overEntry.balls.push(ballObj);
    });

    return Array.from(periodMap.values())
      .sort((a, b) => a.period - b.period)
      .map((pg) => ({
        period: pg.period,
        label: pg.label,
        overs: Array.from(pg.oversMap.values()).sort((a, b) => a.overNumber - b.overNumber)
      }));
  }

  async function fetchCricketPlayByPlay(match, includeFullOvers, options) {
    if (!match || !match.leagueId || !match.rawEventId) return null;
    const force = Boolean(options && options.force);

    if (
      includeFullOvers &&
      !force &&
      match.status === "FT" &&
      match._oversCached &&
      Array.isArray(match.overByOver) &&
      match.overByOver.length
    ) {
      match._oversLoaded = true;
      match._oversError = false;
      return match.overByOver;
    }

    if (includeFullOvers && match._oversPromise && !force) {
      return match._oversPromise;
    }

    const fetchPage = (pg) =>
      fetchResource(
        `/api/cricket/espn-playbyplay/${match.leagueId}?event=${match.rawEventId}&page=${pg}`,
        `https://site.web.api.espn.com/apis/site/v2/sports/cricket/${match.leagueId}/playbyplay?contentorigin=espn&event=${match.rawEventId}&lang=en&region=in&page=${pg}`,
        "json",
        { timeoutMs: 11000 }
      );

    const fetchPageWithRetry = async (pg) => {
      try {
        return await fetchPage(pg);
      } catch (_) {
        return await fetchPage(pg);
      }
    };

    const run = async () => {
      if (includeFullOvers) {
        match._oversLoading = true;
        match._oversError = false;
      }
      try {
        const p1 = await fetchPageWithRetry(1);
        const comm1 = p1 && p1.commentary;
        const items1 = Array.isArray(comm1 && comm1.items) ? comm1.items : [];
        const pageCount = Math.max(1, Number(comm1 && comm1.pageCount) || 1);

        const allItems = [...items1];
        let targetPages = [];
        let isPartialWindow = false;

        if (!includeFullOvers) {
          if (pageCount > 1) targetPages = [pageCount];
        } else if (pageCount > 1) {
          if (pageCount <= 24) {
            for (let pg = 2; pg <= pageCount; pg += 1) targetPages.push(pg);
          } else {
            // For multi-day Tests, load opening page + newest 20 pages (~80 latest overs)
            isPartialWindow = true;
            const startTail = Math.max(2, pageCount - 19);
            for (let pg = startTail; pg <= pageCount; pg += 1) targetPages.push(pg);
          }
        }

        const failedPages = [];
        for (let i = 0; i < targetPages.length; i += 4) {
          const slice = targetPages.slice(i, i + 4);
          const batchRes = await Promise.allSettled(slice.map((pg) => fetchPage(pg)));
          batchRes.forEach((r, idx) => {
            if (r.status === "fulfilled" && r.value && r.value.commentary && Array.isArray(r.value.commentary.items)) {
              allItems.push(...r.value.commentary.items);
            } else {
              failedPages.push(slice[idx]);
            }
          });
        }

        if (failedPages.length) {
          const retryRes = await Promise.allSettled(failedPages.map((pg) => fetchPage(pg)));
          retryRes.forEach((r) => {
            if (r.status === "fulfilled" && r.value && r.value.commentary && Array.isArray(r.value.commentary.items)) {
              allItems.push(...r.value.commentary.items);
            }
          });
        }

        const groups = buildCricketOverByOver(allItems, match);
        if (groups.length) {
          const lastGroup = groups[groups.length - 1];
          const recentBalls = [];
          lastGroup.overs.slice(-2).forEach((ov) => {
            ov.balls.forEach((b) => recentBalls.push(b));
          });
          if (recentBalls.length) {
            match.recentBalls = recentBalls.slice(-10);
          }
        }

        if (includeFullOvers) {
          if (groups.length || !Array.isArray(match.overByOver) || !match.overByOver.length) {
            match.overByOver = groups;
          }
          match.overByOverPartial = isPartialWindow;
          match._oversLoaded = true;
          match._oversError = false;
          match._oversLastFetchTs = Date.now();
          if (match.status === "FT" && groups.length) {
            match._oversCached = true;
          }
        }
        return groups;
      } catch (_) {
        if (includeFullOvers) {
          match._oversError = true;
          if (!Array.isArray(match.overByOver) || !match.overByOver.length) {
            match._oversLoaded = false;
          }
        }
        return null;
      } finally {
        if (includeFullOvers) {
          match._oversLoading = false;
          if (match._oversPromise === taskPromise) {
            match._oversPromise = null;
          }
        }
      }
    };

    const taskPromise = run();
    if (includeFullOvers) {
      match._oversPromise = taskPromise;
    }
    return taskPromise;
  }

  async function fetchCricketMatchSummary(match, options) {
    if (!match || !match.leagueId || !match.rawEventId) return null;
    const opts = options || {};
    const wantFullOvers = Boolean(opts.includeOvers || opts.forceOvers);
    try {
      const pbpPromise =
        wantFullOvers || match.status === "LIVE"
          ? fetchCricketPlayByPlay(match, wantFullOvers, { force: Boolean(opts.forceOvers) }).catch(() => null)
          : Promise.resolve(null);

      let sum = null;
      try {
        sum = await fetchResource(
          `/api/cricket/espn-summary/${match.leagueId}?event=${match.rawEventId}`,
          `https://site.web.api.espn.com/apis/site/v2/sports/cricket/${match.leagueId}/summary?contentorigin=espn&event=${match.rawEventId}&lang=en&region=in`,
          "json",
          { timeoutMs: 10000 }
        );
      } catch (_) {
        sum = null;
      }

      if (sum) {
        const comp = sum.header && sum.header.competitions && sum.header.competitions[0];
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
            teamObj.winner = Boolean(cObj.winner);
            if (cObj.team && cObj.team.color) {
              teamObj.color = sanitizeHexColor(cObj.team.color, teamObj.color);
            }
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

        if (sum.gameInfo && sum.gameInfo.venue && sum.gameInfo.venue.fullName) {
          const vFull = sum.gameInfo.venue.fullName;
          const vCity = sum.gameInfo.venue.address && sum.gameInfo.venue.address.city;
          match.venue = vCity && !vFull.toLowerCase().includes(vCity.toLowerCase()) ? `${vFull}, ${vCity}` : vFull;
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
              isOut: Boolean(b.isOut),
              notOut: Boolean(b.notOut),
              dismissal: b.dismissal || "",
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

        const rawNotes = Array.isArray(sum.notes) ? sum.notes : [];
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
        if (typeof opts.onSummaryReady === "function") {
          opts.onSummaryReady(match);
        }
      }

      const pbpRes = await pbpPromise;
      return sum || pbpRes ? match : null;
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
          rawEventId: m.objectId ? String(m.objectId) : "",
          leagueId: m.series && m.series.objectId ? String(m.series.objectId) : "",
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
        const idMatch = link.match(/\/series\/[^/]*-(\d+)\/[^/]*-(\d+)\//);

        return {
          id: `rss-cr-${idx}-${t1.abbr}-${t2.abbr}`,
          leagueId: idMatch ? idMatch[1] : "",
          rawEventId: idMatch ? idMatch[2] : "",
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

  function computeAgeFromDob(dobStr) {
    if (!dobStr) return null;
    const dt = new Date(dobStr);
    if (Number.isNaN(dt.getTime())) return null;
    const now = new Date();
    let age = now.getFullYear() - dt.getFullYear();
    const m = now.getMonth() - dt.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < dt.getDate())) age -= 1;
    return age > 0 && age < 99 ? age : null;
  }

  function formatF1CompoundCode(raw) {
    const c = String(raw || "M").toUpperCase();
    if (c.startsWith("S")) return "S";
    if (c.startsWith("H")) return "H";
    if (c.startsWith("I")) return "I";
    if (c.startsWith("W")) return "W";
    return "M";
  }

  function formatF1GapDisplay(rawTime, status, driverLaps, leaderLaps, pos, isPreviousResult) {
    if (pos === 1) return isPreviousResult ? "WINNER" : "LEADER";
    if (Number.isFinite(driverLaps) && Number.isFinite(leaderLaps) && leaderLaps > 0 && driverLaps < leaderLaps) {
      const diff = leaderLaps - driverLaps;
      if (!status || status === "Lapped" || /Lap/i.test(status) || status === "Finished") {
        return `+${diff} Lap${diff > 1 ? "s" : ""}`;
      }
      return `${status} (L${driverLaps})`;
    }
    if (rawTime) {
      const s = String(rawTime).trim();
      return s.includes(":") || s.endsWith("s") ? s : `${s}s`;
    }
    return status || "-";
  }

  function buildJolpiLookupMaps(jolpiData, jolpiPitsData, jolpiStandingsData) {
    const resRace =
      jolpiData && jolpiData.MRData && jolpiData.MRData.RaceTable && jolpiData.MRData.RaceTable.Races
        ? jolpiData.MRData.RaceTable.Races[0] || null
        : null;
    const results = resRace && Array.isArray(resRace.Results) ? resRace.Results : [];

    const pitsRace =
      jolpiPitsData && jolpiPitsData.MRData && jolpiPitsData.MRData.RaceTable && jolpiPitsData.MRData.RaceTable.Races
        ? jolpiPitsData.MRData.RaceTable.Races[0] || null
        : null;
    const pitsByDriverId = new Map();
    const rawPits = pitsRace && Array.isArray(pitsRace.PitStops) ? pitsRace.PitStops : [];
    rawPits.forEach((p) => {
      if (!p || !p.driverId) return;
      if (!pitsByDriverId.has(p.driverId)) pitsByDriverId.set(p.driverId, []);
      pitsByDriverId.get(p.driverId).push({
        stop: parseInt(p.stop, 10) || 1,
        lap: parseInt(p.lap, 10) || 0,
        duration: p.duration ? `${Number(p.duration).toFixed(1)}s` : "-"
      });
    });

    const standingsLists =
      jolpiStandingsData &&
      jolpiStandingsData.MRData &&
      jolpiStandingsData.MRData.StandingsTable &&
      jolpiStandingsData.MRData.StandingsTable.StandingsLists
        ? jolpiStandingsData.MRData.StandingsTable.StandingsLists
        : [];
    const standingsArr = standingsLists[0] && Array.isArray(standingsLists[0].DriverStandings)
      ? standingsLists[0].DriverStandings
      : [];

    const byCodeStand = new Map();
    const byFamilyStand = new Map();
    standingsArr.forEach((s) => {
      const drv = s && s.Driver ? s.Driver : {};
      const code = String(drv.code || "").toUpperCase();
      const fam = String(drv.familyName || "").toLowerCase();
      if (code) byCodeStand.set(code, s);
      if (fam) byFamilyStand.set(fam, s);
    });

    const byCodeResult = new Map();
    const byNumResult = new Map();
    const byFamilyResult = new Map();
    results.forEach((r) => {
      const drv = r && r.Driver ? r.Driver : {};
      const code = String(drv.code || "").toUpperCase();
      const num = String(r.number || drv.permanentNumber || "");
      const fam = String(drv.familyName || "").toLowerCase();
      if (code) byCodeResult.set(code, r);
      if (num) byNumResult.set(num, r);
      if (fam) byFamilyResult.set(fam, r);
    });

    return {
      resRace,
      results,
      pitsByDriverId,
      byCodeStand,
      byFamilyStand,
      byCodeResult,
      byNumResult,
      byFamilyResult
    };
  }

  let openf1CompletedCache = null;
  const OPENF1_COMPLETED_TTL_MS = 10 * 60 * 1000;

  function sleepMs(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function fetchOpenF1Safe(proxyPath, directUrl) {
    try {
      return await fetchResource(proxyPath, directUrl, "json");
    } catch (err) {
      await sleepMs(1150);
      return await fetchResource(proxyPath, directUrl, "json");
    }
  }

  async function fetchOpenF1Snapshot(jolpiBundlePromise) {
    if (
      openf1CompletedCache &&
      Date.now() - openf1CompletedCache.ts < OPENF1_COMPLETED_TTL_MS &&
      openf1CompletedCache.snapshot
    ) {
      return openf1CompletedCache.snapshot;
    }

    // Pace OpenF1 calls into pairs separated by 850ms with automatic 429 retry
    const [sessionsRes, driversRes] = await Promise.allSettled([
      fetchOpenF1Safe("/api/openf1/sessions", "https://api.openf1.org/v1/sessions?session_key=latest"),
      fetchOpenF1Safe("/api/openf1/drivers", "https://api.openf1.org/v1/drivers?session_key=latest")
    ]);

    const sessions = sessionsRes.status === "fulfilled" && Array.isArray(sessionsRes.value) ? sessionsRes.value : [];
    const drivers = driversRes.status === "fulfilled" && Array.isArray(driversRes.value) ? driversRes.value : [];
    if (!sessions.length || !drivers.length) return null;

    const sess = sessions[sessions.length - 1];
    await sleepMs(850);

    // Pair 2: positions + stints
    const [positionsRes, stintsRes] = await Promise.allSettled([
      fetchOpenF1Safe("/api/openf1/position", "https://api.openf1.org/v1/position?session_key=latest"),
      fetchOpenF1Safe("/api/openf1/stints", "https://api.openf1.org/v1/stints?session_key=latest")
    ]);

    const positions = positionsRes.status === "fulfilled" && Array.isArray(positionsRes.value) ? positionsRes.value : [];
    const stints = stintsRes.status === "fulfilled" && Array.isArray(stintsRes.value) ? stintsRes.value : [];

    // Deduplicate drivers in case OpenF1 returns multiple records
    const uniqueDriversMap = new Map();
    drivers.forEach((d) => {
      if (d && d.driver_number != null) uniqueDriversMap.set(d.driver_number, d);
    });
    const uniqueDrivers = Array.from(uniqueDriversMap.values());

    await sleepMs(850);

    // Pair 3: pit stops + weather
    const [pitsRes, weatherRes] = await Promise.allSettled([
      fetchOpenF1Safe("/api/openf1/pit", "https://api.openf1.org/v1/pit?session_key=latest"),
      fetchOpenF1Safe("/api/openf1/weather", "https://api.openf1.org/v1/weather?session_key=latest")
    ]);

    const openF1Pits = pitsRes.status === "fulfilled" && Array.isArray(pitsRes.value) ? pitsRes.value : [];
    const weatherList = weatherRes.status === "fulfilled" && Array.isArray(weatherRes.value) ? weatherRes.value : [];

    // Latest position per driver
    const latestPos = {};
    positions.forEach((p) => {
      latestPos[p.driver_number] = p.position;
    });

    // Latest stint per driver & max lap
    // Aggregate all stints & latest stint per driver
    const stintsByDriver = {};
    const latestStint = {};
    const maxStintEndByDriver = {};
    let maxLap = 1;
    stints.forEach((st) => {
      if (!st || st.driver_number == null) return;
      if (st.lap_end && st.lap_end > maxLap) maxLap = st.lap_end;
      if (st.lap_end && (!maxStintEndByDriver[st.driver_number] || st.lap_end > maxStintEndByDriver[st.driver_number])) {
        maxStintEndByDriver[st.driver_number] = st.lap_end;
      }
      if (!stintsByDriver[st.driver_number]) stintsByDriver[st.driver_number] = [];
      stintsByDriver[st.driver_number].push(st);
      const prev = latestStint[st.driver_number];
      if (!prev || (st.stint_number || 0) >= (prev.stint_number || 0)) {
        latestStint[st.driver_number] = st;
      }
    });

    // Aggregate OpenF1 pit stops per driver
    const openF1PitsByDriver = {};
    openF1Pits.forEach((p) => {
      if (!p || p.driver_number == null) return;
      if (!openF1PitsByDriver[p.driver_number]) openF1PitsByDriver[p.driver_number] = [];
      openF1PitsByDriver[p.driver_number].push({
        stop: openF1PitsByDriver[p.driver_number].length + 1,
        lap: p.lap_number || 0,
        duration: p.pit_duration != null && Number.isFinite(Number(p.pit_duration))
          ? `${Number(p.pit_duration).toFixed(1)}s`
          : "-"
      });
    });

    const rawSessName = String(sess.session_name || "SESSION").toUpperCase();
    const sessEndMs = sess.date_end ? Date.parse(sess.date_end) : NaN;
    const isPreviousResult = Number.isFinite(sessEndMs) && Date.now() > sessEndMs + 15 * 60000;

    await sleepMs(850);

    // Pair 4: race control + recent laps (+ intervals only when live)
    const minLap = Math.max(1, maxLap - 1);
    const batch3 = [
      fetchOpenF1Safe("/api/openf1/race_control", "https://api.openf1.org/v1/race_control?session_key=latest"),
      fetchOpenF1Safe(
        `/api/openf1/laps?minLap=${minLap}`,
        `https://api.openf1.org/v1/laps?session_key=latest&lap_number%3E=${minLap}`
      )
    ];
    if (!isPreviousResult) {
      await sleepMs(450);
      batch3.push(fetchOpenF1Safe("/api/openf1/intervals", "https://api.openf1.org/v1/intervals?session_key=latest"));
    }

    const [rcRes, lapsRes, intervalsRes] = await Promise.allSettled(batch3);
    const rcList = rcRes && rcRes.status === "fulfilled" && Array.isArray(rcRes.value) ? rcRes.value : [];
    const lapsList = lapsRes && lapsRes.status === "fulfilled" && Array.isArray(lapsRes.value) ? lapsRes.value : [];
    const intervalsList = intervalsRes && intervalsRes.status === "fulfilled" && Array.isArray(intervalsRes.value) ? intervalsRes.value : [];

    const latestGapByDriver = {};
    intervalsList.forEach((iv) => {
      if (iv && iv.driver_number != null && iv.gap_to_leader != null) {
        latestGapByDriver[iv.driver_number] = iv.gap_to_leader;
      }
    });

    const latestLapByDriver = {};
    let fastestLapOwner = "";
    let fastestLapSec = Infinity;

    lapsList.forEach((l) => {
      if (l.lap_number && l.lap_number > maxLap) maxLap = l.lap_number;
      if (l.lap_duration) {
        latestLapByDriver[l.driver_number] = l.lap_duration;
        if (l.lap_duration < fastestLapSec) {
          fastestLapSec = l.lap_duration;
          const drv = uniqueDrivers.find((d) => d.driver_number === l.driver_number);
          if (drv) fastestLapOwner = drv.name_acronym || "";
        }
      }
    });

    // Resolve Jolpica race results, pitstops & standings for enrichment
    const jolpiBundle = jolpiBundlePromise ? await jolpiBundlePromise.catch(() => ({})) : {};
    const jMaps = buildJolpiLookupMaps(jolpiBundle.results, jolpiBundle.pitstops, jolpiBundle.standings);

    const sessStartMs = sess.date_start ? Date.parse(sess.date_start) : NaN;
    const jRaceDateMs = jMaps.resRace && jMaps.resRace.date ? Date.parse(jMaps.resRace.date) : NaN;
    const sameRaceEvent =
      Boolean(jMaps.resRace) &&
      rawSessName.includes("RACE") &&
      (Number.isNaN(sessStartMs) || Number.isNaN(jRaceDateMs) || Math.abs(sessStartMs - jRaceDateMs) <= 4 * 86400000);

    const raceLeaderLaps =
      sameRaceEvent && jMaps.results[0] && parseInt(jMaps.results[0].laps, 10)
        ? parseInt(jMaps.results[0].laps, 10)
        : maxLap;
    if (raceLeaderLaps > maxLap) maxLap = raceLeaderLaps;

    let jFastestOwner = "";
    let jFastestLap = "";

    const mappedDrivers = uniqueDrivers
      .map((d) => {
        const code = (d.name_acronym || "DRV").toUpperCase();
        const famLower = String(d.last_name || "").toLowerCase();
        const numStr = String(d.driver_number || "");
        const jr = sameRaceEvent
          ? jMaps.byCodeResult.get(code) || jMaps.byNumResult.get(numStr) || jMaps.byFamilyResult.get(famLower) || null
          : null;
        const stRow = jMaps.byCodeStand.get(code) || jMaps.byFamilyStand.get(famLower) || null;
        const jrDrv = (jr && jr.Driver) || (stRow && stRow.Driver) || {};

        if (jr && jr.FastestLap && jr.FastestLap.rank === "1") {
          jFastestOwner = code;
          jFastestLap = (jr.FastestLap.Time && jr.FastestLap.Time.time) || "";
        }

        const driverStints = (stintsByDriver[d.driver_number] || []).sort((a, b) => (a.stint_number || 0) - (b.stint_number || 0));
        const st = latestStint[d.driver_number] || driverStints[driverStints.length - 1] || {};
        const tyreCode = formatF1CompoundCode(st.compound);
        const stintStart = Number(st.lap_start) || 0;
        const stintEnd = Number(st.lap_end) || maxStintEndByDriver[d.driver_number] || 0;
        const stintLaps = stintEnd && stintStart ? Math.max(1, stintEnd - stintStart + 1) : 0;
        const tyreAge = stintLaps + (Number(st.tyre_age_at_start) || 0);

        const of1Pits = (openF1PitsByDriver[d.driver_number] || []).sort((a, b) => a.lap - b.lap);
        const jPits = jrDrv.driverId ? jMaps.pitsByDriverId.get(jrDrv.driverId) || [] : [];
        const pitList = of1Pits.length ? of1Pits : jPits;
        const pits = pitList.length || Math.max(0, driverStints.length - 1);

        const pos = (jr && parseInt(jr.position, 10)) || latestPos[d.driver_number] || 99;
        const grid = jr ? parseInt(jr.grid, 10) || 0 : 0;
        const delta = jr && grid > 0 && pos < 99 ? grid - pos : 0;
        const lapsDriven =
          (jr && parseInt(jr.laps, 10)) ||
          maxStintEndByDriver[d.driver_number] ||
          (stintEnd > 0 ? stintEnd : maxLap);

        let gapDisplay = "-";
        if (jr) {
          gapDisplay = formatF1GapDisplay(jr.Time && jr.Time.time, jr.status, lapsDriven, raceLeaderLaps, pos, isPreviousResult);
        } else if (pos === 1) {
          gapDisplay = isPreviousResult ? "WINNER" : "LEADER";
        } else if (latestGapByDriver[d.driver_number] != null) {
          const gVal = latestGapByDriver[d.driver_number];
          gapDisplay = typeof gVal === "number" ? `+${gVal.toFixed(3)}s` : String(gVal);
        }

        const of1LastLap = formatSecondsToLap(latestLapByDriver[d.driver_number]);
        const jBestLap = (jr && jr.FastestLap && jr.FastestLap.Time && jr.FastestLap.Time.time) || "";
        const dob = jrDrv.dateOfBirth || "";
        const stintSummary = driverStints.map((s) => ({
          stint: s.stint_number || 1,
          code: formatF1CompoundCode(s.compound),
          compound: String(s.compound || "MEDIUM"),
          lapStart: s.lap_start || 0,
          lapEnd: s.lap_end || 0,
          laps: s.lap_end && s.lap_start ? Math.max(1, s.lap_end - s.lap_start + 1) : 0
        }));

        return {
          pos,
          grid,
          delta,
          code,
          name: d.full_name || d.broadcast_name || d.name_acronym || "Driver",
          team: (jr && jr.Constructor && jr.Constructor.name) || d.team_name || "F1 Team",
          color: d.team_colour ? `#${d.team_colour}` : "#e11d48",
          headshot: d.headshot_url || "",
          number: numStr,
          nationality: jrDrv.nationality || "",
          dateOfBirth: dob,
          age: computeAgeFromDob(dob),
          laps: lapsDriven,
          gap: gapDisplay,
          lastLap: of1LastLap !== "-" ? of1LastLap : jBestLap || "-",
          fastestLap: jBestLap || (fastestLapOwner === code && Number.isFinite(fastestLapSec) ? formatSecondsToLap(fastestLapSec) : "-"),
          fastestLapRank: jr && jr.FastestLap ? jr.FastestLap.rank : null,
          racePoints: jr && jr.points != null ? Number(jr.points) : null,
          statusText: (jr && jr.status) || (isPreviousResult ? "Classified" : "Running"),
          tyre: tyreCode,
          tyreAge,
          pits,
          pitDetails: pitList,
          stintHistory: stintSummary,
          standing: stRow
            ? {
                pos: parseInt(stRow.position, 10) || 0,
                points: Number(stRow.points) || 0,
                wins: parseInt(stRow.wins, 10) || 0
              }
            : null
        };
      })
      .sort((a, b) => a.pos - b.pos)
      .slice(0, 22);

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

    const snapshot = {
      id: `openf1-${sess.session_key}`,
      isPreviousResult,
      grandPrix: `${(sess.country_name || sess.location || "FORMULA 1").toUpperCase()} GRAND PRIX`,
      circuit: `${sess.circuit_short_name || sess.location || "Circuit"} • ${sess.session_name || "Session"}`,
      session: isPreviousResult ? `${rawSessName} RESULT` : rawSessName,
      lap: maxLap,
      totalLaps: maxLap,
      trackStatus,
      weather,
      fastestLapOwner: jFastestOwner || fastestLapOwner || (mappedDrivers[0] ? mappedDrivers[0].code : ""),
      fastestLapTime: jFastestLap || (Number.isFinite(fastestLapSec) ? formatSecondsToLap(fastestLapSec) : "-"),
      drivers: mappedDrivers,
      raceControlNotes: recentRc.length
        ? recentRc.map((r) => `${r.lap_number ? `Lap ${r.lap_number}: ` : ""}${r.message || r.flag || r.category}`)
        : [`OpenF1 connected: ${sess.location || "Grand Prix"} (${sess.session_name || "Session"})`]
    };

    if (isPreviousResult && (stints.length > 0 || openF1Pits.length > 0)) {
      openf1CompletedCache = {
        sessionKey: sess.session_key,
        ts: Date.now(),
        snapshot
      };
    }

    return snapshot;
  }

  function parseJolpiF1(payload, jolpiPitsData, jolpiStandingsData) {
    const maps = buildJolpiLookupMaps(payload, jolpiPitsData, jolpiStandingsData);
    const race = maps.resRace;
    const results = maps.results;
    if (!race || !results.length) return null;

    const leaderLaps = parseInt(results[0].laps, 10) || 50;
    let fastestOwner = "";
    let fastestLap = "-";
    const drivers = results.slice(0, 22).map((r) => {
      const drv = r.Driver || {};
      const ctor = r.Constructor || {};
      const code = (drv.code || (drv.familyName || "DRV").slice(0, 3)).toUpperCase();
      const pos = parseInt(r.position, 10) || 0;
      const grid = parseInt(r.grid, 10) || 0;
      const laps = parseInt(r.laps, 10) || 0;
      const isFastest = r.FastestLap && r.FastestLap.rank === "1";
      const jBestLap = (r.FastestLap && r.FastestLap.Time && r.FastestLap.Time.time) || "-";
      if (isFastest) {
        fastestOwner = code;
        fastestLap = jBestLap;
      }
      const pitList = drv.driverId ? maps.pitsByDriverId.get(drv.driverId) || [] : [];
      const stRow = maps.byCodeStand.get(code) || maps.byFamilyStand.get(String(drv.familyName || "").toLowerCase()) || null;
      const dob = drv.dateOfBirth || "";
      return {
        pos,
        grid,
        delta: grid > 0 && pos > 0 ? grid - pos : 0,
        code,
        name: `${drv.givenName || ""} ${drv.familyName || ""}`.trim(),
        team: ctor.name || "F1 Team",
        color: "#e11d48",
        headshot: "",
        number: String(r.number || drv.permanentNumber || ""),
        nationality: drv.nationality || "",
        dateOfBirth: dob,
        age: computeAgeFromDob(dob),
        laps,
        gap: formatF1GapDisplay(r.Time && r.Time.time, r.status, laps, leaderLaps, pos, true),
        lastLap: jBestLap,
        fastestLap: jBestLap,
        fastestLapRank: r.FastestLap ? r.FastestLap.rank : null,
        racePoints: r.points != null ? Number(r.points) : null,
        statusText: r.status || "Classified",
        tyre: "M",
        tyreAge: 0,
        pits: pitList.length,
        pitDetails: pitList,
        stintHistory: [],
        standing: stRow
          ? {
              pos: parseInt(stRow.position, 10) || 0,
              points: Number(stRow.points) || 0,
              wins: parseInt(stRow.wins, 10) || 0
            }
          : null
      };
    });

    return {
      id: `jolpi-f1-${race.season}-${race.round}`,
      isPreviousResult: true,
      grandPrix: String(race.raceName || "FORMULA 1 GRAND PRIX").toUpperCase(),
      circuit: (race.Circuit && race.Circuit.circuitName) || "F1 Circuit",
      session: "RACE RESULT",
      lap: leaderLaps,
      totalLaps: leaderLaps,
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

  function combineIsoDateAndTime(dateStr, timeStr) {
    if (!dateStr) return "";
    if (dateStr.includes("T")) return dateStr;
    const cleanTime = timeStr ? String(timeStr).trim() : "12:00:00Z";
    return `${dateStr}T${cleanTime}`;
  }

  function normalizeEspnSessionLabel(abbr, text) {
    const raw = `${abbr || ""} ${text || ""}`.trim().toUpperCase();
    if (raw.includes("FP1")) return "FP1";
    if (raw.includes("FP2")) return "FP2";
    if (raw.includes("FP3")) return "FP3";
    if (raw.includes("SPRINT") && raw.includes("QUAL")) return "Sprint Quali";
    if (raw.includes("SPRINT") || raw === "SR") return "Sprint";
    if (raw.includes("QUAL")) return "Qualifying";
    if (raw.includes("RACE") || raw === "R") return "Grand Prix";
    return (abbr || text || "Session").trim();
  }

  function buildF1UpcomingRace(jolpiNextPayload, espnF1Payload) {
    const races =
      jolpiNextPayload &&
      jolpiNextPayload.MRData &&
      jolpiNextPayload.MRData.RaceTable &&
      jolpiNextPayload.MRData.RaceTable.Races;
    const jRace = Array.isArray(races) && races.length ? races[0] : null;

    const espnEvents = Array.isArray(espnF1Payload && espnF1Payload.events) ? espnF1Payload.events : [];
    const nowMs = Date.now();
    const espnUpcomingEv =
      espnEvents.find((ev) => {
        const endTs = Date.parse(ev.endDate || ev.date || "");
        return Number.isFinite(endTs) && endTs >= nowMs - 6 * 3600000;
      }) ||
      espnEvents[0] ||
      null;

    if (!jRace && !espnUpcomingEv) return null;

    const sessionsByKey = new Map();
    const addSession = (label, iso, state) => {
      if (!iso) return;
      const ts = Date.parse(iso);
      if (Number.isNaN(ts)) return;
      const key = String(label || "Session").toLowerCase();
      const existing = sessionsByKey.get(key);
      if (!existing || (!existing.state && state)) {
        sessionsByKey.set(key, {
          label,
          iso,
          ts,
          state: state || (ts < nowMs ? "post" : "pre")
        });
      }
    };

    if (jRace) {
      if (jRace.FirstPractice) addSession("FP1", combineIsoDateAndTime(jRace.FirstPractice.date, jRace.FirstPractice.time));
      if (jRace.SecondPractice) addSession("FP2", combineIsoDateAndTime(jRace.SecondPractice.date, jRace.SecondPractice.time));
      if (jRace.ThirdPractice) addSession("FP3", combineIsoDateAndTime(jRace.ThirdPractice.date, jRace.ThirdPractice.time));
      if (jRace.SprintQualifying || jRace.SprintShootout) {
        const sq = jRace.SprintQualifying || jRace.SprintShootout;
        addSession("Sprint Quali", combineIsoDateAndTime(sq.date, sq.time));
      }
      if (jRace.Sprint) addSession("Sprint", combineIsoDateAndTime(jRace.Sprint.date, jRace.Sprint.time));
      if (jRace.Qualifying) addSession("Qualifying", combineIsoDateAndTime(jRace.Qualifying.date, jRace.Qualifying.time));
      if (jRace.date) addSession("Grand Prix", combineIsoDateAndTime(jRace.date, jRace.time));
    }

    if (espnUpcomingEv && Array.isArray(espnUpcomingEv.competitions)) {
      espnUpcomingEv.competitions.forEach((c) => {
        const label = normalizeEspnSessionLabel(c.type && c.type.abbreviation, c.type && c.type.text);
        const st = c.status && c.status.type && c.status.type.state;
        addSession(label, c.date, st);
      });
    }

    const sessions = Array.from(sessionsByKey.values()).sort((a, b) => a.ts - b.ts);
    const raceSess = sessions.find((s) => s.label === "Grand Prix") || sessions[sessions.length - 1] || null;

    const jCircuit = (jRace && jRace.Circuit) || {};
    const jLoc = jCircuit.Location || {};
    const espnCircuit = (espnUpcomingEv && espnUpcomingEv.circuit) || {};
    const espnAddr = espnCircuit.address || {};

    const cityPart = jLoc.locality || espnAddr.city || "";
    const countryPart = jLoc.country || espnAddr.country || "";
    const location = [cityPart, countryPart].filter(Boolean).join(", ") || "Circuit Location TBD";

    const gpTitle = (jRace && jRace.raceName) || (espnUpcomingEv && espnUpcomingEv.name) || "Next Formula 1 Grand Prix";
    const circuitName = jCircuit.circuitName || espnCircuit.fullName || "Grand Prix Circuit";

    const rawCalendar =
      espnF1Payload &&
      Array.isArray(espnF1Payload.leagues) &&
      espnF1Payload.leagues[0] &&
      Array.isArray(espnF1Payload.leagues[0].calendar)
        ? espnF1Payload.leagues[0].calendar
        : [];

    const followingRaces = rawCalendar
      .filter((item) => {
        const endTs = Date.parse(item.endDate || item.startDate || "");
        return Number.isFinite(endTs) && endTs >= nowMs - 12 * 3600000;
      })
      .slice(0, 4)
      .map((item) => ({
        name: item.label || "Formula 1 Grand Prix",
        startDate: item.startDate || "",
        endDate: item.endDate || ""
      }));

    return {
      round: jRace && jRace.round ? String(jRace.round) : "",
      season: (jRace && jRace.season) || String(new Date().getFullYear()),
      grandPrix: gpTitle,
      circuit: circuitName,
      location,
      country: countryPart,
      raceDateIso: (raceSess && raceSess.iso) || (jRace ? combineIsoDateAndTime(jRace.date, jRace.time) : espnUpcomingEv.endDate || espnUpcomingEv.date || ""),
      weekendStartIso: (sessions[0] && sessions[0].iso) || (espnUpcomingEv && espnUpcomingEv.date) || "",
      sessions,
      followingRaces
    };
  }

  const CRICKET_NEWS_EXCLUDED_RE = /\b(women|woman|womens|women's|wpl|wbbl|under-?19|u-?19|u19|sheffield shield|county championship|big bash|bbl|sa20|psl|cpl|the hundred)\b/i;

  function extractNewsTickerItems(newsPayload, sport, targetType, targetId) {
    let articles = [];
    if (typeof newsPayload === "string" && newsPayload.includes("<item>")) {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(newsPayload, "text/xml");
      articles = Array.from(xmlDoc.querySelectorAll("item")).map((it) => ({
        headline: ((it.querySelector("title") && it.querySelector("title").textContent) || "").trim(),
        description: ((it.querySelector("description") && it.querySelector("description").textContent) || "").trim(),
        published: ((it.querySelector("pubDate") && it.querySelector("pubDate").textContent) || "").trim(),
        dataSourceIdentifier: ((it.querySelector("guid") && it.querySelector("guid").textContent) || "").trim()
      }));
    } else {
      articles = Array.isArray(newsPayload && newsPayload.articles) ? newsPayload.articles : [];
    }
    if (sport === "cricket") {
      articles = articles.filter((a) => a.headline && !CRICKET_NEWS_EXCLUDED_RE.test(`${a.headline || ""} ${a.description || ""}`));
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

    // 1. Football: Curated senior men's national team & major men's leagues only
    //    (excludes U17-U23 youth, women's, college NCAA, and amateur/lower leagues)
    const recentFbDates = getRecentUtcDateStrings(2, true); // [tomorrow, today, yesterday, 2daysAgo]
    const tomorrowFbDate = recentFbDates[0];
    const yesterdayFbDate = recentFbDates[2];
    const datedFbTargets = [];
    SOCCER_DATE_SLOTTED_TARGETS.forEach((t) => {
      if (yesterdayFbDate) {
        datedFbTargets.push({ code: t.code, key: t.key, name: t.name, date: yesterdayFbDate });
      }
      if (t.includeTomorrow && tomorrowFbDate) {
        datedFbTargets.push({ code: t.code, key: t.key, name: t.name, date: tomorrowFbDate });
      }
    });

    const [leagueResults, datedFbResults] = await Promise.all([
      Promise.allSettled(
        SOCCER_LEAGUES.map(async (lg) => {
          const data = await fetchResource(
            `/api/espn/soccer/${lg.code}`,
            `https://site.web.api.espn.com/apis/site/v2/sports/soccer/${lg.code}/scoreboard`,
            "json"
          );
          return parseSoccerEvents(data, lg);
        })
      ),
      Promise.allSettled(
        datedFbTargets.map(async (t) => {
          const data = await fetchResource(
            `/api/espn/soccer/${t.code}?dates=${t.date}`,
            `https://site.web.api.espn.com/apis/site/v2/sports/soccer/${t.code}/scoreboard?dates=${t.date}`,
            "json"
          );
          return parseSoccerEvents(data, t);
        })
      )
    ]);

    const footballById = new Map();
    [leagueResults, datedFbResults].forEach((group) => {
      group.forEach((res) => {
        if (res.status === "fulfilled") {
          res.value.forEach((m) => {
            if (!footballById.has(m.id)) footballById.set(m.id, m);
          });
        }
      });
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
      .slice(0, 80);

    const previousFootball = allFootball
      .filter((m) => m.status === "FT")
      .sort((a, b) => (b.eventTimestamp || 0) - (a.eventTimestamp || 0))
      .slice(0, 120);

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
      const crDateOffsets = getUtcDateOffsetList(14, 7).sort(
        (a, b) => Math.abs(a.offset) - Math.abs(b.offset) || a.offset - b.offset
      );
      const nowMs = Date.now();
      const uncachedDateTargets = crDateOffsets.filter((entry) => {
        if (Math.abs(entry.offset) <= 2) return true;
        const cached = cricketDatePanelCache.get(entry.date);
        return !cached || nowMs - cached.ts > CRICKET_EXTENDED_PANEL_TTL_MS;
      });

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
          uncachedDateTargets.map(async (entry) => ({
            entry,
            payload: await fetchResource(
              `/api/cricket/espn-scorepanel?dates=${entry.date}`,
              `https://site.web.api.espn.com/apis/site/v2/sports/cricket/scorepanel?dates=${entry.date}`,
              "json"
            )
          }))
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
        if (res.status === "fulfilled" && res.value && res.value.payload) {
          cricketFetchOk = true;
          const { entry, payload } = res.value;
          const parsedDatePanel = parseEspnCricketScorepanel(payload);
          if (Math.abs(entry.offset) > 2) {
            cricketDatePanelCache.set(entry.date, {
              ts: Date.now(),
              matches: parsedDatePanel.matches,
              seenLeagueIds: Array.from(parsedDatePanel.seenLeagueIds)
            });
          }
          parsedDatePanel.matches.forEach((m) => {
            if (!espnById.has(m.id)) espnById.set(m.id, m);
          });
        }
      });

      crDateOffsets.forEach((entry) => {
        if (Math.abs(entry.offset) <= 2) return;
        const cached = cricketDatePanelCache.get(entry.date);
        if (cached && cached.matches) {
          cricketFetchOk = true;
          cached.matches.forEach((m) => {
            if (!espnById.has(m.id)) {
              espnById.set(m.id, {
                ...m,
                team1: { ...m.team1 },
                team2: { ...m.team2 }
              });
            }
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
        .slice(0, 20);

      const previousCricket = allCricket
        .filter((m) => m.status === "FT")
        .sort((a, b) => (b.eventTimestamp || 0) - (a.eventTimestamp || 0))
        .slice(0, 24);

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

    // 3. Formula 1: OpenF1 (batched) + Jolpica F1 (Results, Pitstops, Standings) -> ESPN F1 (+ Upcoming Race Schedule)
    const jolpiBundlePromise = Promise.all([
      fetchResource("/api/jolpi/f1", "https://api.jolpi.ca/ergast/f1/current/last/results.json", "json").catch(() => null),
      fetchResource("/api/jolpi/f1/pitstops", "https://api.jolpi.ca/ergast/f1/current/last/pitstops.json?limit=100", "json").catch(() => null),
      fetchResource("/api/jolpi/f1/standings", "https://api.jolpi.ca/ergast/f1/current/driverStandings.json", "json").catch(() => null)
    ]).then(([results, pitstops, standings]) => ({ results, pitstops, standings }));

    const [openF1Attempt, jolpiNextRes, espnF1Res, jolpiBundle] = await Promise.all([
      fetchOpenF1Snapshot(jolpiBundlePromise).catch(() => null),
      fetchResource("/api/jolpi/f1/next", "https://api.jolpi.ca/ergast/f1/current/next.json", "json").catch(() => null),
      fetchResource("/api/espn/f1", "https://site.api.espn.com/apis/site/v2/sports/racing/f1/scoreboard", "json").catch(() => null),
      jolpiBundlePromise
    ]);

    let f1Session = openF1Attempt;
    if (f1Session) {
      feedReport.f1Source = `OpenF1 + Jolpica (${f1Session.session})`;
    }

    if (!f1Session && jolpiBundle && jolpiBundle.results) {
      try {
        f1Session = parseJolpiF1(jolpiBundle.results, jolpiBundle.pitstops, jolpiBundle.standings);
        if (f1Session) feedReport.f1Source = "Jolpica F1 (Latest GP)";
      } catch (_) {
        f1Session = null;
      }
    }

    if (!f1Session && espnF1Res) {
      try {
        f1Session = parseEspnF1(espnF1Res);
        if (f1Session) feedReport.f1Source = "ESPN F1";
      } catch (_) {
        f1Session = null;
      }
    }

    const upcomingF1 = buildF1UpcomingRace(jolpiNextRes, espnF1Res);
    if (!f1Session && upcomingF1) {
      f1Session = {
        id: `upcoming-f1-${upcomingF1.season}-${upcomingF1.round || "next"}`,
        isPreviousResult: true,
        grandPrix: upcomingF1.grandPrix.toUpperCase(),
        circuit: upcomingF1.circuit,
        session: "UPCOMING GP",
        lap: 0,
        totalLaps: 50,
        trackStatus: "GREEN",
        weather: { airTemp: "-", trackTemp: "-", wind: "-" },
        fastestLapOwner: "-",
        fastestLapTime: "-",
        drivers: [],
        raceControlNotes: [`Next GP: ${upcomingF1.grandPrix} (${upcomingF1.location})`]
      };
      feedReport.f1Source = "Jolpica / ESPN F1 (Schedule)";
    }
    if (f1Session && upcomingF1) {
      f1Session.upcomingRace = upcomingF1;
      if (feedReport.f1Source && !feedReport.f1Source.includes("Next:")) {
        feedReport.f1Source = `${feedReport.f1Source} + Next: ${upcomingF1.grandPrix}`;
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
    cricketMatches.forEach((m) => {
      if (crToEnrich.length < 3 && m.status === "FT" && m.leagueId && m.rawEventId && !crToEnrich.includes(m)) {
        crToEnrich.push(m);
      }
    });

    const [summaryRes, crSummaryResults, fbNewsRes, crNewsRes, f1NewsRes] = await Promise.all([
      spotlightFb ? fetchFootballMatchSummary(spotlightFb).catch(() => null) : Promise.resolve(null),
      Promise.allSettled(crToEnrich.map((cm) => fetchCricketMatchSummary(cm))),
      fetchResource("/api/espn/soccer/news", "https://site.web.api.espn.com/apis/site/v2/sports/soccer/all/news?limit=10", "json").catch(() => null),
      fetchResource("/api/cricket/news", "https://www.espncricinfo.com/rss/content/story/feeds/0.xml", "text").catch(() => null),
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
    if (f1Session && f1Session.upcomingRace) {
      const nextGp = f1Session.upcomingRace;
      const gpWhen = nextGp.raceDateIso
        ? new Date(nextGp.raceDateIso).toLocaleDateString([], { month: "short", day: "numeric" })
        : "TBD";
      liveTicker.push({
        id: `upcoming-f1-${nextGp.round || nextGp.grandPrix}`,
        sport: "f1",
        tag: "NEXT F1 GP",
        time: gpWhen,
        targetType: "f1",
        targetId: "f1-upcoming",
        text: `${nextGp.round ? `R${nextGp.round} ` : ""}${nextGp.grandPrix} at ${nextGp.circuit} (${nextGp.location})`
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

  /* --------------------------------------------------------------------------
     Player Profile, Photo & ICC Rankings Engine (Football & Cricket Popovers)
     -------------------------------------------------------------------------- */
  const playerProfileCache = new Map();
  const wikiProfileCache = new Map();
  const iccRankingsCache = { men: null, women: null };
  const PROFILE_CACHE_TTL_MS = 15 * 60 * 1000;

  function normalizePersonName(name) {
    return String(name || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/\((c|wk)\)/g, " ")
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function buildCricbuzzSlug(name) {
    return normalizePersonName(name).replace(/\s+/g, "-") || "player";
  }

  function decodeNextFlightText(html) {
    const raw = String(html || "");
    const parts = [];
    const re = /self\.__next_f\.push\((\[1,"(?:[^"\\]|\\.)*"\])\)/g;
    let m;
    while ((m = re.exec(raw)) !== null) {
      try {
        const arr = JSON.parse(m[1]);
        if (typeof arr[1] === "string") parts.push(arr[1]);
      } catch (_) {
        parts.push(m[1].replace(/\\"/g, '"').replace(/\\\\/g, "\\"));
      }
    }
    if (parts.length) return parts.join("\n");
    return raw.replace(/\\"/g, '"').replace(/\\\\/g, "\\");
  }

  function extractBalancedJsonAfter(text, marker) {
    if (!text) return null;
    let idx = text.indexOf(marker);
    if (idx < 0) return null;
    let start = text.indexOf("{", idx + marker.length);
    if (start < 0) return null;

    let depth = 0;
    let inStr = false;
    let esc = false;
    for (let i = start; i < text.length; i++) {
      const ch = text.charAt(i);
      if (esc) {
        esc = false;
        continue;
      }
      if (ch === "\\" && inStr) {
        esc = true;
        continue;
      }
      if (ch === '"') {
        inStr = !inStr;
        continue;
      }
      if (!inStr) {
        if (ch === "{") depth += 1;
        else if (ch === "}") {
          depth -= 1;
          if (depth === 0) {
            try {
              return JSON.parse(text.slice(start, i + 1));
            } catch (_) {
              return null;
            }
          }
        }
      }
    }
    return null;
  }

  const ACTIVE_IPL_FRANCHISES = [
    { re: /\bchennai\s+super\s+kings\b|\bcsk\b/i, name: "Chennai Super Kings" },
    { re: /\bmumbai\s+indians\b/i, name: "Mumbai Indians" },
    { re: /\broyal\s+challengers\s+(?:bengaluru|bangalore)\b|\brcb\b/i, name: "Royal Challengers Bengaluru" },
    { re: /\bkolkata\s+knight\s+riders\b|\bkkr\b/i, name: "Kolkata Knight Riders" },
    { re: /\bsunrisers\s+hyderabad\b|\bsrh\b/i, name: "Sunrisers Hyderabad" },
    { re: /\brajasthan\s+royals\b/i, name: "Rajasthan Royals" },
    { re: /\bdelhi\s+capitals\b/i, name: "Delhi Capitals" },
    { re: /\bpunjab\s+kings\b|\bkings\s+xi\s+punjab\b/i, name: "Punjab Kings" },
    { re: /\bgujarat\s+titans\b/i, name: "Gujarat Titans" },
    { re: /\blucknow\s+super\s+giants\b|\blsg\b/i, name: "Lucknow Super Giants" }
  ];

  function matchActiveIplFranchise(text) {
    const s = String(text || "").trim();
    if (!s) return "";
    for (let i = 0; i < ACTIVE_IPL_FRANCHISES.length; i += 1) {
      if (ACTIVE_IPL_FRANCHISES[i].re.test(s)) return ACTIVE_IPL_FRANCHISES[i].name;
    }
    return "";
  }

  function resolveCricbuzzBio(decoded, playerData) {
    const bio = playerData && typeof playerData.bio === "string" ? playerData.bio.trim() : "";
    if (!bio) return "";
    if (!bio.startsWith("$")) return bio;
    const refId = bio.slice(1).replace(/[^a-zA-Z0-9_-]/g, "");
    if (!refId || !decoded) return "";
    const marker = `\n${refId}:T`;
    let idx = decoded.indexOf(marker);
    if (idx >= 0) idx += 1;
    else if (decoded.startsWith(`${refId}:T`)) idx = 0;
    if (idx < 0) return "";
    const commaIdx = decoded.indexOf(",", idx);
    if (commaIdx < 0) return "";
    const endMatch = decoded.slice(commaIdx + 1).search(/\n[0-9a-zA-Z_-]{1,6}:/);
    const raw = endMatch >= 0 ? decoded.slice(commaIdx + 1, commaIdx + 1 + endMatch) : decoded.slice(commaIdx + 1, commaIdx + 3500);
    return raw.replace(/<[^>]+>/g, " ").replace(/\\u003c[^\\]+\\u003e/g, " ").replace(/\s+/g, " ").trim();
  }

  function parseHtmlDocument(html) {
    if (!html || typeof DOMParser === "undefined") return null;
    try {
      return new DOMParser().parseFromString(String(html), "text/html");
    } catch (_) {
      return null;
    }
  }

  function upsertIccEntry(byNormName, item, fmt, prefix, overwrite) {
    if (!item || !item.name) return;
    const norm = normalizePersonName(item.name);
    if (!norm) return;
    let entry = byNormName.get(norm);
    if (!entry) {
      entry = {
        cbId: item.id ? String(item.id) : "",
        cbName: item.name,
        cbSlug: buildCricbuzzSlug(item.name),
        country: item.country || "",
        normTokens: norm.split(" ").filter(Boolean),
        ranks: {}
      };
      byNormName.set(norm, entry);
    } else if (!entry.cbId && item.id) {
      entry.cbId = String(item.id);
    }
    const key = `${fmt}_${prefix}`;
    if (overwrite || !entry.ranks[key]) {
      entry.ranks[key] = {
        rank: parseInt(item.rank, 10) || item.rank,
        rating: parseInt(item.rating || item.points, 10) || item.rating || ""
      };
    }
  }

  async function fetchWikiIccRankings(gender, byNormName) {
    const pageTitle = gender === "women" ? "ICC_Women's_Player_Rankings" : "ICC_Men's_Player_Rankings";
    const url = `https://en.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(pageTitle)}&redirects=1&prop=text&format=json&origin=*`;
    const payload = await fetchResource("", url, "json", { timeoutMs: 8000 }).catch(() => null);
    const html = payload && payload.parse && payload.parse.text && payload.parse.text["*"];
    const doc = parseHtmlDocument(html);
    if (!doc) return 0;

    let added = 0;
    const tables = doc.querySelectorAll("table.wikitable");
    tables.forEach((tbl) => {
      const rows = tbl.querySelectorAll("tr");
      if (rows.length < 3) return;
      const titleText = (rows[0].textContent || "").replace(/\s+/g, " ").trim();
      if (!/ICC\s+Top/i.test(titleText)) return;

      const fmt = /\bTest\b/i.test(titleText)
        ? "test"
        : /\bW?ODI\b/i.test(titleText)
          ? "odi"
          : /\bW?T20I?\b/i.test(titleText)
            ? "t20"
            : "";
      const prefix = /bat/i.test(titleText)
        ? "bat"
        : /bowl/i.test(titleText)
          ? "bowl"
          : /all-?round/i.test(titleText)
            ? "all"
            : "";
      if (!fmt || !prefix) return;

      for (let r = 1; r < rows.length; r += 1) {
        const cells = rows[r].querySelectorAll("th, td");
        if (cells.length < 3) continue;
        const rankNum = parseInt((cells[0].textContent || "").trim(), 10);
        if (!Number.isFinite(rankNum) || rankNum < 1 || rankNum > 20) continue;
        const nameCell = cells[1];
        const links = nameCell.querySelectorAll("a");
        const playerLink = links.length ? links[links.length - 1] : null;
        const rawName = (playerLink ? playerLink.textContent : nameCell.textContent || "")
          .replace(/\[[^\]]*\]/g, "")
          .replace(/\s+/g, " ")
          .trim();
        const ratingNum = parseInt((cells[2].textContent || "").replace(/[^0-9]/g, ""), 10) || "";
        if (!rawName) continue;
        const flagImg = nameCell.querySelector("img");
        const country = flagImg ? (flagImg.getAttribute("alt") || "").trim() : "";
        upsertIccEntry(byNormName, { name: rawName, rank: rankNum, rating: ratingNum, country }, fmt, prefix);
        added += 1;
      }
    });
    return added;
  }

  const wikiCricketCache = new Map();

  function parseWikiInfoboxDetails(html, extractText) {
    const doc = parseHtmlDocument(html);
    const out = {
      infoboxLoaded: false,
      currentIplTeam: "",
      nationalClosed: false,
      played: { test: false, odi: false, t20: false },
      careerBatting: null,
      careerBowling: null
    };
    const nowYear = new Date().getFullYear();

    if (doc) {
      const ib = doc.querySelector("table.infobox");
      if (ib) {
        const cleanCell = (el) =>
          (el ? el.textContent : "")
            .replace(/\u00a0/g, " ")
            .replace(/\[\s*[a-z0-9]+\s*\]/gi, "")
            .replace(/\s+/g, " ")
            .trim();

        const rows = Array.from(ib.querySelectorAll("tr"));
        if (rows.length > 0) out.infoboxLoaded = true;
        rows.forEach((tr) => {
          const cells = tr.querySelectorAll("th, td");
          if (cells.length < 2) return;
          const left = cleanCell(cells[0]);
          const right = cleanCell(cells[1]);

          if (/^National side$/i.test(left)) {
            const spanMatch = right.match(/\((\d{4})\s*[–-]\s*(present|\d{4})\)/i);
            if (spanMatch && spanMatch[2].toLowerCase() !== "present") {
              const endYr = parseInt(spanMatch[2], 10);
              if (Number.isFinite(endYr) && endYr < nowYear) {
                out.nationalClosed = true;
              }
            }
          }

          if (/^(Test debut|Only Test|Last Test)\b/i.test(left)) out.played.test = true;
          if (/^(ODI debut|Only ODI|Last ODI)\b/i.test(left)) out.played.odi = true;
          if (/^(T20I debut|Only T20I|Last T20I)\b/i.test(left)) out.played.t20 = true;

          const iplMatch = matchActiveIplFranchise(right);
          if (iplMatch) {
            const hasPresent = /\bpresent\b/i.test(left);
            const hasCurrYr = new RegExp(`\\b(?:${nowYear}|${nowYear - 1})\\b`).test(left);
            const endedPrev = new RegExp(`[–-]\\s*${nowYear - 1}\\b`).test(left) && !hasPresent;
            if (hasPresent || (hasCurrYr && !endedPrev)) {
              out.currentIplTeam = iplMatch;
            }
          }
        });

        // Parse Career statistics subtable inside Infobox
        const compIdx = rows.findIndex((tr) => {
          const c0 = tr.querySelector("th, td");
          return c0 && /^Competition$/i.test(cleanCell(c0));
        });
        if (compIdx >= 0) {
          const hdrCells = Array.from(rows[compIdx].querySelectorAll("th, td"));
          const rawFormats = hdrCells.slice(1).map((c) => cleanCell(c)).filter(Boolean);
          const formats = rawFormats.map((f) => (/^LA$/i.test(f) ? "List A" : /^WT20I$/i.test(f) ? "T20I" : /^WODI$/i.test(f) ? "ODI" : f));
          const colCount = formats.length;

          const batMap = {
            Matches: "Matches",
            "Runs scored": "Runs",
            "Batting average": "Average",
            "100s/50s": "100s/50s",
            "Top score": "Highest"
          };
          const bowlMap = {
            Matches: "Matches",
            "Balls bowled": "Balls",
            Wickets: "Wickets",
            "Bowling average": "Avg",
            "5 wickets in innings": "5w",
            "Best bowling": "BBI"
          };
          const batRows = [];
          const bowlRows = [];
          let hasPositiveWickets = false;

          for (let r = compIdx + 1; r < rows.length; r += 1) {
            const cells = Array.from(rows[r].querySelectorAll("th, td"));
            if (cells.length < colCount + 1) continue;
            const lbl = cleanCell(cells[0]);
            const cols = cells.slice(1, 1 + colCount).map((c) => cleanCell(c) || "-");

            if (lbl === "Matches") {
              formats.forEach((f, fIdx) => {
                const n = parseInt(String(cols[fIdx] || "").replace(/[^0-9]/g, ""), 10);
                if (Number.isFinite(n) && n > 0) {
                  if (/^Test$/i.test(f)) out.played.test = true;
                  if (/^ODI$/i.test(f)) out.played.odi = true;
                  if (/^T20I$/i.test(f)) out.played.t20 = true;
                }
              });
            }

            if (batMap[lbl]) batRows.push({ label: batMap[lbl], cols });
            if (bowlMap[lbl]) {
              if (lbl === "Wickets" && cols.some((v) => (parseInt(String(v).replace(/[^0-9]/g, ""), 10) || 0) > 0)) {
                hasPositiveWickets = true;
              }
              bowlRows.push({ label: bowlMap[lbl], cols });
            }
          }

          if (formats.length && batRows.length > 1) {
            out.careerBatting = { formats, rows: batRows };
          }
          if (formats.length && hasPositiveWickets && bowlRows.length > 1) {
            out.careerBowling = { formats, rows: bowlRows };
          }
        }
      }
    }

    if (!out.currentIplTeam && extractText) {
      const lead = String(extractText).slice(0, 1200);
      const presentIplSentence = lead.match(/[^.\n]*\b(?:plays?\s+for|represents?)\b[^.\n]*\bIndian Premier League\b[^.\n]*/i);
      if (presentIplSentence) {
        const team = matchActiveIplFranchise(presentIplSentence[0]);
        if (team) out.currentIplTeam = team;
      }
    }

    return out;
  }

  function detectCricketFormatRetirements(texts, playerName, played) {
    const out = { all: false, test: false, odi: false, t20: false };
    const combined = texts.filter(Boolean).join("\n");
    if (!combined) return out;

    const normTokens = normalizePersonName(playerName).split(" ").filter((t) => t.length >= 2);
    const lastToken = normTokens.length ? normTokens[normTokens.length - 1] : "";
    const sentences = combined.split(/(?<=[.!?])\s+|\n+/).filter(Boolean);

    for (let i = 0; i < sentences.length; i += 1) {
      const s = sentences[i].trim();
      if (!s || s.length > 420) continue;
      if (/\b(?:retired\s+(?:hurt|out|not out)|police|father|football)\b/i.test(s)) continue;

      if (i < 5 && /\bformer\s+(?:[a-z]+\s+){0,2}international\s+cricketer\b/i.test(s)) {
        out.all = true;
        continue;
      }

      if (!/\bretir(?:e|ed|es|ing|ement)\b|\bstep(?:ped)?\s+(?:down|away)\b|\bannounced\s+that\b[^.]{0,40}\bwould\s+be\s+(?:his|her)\s+last\b/i.test(s)) {
        continue;
      }

      // Skip attribution to a different player (e.g., "following MS Dhoni's retirement", "upon the retirement of Agarkar")
      const possMatch = s.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)'s\s+retire/i);
      if (possMatch && lastToken && !possMatch[1].toLowerCase().includes(lastToken)) continue;
      if (/\b(?:upon|following|after)\s+the\s+retirement\s+of\b/i.test(s)) continue;

      const hasSelfRef =
        /\b(?:he|she|his|her|himself|herself)\b/i.test(s) ||
        (lastToken && s.toLowerCase().includes(lastToken));
      if (!hasSelfRef && !/^announced\b/i.test(s)) continue;

      if (/\bretir(?:e|ed|es|ing|ement)\b[^.\n;]{0,65}\b(?:all\s+forms\s+of\s+)?international\s+cricket\b|\bretired\s+from\s+all\s+formats\b/i.test(s)) {
        out.all = true;
      }
      if (/\b(?:retire(?:d|s|ment)?|step(?:ped)?\s+(?:down|away))\b[^.\n;]{0,65}\b(?:the\s+)?Tests?(?:\s+cricket|\s*match(?:es)?)?\b|\bTest\s+(?:cricket\s+)?retirement\b|\bwould\s+be\s+(?:his|her)\s+last[^.\n;]{0,30}\bTest/i.test(s)) {
        out.test = true;
      }
      if (/\b(?:retire(?:d|s|ment)?|step(?:ped)?\s+(?:down|away))\b[^.\n;]{0,65}\b(?:the\s+)?(?:ODIs?|One[-\s]Day\s+Internationals?)\b|\bODI\s+retirement\b/i.test(s)) {
        out.odi = true;
      }
      if (/\b(?:retire(?:d|s|ment)?|step(?:ped)?\s+(?:down|away))\b[^.\n;]{0,65}\b(?:the\s+)?(?:T20Is?|T20\s+Internationals?)\b|\bT20I?\s+retirement\b/i.test(s)) {
        out.t20 = true;
      }
    }

    if (out.all) {
      if (played.test) out.test = true;
      if (played.odi) out.odi = true;
      if (played.t20) out.t20 = true;
    }
    return out;
  }

  async function fetchWikipediaCricketDetails(primaryName, fallbackName) {
    const cleanName = String(primaryName || fallbackName || "").replace(/\s+/g, " ").trim();
    if (!cleanName) return {};
    const cacheKey = cleanName.toLowerCase();
    const cached = wikiCricketCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < PROFILE_CACHE_TTL_MS) return cached.data;

    const cricketRe = /\b(cricket|cricketer|batsman|batter|bowler|all-rounder|wicket-?keeper|ipl|test cricket)\b/i;

    const queryTitleWithParse = async (titleStr, requireMatch) => {
      const qUrl = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(titleStr)}&redirects=1&prop=extracts|pageimages&explaintext=1&pithumbsize=500&format=json&origin=*`;
      const pUrl = `https://en.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(titleStr)}&redirects=1&prop=text&section=0&disabletoc=1&format=json&origin=*`;
      const [data, parseResInitial] = await Promise.all([
        fetchResource("", qUrl, "json", { timeoutMs: 11000 }).catch(() => null),
        fetchResource("", pUrl, "json", { timeoutMs: 11000 }).catch(() => null)
      ]);
      const pages = data && data.query && data.query.pages ? Object.values(data.query.pages) : [];
      const page = pages[0];
      if (!page || page.missing !== undefined || !page.title) return null;
      const extract = String(page.extract || "");
      if (/\bmay refer to:\b/i.test(extract.slice(0, 260))) return null;
      if (requireMatch && !cricketRe.test(extract.slice(0, 1200))) return null;

      let parseRes = parseResInitial;
      let sec0Html = (parseRes && parseRes.parse && parseRes.parse.text && parseRes.parse.text["*"]) || "";
      if (!sec0Html && page.title) {
        const retryUrl = `https://en.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(page.title)}&redirects=1&prop=text&section=0&disabletoc=1&format=json&origin=*`;
        parseRes = await fetchResource("", retryUrl, "json", { timeoutMs: 11000 }).catch(() => null);
        sec0Html = (parseRes && parseRes.parse && parseRes.parse.text && parseRes.parse.text["*"]) || "";
      }

      return {
        title: page.title,
        photo: (page.thumbnail && page.thumbnail.source) || "",
        extract,
        sec0Html
      };
    };

    let pageData = await queryTitleWithParse(cleanName, true);
    if (!pageData && fallbackName && normalizePersonName(fallbackName) !== normalizePersonName(cleanName)) {
      pageData = await queryTitleWithParse(fallbackName, true);
    }
    if (!pageData) {
      const searchQ = `${cleanName} cricketer`;
      const srch = await fetchResource(
        `/api/wiki/search?q=${encodeURIComponent(searchQ)}`,
        `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(searchQ)}&format=json&srlimit=3&origin=*`,
        "json",
        { timeoutMs: 8000 }
      ).catch(() => null);
      const hits = srch && srch.query && Array.isArray(srch.query.search) ? srch.query.search : [];
      const hitTitle = (hits.find((h) => cricketRe.test(h.snippet || h.title || "")) || hits[0] || {}).title || "";
      if (hitTitle) pageData = await queryTitleWithParse(hitTitle, false);
    }

    let finalObj = {};
    if (pageData && pageData.title) {
      const parsedIb = parseWikiInfoboxDetails(pageData.sec0Html, pageData.extract);
      finalObj = {
        loaded: true,
        infoboxLoaded: parsedIb.infoboxLoaded,
        wikiTitle: pageData.title,
        photo: pageData.photo || "",
        extract: pageData.extract || "",
        currentIplTeam: parsedIb.currentIplTeam || "",
        nationalClosed: parsedIb.nationalClosed,
        played: parsedIb.played,
        careerBatting: parsedIb.careerBatting,
        careerBowling: parsedIb.careerBowling
      };
    }

    if (finalObj.infoboxLoaded) {
      wikiCricketCache.set(cacheKey, { ts: Date.now(), data: finalObj });
    }
    return finalObj;
  }

  async function fetchWikipediaProfile(name, sportHint) {
    const cleanName = String(name || "").replace(/\s+/g, " ").trim();
    if (!cleanName) return {};
    const cacheKey = `${sportHint}:${cleanName.toLowerCase()}`;
    const cached = wikiProfileCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < PROFILE_CACHE_TTL_MS) return cached.data;

    const sportRe =
      sportHint === "cricketer"
        ? /cricket|batsman|batter|bowler|all-rounder|wicket/i
        : /football|soccer|midfielder|forward|defender|goalkeeper|striker|winger/i;

    const trySummary = async (titleStr, requireSportMatch) => {
      const enc = encodeURIComponent(String(titleStr || "").trim().replace(/\s+/g, "_"));
      const data = await fetchResource(
        `/api/wiki/summary?title=${encodeURIComponent(titleStr)}`,
        `https://en.wikipedia.org/api/rest_v1/page/summary/${enc}`,
        "json",
        { timeoutMs: 5000 }
      ).catch(() => null);
      if (!data || data.type === "disambiguation" || !data.title) return null;
      const meta = `${data.description || ""} ${data.extract || ""}`;
      if (requireSportMatch && !sportRe.test(meta)) return null;
      return {
        photo: (data.thumbnail && data.thumbnail.source) || "",
        description: data.description || "",
        wikiTitle: data.title || ""
      };
    };

    let res = await trySummary(cleanName, true);
    if (!res) {
      const q = `${cleanName} ${sportHint}`;
      const srch = await fetchResource(
        `/api/wiki/search?q=${encodeURIComponent(q)}`,
        `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(q)}&format=json&srlimit=2&origin=*`,
        "json",
        { timeoutMs: 5000 }
      ).catch(() => null);
      const hitTitle =
        srch && srch.query && Array.isArray(srch.query.search) && srch.query.search[0]
          ? srch.query.search[0].title
          : "";
      if (hitTitle) {
        res = await trySummary(hitTitle, false);
      }
    }

    const finalObj = res || {};
    wikiProfileCache.set(cacheKey, { ts: Date.now(), data: finalObj });
    return finalObj;
  }

  async function fetchIccRankingsMap(gender) {
    const gKey = gender === "women" ? "women" : "men";
    const cached = iccRankingsCache[gKey];
    if (cached && Date.now() - cached.ts < PROFILE_CACHE_TTL_MS * 2) {
      return cached;
    }

    const categories = [
      { cat: "batting", prefix: "bat" },
      { cat: "bowling", prefix: "bowl" },
      { cat: "all-rounder", prefix: "all" }
    ];

    const cbPromise = proxyAvailable === true
      ? Promise.allSettled(
          categories.map((c) =>
            fetchResource(
              `/api/cricket/icc-rankings?cat=${c.cat}&gender=${gKey}`,
              "",
              "text",
              { timeoutMs: 7000 }
            )
          )
        )
      : Promise.resolve([]);

    const byNormName = new Map();
    const formats = ["test", "odi", "t20"];

    const [cbResponses, wikiAdded] = await Promise.all([
      cbPromise,
      fetchWikiIccRankings(gKey, byNormName).catch(() => 0)
    ]);

    let cbAdded = 0;
    cbResponses.forEach((res, cIdx) => {
      if (res.status !== "fulfilled" || !res.value) return;
      const prefix = categories[cIdx].prefix;
      const decoded = decodeNextFlightText(res.value);
      const fmtData = extractBalancedJsonAfter(decoded, '"formatTypesData":');
      if (!fmtData || typeof fmtData !== "object") return;

      formats.forEach((fmt) => {
        const list = fmtData[fmt] && Array.isArray(fmtData[fmt].rank) ? fmtData[fmt].rank : [];
        list.forEach((item) => {
          if (!item || !item.name) return;
          upsertIccEntry(byNormName, item, fmt, prefix, true);
          cbAdded += 1;
        });
      });
    });

    const scope = cbAdded > 0 ? "top100" : wikiAdded > 0 ? "top10" : "none";
    const result = { ts: Date.now(), map: byNormName, scope };
    iccRankingsCache[gKey] = result;
    return result;
  }

  function findIccRankingEntry(iccMap, playerName, teamHint) {
    if (!iccMap || !iccMap.size || !playerName) return null;
    const norm = normalizePersonName(playerName);
    if (!norm) return null;
    if (iccMap.has(norm)) return iccMap.get(norm);

    const targetTokens = norm.split(" ").filter(Boolean);
    const teamLower = String(teamHint || "").toLowerCase();
    let best = null;
    let bestScore = 0;

    iccMap.forEach((entry) => {
      const eTokens = entry.normTokens || [];
      if (!eTokens.length) return;
      const allEntryInTarget = eTokens.every((t) => targetTokens.includes(t));
      const allTargetInEntry = targetTokens.every((t) => eTokens.includes(t));
      if (!allEntryInTarget && !allTargetInEntry) {
        // Check initial + surname match (e.g. "S Gill" vs "Shubman Gill", "KL Rahul")
        const lastSame = eTokens[eTokens.length - 1] === targetTokens[targetTokens.length - 1];
        const firstCompat =
          eTokens[0] &&
          targetTokens[0] &&
          (eTokens[0].charAt(0) === targetTokens[0].charAt(0)) &&
          (eTokens[0].length === 1 || targetTokens[0].length === 1);
        if (!(lastSame && firstCompat && eTokens.length >= 2 && targetTokens.length >= 2)) return;
      }

      let score = Math.min(eTokens.length, targetTokens.length) * 10;
      if (entry.country && teamLower && teamLower.includes(entry.country.toLowerCase())) {
        score += 20;
      }
      if (score > bestScore) {
        bestScore = score;
        best = entry;
      }
    });

    return best;
  }

  function formatCricbuzzCareerTable(statsBlock) {
    if (!statsBlock || !Array.isArray(statsBlock.headers) || !Array.isArray(statsBlock.values)) return null;
    const formats = statsBlock.headers.slice(1);
    const rows = [];
    statsBlock.values.forEach((r) => {
      if (!r || !Array.isArray(r.values) || !r.values.length) return;
      rows.push({
        label: r.values[0],
        cols: r.values.slice(1)
      });
    });
    return formats.length && rows.length ? { formats, rows } : null;
  }

  async function fetchFootballPlayerProfile(hint) {
    const id = hint && hint.id ? String(hint.id) : "";
    const name = (hint && hint.name) || "Player";

    const [athRes, ovRes, wikiFallback] = await Promise.all([
      id
        ? fetchResource(
            `/api/soccer/athlete?id=${encodeURIComponent(id)}`,
            `https://site.web.api.espn.com/apis/common/v3/sports/soccer/athletes/${encodeURIComponent(id)}`,
            "json",
            { timeoutMs: 6500 }
          ).catch(() => null)
        : Promise.resolve(null),
      id
        ? fetchResource(
            `/api/soccer/athlete-overview?id=${encodeURIComponent(id)}`,
            `https://site.web.api.espn.com/apis/common/v3/sports/soccer/athletes/${encodeURIComponent(id)}/overview`,
            "json",
            { timeoutMs: 6500 }
          ).catch(() => null)
        : Promise.resolve(null),
      hint && hint.headshot ? Promise.resolve({}) : fetchWikipediaProfile(name, "footballer")
    ]);

    const a = (athRes && athRes.athlete) || {};
    const espnPhoto = (a.headshot && a.headshot.href) || (hint && hint.headshot) || "";
    const resolvedName = a.displayName || name;
    let wiki = wikiFallback || {};
    if (!espnPhoto && !wiki.photo && resolvedName) {
      wiki = await fetchWikipediaProfile(resolvedName, "footballer").catch(() => ({}));
    }

    const summaryList =
      a.statsSummary && Array.isArray(a.statsSummary.statistics)
        ? a.statsSummary.statistics
            .filter((s) => s && s.displayName && s.displayValue !== undefined && s.displayValue !== "")
            .map((s) => ({ label: s.displayName, value: String(s.displayValue) }))
        : [];

    const ovStats = ovRes && ovRes.statistics ? ovRes.statistics : null;
    const labels = ovStats && Array.isArray(ovStats.labels) ? ovStats.labels : [];
    const splits =
      ovStats && Array.isArray(ovStats.splits)
        ? ovStats.splits.slice(0, 5).map((sp) => ({
            competition: sp.displayName || "Competition",
            values: Array.isArray(sp.stats) ? sp.stats : []
          }))
        : [];

    return {
      sport: "football",
      name: resolvedName,
      photo: espnPhoto || wiki.photo || "",
      bioNote: wiki.description || "",
      club: (a.team && (a.team.displayName || a.team.shortDisplayName)) || (hint && hint.team) || "-",
      nationality: a.citizenship || "-",
      flagUrl: (a.flag && a.flag.href) || "",
      position: (a.position && (a.position.displayName || a.position.name)) || (hint && hint.pos) || "-",
      jersey: a.jersey ? String(a.jersey) : (hint && hint.jersey) || "-",
      age: a.age || computeAgeFromDob(a.dateOfBirth) || "-",
      height: a.displayHeight || "-",
      weight: a.displayWeight || "-",
      matchStats: (hint && hint.matchStats) || null,
      seasonTitle: (a.statsSummary && a.statsSummary.displayName) || "Season Summary",
      summaryStats: summaryList,
      seasonLabels: labels,
      seasonSplits: splits
    };
  }

  function checkCareerTableFormatPlayed(table, colPattern) {
    if (!table || !Array.isArray(table.formats) || !Array.isArray(table.rows)) return false;
    const colIdx = table.formats.findIndex((f) => colPattern.test(String(f || "")));
    if (colIdx < 0) return false;
    const matchesRow = table.rows.find((r) => /^matches$/i.test(String((r && r.label) || "")));
    if (!matchesRow || !Array.isArray(matchesRow.cols)) return true;
    const n = parseInt(String(matchesRow.cols[colIdx] || "").replace(/[^0-9]/g, ""), 10);
    return Number.isFinite(n) && n > 0;
  }

  async function fetchCricketPlayerProfile(hint) {
    const id = hint && hint.id ? String(hint.id) : "";
    const name = (hint && hint.name) || "Cricketer";
    const teamHint = (hint && hint.team) || "";
    const isWomen = /women/i.test(`${teamHint} ${(hint && hint.series) || ""}`);
    const gender = isWomen ? "women" : "men";

    const [athRes, iccResult] = await Promise.all([
      id
        ? fetchResource(
            `/api/cricket/athlete?id=${encodeURIComponent(id)}`,
            `https://site.web.api.espn.com/apis/common/v3/sports/cricket/athletes/${encodeURIComponent(id)}`,
            "json",
            { timeoutMs: 6500 }
          ).catch(() => null)
        : Promise.resolve(null),
      fetchIccRankingsMap(gender).catch(() => ({ map: new Map(), scope: "none" }))
    ]);

    const iccMap = (iccResult && iccResult.map) || new Map();
    const iccScope = (iccResult && iccResult.scope) || "none";
    const a = (athRes && athRes.athlete) || {};
    const displayName = a.displayName || name;
    const explicitHeadshot = (a.headshot && a.headshot.href) || "";
    const cdnHeadshotFallback = id ? `https://a.espncdn.com/i/headshots/cricket/players/full/${id}.png` : "";
    const espnPhoto = explicitHeadshot || cdnHeadshotFallback;
    const cbEntry = findIccRankingEntry(iccMap, displayName, teamHint) || findIccRankingEntry(iccMap, name, teamHint);

    const [cbHtmlRes, wikiDetails] = await Promise.all([
      cbEntry && cbEntry.cbId && proxyAvailable === true
        ? fetchResource(
            `/api/cricket/cb-profile?id=${encodeURIComponent(cbEntry.cbId)}&slug=${encodeURIComponent(cbEntry.cbSlug)}`,
            "",
            "text",
            { timeoutMs: 7000 }
          ).catch(() => null)
        : Promise.resolve(null),
      fetchWikipediaCricketDetails(displayName, name).catch(() => ({}))
    ]);

    let playerData = null;
    let battingTable = null;
    let bowlingTable = null;
    let cbBioText = "";
    if (cbHtmlRes) {
      const decoded = decodeNextFlightText(cbHtmlRes);
      playerData = extractBalancedJsonAfter(decoded, '"playerData":');
      battingTable = formatCricbuzzCareerTable(extractBalancedJsonAfter(decoded, '"battingStats":'));
      bowlingTable = formatCricbuzzCareerTable(extractBalancedJsonAfter(decoded, '"bowlingStats":'));
      cbBioText = resolveCricbuzzBio(decoded, playerData);
    }

    let ageVal = a.age || computeAgeFromDob(a.dateOfBirth);
    if (!ageVal && playerData && playerData.DoB) {
      const mAge = String(playerData.DoB).match(/\((\d+)\s+years/i);
      if (mAge) ageVal = parseInt(mAge[1], 10);
    }
    if (!ageVal && wikiDetails && wikiDetails.extract) {
      const mBorn = wikiDetails.extract.match(/\bborn\s+(\d{1,2}\s+[A-Za-z]+\s+\d{4}|[A-Za-z]+\s+\d{1,2},\s+\d{4})/i);
      if (mBorn) ageVal = computeAgeFromDob(mBorn[1]);
    }

    const rMap = (cbEntry && cbEntry.ranks) || {};
    const pRanks = (playerData && playerData.rankings) || {};
    const buildRankCell = (key, fallbackVal, bestVal) => {
      const item = rMap[key];
      const rank = item && item.rank ? item.rank : fallbackVal || null;
      const rating = item && item.rating ? item.rating : null;
      return rank || bestVal ? { rank: rank || null, rating, best: bestVal || null } : null;
    };

    const iccRankings = {
      batting: {
        test: buildRankCell("test_bat", pRanks.bat && pRanks.bat.testRank, pRanks.bat && pRanks.bat.testBestRank),
        odi: buildRankCell("odi_bat", pRanks.bat && pRanks.bat.odiRank, pRanks.bat && pRanks.bat.odiBestRank),
        t20: buildRankCell("t20_bat", pRanks.bat && pRanks.bat.t20Rank, pRanks.bat && pRanks.bat.t20BestRank)
      },
      bowling: {
        test: buildRankCell("test_bowl", pRanks.bowl && pRanks.bowl.testRank, pRanks.bowl && pRanks.bowl.testBestRank),
        odi: buildRankCell("odi_bowl", pRanks.bowl && pRanks.bowl.odiRank, pRanks.bowl && pRanks.bowl.odiBestRank),
        t20: buildRankCell("t20_bowl", pRanks.bowl && pRanks.bowl.t20Rank, pRanks.bowl && pRanks.bowl.t20BestRank)
      },
      allRounder: {
        test: buildRankCell("test_all", pRanks.all && pRanks.all.testRank, pRanks.all && pRanks.all.testBestRank),
        odi: buildRankCell("odi_all", pRanks.all && pRanks.all.odiRank, pRanks.all && pRanks.all.odiBestRank),
        t20: buildRankCell("t20_all", pRanks.all && pRanks.all.t20Rank, pRanks.all && pRanks.all.t20BestRank)
      }
    };

    const hintFmtRaw = String((hint && hint.format) || "");
    const hintIsFmt = (fmt) => {
      if (fmt === "test") return /\btest\b/i.test(hintFmtRaw);
      if (fmt === "odi") return /\bw?odi\b/i.test(hintFmtRaw);
      if (fmt === "t20") return /\bw?t20i\b/i.test(hintFmtRaw) && !/\bipl\b/i.test(hintFmtRaw);
      return false;
    };

    const wikiPlayed = (wikiDetails && wikiDetails.played) || {};
    const cbPlayed = {
      test: checkCareerTableFormatPlayed(battingTable, /^Test$/i) || checkCareerTableFormatPlayed(bowlingTable, /^Test$/i),
      odi: checkCareerTableFormatPlayed(battingTable, /^ODI$/i) || checkCareerTableFormatPlayed(bowlingTable, /^ODI$/i),
      t20: checkCareerTableFormatPlayed(battingTable, /^T20I?$/i) || checkCareerTableFormatPlayed(bowlingTable, /^T20I?$/i)
    };

    const hasFmtRank = (fmt) =>
      ["batting", "bowling", "allRounder"].some(
        (cat) => iccRankings[cat][fmt] && iccRankings[cat][fmt].rank
      );
    const hasFmtBest = (fmt) =>
      ["batting", "bowling", "allRounder"].some(
        (cat) => iccRankings[cat][fmt] && iccRankings[cat][fmt].best
      );

    const played = {
      test: Boolean(hintIsFmt("test") || wikiPlayed.test || cbPlayed.test || hasFmtRank("test") || hasFmtBest("test")),
      odi: Boolean(hintIsFmt("odi") || wikiPlayed.odi || cbPlayed.odi || hasFmtRank("odi") || hasFmtBest("odi")),
      t20: Boolean(hintIsFmt("t20") || wikiPlayed.t20 || cbPlayed.t20 || hasFmtRank("t20") || hasFmtBest("t20"))
    };

    const retired = detectCricketFormatRetirements(
      [wikiDetails && wikiDetails.extract, cbBioText],
      (playerData && playerData.name) || displayName,
      played
    );

    const hasMetaSource = Boolean((wikiDetails && wikiDetails.infoboxLoaded) || cbHtmlRes);
    const nationalClosed = Boolean(wikiDetails && wikiDetails.nationalClosed);
    const formatStatus = {};

    ["test", "odi", "t20"].forEach((fmt) => {
      const rankList = ["batting", "bowling", "allRounder"]
        .map((cat) => iccRankings[cat][fmt] && parseInt(iccRankings[cat][fmt].rank, 10))
        .filter((n) => Number.isFinite(n) && n > 0);
      const bestCurrent = rankList.length ? Math.min(...rankList) : null;
      const isNow = hintIsFmt(fmt);
      const isRet = !isNow && played[fmt] && (retired[fmt] || retired.all || nationalClosed);

      if (isRet) {
        formatStatus[fmt] = { state: "retired", label: "Retired" };
      } else if (!played[fmt] && hasMetaSource) {
        formatStatus[fmt] = { state: "not_playing", label: "Not Playing" };
      } else if (bestCurrent) {
        formatStatus[fmt] = { state: "ranked", label: `Ranked #${bestCurrent}`, topRank: bestCurrent };
      } else if (!played[fmt]) {
        formatStatus[fmt] = { state: "unknown", label: "No data" };
      } else {
        formatStatus[fmt] = {
          state: "unranked",
          label: iccScope === "top10" ? "Outside Top 10" : "Unranked"
        };
      }
    });

    const iplFromHint =
      /ipl|indian premier league/i.test(`${hintFmtRaw} ${(hint && hint.series) || ""}`)
        ? matchActiveIplFranchise(teamHint)
        : "";
    const iplTeam = iplFromHint || (wikiDetails && wikiDetails.currentIplTeam) || "";

    return {
      sport: "cricket",
      name: (playerData && playerData.name) || displayName,
      fullName: (playerData && playerData.fullName) || displayName,
      photo: espnPhoto || (wikiDetails && wikiDetails.photo) || "",
      fallbackPhoto: (wikiDetails && wikiDetails.photo) || "",
      team: (playerData && playerData.intlTeam) || (a.team && a.team.displayName) || teamHint || (cbEntry && cbEntry.country) || "-",
      iplTeam,
      flagUrl: (a.flag && a.flag.href) || "",
      age: ageVal || "-",
      dob: (playerData && playerData.DoBFormat) || "",
      birthPlace: (playerData && playerData.birthPlace) || "",
      role: (playerData && playerData.role) || (a.position && a.position.name) || (hint && hint.role) || "-",
      batStyle: (a.batStyle && a.batStyle.description) || (playerData && playerData.bat) || "-",
      bowlStyle: (a.bowlStyle && a.bowlStyle.description) || (playerData && playerData.bowl) || "-",
      iccRankings,
      formatStatus,
      rankingsScope: iccScope,
      careerBatting: battingTable || (wikiDetails && wikiDetails.careerBatting) || null,
      careerBowling: bowlingTable || (wikiDetails && wikiDetails.careerBowling) || null,
      matchStats: (hint && hint.matchStats) || null
    };
  }

  async function fetchPlayerProfile(hint) {
    const sport = hint && hint.sport;
    const key = `${sport}:${(hint && hint.id) || ""}:${normalizePersonName(hint && hint.name)}:${normalizePersonName(hint && hint.team)}`;
    const cached = playerProfileCache.get(key);
    if (cached && Date.now() - cached.ts < PROFILE_CACHE_TTL_MS) {
      return cached.data;
    }

    const data =
      sport === "cricket"
        ? await fetchCricketPlayerProfile(hint)
        : await fetchFootballPlayerProfile(hint);
    playerProfileCache.set(key, { ts: Date.now(), data });
    return data;
  }

  Apex.liveFeed = {
    fetchLiveSnapshot,
    fetchFootballMatchSummary,
    fetchCricketMatchSummary,
    fetchCricketPlayByPlay,
    fetchPlayerProfile
  };
})(window);
