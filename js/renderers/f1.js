/* ==========================================================================
   Formula 1 Renderer
   Renders Grand Prix Header, Track Flag, Telemetry Strip, Timing Tower,
   Pirelli Tyre Compounds, and Race Control Notes.
   ========================================================================== */

(function (root) {
  "use strict";

  const Apex = (root.ApexSports = root.ApexSports || {});

  function getTrackFlagInfo(status) {
    const code = String(status || "GREEN").toUpperCase();
    if (code === "VSC") return { cls: "is-vsc", label: "VIRTUAL SC" };
    if (code === "SC") return { cls: "is-sc", label: "SAFETY CAR" };
    if (code === "YELLOW") return { cls: "is-yellow", label: "YELLOW FLAG" };
    if (code === "RED") return { cls: "is-red", label: "RED FLAG" };
    return { cls: "is-green", label: "GREEN TRACK" };
  }

  function renderDelta(delta) {
    if (delta > 0) return `<span class="f1-delta is-up">▲${delta}</span>`;
    if (delta < 0) return `<span class="f1-delta is-down">▼${Math.abs(delta)}</span>`;
    return `<span class="f1-delta is-flat">—</span>`;
  }

  function formatF1Countdown(isoStr) {
    if (!isoStr) return "UPCOMING";
    const ts = Date.parse(isoStr);
    if (Number.isNaN(ts)) return "UPCOMING";
    const diffMs = ts - Date.now();
    if (diffMs <= 0 && diffMs >= -3 * 3600000) return "RACE LIVE";
    if (diffMs < -3 * 3600000) return "COMPLETED";
    const totalMins = Math.floor(diffMs / 60000);
    const days = Math.floor(totalMins / (24 * 60));
    const hours = Math.floor((totalMins % (24 * 60)) / 60);
    const mins = totalMins % 60;
    if (days >= 1) return `IN ${days}D ${hours}H`;
    if (hours >= 1) return `IN ${hours}H ${mins}M`;
    return `IN ${Math.max(1, mins)}M`;
  }

  function formatF1SessionClock(isoStr) {
    if (!isoStr) return "TBD";
    const dt = new Date(isoStr);
    if (Number.isNaN(dt.getTime())) return "TBD";
    const day = dt.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
    const tm = dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
    return `${day} • ${tm}`;
  }

  function formatF1ChipTime(isoStr) {
    if (!isoStr) return "TBD";
    const dt = new Date(isoStr);
    if (Number.isNaN(dt.getTime())) return "TBD";
    const wd = dt.toLocaleDateString([], { weekday: "short" });
    const tm = dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
    return `${wd} ${tm}`;
  }

  function formatF1WeekendSpan(startIso, endIso) {
    if (!startIso && !endIso) return "";
    const s = startIso ? new Date(startIso) : null;
    const e = endIso ? new Date(endIso) : null;
    if (s && !Number.isNaN(s.getTime()) && e && !Number.isNaN(e.getTime())) {
      const sText = s.toLocaleDateString([], { month: "short", day: "numeric" });
      const eText = e.toLocaleDateString([], { month: "short", day: "numeric" });
      return sText === eText ? sText : `${sText} – ${eText}`;
    }
    const valid = s && !Number.isNaN(s.getTime()) ? s : e;
    return valid ? valid.toLocaleDateString([], { month: "short", day: "numeric" }) : "";
  }

  function renderUpcomingF1Card(upcoming) {
    if (!upcoming) return "";
    const { escapeHtml } = Apex.utils;
    const sessions = Array.isArray(upcoming.sessions) ? upcoming.sessions : [];
    const nowMs = Date.now();
    const nextIdx = sessions.findIndex((s) => s.ts >= nowMs - 3600000);
    const countdown = formatF1Countdown(upcoming.raceDateIso);
    const weekendSpan = formatF1WeekendSpan(upcoming.weekendStartIso, upcoming.raceDateIso);
    const raceClock = formatF1SessionClock(upcoming.raceDateIso);

    const sessionChipsHtml = sessions
      .map((s, idx) => {
        const isNext = idx === nextIdx;
        const isPost = !isNext && (s.state === "post" || (s.ts && s.ts < nowMs - 2 * 3600000));
        return `
          <div class="f1-session-chip ${isNext ? "is-next" : ""} ${isPost ? "is-post" : ""}">
            <span class="f1-session-lbl">${escapeHtml(s.label)}</span>
            <span class="f1-session-time tabular">${escapeHtml(formatF1ChipTime(s.iso))}</span>
          </div>
        `;
      })
      .join("");

    return `
      <div class="f1-upcoming-card" data-open-modal="f1" data-id="f1-upcoming" title="Click for full Grand Prix weekend schedule & upcoming calendar">
        <div class="f1-upcoming-top">
          <div class="f1-upcoming-title-wrap">
            <span class="f1-upcoming-tag">${upcoming.round ? `NEXT • R${escapeHtml(upcoming.round)}` : "NEXT RACE"}</span>
            <span class="f1-upcoming-gp">${escapeHtml(upcoming.grandPrix)}</span>
          </div>
          <span class="f1-upcoming-countdown tabular">${escapeHtml(countdown)}</span>
        </div>
        <div class="f1-upcoming-meta">
          <div class="f1-upcoming-row">
            <span class="f1-upcoming-k">WHERE</span>
            <span class="f1-upcoming-v">${escapeHtml(upcoming.circuit)} • ${escapeHtml(upcoming.location)}</span>
          </div>
          <div class="f1-upcoming-row">
            <span class="f1-upcoming-k">WHEN</span>
            <span class="f1-upcoming-v tabular">${weekendSpan ? `${escapeHtml(weekendSpan)} • ` : ""}Race: ${escapeHtml(raceClock)}</span>
          </div>
        </div>
        ${sessions.length ? `<div class="f1-session-strip">${sessionChipsHtml}</div>` : ""}
      </div>
    `;
  }

  function renderF1Panel(state) {
    const container = document.getElementById("f1-panel-body");
    const countEl = document.getElementById("f1-panel-meta");
    if (!container) return;

    const f1 = state.f1;
    if (!f1) {
      container.innerHTML = `<div class="empty-state">Fetching latest Formula 1 session &amp; classification...</div>`;
      return;
    }

    const { escapeHtml } = Apex.utils;
    if (countEl) {
      if (f1.isPreviousResult && f1.upcomingRace) {
        countEl.textContent = `Next: ${f1.upcomingRace.grandPrix} • ${f1.session}`;
      } else {
        countEl.textContent = f1.isPreviousResult
          ? `Previous GP • ${f1.session}`
          : `${f1.session} • Lap ${f1.lap}/${f1.totalLaps}`;
      }
    }

    const flag = getTrackFlagInfo(f1.trackStatus);
    const lapPct = Math.min(100, Math.round((f1.lap / Math.max(1, f1.totalLaps)) * 100));
    const upcomingCardHtml = renderUpcomingF1Card(f1.upcomingRace);
    const hasDrivers = Array.isArray(f1.drivers) && f1.drivers.length > 0;

    const rowsHtml = (f1.drivers || [])
      .map((d) => {
        const isFastest = f1.fastestLapOwner && d.code === f1.fastestLapOwner;
        const compound = (d.tyre || "M").toUpperCase().slice(0, 1);
        return `
          <div class="f1-tower-row ${isFastest ? "is-fastest" : ""}" data-open-modal="f1" data-id="${escapeHtml(d.code)}" title="Click for Race Control & driver stint telemetry">
            <span class="f1-pos tabular">${escapeHtml(d.pos)}</span>
            ${renderDelta(d.delta)}
            <div class="f1-driver-cell">
              <span class="f1-team-bar" style="background:${escapeHtml(d.color)}"></span>
              <span class="f1-driver-code">${escapeHtml(d.code)}</span>
              <span class="f1-driver-team">${escapeHtml(d.team)}</span>
            </div>
            <span class="f1-gap tabular">${escapeHtml(d.gap)}</span>
            <span class="f1-lap-time tabular ${isFastest ? "is-purple" : ""}">${escapeHtml(d.lastLap)}</span>
            <span style="display:flex;justify-content:center;">
              <span class="tyre-pill is-${escapeHtml(compound)}" title="Compound ${escapeHtml(compound)} (${escapeHtml(d.tyreAge)} laps)">
                ${escapeHtml(compound)}<span style="font-size:8px;opacity:0.8">${escapeHtml(d.tyreAge)}</span>
              </span>
            </span>
            <span class="f1-pits tabular">${escapeHtml(d.pits)}</span>
          </div>
        `;
      })
      .join("");

    const notesHtml = (f1.raceControlNotes || [])
      .slice(0, 2)
      .map((n) => `<div style="font-size:11px;color:var(--text-secondary);line-height:1.35;">• ${escapeHtml(n)}</div>`)
      .join("");

    const towerHtml = hasDrivers
      ? `
        <div class="f1-tower-wrap">
          <div class="f1-tower-head">
            <span>Pos</span>
            <span></span>
            <span>Driver</span>
            <span style="text-align:right">Gap</span>
            <span style="text-align:right">Last Lap</span>
            <span style="text-align:center">Tyre</span>
            <span style="text-align:center">Pit</span>
          </div>
          ${rowsHtml}
        </div>
      `
      : "";

    container.innerHTML = `
      ${upcomingCardHtml}

      <div class="f1-header-card" data-open-modal="f1" data-id="f1-gp" style="cursor:pointer;">
        <div class="f1-gp-top">
          <div>
            <div class="f1-gp-name">${escapeHtml(f1.grandPrix)}</div>
            <div class="f1-gp-circuit">${escapeHtml(f1.circuit)}</div>
          </div>
          <span class="track-flag-pill ${flag.cls}">${flag.label}</span>
        </div>

        <div class="f1-lap-bar-row">
          <span class="f1-lap-label tabular">LAP ${escapeHtml(f1.lap)} / ${escapeHtml(f1.totalLaps)}</span>
          <div class="f1-progress-track">
            <div class="f1-progress-fill" style="width:${lapPct}%"></div>
          </div>
          <span class="f1-lap-label tabular" style="color:var(--text-muted)">${lapPct}%</span>
        </div>

        <div class="f1-telemetry-strip">
          <div class="f1-tele-chip">
            <span class="f1-tele-k">Fastest Lap</span>
            <span class="f1-tele-v f1-lap-time is-purple" style="text-align:left">${escapeHtml(f1.fastestLapOwner)} ${escapeHtml(f1.fastestLapTime)}</span>
          </div>
          <div class="f1-tele-chip">
            <span class="f1-tele-k">Track / Air</span>
            <span class="f1-tele-v">${escapeHtml(f1.weather.trackTemp)} / ${escapeHtml(f1.weather.airTemp)}</span>
          </div>
          <div class="f1-tele-chip">
            <span class="f1-tele-k">Wind</span>
            <span class="f1-tele-v">${escapeHtml(f1.weather.wind)}</span>
          </div>
        </div>
      </div>

      ${towerHtml}

      <div style="background:var(--bg-surface);border:1px solid var(--border-subtle);border-radius:var(--radius-md);padding:9px 11px;display:flex;flex-direction:column;gap:4px;">
        <div style="font-family:var(--font-mono);font-size:10px;font-weight:700;color:var(--sport-f1);text-transform:uppercase;letter-spacing:0.05em;">
          Race Control Wire
        </div>
        ${notesHtml}
      </div>
    `;
  }

  Apex.renderers = Apex.renderers || {};
  Apex.renderers.renderF1Panel = renderF1Panel;
})(window);
