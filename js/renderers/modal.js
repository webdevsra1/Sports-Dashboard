/* ==========================================================================
   Broadcast Detail Inspector & Live Feed Settings Modal
   ========================================================================== */

(function (root) {
  "use strict";

  const Apex = (root.ApexSports = root.ApexSports || {});

  function renderFootyPlayerSymbols(player) {
    const parts = [];
    if (player.goals > 0) {
      const mins = player.goalMinutes && player.goalMinutes.length ? ` (${player.goalMinutes.join(", ")})` : "";
      parts.push(`<span class="stat-sym-group" title="${player.goals} Goal(s)${Apex.utils.escapeHtml(mins)}">${"⚽".repeat(Math.min(player.goals, 8))}</span>`);
    }
    if (player.assists > 0) {
      const mins = player.assistMinutes && player.assistMinutes.length ? ` (${player.assistMinutes.join(", ")})` : "";
      parts.push(`<span class="stat-sym-group" title="${player.assists} Assist(s)${Apex.utils.escapeHtml(mins)}">${"👟".repeat(Math.min(player.assists, 8))}</span>`);
    }
    if (player.yellowCards > 0) {
      parts.push(`<span class="stat-sym-group" title="${player.yellowCards} Yellow Card(s)">${"🟨".repeat(Math.min(player.yellowCards, 2))}</span>`);
    }
    if (player.redCards > 0) {
      parts.push(`<span class="stat-sym-group" title="Red Card">🟥</span>`);
    }
    return parts.join("");
  }

  function groupStartersByFormation(startingXI, formation) {
    const list = Array.isArray(startingXI) ? startingXI : [];
    if (!list.length) return [];

    const nums = String(formation || "")
      .split("-")
      .map((n) => parseInt(n, 10))
      .filter((n) => Number.isFinite(n) && n > 0);

    const rows = [];
    const totalOutfield = nums.reduce((a, b) => a + b, 0);
    if (list.length >= 11 && totalOutfield === 10) {
      let cursor = 0;
      rows.push([list[cursor++]]);
      nums.forEach((count) => {
        rows.push(list.slice(cursor, cursor + count));
        cursor += count;
      });
      return rows.filter((r) => r.length > 0);
    }

    if (list.length >= 11 && totalOutfield === 11) {
      let cursor = 0;
      nums.forEach((count) => {
        rows.push(list.slice(cursor, cursor + count));
        cursor += count;
      });
      return rows.filter((r) => r.length > 0);
    }

    const gk = [];
    const def = [];
    const mid = [];
    const fwd = [];
    list.forEach((p, idx) => {
      const pos = String(p.pos || "").toUpperCase();
      if (idx === 0 || pos === "G" || pos === "GK") gk.push(p);
      else if (pos.includes("D") || pos.includes("B")) def.push(p);
      else if (pos.includes("F") || pos.includes("ST") || pos === "W" || pos === "LW" || pos === "RW") fwd.push(p);
      else mid.push(p);
    });
    return [gk, def, mid, fwd].filter((r) => r.length > 0);
  }

  function renderFootballPitch(startingXI, formation, teamColor) {
    const { escapeHtml } = Apex.utils;
    const rows = groupStartersByFormation(startingXI, formation);
    if (!rows.length) return "";
    const safeColor = teamColor || "#1e293b";

    const rowsHtml = rows
      .map(
        (row) => `
        <div class="fb-pitch-row">
          ${row
            .map((p) => {
              const lastName = String(p.shortName || p.name || "Player").replace(/^[A-Z]\.\s*/, "");
              const syms = renderFootyPlayerSymbols(p);
              const subFlag = p.subbedOut ? `<span title="Subbed off${p.subOutMinute ? ` (${escapeHtml(p.subOutMinute)})` : ""}" style="color:#fbbf24;font-weight:800;">↓</span>` : "";
              return `
                <div class="fb-pitch-node ${p.subbedOut ? "is-subbed-out" : ""}">
                  <span class="fb-pitch-jersey" style="background:${escapeHtml(safeColor)}">${escapeHtml(p.jersey || "•")}</span>
                  <span class="fb-pitch-name" title="${escapeHtml(p.name)}">${escapeHtml(lastName)}</span>
                  <span class="fb-pitch-syms">${syms}${subFlag}</span>
                </div>
              `;
            })
            .join("")}
        </div>
      `
      )
      .join("");

    return `<div class="fb-pitch">${rowsHtml}</div>`;
  }

  function renderFootballPlayerRow(player, isSub) {
    const { escapeHtml } = Apex.utils;
    const syms = renderFootyPlayerSymbols(player);

    let subBadge = "";
    let swapHint = "";
    if (!isSub && player.subbedOut) {
      const m = player.subOutMinute ? ` ${player.subOutMinute}` : "";
      subBadge = `<span class="sub-badge is-out">↓ OUT${escapeHtml(m)}</span>`;
      if (player.swappedWith) swapHint = `Replaced by ${player.swappedWith}`;
    } else if (isSub && player.subbedIn) {
      const m = player.subInMinute ? ` ${player.subInMinute}` : "";
      subBadge = `<span class="sub-badge is-in">↑ IN${escapeHtml(m)}</span>`;
      if (player.swappedWith) swapHint = `Replaced ${player.swappedWith}`;
    } else if (isSub) {
      subBadge = `<span class="sub-badge is-bench">BENCH</span>`;
    }

    return `
      <div class="fb-player-row">
        <div class="fb-player-left">
          <span class="fb-num-tag">#${escapeHtml(player.jersey || "-")}</span>
          <span class="fb-pos-tag">${escapeHtml(player.pos || (isSub ? "SUB" : "XI"))}</span>
          <div class="fb-player-name-wrap">
            <span class="fb-player-name">${escapeHtml(player.name)}</span>
            ${swapHint ? `<span class="fb-swap-note">${escapeHtml(swapHint)}</span>` : ""}
          </div>
        </div>
        <div class="fb-player-right">
          ${syms}
          ${subBadge}
        </div>
      </div>
    `;
  }

  function renderFootballSquadCard(lineup, teamColor) {
    const { escapeHtml } = Apex.utils;
    const startingXI = Array.isArray(lineup.startingXI) ? lineup.startingXI : [];
    const substitutes = Array.isArray(lineup.substitutes) ? lineup.substitutes : [];

    if (!startingXI.length && Array.isArray(lineup.starters)) {
      return `
        <div class="squad-card">
          <div class="squad-card-head">
            <span class="squad-team-title">${escapeHtml(lineup.team)}</span>
            ${lineup.formation ? `<span class="formation-pill">${escapeHtml(lineup.formation)}</span>` : ""}
          </div>
          <div style="color:var(--text-secondary);font-size:11px;line-height:1.5;">${lineup.starters.map(escapeHtml).join(" • ") || "Lineups pending"}</div>
        </div>
      `;
    }

    return `
      <div class="squad-card">
        <div class="squad-card-head">
          <span class="squad-team-title">${escapeHtml(lineup.team)}</span>
          <span class="formation-pill">${escapeHtml(lineup.formation || "XI")}</span>
        </div>

        ${renderFootballPitch(startingXI, lineup.formation, teamColor)}

        <div class="squad-sub-label">Starting XI (${startingXI.length})</div>
        <div class="fb-roster-list">
          ${startingXI.map((p) => renderFootballPlayerRow(p, false)).join("")}
        </div>

        ${
          substitutes.length
            ? `
              <div class="squad-sub-label">Substitutes (${substitutes.filter((s) => s.subbedIn).length} used / ${substitutes.length})</div>
              <div class="fb-roster-list">
                ${substitutes.map((p) => renderFootballPlayerRow(p, true)).join("")}
              </div>
            `
            : ""
        }
      </div>
    `;
  }

  function renderFootballModal(match) {
    const { escapeHtml, renderCrest, renderStatusBadge } = Apex.utils;
    const eventsHtml =
      match.events && match.events.length
        ? [...match.events]
            .reverse()
            .map(
              (ev) => `
            <div class="timeline-item">
              <span class="timeline-min tabular">${escapeHtml(ev.minute)}</span>
              <span class="status-badge is-ft" style="min-width:46px;justify-content:center">${escapeHtml(ev.team)}</span>
              <span>${escapeHtml(ev.text)}</span>
            </div>
          `
            )
            .join("")
        : `<div class="empty-state">No major events logged yet.</div>`;

    const commentaryHtml =
      match.commentary && match.commentary.length
        ? `
          <div class="modal-section-label">Live Commentary</div>
          <div class="timeline-list">
            ${match.commentary
              .slice(0, 8)
              .map(
                (c) => `
              <div class="timeline-item">
                <span class="timeline-min tabular">${escapeHtml(c.minute)}</span>
                <span>${escapeHtml(c.text)}</span>
              </div>
            `
              )
              .join("")}
          </div>
        `
        : "";

    const lineupsHtml =
      match.lineups && match.lineups.length
        ? `
          <div class="modal-section-label">
            <span>Squads &amp; Playing Format</span>
            <span style="font-size:10px;color:var(--text-secondary);text-transform:none;">⚽ Goal (× count) • 👟 Assist (× count) • ↓ Sub Off • ↑ Sub On</span>
          </div>
          <div class="fb-lineups-grid">
            ${match.lineups
              .map((l, idx) => renderFootballSquadCard(l, idx === 0 ? match.home.color : match.away.color))
              .join("")}
          </div>
        `
        : match.rawEventId && match.status !== "PRE"
        ? `<div class="empty-state">Loading squads, formation &amp; substitutes...</div>`
        : "";

    return {
      title: `${match.leagueName} — ${match.home.name} vs ${match.away.name}`,
      body: `
        <div class="hero-scoreboard" style="background:var(--bg-surface);padding:14px;border-radius:10px;border:1px solid var(--border-subtle);">
          <div class="hero-team">
            ${renderCrest(match.home, true)}
            <div>
              <div class="hero-team-name">${escapeHtml(match.home.name)}</div>
              <div class="hero-team-sub">${escapeHtml(match.venue)}</div>
            </div>
          </div>
          <div class="hero-score-box">
            <div class="hero-score-digits tabular">${match.status === "PRE" ? "VS" : `${escapeHtml(match.home.score)} - ${escapeHtml(match.away.score)}`}</div>
            ${renderStatusBadge(match.status, match.clock)}
          </div>
          <div class="hero-team is-away">
            ${renderCrest(match.away, true)}
            <div>
              <div class="hero-team-name">${escapeHtml(match.away.name)}</div>
              <div class="hero-team-sub">${escapeHtml(match.leagueName)}</div>
            </div>
          </div>
        </div>

        ${
          match.stats
            ? `
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;font-family:var(--font-mono);font-size:11px;">
            <div class="timeline-item" style="justify-content:space-between;"><span>Possession</span><strong>${escapeHtml(match.stats.possession[0])}% - ${escapeHtml(match.stats.possession[1])}%</strong></div>
            <div class="timeline-item" style="justify-content:space-between;"><span>On Target</span><strong>${escapeHtml(match.stats.shotsOnTarget[0])} - ${escapeHtml(match.stats.shotsOnTarget[1])}</strong></div>
            <div class="timeline-item" style="justify-content:space-between;"><span>Shots</span><strong>${escapeHtml((match.stats.totalShots && match.stats.totalShots[0]) || 0)} - ${escapeHtml((match.stats.totalShots && match.stats.totalShots[1]) || 0)}</strong></div>
          </div>
        `
            : ""
        }

        ${lineupsHtml}

        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
          <span class="modal-section-label">Match Timeline</span>
          <button type="button" class="filter-pill is-active" data-pin-football-modal="${escapeHtml(match.id)}">Pin to Football Spotlight</button>
        </div>

        <div class="timeline-list">${eventsHtml}</div>
        ${commentaryHtml}
      `
    };
  }

  function renderCricketInningsCard(inn, isLatest, isLiveMatch) {
    const { escapeHtml } = Apex.utils;
    const batters = Array.isArray(inn.batters) ? inn.batters : [];
    const bowlers = Array.isArray(inn.bowlers) ? inn.bowlers : [];

    return `
      <div class="cr-innings-card">
        <div class="cr-innings-head">
          <span>Innings ${escapeHtml(inn.period)}: ${escapeHtml(inn.title)}</span>
          ${isLatest && isLiveMatch ? `<span class="status-badge is-live">CURRENT</span>` : ""}
        </div>

        ${
          batters.length
            ? `
          <div class="cr-table-scroll">
            <table class="cr-detail-table">
              <thead>
                <tr>
                  <th class="is-left">#</th>
                  <th class="is-left">Batter (Batting Order)</th>
                  <th class="is-left">Status / Dismissal</th>
                  <th>R</th>
                  <th>B</th>
                  <th>4s</th>
                  <th>6s</th>
                  <th>SR</th>
                </tr>
              </thead>
              <tbody>
                ${batters
                  .map((b, idx) => {
                    const tags = `${b.captain ? " (c)" : ""}${b.keeper ? " (wk)" : ""}`;
                    const star = b.notOut && b.batted ? "*" : "";
                    const orderNum = b.order < 100 ? b.order : idx + 1;
                    return `
                      <tr class="${b.notOut ? "is-not-out" : ""}">
                        <td class="is-left" style="color:var(--text-muted);font-family:var(--font-mono);width:24px;">${escapeHtml(orderNum)}</td>
                        <td class="is-left"><strong>${escapeHtml(b.name)}${escapeHtml(star)}</strong><span style="color:var(--text-muted);font-size:10px;">${escapeHtml(tags)}</span></td>
                        <td class="is-left cr-dismissal-cell">${escapeHtml(b.dismissal || (b.batted ? "not out" : "Yet to bat"))}</td>
                        <td><strong>${b.batted ? escapeHtml(b.runs) : "-"}</strong></td>
                        <td>${b.batted ? escapeHtml(b.balls) : "-"}</td>
                        <td>${b.batted ? escapeHtml(b.fours) : "-"}</td>
                        <td>${b.batted ? escapeHtml(b.sixes) : "-"}</td>
                        <td>${b.batted ? escapeHtml(b.sr) : "-"}</td>
                      </tr>
                    `;
                  })
                  .join("")}
              </tbody>
            </table>
          </div>
        `
            : ""
        }

        ${
          bowlers.length
            ? `
          <div style="padding:6px 10px;background:var(--bg-canvas);border-top:1px solid var(--border-subtle);border-bottom:1px solid var(--border-subtle);font-family:var(--font-mono);font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;">
            Bowling — ${escapeHtml(inn.bowlTeamName || "Opposition")} (with Bowling Average)
          </div>
          <div class="cr-table-scroll">
            <table class="cr-detail-table">
              <thead>
                <tr>
                  <th class="is-left">Bowler</th>
                  <th>O</th>
                  <th>M</th>
                  <th>R</th>
                  <th>W</th>
                  <th>ECON</th>
                  <th title="Bowling Average (Runs per Wicket)">AVG</th>
                  <th>WD</th>
                  <th>NB</th>
                </tr>
              </thead>
              <tbody>
                ${bowlers
                  .map(
                    (bw) => `
                  <tr>
                    <td class="is-left"><strong>${escapeHtml(bw.name)}</strong>${bw.isActive ? `<span class="striker-mark">*</span>` : ""}</td>
                    <td>${escapeHtml(bw.overs)}</td>
                    <td>${escapeHtml(bw.maidens)}</td>
                    <td>${escapeHtml(bw.runs)}</td>
                    <td><strong>${escapeHtml(bw.wickets)}</strong></td>
                    <td>${escapeHtml(bw.econ)}</td>
                    <td style="color:var(--sport-cricket);font-weight:700;">${escapeHtml(bw.avg !== undefined ? bw.avg : "-")}</td>
                    <td>${escapeHtml(bw.wides !== undefined ? bw.wides : 0)}</td>
                    <td>${escapeHtml(bw.noballs !== undefined ? bw.noballs : 0)}</td>
                  </tr>
                `
                  )
                  .join("")}
              </tbody>
            </table>
          </div>
        `
            : ""
        }
      </div>
    `;
  }

  function renderCricketModal(match) {
    const { escapeHtml, renderStatusBadge, formatCricketScore } = Apex.utils;
    const safeUrl =
      match.externalUrl && /^https?:\/\//i.test(match.externalUrl) ? match.externalUrl : "";

    const inningsList = Array.isArray(match.inningsCards) ? match.inningsCards : [];
    const inningsHtml = inningsList.length
      ? `
        <div class="modal-section-label">
          <span>Full Innings Scorecards &amp; Bowler Figures</span>
          <span style="font-size:10px;color:var(--text-secondary);text-transform:none;">ECON = Runs/Over • AVG = Runs/Wicket</span>
        </div>
        ${[...inningsList]
          .reverse()
          .map((inn, idx) => renderCricketInningsCard(inn, idx === 0, match.status === "LIVE"))
          .join("")}
      `
      : "";

    const fallbackPlayersHtml = !inningsList.length
      ? `${
          match.batters && match.batters.length
            ? `
          <div class="modal-section-label">Active Batters</div>
          <div class="cr-innings-card">
            <table class="cr-detail-table">
              <thead><tr><th class="is-left">Batter</th><th>R</th><th>B</th><th>4s</th><th>6s</th><th>SR</th></tr></thead>
              <tbody>
                ${match.batters
                  .map(
                    (b) => `<tr><td class="is-left"><strong>${escapeHtml(b.name)}${b.striker ? "*" : ""}</strong></td><td>${escapeHtml(b.runs)}</td><td>${escapeHtml(b.balls)}</td><td>${escapeHtml(b.fours)}</td><td>${escapeHtml(b.sixes)}</td><td>${escapeHtml(b.sr)}</td></tr>`
                  )
                  .join("")}
              </tbody>
            </table>
          </div>`
            : ""
        }${
          match.bowler
            ? `
          <div class="modal-section-label">Active Bowler</div>
          <div class="cr-innings-card">
            <table class="cr-detail-table">
              <thead><tr><th class="is-left">Bowler</th><th>O</th><th>M</th><th>R</th><th>W</th><th>ECON</th><th>AVG</th></tr></thead>
              <tbody>
                <tr><td class="is-left"><strong>${escapeHtml(match.bowler.name)}</strong></td><td>${escapeHtml(match.bowler.overs)}</td><td>${escapeHtml(match.bowler.maidens)}</td><td>${escapeHtml(match.bowler.runs)}</td><td>${escapeHtml(match.bowler.wickets)}</td><td>${escapeHtml(match.bowler.econ)}</td><td>${escapeHtml(match.bowler.wickets > 0 ? (match.bowler.runs / match.bowler.wickets).toFixed(2) : "-")}</td></tr>
              </tbody>
            </table>
          </div>`
            : match.leagueId && match.rawEventId
            ? `<div class="empty-state">Loading full batting order &amp; bowling averages...</div>`
            : ""
        }`
      : "";

    const squadsList = Array.isArray(match.squads) ? match.squads : [];
    const squadsHtml = squadsList.length
      ? `
        <div class="modal-section-label">
          <span>Both Team Squads (In Batting Order)</span>
          <span style="font-size:10px;color:var(--text-secondary);text-transform:none;">Includes Batting Score &amp; Bowler Average</span>
        </div>
        <div class="cr-squads-grid">
          ${squadsList
            .map(
              (sq) => `
            <div class="squad-card">
              <div class="squad-card-head">
                <span class="squad-team-title">${escapeHtml(sq.teamName)}</span>
                <span class="formation-pill" style="background:rgba(14,165,233,0.14);color:var(--sport-cricket);border-color:rgba(14,165,233,0.35);">${sq.playingXI.length <= 11 ? "XI" : "Squad"} (${escapeHtml(sq.playingXI.length)})</span>
              </div>
              <div class="fb-roster-list">
                ${sq.playingXI
                  .map(
                    (pl, idx) => `
                  <div class="cr-squad-row">
                    <div class="fb-player-left">
                      <span class="fb-num-tag">${idx + 1}.</span>
                      <div class="fb-player-name-wrap">
                        <span class="fb-player-name">${escapeHtml(pl.name)}${pl.captain ? " (c)" : ""}${pl.keeper ? " (wk)" : ""}</span>
                        ${pl.role ? `<span class="fb-swap-note">${escapeHtml(pl.role)}</span>` : ""}
                      </div>
                    </div>
                    <div class="cr-squad-stats">
                      <span><strong>Bat:</strong> ${escapeHtml(pl.batSummary)}</span>
                      ${pl.bowled ? `<span style="color:var(--sport-cricket);"><strong>Bowl:</strong> ${escapeHtml(pl.bowlSummary)}</span>` : ""}
                    </div>
                  </div>
                `
                  )
                  .join("")}
              </div>
              ${
                sq.bench && sq.bench.length
                  ? `
                <div class="squad-sub-label">Bench / Squad Reserves (${sq.bench.length})</div>
                <div style="font-size:11px;color:var(--text-secondary);line-height:1.5;">
                  ${sq.bench.map((b) => escapeHtml(b.name)).join(" • ")}
                </div>
              `
                  : ""
              }
            </div>
          `
            )
            .join("")}
        </div>
      `
      : "";

    const notesList = Array.isArray(match.recentNotes) ? match.recentNotes : [];
    const notesHtml = notesList.length
      ? `
          <div class="modal-section-label">Match Notes</div>
          <div class="timeline-list">
            ${notesList.map((n, i) => `<div class="timeline-item"><span class="timeline-min">#${i + 1}</span><span>${escapeHtml(n)}</span></div>`).join("")}
          </div>
        `
      : "";

    return {
      title: `${match.format} • ${match.series}`,
      body: `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 12px;background:var(--bg-surface);border-radius:10px;border:1px solid var(--border-subtle);">
          <div>
            <div style="font-weight:700;font-size:14px;">${escapeHtml(match.team1.name)} vs ${escapeHtml(match.team2.name)}</div>
            <div style="font-size:12px;color:var(--sport-cricket);margin-top:2px;">${escapeHtml(match.equation)}</div>
            ${match.venue ? `<div style="font-size:11px;color:var(--text-muted);margin-top:2px;">${escapeHtml(match.venue)}</div>` : ""}
          </div>
          ${renderStatusBadge(match.status, match.clock)}
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          <div style="padding:10px;background:var(--bg-surface);border-radius:8px;border:1px solid var(--border-subtle);">
            <div style="font-size:11px;color:var(--text-muted);">${escapeHtml(match.team1.name)}</div>
            <div class="tabular" style="font-size:22px;font-weight:800;">${escapeHtml(formatCricketScore(match.team1))} ${match.team1.overs && match.team1.overs !== "-" ? `<span style="font-size:12px;color:var(--text-muted)">(${escapeHtml(match.team1.overs)} ov)</span>` : ""}</div>
          </div>
          <div style="padding:10px;background:var(--bg-surface);border-radius:8px;border:1px solid var(--border-subtle);">
            <div style="font-size:11px;color:var(--text-muted);">${escapeHtml(match.team2.name)}</div>
            <div class="tabular" style="font-size:22px;font-weight:800;">${escapeHtml(formatCricketScore(match.team2))} ${match.team2.overs && match.team2.overs !== "-" ? `<span style="font-size:12px;color:var(--text-muted)">(${escapeHtml(match.team2.overs)} ov)</span>` : ""}</div>
          </div>
        </div>

        <div style="font-size:12px;color:var(--text-secondary);background:var(--bg-surface);padding:10px 12px;border-radius:8px;border:1px solid var(--border-subtle);">
          <strong>CRR:</strong> ${escapeHtml(match.crr || "-")}
          ${match.rrr ? ` &nbsp;|&nbsp; <strong>RRR:</strong> ${escapeHtml(match.rrr)}` : ""}
          ${match.target ? ` &nbsp;|&nbsp; <strong>Target:</strong> ${escapeHtml(match.target)}` : ""}
          <div style="margin-top:6px;"><strong>Latest Update:</strong> ${escapeHtml(match.lastBallNote || match.equation)}</div>
          ${safeUrl ? `<div style="margin-top:8px;"><a href="${escapeHtml(safeUrl)}" target="_blank" rel="noopener noreferrer" style="color:var(--sport-cricket);font-weight:600;">Open Full Scorecard on ESPN ↗</a></div>` : ""}
        </div>

        ${inningsHtml}
        ${fallbackPlayersHtml}
        ${squadsHtml}
        ${notesHtml}
      `
    };
  }

  function renderF1Modal(f1, targetId) {
    const { escapeHtml } = Apex.utils;
    const focusedDriver = (f1.drivers || []).find((d) => d.code === targetId);
    const notesHtml = (f1.raceControlNotes || [])
      .map(
        (n, i) => `
        <div class="timeline-item">
          <span class="timeline-min" style="color:var(--sport-f1)">#${i + 1}</span>
          <span>${escapeHtml(n)}</span>
        </div>
      `
      )
      .join("");

    const driverSpotlight = focusedDriver
      ? `
        <div style="padding:12px;background:var(--bg-surface-elevated);border:1px solid var(--border-medium);border-left:4px solid ${escapeHtml(focusedDriver.color)};border-radius:10px;">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <div>
              <div style="font-family:var(--font-display);font-size:18px;font-weight:800;">P${escapeHtml(focusedDriver.pos)} • ${escapeHtml(focusedDriver.name)} (${escapeHtml(focusedDriver.code)})</div>
              <div style="font-size:12px;color:var(--text-secondary);">${escapeHtml(focusedDriver.team)}</div>
            </div>
            <span class="tyre-pill is-${escapeHtml(focusedDriver.tyre)}">${escapeHtml(focusedDriver.tyre)} • ${escapeHtml(focusedDriver.tyreAge)}L</span>
          </div>
          <div class="tabular" style="display:flex;gap:18px;margin-top:10px;font-family:var(--font-mono);font-size:12px;">
            <span><strong>Gap:</strong> ${escapeHtml(focusedDriver.gap)}</span>
            <span><strong>Last Lap:</strong> ${escapeHtml(focusedDriver.lastLap)}</span>
            <span><strong>Pit Stops:</strong> ${escapeHtml(focusedDriver.pits)}</span>
          </div>
        </div>
      `
      : "";

    return {
      title: `${f1.grandPrix} — Race Control & Telemetry`,
      body: `
        ${driverSpotlight}
        <div style="display:flex;gap:10px;flex-wrap:wrap;font-family:var(--font-mono);font-size:11px;">
          <span class="status-badge is-live">LAP ${escapeHtml(f1.lap)}/${escapeHtml(f1.totalLaps)}</span>
          <span class="status-badge is-ft">FASTEST: ${escapeHtml(f1.fastestLapOwner || "-")} (${escapeHtml(f1.fastestLapTime || "-")})</span>
          <span class="status-badge is-pre">TRACK ${escapeHtml(f1.weather.trackTemp)} • AIR ${escapeHtml(f1.weather.airTemp)}</span>
        </div>
        <div style="font-family:var(--font-mono);font-size:11px;color:var(--text-muted);text-transform:uppercase;">Race Control Log</div>
        <div class="timeline-list">${notesHtml}</div>
      `
    };
  }

  function openInspectorModal(state, type, id) {
    const backdrop = document.getElementById("inspector-modal");
    const titleEl = document.getElementById("modal-title");
    const bodyEl = document.getElementById("modal-body");
    if (!backdrop || !titleEl || !bodyEl) return;

    let content = null;
    if (type === "football") {
      const match = (state.football || []).find((m) => m.id === id) || state.football[0];
      if (match) content = renderFootballModal(match);
    } else if (type === "cricket") {
      const match = (state.cricket || []).find((m) => m.id === id) || state.cricket[0];
      if (match) content = renderCricketModal(match);
    } else if (type === "f1") {
      content = renderF1Modal(state.f1, id);
    }

    if (!content) return;
    titleEl.textContent = content.title;
    bodyEl.innerHTML = content.body;
    backdrop.classList.add("is-open");
  }

  function openSettingsModal(ui, feedReport) {
    const backdrop = document.getElementById("inspector-modal");
    const titleEl = document.getElementById("modal-title");
    const bodyEl = document.getElementById("modal-body");
    if (!backdrop || !titleEl || !bodyEl) return;

    const { escapeHtml } = Apex.utils;
    const report = feedReport || {
      proxy: false,
      footballSource: "Pending",
      cricketSource: "Pending",
      f1Source: "Pending"
    };

    titleEl.textContent = "Sports Dashboard — Live Feed Diagnostics & Settings";
    bodyEl.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px;">
        <div class="timeline-item"><strong>Local Proxy:</strong>&nbsp;<span>${report.proxy ? "Connected (127.0.0.1)" : "Not active (direct browser fetch)"}</span></div>
        <div class="timeline-item"><strong>Football Feed:</strong>&nbsp;<span>${escapeHtml(report.footballSource)}</span></div>
        <div class="timeline-item"><strong>Cricket Feed:</strong>&nbsp;<span>${escapeHtml(report.cricketSource)}</span></div>
        <div class="timeline-item"><strong>Formula 1 Feed:</strong>&nbsp;<span>${escapeHtml(report.f1Source)}</span></div>
      </div>

      <form id="feed-settings-form" style="display:flex;flex-direction:column;gap:12px;background:var(--bg-surface);border:1px solid var(--border-subtle);border-radius:10px;padding:12px;">
        <label style="display:flex;flex-direction:column;gap:5px;font-size:12px;font-weight:600;">
          Live Refresh Interval
          <select id="setting-poll-seconds" style="padding:7px 9px;border-radius:6px;border:1px solid var(--border-medium);background:var(--bg-canvas);color:var(--text-primary);font-family:var(--font-mono);font-size:12px;">
            <option value="15" ${ui.pollSeconds === 15 ? "selected" : ""}>Every 15 seconds</option>
            <option value="20" ${ui.pollSeconds === 20 ? "selected" : ""}>Every 20 seconds (Default)</option>
            <option value="30" ${ui.pollSeconds === 30 ? "selected" : ""}>Every 30 seconds</option>
            <option value="60" ${ui.pollSeconds === 60 ? "selected" : ""}>Every 60 seconds</option>
          </select>
        </label>

        <label style="display:flex;flex-direction:column;gap:5px;font-size:12px;font-weight:600;">
          Optional CricketData / CricAPI Key (for enhanced ball-by-ball scorecards)
          <input id="setting-cricapi-key" type="password" value="${escapeHtml(ui.cricApiKey || "")}" placeholder="Optional — leave blank for built-in ESPN Men's International & IPL Cricket feeds" style="padding:7px 9px;border-radius:6px;border:1px solid var(--border-medium);background:var(--bg-canvas);color:var(--text-primary);font-family:var(--font-mono);font-size:12px;" />
        </label>

        <div style="display:flex;justify-content:flex-end;gap:8px;">
          <button type="submit" class="filter-pill is-active" style="padding:6px 14px;font-size:12px;">Save &amp; Sync Live Now</button>
        </div>
      </form>
    `;
    backdrop.classList.add("is-open");
  }

  function closeInspectorModal() {
    const backdrop = document.getElementById("inspector-modal");
    if (backdrop) backdrop.classList.remove("is-open");
  }

  Apex.renderers = Apex.renderers || {};
  Apex.renderers.openInspectorModal = openInspectorModal;
  Apex.renderers.openSettingsModal = openSettingsModal;
  Apex.renderers.closeInspectorModal = closeInspectorModal;
})(window);
