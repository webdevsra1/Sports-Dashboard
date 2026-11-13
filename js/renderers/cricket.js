/* ==========================================================================
   Cricket Renderer
   Renders Live Scorecard, CRR/RRR Equation, Active Batters/Bowler, Ball Strip,
   and Switchable Secondary Fixtures.
   ========================================================================== */

(function (root) {
  "use strict";

  const Apex = (root.ApexSports = root.ApexSports || {});

  function renderBallPill(ball) {
    const isObj = ball && typeof ball === "object";
    const raw = isObj ? String(ball.label ?? "0") : String(ball ?? "0");
    const up = raw.toUpperCase();
    let kind = isObj && ball.kind ? ball.kind : "";
    if (!kind) {
      if (up === "W" || up.includes("+W")) kind = "wicket";
      else if (up === "6") kind = "six";
      else if (up === "4") kind = "four";
      else if (/WD|NB|LB|B$/i.test(up)) kind = "extra";
      else if (up === "0" || up === "•") kind = "dot";
      else kind = "run";
    }
    const label = raw === "•" ? "0" : raw;
    const tooltip = isObj && ball.tooltip ? ` title="${Apex.utils.escapeHtml(ball.tooltip)}"` : "";
    return `<span class="cricket-ball-circle is-${Apex.utils.escapeHtml(kind)}"${tooltip}>${Apex.utils.escapeHtml(label)}</span>`;
  }

  function renderCricketTeamRow(team) {
    const { escapeHtml, renderCrest } = Apex.utils;
    return `
      <div class="cricket-team-row ${team.isBatting ? "is-batting" : ""}">
        <div class="cricket-team-left">
          ${renderCrest(team, false)}
          <div>
            <div class="cricket-team-code">
              ${escapeHtml(team.name)}
              ${team.isBatting ? `<span class="cricket-batting-dot" style="display:inline-block;margin-left:5px;vertical-align:middle;" title="Batting"></span>` : ""}
            </div>
            <div style="font-size:10px;color:var(--text-muted)">${team.isBatting ? "Batting" : "Innings"}</div>
          </div>
        </div>
        <div class="cricket-score-main tabular">
          <span>${escapeHtml(Apex.utils.formatCricketScore(team))}</span>
          ${team.overs && team.overs !== "-" ? `<span class="cricket-overs">(${escapeHtml(team.overs)} ov)</span>` : ""}
        </div>
      </div>
    `;
  }

  function renderCricketHero(match) {
    if (!match) return `<div class="empty-state">No cricket fixtures active.</div>`;
    const { escapeHtml, renderStatusBadge } = Apex.utils;
    const flashClass = match._flashUntil && match._flashUntil > Date.now() ? "is-flashing" : "";

    const hasPlayers = (match.batters && match.batters.length > 0) || Boolean(match.bowler);

    const battersRows =
      match.batters && match.batters.length
        ? match.batters
            .map(
              (b) => `
            <tr>
              <td>
                <div>${escapeHtml(b.name)}${b.striker ? `<span class="striker-mark">*</span>` : ""}</div>
                ${b.isOut && b.dismissal ? `<div class="cr-mini-dismissal">${escapeHtml(b.dismissal)}</div>` : ""}
              </td>
              <td>${escapeHtml(b.runs)}</td>
              <td>${escapeHtml(b.balls)}</td>
              <td>${escapeHtml(b.fours)}</td>
              <td>${escapeHtml(b.sixes)}</td>
              <td>${escapeHtml(b.sr)}</td>
            </tr>
          `
            )
            .join("")
        : "";

    const bowlerHtml = match.bowler
      ? `
        <table class="cricket-mini-table" style="border-top:1px solid var(--border-subtle)">
          <thead>
            <tr>
              <th>Bowler</th>
              <th>O</th>
              <th>M</th>
              <th>R</th>
              <th>W</th>
              <th>ECON</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>${escapeHtml(match.bowler.name)}</td>
              <td>${escapeHtml(match.bowler.overs)}</td>
              <td>${escapeHtml(match.bowler.maidens)}</td>
              <td>${escapeHtml(match.bowler.runs)}</td>
              <td>${escapeHtml(match.bowler.wickets)}</td>
              <td>${escapeHtml(match.bowler.econ)}</td>
            </tr>
          </tbody>
        </table>
      `
      : "";

    const playersBoxHtml = hasPlayers
      ? `
        <div class="cricket-players-box">
          ${
            battersRows
              ? `<table class="cricket-mini-table">
                  <thead>
                    <tr>
                      <th>Batter</th>
                      <th>R</th>
                      <th>B</th>
                      <th>4s</th>
                      <th>6s</th>
                      <th>SR</th>
                    </tr>
                  </thead>
                  <tbody>${battersRows}</tbody>
                </table>`
              : ""
          }
          ${bowlerHtml}
        </div>
      `
      : "";

    const ballsHtml =
      match.recentBalls && match.recentBalls.length
        ? `
          <div class="recent-balls-wrap">
            <span class="recent-balls-label">Recent Balls</span>
            <div class="recent-balls-list">${match.recentBalls.map(renderBallPill).join("")}</div>
          </div>
        `
        : "";

    const rateText =
      match.crr && match.crr !== "-"
        ? `CRR ${escapeHtml(match.crr)}${match.rrr ? ` • RRR ${escapeHtml(match.rrr)}` : ""}`
        : escapeHtml(match.format);

    return `
      <article class="cricket-hero ${flashClass}" data-open-modal="cricket" data-id="${escapeHtml(match.id)}">
        <div class="hero-top-row">
          <div style="display:flex;align-items:center;gap:7px;min-width:0;">
            <span class="cricket-format-tag">${escapeHtml(match.format)}</span>
            <span style="font-size:11px;color:var(--text-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(match.series)}</span>
          </div>
          ${renderStatusBadge(match.status, match.clock)}
        </div>

        <div class="cricket-innings-stack">
          ${renderCricketTeamRow(match.team1)}
          ${renderCricketTeamRow(match.team2)}
        </div>

        <div class="cricket-equation-bar">
          <span>${escapeHtml(match.equation)}</span>
          <span class="cricket-rates tabular">${rateText}</span>
        </div>

        ${playersBoxHtml}
        ${ballsHtml}

        <div style="font-size:11px;color:var(--text-secondary);border-top:1px solid var(--border-subtle);padding-top:7px;display:flex;justify-content:space-between;gap:8px;">
          <span>${escapeHtml(match.lastBallNote || match.venue || "Click for full innings scorecard")}</span>
          <span style="color:var(--sport-cricket);font-weight:600;flex-shrink:0;">Details →</span>
        </div>
      </article>
    `;
  }

  function renderCricketMiniCard(match, isSelected) {
    const { escapeHtml, renderStatusBadge, formatCricketScore } = Apex.utils;
    const t1Ov = match.team1.overs && match.team1.overs !== "-" ? ` <span style="color:var(--text-muted);font-weight:500">(${escapeHtml(match.team1.overs)})</span>` : "";
    const t2Ov = match.team2.overs && match.team2.overs !== "-" ? ` <span style="color:var(--text-muted);font-weight:500">(${escapeHtml(match.team2.overs)})</span>` : "";
    return `
      <article class="cricket-mini-card ${isSelected ? "is-selected" : ""}" data-select-cricket="${escapeHtml(match.id)}">
        <div class="match-row-meta">
          <span class="cr-mini-series"><strong style="color:var(--sport-cricket)">${escapeHtml(match.format)}</strong> • ${escapeHtml(match.series)}</span>
          ${renderStatusBadge(match.status, match.clock)}
        </div>
        <div class="cr-mini-teams">
          <div class="cr-mini-team-row">
            <span class="cr-mini-team-abbr">${escapeHtml(match.team1.name || match.team1.abbr)}</span>
            <span class="cr-mini-team-score tabular">${escapeHtml(formatCricketScore(match.team1))}${t1Ov}</span>
          </div>
          <div class="cr-mini-team-row">
            <span class="cr-mini-team-abbr">${escapeHtml(match.team2.name || match.team2.abbr)}</span>
            <span class="cr-mini-team-score tabular">${escapeHtml(formatCricketScore(match.team2))}${t2Ov}</span>
          </div>
        </div>
        <div class="cr-mini-foot">
          <span class="cr-mini-eq">${escapeHtml(match.equation)}</span>
          <span class="cr-mini-actions">
            <button type="button" class="cr-mini-details-btn" data-open-modal="cricket" data-id="${escapeHtml(match.id)}" title="Open full scorecard &amp; squads">Scorecard →</button>
          </span>
        </div>
      </article>
    `;
  }

  function renderCricketPanel(state, ui) {
    const container = document.getElementById("cricket-panel-body");
    const countEl = document.getElementById("cricket-panel-meta");
    if (!container) return;

    const matches = state.cricket || [];
    const liveCount = matches.filter((m) => m.status === "LIVE").length;
    const prevCount = matches.filter((m) => m.status === "FT").length;
    if (countEl) {
      countEl.textContent = `${liveCount} Live • ${prevCount} Previous • Men's Intl / IPL`;
    }

    if (!matches.length) {
      const msg = ui && ui.isInitialLoading
        ? "Loading Men's International & IPL live and previous scores..."
        : "No live, upcoming, or recent Men's International or IPL cricket matches found.";
      container.innerHTML = `<div class="empty-state">${Apex.utils.escapeHtml(msg)}</div>`;
      return;
    }

    const featured =
      matches.find((m) => m.id === ui.featuredCricketId) ||
      matches.find((m) => m.status === "LIVE") ||
      matches.find((m) => m.status === "PRE") ||
      matches[0];

    const liveUpcomingMatches = matches.filter((m) => m.status !== "FT");
    const previousMatches = matches.filter((m) => m.status === "FT");

    const liveListHtml = liveUpcomingMatches.length
      ? liveUpcomingMatches.map((m) => renderCricketMiniCard(m, featured && m.id === featured.id)).join("")
      : `<div class="empty-state is-compact">No live or upcoming Men's International / IPL fixtures right now.</div>`;

    const prevListHtml = previousMatches.length
      ? previousMatches.map((m) => renderCricketMiniCard(m, featured && m.id === featured.id)).join("")
      : `<div class="empty-state is-compact">No recent completed Men's International / IPL results found.</div>`;

    container.innerHTML = `
      <div class="cricket-layout-split">
        ${renderCricketHero(featured)}
        <div class="cricket-other-list">
          <div class="matches-split-sections">
            <div class="match-split-box">
              <div class="match-split-header">
                <span class="match-split-title is-live-title"><span class="live-dot"></span>Live &amp; Upcoming</span>
                <span class="match-split-count tabular">${liveCount > 0 ? `${liveCount} LIVE • ` : ""}${liveUpcomingMatches.length}</span>
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
        </div>
      </div>
    `;
  }

  Apex.renderers = Apex.renderers || {};
  Apex.renderers.renderCricketPanel = renderCricketPanel;
})(window);
