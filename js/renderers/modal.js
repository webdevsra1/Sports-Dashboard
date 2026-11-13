/* ==========================================================================
   Broadcast Detail Inspector & Live Feed Settings Modal
   ========================================================================== */

(function (root) {
  "use strict";

  const Apex = (root.ApexSports = root.ApexSports || {});
  const activeModalPlayers = new Map();

  function registerModalPlayer(hint) {
    if (!hint || !hint.name) return "";
    const idPart = hint.id ? String(hint.id) : "";
    const key = `${hint.sport}:${idPart}:${String(hint.name).toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
    const existing = activeModalPlayers.get(key);
    if (existing) {
      activeModalPlayers.set(key, {
        ...existing,
        ...hint,
        id: idPart || existing.id,
        team: hint.team || existing.team,
        role: hint.role || existing.role,
        headshot: hint.headshot || existing.headshot,
        matchStats: {
          ...(existing.matchStats || {}),
          ...(hint.matchStats || {})
        }
      });
    } else {
      activeModalPlayers.set(key, hint);
    }
    return key;
  }

  function getModalPlayerHint(key) {
    return activeModalPlayers.get(String(key || "")) || null;
  }

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

  function registerFootyPlayerHint(player, teamName) {
    return registerModalPlayer({
      sport: "football",
      id: player.id || "",
      name: player.name || "Player",
      team: player.club || teamName || "",
      pos: player.pos || "",
      jersey: player.jersey || "",
      headshot: player.headshot || "",
      matchStats: {
        goals: player.goals || 0,
        assists: player.assists || 0,
        goalMinutes: player.goalMinutes || [],
        assistMinutes: player.assistMinutes || [],
        yellowCards: player.yellowCards || 0,
        redCards: player.redCards || 0,
        subInMinute: player.subInMinute || "",
        subOutMinute: player.subOutMinute || "",
        swappedWith: player.swappedWith || "",
        shots: player.shots || 0,
        shotsOnTarget: player.shotsOnTarget || 0,
        saves: player.saves || 0,
        foulsCommitted: player.foulsCommitted || 0
      }
    });
  }

  function renderFootballPitch(startingXI, formation, teamColor, teamName) {
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
              const pKey = registerFootyPlayerHint(p, teamName);
              return `
                <div class="fb-pitch-node is-clickable ${p.subbedOut ? "is-subbed-out" : ""}" data-open-player="${escapeHtml(pKey)}" role="button" tabindex="0" title="View profile: ${escapeHtml(p.name)}">
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

    return `
      <div class="fb-pitch">
        <div class="fb-pitch-goal" title="Goal post (Goalkeeper end)" aria-label="Goal post">
          <span class="fb-pitch-goal-post fb-pitch-goal-post-l"></span>
          <span class="fb-pitch-goal-net">GOAL</span>
          <span class="fb-pitch-goal-post fb-pitch-goal-post-r"></span>
        </div>
        <div class="fb-pitch-box" aria-hidden="true"></div>
        ${rowsHtml}
        <div class="fb-pitch-midarc" aria-hidden="true"></div>
      </div>
    `;
  }

  function renderFootballPlayerRow(player, isSub, teamName) {
    const { escapeHtml } = Apex.utils;
    const syms = renderFootyPlayerSymbols(player);
    const pKey = registerFootyPlayerHint(player, teamName);

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
      <div class="fb-player-row is-clickable" data-open-player="${escapeHtml(pKey)}" role="button" tabindex="0" title="Click for player photo, club, nationality &amp; stats">
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

        ${renderFootballPitch(startingXI, lineup.formation, teamColor, lineup.team)}

        <div class="squad-sub-label">Starting XI (${startingXI.length}) • Click any player for profile</div>
        <div class="fb-roster-list">
          ${startingXI.map((p) => renderFootballPlayerRow(p, false, lineup.team)).join("")}
        </div>

        ${
          substitutes.length
            ? `
              <div class="squad-sub-label">Substitutes (${substitutes.filter((s) => s.subbedIn).length} used / ${substitutes.length})</div>
              <div class="fb-roster-list">
                ${substitutes.map((p) => renderFootballPlayerRow(p, true, lineup.team)).join("")}
              </div>
            `
            : ""
        }
      </div>
    `;
  }

  function renderFootballModal(match) {
    activeModalPlayers.clear();
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

  function formatSquadBatSummaryHtml(pl, matchStatus) {
    const { escapeHtml } = Apex.utils;
    const entries = Array.isArray(pl && pl.batEntries) && pl.batEntries.length ? pl.batEntries : null;
    if (!entries) {
      const raw = (pl && pl.batSummary) || "Yet to bat";
      return escapeHtml(matchStatus === "FT" && /^yet to bat$/i.test(raw) ? "Did not bat" : raw);
    }
    return entries
      .map((entry) => {
        if (entry.isOut) {
          const tip = entry.fallText ? ` title="${escapeHtml(entry.fallText)}"` : "";
          return `<span class="cr-bat-entry"><strong>${escapeHtml(entry.scoreText)}</strong> <span class="cr-bat-out"${tip}>• ${escapeHtml(entry.dismissalText)}</span></span>`;
        }
        if (entry.notOut) {
          return `<span class="cr-bat-entry"><strong class="cr-bat-notout">${escapeHtml(entry.scoreText)}</strong> <span class="cr-bat-notout">• Not out</span></span>`;
        }
        return `<span class="cr-bat-entry"><strong>${escapeHtml(entry.scoreText)}</strong></span>`;
      })
      .join(` <span class="cr-bat-sep">&amp;</span> `);
  }

  function safeCricketHex(color, fallback) {
    return /^#[0-9a-f]{6}$/i.test(String(color || "")) ? String(color) : fallback || "#38bdf8";
  }

  function formatInningsOrdinal(num) {
    const labels = { 1: "1st Innings", 2: "2nd Innings", 3: "3rd Innings", 4: "4th Innings" };
    return labels[Number(num)] || `Innings ${num}`;
  }

  function registerCricketPlayerHint(player, teamName, seriesName, extraMatchStats) {
    return registerModalPlayer({
      sport: "cricket",
      id: (player && player.id) || "",
      name: (player && player.name) || "Player",
      team: teamName || "",
      series: seriesName || "",
      role: (player && player.role) || "",
      isCaptain: Boolean(player && player.captain),
      isKeeper: Boolean(player && player.keeper),
      matchStats: extraMatchStats || {}
    });
  }

  function renderCricketInningsCard(inn, isLatest, isLiveMatch, matchStatus, matchSeries) {
    const { escapeHtml } = Apex.utils;
    const allBatters = Array.isArray(inn.batters) ? inn.batters : [];
    const battedList = allBatters.filter((b) => b.batted);
    const didNotBatList = allBatters.filter((b) => !b.batted);
    const battersToShow = battedList.length ? battedList : allBatters;
    const bowlers = Array.isArray(inn.bowlers) ? inn.bowlers : [];
    const teamColor = safeCricketHex(inn.batTeamColor, "#38bdf8");
    const isFinishedInn = Boolean(inn.summaryDesc) || matchStatus === "FT" || !isLatest;

    const extrasValue = inn.extrasCount !== undefined && inn.extrasCount !== null ? inn.extrasCount : 0;
    const hasExtrasRow = extrasValue > 0 || Boolean(inn.extrasDetail);
    const totalScoreLabel = inn.scoreBadge || inn.scoreText || "-";
    const totalMetaParts = [];
    if (inn.summaryDesc) totalMetaParts.push(inn.summaryDesc);
    else if (Number.isFinite(inn.wickets)) totalMetaParts.push(`${inn.wickets} wkts`);
    if (inn.overs) totalMetaParts.push(`${inn.overs} ov`);
    if (inn.runRate) totalMetaParts.push(`RR ${inn.runRate}`);

    const fowList = Array.isArray(inn.fowList) ? inn.fowList : [];

    return `
      <section class="cr-inn-card" style="--inn-accent:${escapeHtml(teamColor)};">
        <div class="cr-inn-head">
          <div class="cr-inn-head-left">
            <span class="cr-inn-crest">${escapeHtml(inn.batTeamAbbr || "IN")}</span>
            <div class="cr-inn-title-wrap">
              <span class="cr-inn-kicker">${escapeHtml(formatInningsOrdinal(inn.period))}</span>
              <span class="cr-inn-team">${escapeHtml(inn.batTeamName || "Batting")}</span>
            </div>
            ${isLatest && isLiveMatch ? `<span class="status-badge is-live">BATTING</span>` : ""}
          </div>
          <div class="cr-inn-head-right">
            <span class="cr-inn-total-score tabular">${escapeHtml(totalScoreLabel)}</span>
            ${
              totalMetaParts.length
                ? `<span class="cr-inn-total-meta tabular">(${escapeHtml(totalMetaParts.join(" • "))})</span>`
                : ""
            }
          </div>
        </div>

        ${
          battersToShow.length
            ? `
          <div class="cr-table-scroll">
            <table class="cr-sc-table is-batting">
              <thead>
                <tr>
                  <th class="is-left">Batter</th>
                  <th class="is-left">Dismissal</th>
                  <th>R</th>
                  <th>B</th>
                  <th>4s</th>
                  <th>6s</th>
                  <th>SR</th>
                </tr>
              </thead>
              <tbody>
                ${battersToShow
                  .map((b) => {
                    const tags = `${b.captain ? " (c)" : ""}${b.keeper ? " (wk)" : ""}`;
                    const star = b.notOut && b.batted ? "*" : "";
                    const rowClass = b.isOut ? "is-out" : b.notOut ? "is-not-out" : "";
                    const tipAttr = b.fallText ? ` title="${escapeHtml(b.fallText)}"` : "";
                    const dismissalCell = b.notOut
                      ? `<span class="cr-status-pill is-not-out">${escapeHtml(b.dismissal || "Not out")}</span>`
                      : b.isOut
                      ? `<span class="cr-dismissal-text is-out"${tipAttr}>${escapeHtml(b.dismissal)}</span>`
                      : `<span class="cr-dismissal-text">${escapeHtml(b.dismissal || "Yet to bat")}</span>`;
                    const pKey = registerCricketPlayerHint(b, inn.batTeamName, matchSeries, {
                      batScore: b.batted ? `${b.runs}${b.notOut ? "*" : ""} (${b.balls}b, 4s:${b.fours}, 6s:${b.sixes}, SR ${b.sr})` : "",
                      dismissal: b.dismissal || ""
                    });
                    return `
                      <tr class="${rowClass}">
                        <td class="is-left cr-batter-cell">
                          <button type="button" class="player-link-btn" data-open-player="${escapeHtml(pKey)}" title="View player age, ICC rankings &amp; stats">
                            <span class="cr-batter-name">${escapeHtml(b.name)}${star ? `<span class="cr-star">*</span>` : ""}</span>
                          </button>${
                            tags ? `<span class="cr-role-tag">${escapeHtml(tags)}</span>` : ""
                          }
                        </td>
                        <td class="is-left">${dismissalCell}</td>
                        <td class="cr-runs-cell">${b.batted ? escapeHtml(b.runs) : "-"}</td>
                        <td class="cr-num-muted">${b.batted ? escapeHtml(b.balls) : "-"}</td>
                        <td class="cr-num-muted">${b.batted ? escapeHtml(b.fours) : "-"}</td>
                        <td class="cr-num-muted">${b.batted ? escapeHtml(b.sixes) : "-"}</td>
                        <td class="cr-sr-cell">${b.batted ? escapeHtml(b.sr) : "-"}</td>
                      </tr>
                    `;
                  })
                  .join("")}
              </tbody>
              ${
                hasExtrasRow
                  ? `
                <tfoot>
                  <tr class="cr-sc-extras-row">
                    <td class="is-left">Extras</td>
                    <td class="is-left cr-extras-detail">${escapeHtml(inn.extrasDetail || "")}</td>
                    <td class="cr-runs-cell">${escapeHtml(extrasValue)}</td>
                    <td colspan="4"></td>
                  </tr>
                </tfoot>
              `
                  : ""
              }
            </table>
          </div>
          <div class="cr-sc-total-bar">
            <div class="cr-sc-total-left">
              <span class="cr-sc-total-label">TOTAL</span>
              ${
                totalMetaParts.length
                  ? `<span class="cr-sc-total-sub tabular">${escapeHtml(totalMetaParts.join(" • "))}</span>`
                  : ""
              }
            </div>
            <span class="cr-sc-total-val tabular">${escapeHtml(totalScoreLabel)}</span>
          </div>
        `
            : ""
        }

        ${
          didNotBatList.length && battedList.length
            ? `
          <div class="cr-sc-meta-band">
            <span class="cr-meta-label">${isFinishedInn ? "Did not bat" : "Yet to bat"}</span>
            <div class="cr-dnb-list">
              ${didNotBatList
                .map((b) => {
                  const tags = `${b.captain ? " (c)" : ""}${b.keeper ? " (wk)" : ""}`;
                  const pKey = registerCricketPlayerHint(b, inn.batTeamName, matchSeries, {
                    batScore: isFinishedInn ? "Did not bat" : "Yet to bat"
                  });
                  return `<button type="button" class="cr-dnb-chip is-clickable" data-open-player="${escapeHtml(pKey)}">${escapeHtml(b.name)}${escapeHtml(tags)}</button>`;
                })
                .join("")}
            </div>
          </div>
        `
            : ""
        }

        ${
          fowList.length
            ? `
          <div class="cr-sc-meta-band">
            <span class="cr-meta-label">Fall of Wickets</span>
            <div class="cr-fow-chips">
              ${fowList
                .map(
                  (fw) =>
                    `<span class="cr-fow-chip tabular"><strong>${escapeHtml(fw.wicket)}-${escapeHtml(fw.runs)}</strong> ${escapeHtml(fw.batter)}${fw.over ? ` (${escapeHtml(fw.over)})` : ""}</span>`
                )
                .join("")}
            </div>
          </div>
        `
            : ""
        }

        ${
          bowlers.length
            ? `
          <div class="cr-bowl-subhead">
            <span>Bowling — ${escapeHtml(inn.bowlTeamName || "Opposition")}</span>
            <span class="cr-bowl-hint">ECON • Bowling AVG</span>
          </div>
          <div class="cr-table-scroll">
            <table class="cr-sc-table is-bowling">
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
                  .map((bw) => {
                    const wNum = Number(bw.wickets) || 0;
                    const wClass = wNum >= 3 ? "is-haul" : wNum >= 1 ? "has-wkts" : "is-zero";
                    const pKey = registerCricketPlayerHint(bw, inn.bowlTeamName || "Opposition", matchSeries, {
                      bowlSummary: `${bw.wickets}/${bw.runs} (${bw.overs} ov) • Econ ${bw.econ} • Avg ${bw.avg !== undefined ? bw.avg : "-"}`
                    });
                    return `
                      <tr>
                        <td class="is-left cr-batter-cell">
                          <button type="button" class="player-link-btn" data-open-player="${escapeHtml(pKey)}" title="View bowler age, ICC rankings &amp; stats">
                            <span class="cr-batter-name">${escapeHtml(bw.name)}</span>${bw.isActive ? `<span class="cr-star">*</span>` : ""}
                          </button>
                        </td>
                        <td>${escapeHtml(bw.overs)}</td>
                        <td class="cr-num-muted">${escapeHtml(bw.maidens)}</td>
                        <td>${escapeHtml(bw.runs)}</td>
                        <td><span class="cr-wkts-pill ${wClass}">${escapeHtml(wNum)}</span></td>
                        <td>${escapeHtml(bw.econ)}</td>
                        <td class="cr-avg-cell">${escapeHtml(bw.avg !== undefined ? bw.avg : "-")}</td>
                        <td class="cr-num-muted">${escapeHtml(bw.wides !== undefined ? bw.wides : 0)}</td>
                        <td class="cr-num-muted">${escapeHtml(bw.noballs !== undefined ? bw.noballs : 0)}</td>
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
      </section>
    `;
  }

  function renderCricketBallBadge(ball) {
    const { escapeHtml } = Apex.utils;
    const label = ball && ball.label !== undefined ? String(ball.label) : String(ball ?? "0");
    const kind = (ball && ball.kind) || "dot";
    const tip = ball && ball.tooltip ? ` title="${escapeHtml(ball.tooltip)}"` : "";
    return `<span class="cricket-ball-circle is-${escapeHtml(kind)}"${tip}>${escapeHtml(label)}</span>`;
  }

  function renderCricketOversSection(match, ui) {
    const { escapeHtml } = Apex.utils;
    const groups = Array.isArray(match.overByOver) ? match.overByOver : [];
    const newestFirst = Boolean(ui && ui.cricketOversNewestFirst);

    if (!groups.length) {
      const hasIds = Boolean(match.rawEventId && match.leagueId);
      const isNoPlay = /\b(no result|abandoned|cancelled)\b/i.test(String(match.equation || ""));
      let msg = "Over-by-over delivery log is unavailable for this fixture.";
      let retryBtnHtml = "";

      if (match._oversLoading || (hasIds && !match._oversLoaded && !match._oversError && match.status !== "PRE")) {
        msg = "Loading over-by-over ball scores...";
      } else if (match._oversError) {
        msg = "Could not load over-by-over ball scores from ESPN right now.";
        retryBtnHtml = `<button type="button" class="filter-pill is-active" data-retry-overs="1" style="font-size:10px;padding:3px 10px;">Retry Overs</button>`;
      } else if (!hasIds) {
        msg = "Over-by-over delivery log is unavailable for this fixture (missing feed ID).";
      } else if (match.status === "PRE") {
        msg = "Match has not started yet — over-by-over ball scores will appear once play begins.";
      } else if (isNoPlay) {
        msg = `No deliveries were bowled (${match.equation}) — over-by-over data is unavailable.`;
      }

      return `
        <div class="cr-overs-section">
          <div class="cr-overs-head">
            <div class="modal-section-label" style="margin:0;">Over-by-Over Ball Scores</div>
            ${retryBtnHtml}
          </div>
          <div style="font-size:11px;color:var(--text-muted);padding:4px 0;">${escapeHtml(msg)}</div>
        </div>
      `;
    }

    const totalOversShown = groups.reduce((acc, g) => acc + ((g.overs && g.overs.length) || 0), 0);
    const orderedGroups = newestFirst ? [...groups].reverse() : groups;
    const selectedInn = (ui && ui.cricketSelectedInnings) || "all";
    const filteredGroups =
      selectedInn === "all"
        ? orderedGroups
        : orderedGroups.filter((grp) => String(grp.period) === String(selectedInn));
    const displayGroups = filteredGroups.length ? filteredGroups : orderedGroups;

    const inningsFilterHtml =
      groups.length > 1
        ? `
        <div class="cr-inn-tabs" role="tablist" aria-label="Filter Over-by-Over Innings">
          <button type="button" class="cr-inn-pill ${selectedInn === "all" ? "is-active" : ""}" data-cr-inn="all">
            All Innings (${groups.length})
          </button>
          ${orderedGroups
            .map(
              (grp) => `
            <button type="button" class="cr-inn-pill ${String(selectedInn) === String(grp.period) ? "is-active" : ""}" data-cr-inn="${escapeHtml(grp.period)}">
              ${escapeHtml(grp.label)} <span class="tabular">(${escapeHtml((grp.overs || []).length)} ov)</span>
            </button>
          `
            )
            .join("")}
        </div>
      `
        : "";

    const groupsHtml = displayGroups
      .map((grp) => {
        const oversList = newestFirst ? [...(grp.overs || [])].reverse() : grp.overs || [];
        const rowsHtml = oversList
          .map(
            (ov) => `
            <div class="cr-over-row">
              <div class="cr-over-meta">
                <span class="cr-over-num">Over ${escapeHtml(ov.overNumber)}:</span>
                <span class="cr-over-sub">${ov.bowler ? `${escapeHtml(ov.bowler)} • ` : ""}${escapeHtml(ov.runs)}r${ov.wickets ? ` • ${escapeHtml(ov.wickets)}w` : ""}</span>
              </div>
              <div class="cr-over-balls">
                ${(ov.balls || []).map(renderCricketBallBadge).join("")}
              </div>
            </div>
          `
          )
          .join("");

        return `
          <div class="cr-overs-innings-label">
            <span>${escapeHtml(grp.label)}</span>
            <span style="color:var(--text-muted);font-weight:600;">${oversList.length} Overs</span>
          </div>
          <div class="cr-overs-scroll">${rowsHtml}</div>
        `;
      })
      .join("");

    return `
      <div class="cr-overs-section">
        <div class="cr-overs-head">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <span class="modal-section-label" style="margin:0;">Over-by-Over Ball Scores</span>
            ${
              match.overByOverPartial
                ? `<span style="font-size:10px;color:var(--text-muted);">(Opening &amp; latest ${escapeHtml(totalOversShown)} overs shown)</span>`
                : ""
            }
          </div>
          <button type="button" class="filter-pill" data-toggle-overs-order="1" style="font-size:10px;padding:3px 9px;">
            ${newestFirst ? "Order: Latest First" : "Order: Over 1 →"}
          </button>
        </div>
        ${inningsFilterHtml}
        ${groupsHtml}
      </div>
    `;
  }

  function renderCricketBannerTeam(team, matchStatus, allowWinnerBadge) {
    const { escapeHtml, formatCricketScore } = Apex.utils;
    const accent = safeCricketHex(team && team.color, "#38bdf8");
    const isBatting = Boolean(team && team.isBatting && matchStatus === "LIVE");
    const isWinner = Boolean(allowWinnerBadge && team && team.winner && matchStatus === "FT");
    const rawScore = formatCricketScore(team);
    const displayScore =
      matchStatus === "FT" && String(rawScore).trim() === "Yet to bat"
        ? "Did not bat"
        : rawScore;
    const isTextStatus = !/\d/.test(String(displayScore || ""));
    const tag = isBatting
      ? `<span class="cr-sc-team-tag is-batting">BATTING</span>`
      : isWinner
      ? `<span class="cr-sc-team-tag is-winner">WON</span>`
      : "";
    return `
      <div class="cr-sc-team ${isBatting ? "is-batting" : ""} ${isWinner ? "is-winner" : ""}" style="--team-accent:${escapeHtml(accent)};">
        <div class="cr-sc-team-head">
          <span class="cr-sc-crest">${escapeHtml((team && team.abbr) || "TM")}</span>
          <span class="cr-sc-team-name">${escapeHtml((team && team.name) || "Team")}</span>
          ${tag}
        </div>
        <div class="cr-sc-team-score tabular">
          <span class="cr-sc-runs ${isTextStatus ? "is-text-status" : ""}">${escapeHtml(displayScore)}</span>
          ${
            team && team.overs && team.overs !== "-"
              ? `<span class="cr-sc-overs">(${escapeHtml(team.overs)} ov)</span>`
              : ""
          }
        </div>
      </div>
    `;
  }

  function renderCricketModal(match, ui) {
    activeModalPlayers.clear();
    const { escapeHtml, renderStatusBadge } = Apex.utils;
    const safeUrl =
      match.externalUrl && /^https?:\/\//i.test(match.externalUrl) ? match.externalUrl : "";

    const activeTab = (ui && ui.cricketModalTab) || "scorecard";
    const selectedInn = (ui && ui.cricketSelectedInnings) || "all";
    const inningsList = Array.isArray(match.inningsCards) ? match.inningsCards : [];
    const orderedInnings = [...inningsList].reverse();
    const visibleInnings =
      selectedInn === "all"
        ? orderedInnings
        : orderedInnings.filter((inn) => String(inn.period) === String(selectedInn));
    const displayInnings = visibleInnings.length ? visibleInnings : orderedInnings;
    const latestPeriod = inningsList.length ? inningsList[inningsList.length - 1].period : null;

    const inningsSwitcherHtml =
      inningsList.length > 1
        ? `
        <div class="cr-inn-tabs" role="tablist" aria-label="Filter Innings">
          <button type="button" class="cr-inn-pill ${selectedInn === "all" ? "is-active" : ""}" data-cr-inn="all">
            All Innings (${inningsList.length})
          </button>
          ${orderedInnings
            .map(
              (inn) => `
            <button type="button" class="cr-inn-pill ${String(selectedInn) === String(inn.period) ? "is-active" : ""}" data-cr-inn="${escapeHtml(inn.period)}">
              Inn ${escapeHtml(inn.period)}: ${escapeHtml(inn.batTeamAbbr || inn.batTeamName)} ${
                inn.scoreBadge ? `<span class="tabular">(${escapeHtml(inn.scoreBadge)})</span>` : ""
              }
            </button>
          `
            )
            .join("")}
        </div>
      `
        : "";

    const lastBallsStripHtml =
      match.recentBalls && match.recentBalls.length
        ? `
        <div class="cr-last6-strip">
          <div class="cr-last6-left">
            <span class="cr-meta-label">Recent Balls</span>
            <div class="cr-last6-list">${match.recentBalls.map(renderCricketBallBadge).join("")}</div>
          </div>
          <button type="button" class="cr-mini-details-btn" data-cr-tab="overs">Full Over-by-Over →</button>
        </div>
      `
        : "";

    const inningsHtml = inningsList.length
      ? `
        ${inningsSwitcherHtml}
        <div class="cr-inn-stack">
          ${displayInnings
            .map((inn) => renderCricketInningsCard(inn, inn.period === latestPeriod, match.status === "LIVE", match.status, match.series))
            .join("")}
        </div>
      `
      : "";

    const fallbackPlayersHtml = !inningsList.length
      ? `${
          match.batters && match.batters.length
            ? `
          <section class="cr-inn-card">
            <div class="cr-inn-head">
              <div class="cr-inn-head-left">
                <span class="cr-inn-team">Active Batters</span>
              </div>
            </div>
            <div class="cr-table-scroll">
              <table class="cr-sc-table is-batting">
                <thead><tr><th class="is-left">Batter</th><th>R</th><th>B</th><th>4s</th><th>6s</th><th>SR</th></tr></thead>
                <tbody>
                  ${match.batters
                    .map((b) => {
                      const pKey = registerCricketPlayerHint(b, "", match.series, {
                        batScore: `${b.runs} (${b.balls}b)`,
                        dismissal: b.dismissal || ""
                      });
                      return `<tr><td class="is-left cr-batter-cell"><button type="button" class="player-link-btn" data-open-player="${escapeHtml(pKey)}"><span class="cr-batter-name">${escapeHtml(b.name)}${b.striker ? `<span class="cr-star">*</span>` : ""}</span></button>${b.isOut && b.dismissal ? `<div class="cr-mini-dismissal">${escapeHtml(b.dismissal)}</div>` : ""}</td><td class="cr-runs-cell">${escapeHtml(b.runs)}</td><td class="cr-num-muted">${escapeHtml(b.balls)}</td><td class="cr-num-muted">${escapeHtml(b.fours)}</td><td class="cr-num-muted">${escapeHtml(b.sixes)}</td><td class="cr-sr-cell">${escapeHtml(b.sr)}</td></tr>`;
                    })
                    .join("")}
                </tbody>
              </table>
            </div>
          </section>`
            : ""
        }${
          match.bowler
            ? `
          <section class="cr-inn-card">
            <div class="cr-inn-head">
              <div class="cr-inn-head-left">
                <span class="cr-inn-team">Active Bowler</span>
              </div>
            </div>
            <div class="cr-table-scroll">
              <table class="cr-sc-table is-bowling">
                <thead><tr><th class="is-left">Bowler</th><th>O</th><th>M</th><th>R</th><th>W</th><th>ECON</th><th>AVG</th></tr></thead>
                <tbody>
                  ${(() => {
                    const pKey = registerCricketPlayerHint(match.bowler, "", match.series, {
                      bowlSummary: `${match.bowler.wickets}/${match.bowler.runs} (${match.bowler.overs} ov) • Econ ${match.bowler.econ}`
                    });
                    return `<tr><td class="is-left cr-batter-cell"><button type="button" class="player-link-btn" data-open-player="${escapeHtml(pKey)}"><span class="cr-batter-name">${escapeHtml(match.bowler.name)}</span></button></td><td>${escapeHtml(match.bowler.overs)}</td><td class="cr-num-muted">${escapeHtml(match.bowler.maidens)}</td><td>${escapeHtml(match.bowler.runs)}</td><td><span class="cr-wkts-pill ${Number(match.bowler.wickets) >= 1 ? "has-wkts" : "is-zero"}">${escapeHtml(match.bowler.wickets)}</span></td><td>${escapeHtml(match.bowler.econ)}</td><td class="cr-avg-cell">${escapeHtml(match.bowler.wickets > 0 ? (match.bowler.runs / match.bowler.wickets).toFixed(2) : "-")}</td></tr>`;
                  })()}
                </tbody>
              </table>
            </div>
          </section>`
            : match.leagueId && match.rawEventId && !match._summaryEnriched
            ? `<div class="empty-state">Loading full scorecard &amp; bowling averages...</div>`
            : `<div class="empty-state">${match.status === "UP" ? "Match has not started yet — check Squads &amp; Info for announced lineups." : "Detailed scorecard is not yet available for this fixture."}</div>`
        }`
      : "";

    const squadsList = Array.isArray(match.squads) ? match.squads : [];
    const squadsHtml = squadsList.length
      ? `
        <div class="modal-section-label">
          <span>Both Team Squads (In Batting Order)</span>
          <span style="font-size:10px;color:var(--text-secondary);text-transform:none;">Click any player for age, ICC rankings &amp; career stats</span>
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
                  .map((pl, idx) => {
                    const pKey = registerCricketPlayerHint(pl, sq.teamName, match.series, {
                      batSummary: pl.batSummary || "",
                      bowlSummary: pl.bowlSummary || ""
                    });
                    return `
                  <div class="cr-squad-row is-clickable" data-open-player="${escapeHtml(pKey)}" role="button" tabindex="0" title="Click for player age, ICC world ranking &amp; stats">
                    <div class="fb-player-left">
                      <span class="fb-num-tag">${idx + 1}.</span>
                      <div class="fb-player-name-wrap">
                        <span class="fb-player-name">${escapeHtml(pl.name)}${pl.captain ? " (c)" : ""}${pl.keeper ? " (wk)" : ""}</span>
                        ${pl.role ? `<span class="fb-swap-note">${escapeHtml(pl.role)}</span>` : ""}
                      </div>
                    </div>
                    <div class="cr-squad-stats">
                      <span class="cr-bat-line"><strong>Bat:</strong> ${formatSquadBatSummaryHtml(pl, match.status)}</span>
                      ${pl.bowled ? `<span style="color:var(--sport-cricket);"><strong>Bowl:</strong> ${escapeHtml(pl.bowlSummary)}</span>` : ""}
                    </div>
                  </div>
                `;
                  })
                  .join("")}
              </div>
              ${
                sq.bench && sq.bench.length
                  ? `
                <div class="squad-sub-label">Bench / Squad Reserves (${sq.bench.length})</div>
                <div class="cr-bench-chips">
                  ${sq.bench
                    .map((b) => {
                      const bKey = registerCricketPlayerHint(b, sq.teamName, match.series, { batSummary: "Reserve / Bench" });
                      return `<button type="button" class="cr-dnb-chip is-clickable" data-open-player="${escapeHtml(bKey)}">${escapeHtml(b.name)}</button>`;
                    })
                    .join("")}
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
      : `<div class="empty-state">Squad lineups have not been published for this match.</div>`;

    const notesList = Array.isArray(match.recentNotes) ? match.recentNotes : [];
    const notesHtml = notesList.length
      ? `
          <div class="modal-section-label">Match Notes</div>
          <div class="timeline-list">
            ${notesList.map((n, i) => `<div class="timeline-item"><span class="timeline-min">#${i + 1}</span><span>${escapeHtml(n)}</span></div>`).join("")}
          </div>
        `
      : "";

    const totalOversCount = (match.overByOver || []).reduce((acc, g) => acc + ((g.overs && g.overs.length) || 0), 0);
    const totalSquadCount = squadsList.length;
    const distinctUpdate = match.lastBallNote && match.lastBallNote !== match.equation ? match.lastBallNote : "";

    let tabBodyHtml = "";
    if (activeTab === "overs") {
      tabBodyHtml = renderCricketOversSection(match, ui);
    } else if (activeTab === "squads") {
      tabBodyHtml = `${squadsHtml}${notesHtml}`;
    } else {
      tabBodyHtml = `${lastBallsStripHtml}${inningsHtml}${fallbackPlayersHtml}`;
    }

    const bothMarkedWinner = Boolean(match.team1 && match.team1.winner && match.team2 && match.team2.winner);
    const isNoResultOrDraw =
      bothMarkedWinner || /\b(no result|abandoned|drawn|draw|tied|cancelled)\b/i.test(String(match.equation || ""));
    const allowWinnerBadge = !isNoResultOrDraw;

    const venueClean = String(match.venue || "").trim();
    const seriesClean = String(match.series || "").trim();
    const venuePrimary = venueClean.split(",")[0].trim();
    const showVenue = Boolean(
      venueClean &&
        (!seriesClean ||
          (!seriesClean.toLowerCase().includes(venueClean.toLowerCase()) &&
            (!venuePrimary || !seriesClean.toLowerCase().includes(venuePrimary.toLowerCase()))))
    );

    return {
      title: `${match.format} • ${match.series}`,
      body: `
        <div class="cr-sc-banner">
          <div class="cr-sc-banner-top">
            <div class="cr-sc-meta-left">
              <span class="cricket-format-tag">${escapeHtml(match.format)}</span>
              <span class="cr-sc-series">${escapeHtml(match.series)}</span>
              ${showVenue ? `<span class="cr-sc-venue">• ${escapeHtml(venueClean)}</span>` : ""}
            </div>
            <div class="cr-sc-meta-right">
              ${safeUrl ? `<a class="cr-espn-link" href="${escapeHtml(safeUrl)}" target="_blank" rel="noopener noreferrer">ESPN ↗</a>` : ""}
              ${renderStatusBadge(match.status, match.clock)}
            </div>
          </div>

          <div class="cr-sc-teams-row">
            ${renderCricketBannerTeam(match.team1, match.status, allowWinnerBadge)}
            ${renderCricketBannerTeam(match.team2, match.status, allowWinnerBadge)}
          </div>

          <div class="cr-sc-banner-foot">
            <div class="cr-sc-equation">${escapeHtml(match.equation || match.clock || "Match Center")}</div>
            <div class="cr-sc-metrics tabular">
              ${match.crr && match.crr !== "-" ? `<span class="cr-metric-chip">CRR <strong>${escapeHtml(match.crr)}</strong></span>` : ""}
              ${match.rrr ? `<span class="cr-metric-chip">RRR <strong>${escapeHtml(match.rrr)}</strong></span>` : ""}
              ${match.target ? `<span class="cr-metric-chip">Target <strong>${escapeHtml(match.target)}</strong></span>` : ""}
            </div>
          </div>
          ${distinctUpdate ? `<div class="cr-sc-latest-note"><strong>Latest:</strong> ${escapeHtml(distinctUpdate)}</div>` : ""}
        </div>

        <nav class="cr-sc-tabs" role="tablist" aria-label="Cricket Scorecard Views">
          <button type="button" class="cr-sc-tab ${activeTab === "scorecard" ? "is-active" : ""}" data-cr-tab="scorecard">
            Scorecard ${inningsList.length ? `<span class="cr-tab-count">${inningsList.length}</span>` : ""}
          </button>
          <button type="button" class="cr-sc-tab ${activeTab === "overs" ? "is-active" : ""}" data-cr-tab="overs">
            Over-by-Over ${totalOversCount ? `<span class="cr-tab-count">${totalOversCount}</span>` : ""}
          </button>
          <button type="button" class="cr-sc-tab ${activeTab === "squads" ? "is-active" : ""}" data-cr-tab="squads">
            Squads &amp; Info ${totalSquadCount ? `<span class="cr-tab-count">${totalSquadCount}</span>` : ""}
          </button>
        </nav>

        ${tabBodyHtml}
      `
    };
  }

  function formatModalF1DateTime(isoStr) {
    if (!isoStr) return "TBD";
    const dt = new Date(isoStr);
    if (Number.isNaN(dt.getTime())) return "TBD";
    return dt.toLocaleString([], {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function renderPlayerAvatarHtml(photoUrl, fallbackPhoto, name, accentColor, numberBadge) {
    const { escapeHtml } = Apex.utils;
    const initials =
      String(name || "PL")
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((w) => w.charAt(0).toUpperCase())
        .join("") || "PL";
    const bg = /^#[0-9a-f]{3,6}$/i.test(String(accentColor || "")) ? accentColor : "#0ea5e9";
    const safeFb = fallbackPhoto && /^https?:\/\//i.test(fallbackPhoto) ? fallbackPhoto : "";
    const safePhoto = photoUrl && /^https?:\/\//i.test(photoUrl) ? photoUrl : safeFb;
    const badgeHtml = numberBadge ? `<span class="player-avatar-num tabular">#${escapeHtml(numberBadge)}</span>` : "";

    if (!safePhoto) {
      return `
        <div class="player-avatar-box is-fallback" style="--avatar-accent:${escapeHtml(bg)};">
          <span class="player-avatar-initials">${escapeHtml(initials)}</span>
          ${badgeHtml}
        </div>
      `;
    }

    const onErrHandler =
      safeFb && safeFb !== safePhoto
        ? `if(!this.dataset.triedFb){this.dataset.triedFb='1';this.src='${escapeHtml(safeFb)}';}else{this.style.display='none';this.nextElementSibling.style.display='flex';}`
        : `this.style.display='none';this.nextElementSibling.style.display='flex';`;

    return `
      <div class="player-avatar-box" style="--avatar-accent:${escapeHtml(bg)};">
        <img class="player-avatar-img" src="${escapeHtml(safePhoto)}" alt="${escapeHtml(name || "Player")}" loading="lazy" onerror="${onErrHandler}" />
        <div class="player-avatar-fallback" style="display:none;">
          <span class="player-avatar-initials">${escapeHtml(initials)}</span>
        </div>
        ${badgeHtml}
      </div>
    `;
  }

  function renderF1Modal(f1, targetId) {
    const { escapeHtml } = Apex.utils;
    const focusedDriver = (f1.drivers || []).find((d) => d.code === targetId);
    const isDriverModal = Boolean(focusedDriver);
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
      ? (() => {
          const lapsDriven = focusedDriver.laps !== undefined && focusedDriver.laps !== null ? focusedDriver.laps : f1.lap;
          const totalRaceLaps = f1.totalLaps || lapsDriven || "-";
          const pitDetailsList = Array.isArray(focusedDriver.pitDetails) ? focusedDriver.pitDetails : [];
          const stintsList = Array.isArray(focusedDriver.stintHistory) ? focusedDriver.stintHistory : [];
          const gridDelta = Number(focusedDriver.delta) || 0;
          const deltaLabel =
            gridDelta > 0
              ? `▲${gridDelta} from P${focusedDriver.grid || "-"}`
              : gridDelta < 0
              ? `▼${Math.abs(gridDelta)} from P${focusedDriver.grid || "-"}`
              : focusedDriver.grid
              ? `Grid P${focusedDriver.grid}`
              : "Grid -";
          const st = focusedDriver.standing;

          return `
            <div class="f1-driver-card" style="--drv-color:${escapeHtml(focusedDriver.color || "#e11d48")};">
              <div class="f1-driver-top">
                <div class="f1-driver-identity">
                  ${renderPlayerAvatarHtml(focusedDriver.headshot, "", focusedDriver.name, focusedDriver.color, focusedDriver.number)}
                  <div class="f1-driver-meta">
                    <div class="f1-driver-kicker tabular">
                      <span class="f1-pos-chip">P${escapeHtml(focusedDriver.pos)}</span>
                      <span class="f1-code-chip">${escapeHtml(focusedDriver.code)}</span>
                      <span class="f1-delta-chip ${gridDelta > 0 ? "is-up" : gridDelta < 0 ? "is-down" : ""}">${escapeHtml(deltaLabel)}</span>
                    </div>
                    <div class="f1-driver-name">${escapeHtml(focusedDriver.name)}</div>
                    <div class="f1-driver-sub">
                      <span>${escapeHtml(focusedDriver.team)}</span>
                      ${focusedDriver.nationality ? `<span>• ${escapeHtml(focusedDriver.nationality)}</span>` : ""}
                      ${focusedDriver.age ? `<span>• Age ${escapeHtml(focusedDriver.age)}</span>` : ""}
                    </div>
                  </div>
                </div>
                <span class="tyre-pill is-${escapeHtml(focusedDriver.tyre)}">${escapeHtml(focusedDriver.tyre)} • ${escapeHtml(focusedDriver.tyreAge)}L</span>
              </div>

              <div class="f1-driver-stat-grid tabular">
                <div class="f1-dstat-box">
                  <span class="f1-dstat-lbl">Laps Driven</span>
                  <span class="f1-dstat-val">${escapeHtml(lapsDriven)} / ${escapeHtml(totalRaceLaps)}</span>
                </div>
                <div class="f1-dstat-box">
                  <span class="f1-dstat-lbl">Gap / Result</span>
                  <span class="f1-dstat-val">${escapeHtml(focusedDriver.gap)}</span>
                </div>
                <div class="f1-dstat-box">
                  <span class="f1-dstat-lbl">Pit Stops</span>
                  <span class="f1-dstat-val">${escapeHtml(focusedDriver.pits)}</span>
                </div>
                <div class="f1-dstat-box">
                  <span class="f1-dstat-lbl">Fastest / Last Lap</span>
                  <span class="f1-dstat-val">${escapeHtml(focusedDriver.fastestLap && focusedDriver.fastestLap !== "-" ? focusedDriver.fastestLap : focusedDriver.lastLap)}</span>
                </div>
                <div class="f1-dstat-box">
                  <span class="f1-dstat-lbl">Status</span>
                  <span class="f1-dstat-val">${escapeHtml(focusedDriver.statusText || "Classified")}</span>
                </div>
                <div class="f1-dstat-box">
                  <span class="f1-dstat-lbl">Race Points</span>
                  <span class="f1-dstat-val">${focusedDriver.racePoints !== null && focusedDriver.racePoints !== undefined ? `${escapeHtml(focusedDriver.racePoints)} pts` : "-"}</span>
                </div>
              </div>

              ${
                st
                  ? `
                <div class="f1-standings-strip tabular">
                  <span class="f1-stand-badge">Season Standing: P${escapeHtml(st.pos)}</span>
                  <span>Points: <strong>${escapeHtml(st.points)}</strong></span>
                  <span>Wins: <strong>${escapeHtml(st.wins)}</strong></span>
                </div>
              `
                  : ""
              }

              ${
                pitDetailsList.length || stintsList.length
                  ? `
                <div class="f1-stint-pit-wrap">
                  ${
                    pitDetailsList.length
                      ? `
                    <div class="f1-mini-group">
                      <span class="f1-mini-lbl">Pit Stop Log</span>
                      <div class="f1-mini-chips tabular">
                        ${pitDetailsList
                          .map((p) => `<span class="f1-pit-chip">Stop ${escapeHtml(p.stop)}: Lap ${escapeHtml(p.lap)}${p.duration && p.duration !== "-" ? ` (${escapeHtml(p.duration)})` : ""}</span>`)
                          .join("")}
                      </div>
                    </div>
                  `
                      : ""
                  }
                  ${
                    stintsList.length
                      ? `
                    <div class="f1-mini-group">
                      <span class="f1-mini-lbl">Tyre Stints</span>
                      <div class="f1-mini-chips tabular">
                        ${stintsList
                          .map((s) => `<span class="f1-stint-chip"><span class="tyre-pill is-${escapeHtml(s.code)}" style="padding:1px 5px;font-size:9px;">${escapeHtml(s.code)}</span> L${escapeHtml(s.lapStart)}–${escapeHtml(s.lapEnd)} (${escapeHtml(s.laps)}L)</span>`)
                          .join("")}
                      </div>
                    </div>
                  `
                      : ""
                  }
                </div>
              `
                  : ""
              }
            </div>
          `;
        })()
      : "";

    const upcoming = f1.upcomingRace;
    const nowMs = Date.now();
    const upcomingSection =
      !isDriverModal && upcoming
        ? (() => {
            const sessions = Array.isArray(upcoming.sessions) ? upcoming.sessions : [];
            const nextIdx = sessions.findIndex((s) => s.ts >= nowMs - 3600000);
            const sessionRowsHtml = sessions
              .map((s, idx) => {
                const isNext = idx === nextIdx;
                const isPost = !isNext && (s.state === "post" || (s.ts && s.ts < nowMs - 2 * 3600000));
                const badgeCls = s.state === "in" ? "is-live" : isPost ? "is-ft" : "is-pre";
                const badgeTxt = s.state === "in" ? "LIVE" : isPost ? "DONE" : isNext ? "NEXT UP" : "SCHEDULED";
                return `
                  <div class="f1-modal-session-row ${isNext ? "is-next" : ""}">
                    <span class="f1-modal-session-name">${escapeHtml(s.label)}</span>
                    <span class="f1-modal-session-when tabular">${escapeHtml(formatModalF1DateTime(s.iso))}</span>
                    <span class="status-badge ${badgeCls}">${badgeTxt}</span>
                  </div>
                `;
              })
              .join("");

            const calHtml = (upcoming.followingRaces || []).length
              ? `
                <div class="f1-modal-cal-wrap">
                  <div style="font-family:var(--font-mono);font-size:10px;color:var(--text-muted);text-transform:uppercase;">Upcoming Season Calendar</div>
                  <div class="f1-modal-cal-grid">
                    ${upcoming.followingRaces
                      .map((cal) => {
                        const sDt = cal.startDate ? new Date(cal.startDate) : null;
                        const eDt = cal.endDate ? new Date(cal.endDate) : null;
                        const sLbl = sDt && !Number.isNaN(sDt.getTime()) ? sDt.toLocaleDateString([], { month: "short", day: "numeric" }) : "";
                        const eLbl = eDt && !Number.isNaN(eDt.getTime()) ? eDt.toLocaleDateString([], { month: "short", day: "numeric" }) : "";
                        const span = sLbl && eLbl && sLbl !== eLbl ? `${sLbl} – ${eLbl}` : sLbl || eLbl || "TBD";
                        return `
                          <div class="f1-cal-chip">
                            <span class="f1-cal-name">${escapeHtml(cal.name)}</span>
                            <span class="f1-cal-date tabular">${escapeHtml(span)}</span>
                          </div>
                        `;
                      })
                      .join("")}
                  </div>
                </div>
              `
              : "";

            return `
              <div class="f1-modal-upcoming-box">
                <div class="f1-modal-upcoming-head">
                  <div>
                    <div class="f1-upcoming-tag">${upcoming.round ? `ROUND ${escapeHtml(upcoming.round)} • ${escapeHtml(upcoming.season)}` : "NEXT GRAND PRIX"}</div>
                    <div class="f1-modal-upcoming-gp">${escapeHtml(upcoming.grandPrix)}</div>
                    <div class="f1-modal-upcoming-loc"><strong>Where:</strong> ${escapeHtml(upcoming.circuit)} • ${escapeHtml(upcoming.location)}</div>
                    <div class="f1-modal-upcoming-loc"><strong>Lights Out:</strong> ${escapeHtml(formatModalF1DateTime(upcoming.raceDateIso))}</div>
                  </div>
                </div>
                ${sessions.length ? `<div class="f1-modal-session-list">${sessionRowsHtml}</div>` : ""}
                ${calHtml}
              </div>
            `;
          })()
        : "";

    return {
      title: isDriverModal
        ? `${focusedDriver.name} (${focusedDriver.code}) — ${f1.grandPrix}`
        : targetId === "f1-upcoming" && upcoming
        ? `${upcoming.grandPrix} — Upcoming Weekend Schedule`
        : `${f1.grandPrix} — Race Control & Telemetry`,
      body: `
        ${driverSpotlight}
        ${!isDriverModal && targetId === "f1-upcoming" ? upcomingSection : ""}
        <div style="display:flex;gap:10px;flex-wrap:wrap;font-family:var(--font-mono);font-size:11px;">
          <span class="status-badge is-live">LAP ${escapeHtml(f1.lap)}/${escapeHtml(f1.totalLaps)}</span>
          <span class="status-badge is-ft">FASTEST: ${escapeHtml(f1.fastestLapOwner || "-")} (${escapeHtml(f1.fastestLapTime || "-")})</span>
          <span class="status-badge is-pre">TRACK ${escapeHtml(f1.weather.trackTemp)} • AIR ${escapeHtml(f1.weather.airTemp)}</span>
        </div>
        ${!isDriverModal && targetId !== "f1-upcoming" ? upcomingSection : ""}
        <div style="font-family:var(--font-mono);font-size:11px;color:var(--text-muted);text-transform:uppercase;">Race Control Log</div>
        <div class="timeline-list">${notesHtml}</div>
      `
    };
  }

  function formatIccRankCellHtml(cell) {
    const { escapeHtml } = Apex.utils;
    if (!cell || (!cell.rank && !cell.best)) {
      return `<td class="player-rank-cell is-empty">—</td>`;
    }
    const rankTxt = cell.rank ? `#${escapeHtml(cell.rank)}` : "—";
    const subParts = [];
    if (cell.rating) subParts.push(`${escapeHtml(cell.rating)} pts`);
    if (!cell.rank && cell.best) subParts.push(`Best #${escapeHtml(cell.best)}`);
    return `
      <td class="player-rank-cell ${cell.rank ? "is-ranked" : ""}">
        <span class="player-rank-num tabular">${rankTxt}</span>
        ${subParts.length ? `<span class="player-rank-sub tabular">${subParts.join(" • ")}</span>` : ""}
      </td>
    `;
  }

  function renderCricketCareerMatrixHtml(title, table) {
    const { escapeHtml } = Apex.utils;
    if (!table || !table.formats || !table.rows) return "";
    const wanted = new Set(["Matches", "Innings", "Runs", "Highest", "Average", "SR", "100s", "50s", "Wickets", "Avg", "Eco", "BBI", "4w", "5w"]);
    const filteredRows = table.rows.filter((r) => wanted.has(r.label));
    const displayRows = filteredRows.length ? filteredRows : table.rows.slice(0, 7);

    return `
      <div class="player-card-section">
        <div class="player-section-title">${escapeHtml(title)}</div>
        <div class="cr-table-scroll">
          <table class="player-stat-table tabular">
            <thead>
              <tr>
                <th class="is-left">Metric</th>
                ${table.formats.map((f) => `<th>${escapeHtml(f)}</th>`).join("")}
              </tr>
            </thead>
            <tbody>
              ${displayRows
                .map(
                  (r) => `
                <tr>
                  <td class="is-left player-metric-lbl">${escapeHtml(r.label)}</td>
                  ${r.cols.map((val) => `<td>${escapeHtml(val || "-")}</td>`).join("")}
                </tr>
              `
                )
                .join("")}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  function renderFootballProfileBody(p) {
    const { escapeHtml } = Apex.utils;
    const ms = p.matchStats || {};
    const matchChips = [];
    if (ms.goals > 0) matchChips.push({ k: "Goals", v: `${ms.goals}${ms.goalMinutes && ms.goalMinutes.length ? ` (${ms.goalMinutes.join(", ")})` : ""}` });
    if (ms.assists > 0) matchChips.push({ k: "Assists", v: `${ms.assists}${ms.assistMinutes && ms.assistMinutes.length ? ` (${ms.assistMinutes.join(", ")})` : ""}` });
    if (ms.shots > 0) matchChips.push({ k: "Shots (On Target)", v: `${ms.shots} (${ms.shotsOnTarget || 0})` });
    if (ms.saves > 0) matchChips.push({ k: "Saves", v: String(ms.saves) });
    if (ms.yellowCards > 0) matchChips.push({ k: "Yellow Cards", v: String(ms.yellowCards) });
    if (ms.redCards > 0) matchChips.push({ k: "Red Cards", v: String(ms.redCards) });
    if (ms.subInMinute) matchChips.push({ k: "Sub On", v: ms.subInMinute });
    if (ms.subOutMinute) matchChips.push({ k: "Sub Off", v: ms.subOutMinute });

    const summaryHtml = (p.summaryStats || []).length
      ? `
        <div class="player-card-section">
          <div class="player-section-title">${escapeHtml(p.seasonTitle || "Season Summary")}</div>
          <div class="player-stat-grid tabular">
            ${p.summaryStats
              .map(
                (s) => `
              <div class="player-stat-box">
                <span class="player-stat-k">${escapeHtml(s.label)}</span>
                <span class="player-stat-v">${escapeHtml(s.value)}</span>
              </div>
            `
              )
              .join("")}
          </div>
        </div>
      `
      : "";

    const splitsHtml =
      p.seasonLabels && p.seasonLabels.length && p.seasonSplits && p.seasonSplits.length
        ? (() => {
            const isGk = /goalkeeper|^gk$/i.test(String(p.position || ""));
            const targetCols = isGk ? ["STRT", "SV", "GA", "CS", "YC", "RC"] : ["STRT", "G", "A", "SHOT", "SOG", "YC"];
            const colIndices = targetCols
              .map((lbl) => ({ lbl, idx: p.seasonLabels.indexOf(lbl) }))
              .filter((c) => c.idx >= 0);
            if (!colIndices.length) return "";
            return `
              <div class="player-card-section">
                <div class="player-section-title">Season Competition Breakdown</div>
                <div class="cr-table-scroll">
                  <table class="player-stat-table tabular">
                    <thead>
                      <tr>
                        <th class="is-left">Competition</th>
                        ${colIndices.map((c) => `<th>${escapeHtml(c.lbl)}</th>`).join("")}
                      </tr>
                    </thead>
                    <tbody>
                      ${p.seasonSplits
                        .map(
                          (sp) => `
                        <tr>
                          <td class="is-left player-metric-lbl">${escapeHtml(sp.competition)}</td>
                          ${colIndices.map((c) => `<td>${escapeHtml(sp.values[c.idx] !== undefined ? sp.values[c.idx] : "-")}</td>`).join("")}
                        </tr>
                      `
                        )
                        .join("")}
                    </tbody>
                  </table>
                </div>
              </div>
            `;
          })()
        : "";

    return `
      <div class="player-profile-hero">
        ${renderPlayerAvatarHtml(p.photo, "", p.name, "#10b981", p.jersey && p.jersey !== "-" ? p.jersey : "")}
        <div class="player-hero-info">
          <div class="player-hero-tags">
            <span class="player-role-pill">${escapeHtml(p.position)}</span>
            ${p.club && p.club !== "-" ? `<span class="player-club-pill">${escapeHtml(p.club)}</span>` : ""}
          </div>
          <div class="player-hero-name">${escapeHtml(p.name)}</div>
          <div class="player-hero-sub">
            ${p.flagUrl ? `<img class="player-flag-img" src="${escapeHtml(p.flagUrl)}" alt="${escapeHtml(p.nationality)}" onerror="this.style.display='none'" />` : ""}
            <span><strong>Nationality:</strong> ${escapeHtml(p.nationality)}</span>
            ${p.age && p.age !== "-" ? `<span>• <strong>Age:</strong> ${escapeHtml(p.age)}</span>` : ""}
          </div>
          ${
            p.height !== "-" || p.weight !== "-"
              ? `<div class="player-hero-sub"><span>Height: ${escapeHtml(p.height)}</span><span>• Weight: ${escapeHtml(p.weight)}</span></div>`
              : ""
          }
          ${p.bioNote ? `<div class="player-bio-note">${escapeHtml(p.bioNote)}</div>` : ""}
        </div>
      </div>

      ${
        matchChips.length
          ? `
        <div class="player-card-section">
          <div class="player-section-title">Current Match Contribution</div>
          <div class="player-stat-grid tabular">
            ${matchChips
              .map(
                (mc) => `
              <div class="player-stat-box">
                <span class="player-stat-k">${escapeHtml(mc.k)}</span>
                <span class="player-stat-v">${escapeHtml(mc.v)}</span>
              </div>
            `
              )
              .join("")}
          </div>
        </div>
      `
          : ""
      }

      ${summaryHtml}
      ${splitsHtml}
    `;
  }

  function renderCricketProfileBody(p) {
    const { escapeHtml } = Apex.utils;
    const ranks = p.iccRankings || { batting: {}, bowling: {}, allRounder: {} };
    const hasAnyRank = ["batting", "bowling", "allRounder"].some((cat) =>
      ["test", "odi", "t20"].some((fmt) => ranks[cat] && ranks[cat][fmt] && (ranks[cat][fmt].rank || ranks[cat][fmt].best))
    );
    const ms = p.matchStats || {};

    const matchPerfRows = [];
    if (ms.batScore) matchPerfRows.push({ k: "This Match Batting", v: `${ms.batScore}${ms.dismissal ? ` • ${ms.dismissal}` : ""}` });
    else if (ms.batSummary && ms.batSummary !== "Yet to bat") matchPerfRows.push({ k: "This Match Batting", v: ms.batSummary });
    if (ms.bowlSummary) matchPerfRows.push({ k: "This Match Bowling", v: ms.bowlSummary });

    const preferBowlFirst = /bowler/i.test(String(p.role || ""));
    const batTableHtml = renderCricketCareerMatrixHtml("Career Batting Statistics", p.careerBatting);
    const bowlTableHtml = renderCricketCareerMatrixHtml("Career Bowling Statistics", p.careerBowling);

    return `
      <div class="player-profile-hero">
        ${renderPlayerAvatarHtml(p.photo, p.fallbackPhoto, p.name, "#0ea5e9", "")}
        <div class="player-hero-info">
          <div class="player-hero-tags">
            <span class="player-role-pill">${escapeHtml(p.role || "Cricketer")}</span>
            <span class="player-age-pill tabular">Age: ${escapeHtml(p.age)}</span>
          </div>
          <div class="player-hero-name">${escapeHtml(p.fullName || p.name)}</div>
          <div class="player-hero-sub">
            ${p.flagUrl ? `<img class="player-flag-img" src="${escapeHtml(p.flagUrl)}" alt="${escapeHtml(p.team)}" onerror="this.style.display='none'" />` : ""}
            <span><strong>Team:</strong> ${escapeHtml(p.team)}</span>
            ${p.birthPlace ? `<span>• ${escapeHtml(p.birthPlace)}</span>` : ""}
          </div>
          <div class="player-hero-sub">
            <span><strong>Bat:</strong> ${escapeHtml(p.batStyle)}</span>
            <span>• <strong>Bowl:</strong> ${escapeHtml(p.bowlStyle)}</span>
          </div>
        </div>
      </div>

      <div class="player-card-section">
        <div class="player-section-title">ICC World Rankings</div>
        ${
          hasAnyRank
            ? `
          <div class="cr-table-scroll">
            <table class="player-rank-table">
              <thead>
                <tr>
                  <th class="is-left">Discipline</th>
                  <th>Test</th>
                  <th>ODI</th>
                  <th>T20I</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td class="is-left player-metric-lbl">Batting</td>
                  ${formatIccRankCellHtml(ranks.batting.test)}
                  ${formatIccRankCellHtml(ranks.batting.odi)}
                  ${formatIccRankCellHtml(ranks.batting.t20)}
                </tr>
                <tr>
                  <td class="is-left player-metric-lbl">Bowling</td>
                  ${formatIccRankCellHtml(ranks.bowling.test)}
                  ${formatIccRankCellHtml(ranks.bowling.odi)}
                  ${formatIccRankCellHtml(ranks.bowling.t20)}
                </tr>
                <tr>
                  <td class="is-left player-metric-lbl">All-Rounder</td>
                  ${formatIccRankCellHtml(ranks.allRounder.test)}
                  ${formatIccRankCellHtml(ranks.allRounder.odi)}
                  ${formatIccRankCellHtml(ranks.allRounder.t20)}
                </tr>
              </tbody>
            </table>
          </div>
        `
            : `<div class="player-muted-note">Not currently listed in live ICC Men's / Women's Top Rankings tables.</div>`
        }
      </div>

      ${
        matchPerfRows.length
          ? `
        <div class="player-card-section">
          <div class="player-section-title">Match Performance</div>
          <div class="player-stat-grid">
            ${matchPerfRows
              .map(
                (r) => `
              <div class="player-stat-box is-wide">
                <span class="player-stat-k">${escapeHtml(r.k)}</span>
                <span class="player-stat-v">${escapeHtml(r.v)}</span>
              </div>
            `
              )
              .join("")}
          </div>
        </div>
      `
          : ""
      }

      ${preferBowlFirst ? `${bowlTableHtml}${batTableHtml}` : `${batTableHtml}${bowlTableHtml}`}
    `;
  }

  function openPlayerModalLoading(hint) {
    const backdrop = document.getElementById("player-modal");
    const titleEl = document.getElementById("player-modal-title");
    const bodyEl = document.getElementById("player-modal-body");
    if (!backdrop || !titleEl || !bodyEl || !hint) return;
    const { escapeHtml } = Apex.utils;
    titleEl.textContent = `${hint.name}${hint.team ? ` — ${hint.team}` : ""}`;
    bodyEl.innerHTML = `
      <div class="player-loading-state">
        <div class="player-loading-spinner" aria-hidden="true"></div>
        <div>Loading live player photo, bio &amp; ${hint.sport === "cricket" ? "ICC rankings / stats" : "club & season stats"}...</div>
      </div>
    `;
    backdrop.classList.add("is-open");
  }

  function updatePlayerModalContent(profile) {
    const backdrop = document.getElementById("player-modal");
    const titleEl = document.getElementById("player-modal-title");
    const bodyEl = document.getElementById("player-modal-body");
    if (!backdrop || !titleEl || !bodyEl || !profile || !backdrop.classList.contains("is-open")) return;
    titleEl.textContent =
      profile.sport === "cricket"
        ? `${profile.name}${profile.team && profile.team !== "-" ? ` • ${profile.team}` : ""}`
        : `${profile.name}${profile.club && profile.club !== "-" ? ` • ${profile.club}` : ""}`;
    bodyEl.innerHTML =
      profile.sport === "cricket" ? renderCricketProfileBody(profile) : renderFootballProfileBody(profile);
  }

  function openPlayerModalError(hint, errMsg) {
    const backdrop = document.getElementById("player-modal");
    const bodyEl = document.getElementById("player-modal-body");
    if (!backdrop || !bodyEl || !backdrop.classList.contains("is-open")) return;
    const { escapeHtml } = Apex.utils;
    bodyEl.innerHTML = `<div class="empty-state">Unable to load live profile for ${escapeHtml((hint && hint.name) || "player")}${errMsg ? ` (${escapeHtml(errMsg)})` : ""}.</div>`;
  }

  function closePlayerModal() {
    const backdrop = document.getElementById("player-modal");
    if (backdrop) backdrop.classList.remove("is-open");
  }

  function openInspectorModal(state, type, id, ui) {
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
      if (match) content = renderCricketModal(match, ui);
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
    closePlayerModal();
    const backdrop = document.getElementById("inspector-modal");
    if (backdrop) backdrop.classList.remove("is-open");
  }

  Apex.renderers = Apex.renderers || {};
  Apex.renderers.openInspectorModal = openInspectorModal;
  Apex.renderers.openSettingsModal = openSettingsModal;
  Apex.renderers.closeInspectorModal = closeInspectorModal;
  Apex.renderers.getModalPlayerHint = getModalPlayerHint;
  Apex.renderers.openPlayerModalLoading = openPlayerModalLoading;
  Apex.renderers.updatePlayerModalContent = updatePlayerModalContent;
  Apex.renderers.openPlayerModalError = openPlayerModalError;
  Apex.renderers.closePlayerModal = closePlayerModal;
})(window);
