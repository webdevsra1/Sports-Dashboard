/* ==========================================================================
   Football / Soccer Renderer
   Renders Featured Match Hero Card, League Filters, and Live/Upcoming Grid.
   ========================================================================== */

(function (root) {
  "use strict";

  const Apex = (root.ApexSports = root.ApexSports || {});

  const LEAGUE_FILTERS = [
    { key: "ALL", label: "All Leagues" },
    { key: "LIVE", label: "Live Only" },
    { key: "UNL", label: "Nations League" },
    { key: "EPL", label: "Premier League" },
    { key: "UCL", label: "UCL" },
    { key: "LALIGA", label: "La Liga" },
    { key: "SERIEA", label: "Serie A" },
    { key: "BUNDESLIGA", label: "Bundesliga" },
    { key: "INTL", label: "International" }
  ];

  function renderScorersList(scorers) {
    if (!scorers || !scorers.length) {
      return `<div class="scorer-line" style="color:var(--text-muted)">No goals yet</div>`;
    }
    return scorers
      .map(
        (s) =>
          `<div class="scorer-line"><span>⚽</span><span>${Apex.utils.escapeHtml(s)}</span></div>`
      )
      .join("");
  }

  function renderStatComparison(label, homeVal, awayVal, isPercent) {
    const hNum = Number(homeVal) || 0;
    const aNum = Number(awayVal) || 0;
    const total = hNum + aNum;
    const homePct = total > 0 ? Math.round((hNum / total) * 100) : 50;
    const awayPct = 100 - homePct;
    const suffix = isPercent ? "%" : "";

    return `
      <div class="stat-mini">
        <div class="stat-mini-head tabular">
          <span>${Apex.utils.escapeHtml(homeVal)}${suffix}</span>
          <span class="stat-mini-label">${Apex.utils.escapeHtml(label)}</span>
          <span>${Apex.utils.escapeHtml(awayVal)}${suffix}</span>
        </div>
        <div class="stat-bar-track">
          <div class="stat-bar-home" style="width:${homePct}%"></div>
          <div class="stat-bar-away" style="width:${awayPct}%"></div>
        </div>
      </div>
    `;
  }

  function renderHeroMatch(match) {
    if (!match) return "";
    const flashClass = match._flashUntil && match._flashUntil > Date.now() ? "is-flashing" : "";
    const { escapeHtml, renderCrest, renderStatusBadge } = Apex.utils;

    const hasXg = match.stats.xg && (match.stats.xg[0] > 0 || match.stats.xg[1] > 0);
    const thirdStat = !hasXg && match.stats.totalShots
      ? renderStatComparison("Shots", match.stats.totalShots[0], match.stats.totalShots[1], false)
      : renderStatComparison("xG", Number(match.stats.xg[0] || 0).toFixed(2), Number(match.stats.xg[1] || 0).toFixed(2), false);

    return `
      <article class="football-hero-card ${flashClass}" data-open-modal="football" data-id="${escapeHtml(match.id)}" title="Click to inspect match timeline & stats">
        <div class="hero-top-row">
          <span class="league-tag">● ${escapeHtml(match.leagueName)} <span style="color:var(--text-muted);font-weight:500">• ${escapeHtml(match.venue)}</span></span>
          ${renderStatusBadge(match.status, match.clock)}
        </div>

        <div class="hero-scoreboard">
          <div class="hero-team">
            ${renderCrest(match.home, true)}
            <div class="hero-team-info">
              <div class="hero-team-name">${escapeHtml(match.home.name)}</div>
              <div class="hero-team-sub">HOME</div>
            </div>
          </div>

          <div class="hero-score-box">
            <div class="hero-score-digits tabular">
              ${
                match.status === "PRE"
                  ? `<span style="font-size:20px;color:var(--text-secondary)">VS</span>`
                  : `<span>${escapeHtml(match.home.score)}</span><span class="score-sep">-</span><span>${escapeHtml(match.away.score)}</span>`
              }
            </div>
            <div class="hero-clock tabular">${escapeHtml(match.status === "LIVE" ? `LIVE ${match.clock}` : match.clock)}</div>
          </div>

          <div class="hero-team is-away">
            ${renderCrest(match.away, true)}
            <div class="hero-team-info">
              <div class="hero-team-name">${escapeHtml(match.away.name)}</div>
              <div class="hero-team-sub">AWAY</div>
            </div>
          </div>
        </div>

        <div class="hero-scorers">
          <div class="scorers-col">${renderScorersList(match.home.scorers)}</div>
          <div class="scorers-col is-away">${renderScorersList(match.away.scorers)}</div>
        </div>

        <div class="stats-mini-grid">
          ${renderStatComparison("Possession", match.stats.possession[0], match.stats.possession[1], true)}
          ${renderStatComparison("On Target", match.stats.shotsOnTarget[0], match.stats.shotsOnTarget[1], false)}
          ${thirdStat}
        </div>
      </article>
    `;
  }

  function renderCardPips(side) {
    let html = "";
    for (let i = 0; i < (side.redCards || 0); i += 1) {
      html += `<span class="card-pip is-red" title="Red Card"></span>`;
    }
    for (let i = 0; i < (side.yellowCards || 0); i += 1) {
      html += `<span class="card-pip is-yellow" title="Yellow Card"></span>`;
    }
    return html ? `<span class="match-side-cards">${html}</span>` : "";
  }

  function renderMatchRow(match, isFeatured) {
    const { escapeHtml, renderCrest, renderStatusBadge } = Apex.utils;
    const flashClass = match._flashUntil && match._flashUntil > Date.now() ? "is-flashing" : "";
    const featuredClass = isFeatured ? "is-featured" : "";

    return `
      <article class="match-row-card ${featuredClass} ${flashClass}" data-open-modal="football" data-id="${escapeHtml(match.id)}">
        <div class="match-row-meta">
          <span>${escapeHtml(match.leagueName)} • ${escapeHtml(match.venue.split(",")[0])}</span>
          <div style="display:flex;align-items:center;gap:6px;">
            <button type="button" class="filter-pill" style="padding:1px 7px;font-size:10px;" data-pin-football="${escapeHtml(match.id)}" title="Pin to top spotlight">
              ${isFeatured ? "Pinned" : "Pin"}
            </button>
            ${renderStatusBadge(match.status, match.clock)}
          </div>
        </div>

        <div class="match-row-teams">
          <div class="match-side">
            ${renderCrest(match.home, false)}
            <span class="match-side-name">${escapeHtml(match.home.name)}</span>
            ${renderCardPips(match.home)}
          </div>

          <div class="match-score-pill tabular">
            ${match.status === "PRE" ? "vs" : `${escapeHtml(match.home.score)} - ${escapeHtml(match.away.score)}`}
          </div>

          <div class="match-side is-away">
            ${renderCrest(match.away, false)}
            <span class="match-side-name">${escapeHtml(match.away.name)}</span>
            ${renderCardPips(match.away)}
          </div>
        </div>

        <div class="match-latest-note">
          <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(match.latestEvent)}</span>
          <span style="color:var(--sport-football);font-weight:600;flex-shrink:0;">Details →</span>
        </div>
      </article>
    `;
  }

  function renderFootballPanel(state, ui) {
    const container = document.getElementById("football-panel-body");
    const countEl = document.getElementById("football-panel-meta");
    if (!container) return;

    const matches = state.football || [];
    const liveCount = matches.filter((m) => m.status === "LIVE" || m.status === "HT").length;
    const prevCount = matches.filter((m) => m.status === "FT").length;
    if (countEl) {
      countEl.textContent = `${liveCount} Live • ${prevCount} Previous`;
    }

    if (!matches.length) {
      const msg = ui && ui.isInitialLoading
        ? "Loading live & previous football matches..."
        : "No live, upcoming, or previous football matches available.";
      container.innerHTML = `<div class="empty-state">${Apex.utils.escapeHtml(msg)}</div>`;
      return;
    }

    const featured =
      matches.find((m) => m.id === ui.featuredFootballId) ||
      matches.find((m) => m.status === "LIVE" || m.status === "HT") ||
      matches.find((m) => m.status === "PRE") ||
      matches[0];

    const filtered = matches.filter((m) => {
      if (ui.footballLeagueFilter === "ALL") return true;
      if (ui.footballLeagueFilter === "LIVE") return m.status === "LIVE" || m.status === "HT";
      if (ui.footballLeagueFilter === "INTL") {
        return ["UNL", "WCQ", "INTL", "WORLD"].includes(m.league) ||
          /nations|world|friendly|international|concacaf|copa|euro/i.test(m.leagueName || "");
      }
      if (ui.footballLeagueFilter === "UNL") {
        return m.league === "UNL" || /nations league/i.test(m.leagueName || "");
      }
      return m.league === ui.footballLeagueFilter;
    });

    const filterHtml = `
      <div class="filter-pills">
        ${LEAGUE_FILTERS.map(
          (f) =>
            `<button type="button" class="filter-pill ${ui.footballLeagueFilter === f.key ? "is-active" : ""}" data-fb-filter="${f.key}">${f.label}</button>`
        ).join("")}
      </div>
    `;

    const liveUpcomingMatches = filtered.filter((m) => m.status !== "FT");
    const previousMatches = filtered.filter((m) => m.status === "FT");
    const liveInFilterCount = liveUpcomingMatches.filter((m) => m.status === "LIVE" || m.status === "HT").length;

    const liveListHtml = liveUpcomingMatches.length
      ? liveUpcomingMatches.map((m) => renderMatchRow(m, featured && m.id === featured.id)).join("")
      : `<div class="empty-state is-compact">No live or upcoming matches in this league filter.</div>`;

    const prevEmptyText =
      ui.footballLeagueFilter === "LIVE"
        ? "Switch from Live Only to view previous match results."
        : "No previous results available in this league filter.";
    const prevListHtml = previousMatches.length
      ? previousMatches.map((m) => renderMatchRow(m, featured && m.id === featured.id)).join("")
      : `<div class="empty-state is-compact">${prevEmptyText}</div>`;

    container.innerHTML = `
      ${renderHeroMatch(featured)}
      ${filterHtml}
      <div class="matches-split-sections">
        <div class="match-split-box">
          <div class="match-split-header">
            <span class="match-split-title is-live-title"><span class="live-dot"></span>Live &amp; Upcoming</span>
            <span class="match-split-count tabular">${liveInFilterCount > 0 ? `${liveInFilterCount} LIVE • ` : ""}${liveUpcomingMatches.length}</span>
          </div>
          <div class="match-split-list">${liveListHtml}</div>
        </div>

        <div class="match-split-box">
          <div class="match-split-header">
            <span class="match-split-title is-prev-title">Previous Matches</span>
            <span class="match-split-count tabular">${previousMatches.length}</span>
          </div>
          <div class="match-split-list">${prevListHtml}</div>
        </div>
      </div>
    `;
  }

  Apex.renderers = Apex.renderers || {};
  Apex.renderers.renderFootballPanel = renderFootballPanel;
})(window);
