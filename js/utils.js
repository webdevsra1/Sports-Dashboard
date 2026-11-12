/* ==========================================================================
   Shared Utilities & Broadcast Helpers
   ========================================================================== */

(function (root) {
  "use strict";

  const Apex = (root.ApexSports = root.ApexSports || {});

  function escapeHtml(value) {
    if (value === null || value === undefined) return "";
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function formatLocalClock(date) {
    const d = date instanceof Date ? date : new Date();
    return d.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    });
  }

  function renderCrest(team, isLarge) {
    const sizeClass = isLarge ? "team-crest is-lg" : "team-crest";
    const bg = team.color || "#1e293b";
    const accent = team.accent || "rgba(255,255,255,0.22)";
    const abbr = escapeHtml((team.abbr || "TM").slice(0, 3).toUpperCase());

    if (team.logo) {
      return (
        `<span class="${sizeClass}" style="background:${escapeHtml(bg)};border-color:${escapeHtml(accent)}">` +
        `<img src="${escapeHtml(team.logo)}" alt="${abbr}" loading="lazy" ` +
        `onerror="this.style.display='none';this.nextElementSibling.style.display='inline';">` +
        `<span style="display:none">${abbr}</span>` +
        `</span>`
      );
    }

    return (
      `<span class="${sizeClass}" style="background:linear-gradient(145deg, ${escapeHtml(bg)} 0%, #0f172a 140%);` +
      `box-shadow: inset 0 -3px 0 ${escapeHtml(accent)};">` +
      `<span>${abbr}</span>` +
      `</span>`
    );
  }

  function renderStatusBadge(status, clockText) {
    if (status === "LIVE") {
      return `<span class="status-badge is-live"><span class="live-dot"></span>${escapeHtml(clockText || "LIVE")}</span>`;
    }
    if (status === "HT") {
      return `<span class="status-badge is-ht">${escapeHtml(clockText || "HT")}</span>`;
    }
    if (status === "FT") {
      return `<span class="status-badge is-ft">${escapeHtml(clockText || "FT")}</span>`;
    }
    return `<span class="status-badge is-pre">${escapeHtml(clockText || "UPCOMING")}</span>`;
  }

  function formatCricketScore(team) {
    if (!team) return "-";
    if (team.scoreDisplay !== undefined && team.scoreDisplay !== null && team.scoreDisplay !== "") {
      return String(team.scoreDisplay);
    }
    return `${team.runs}/${team.wickets}`;
  }

  Apex.utils = {
    escapeHtml,
    deepClone,
    formatLocalClock,
    renderCrest,
    renderStatusBadge,
    formatCricketScore
  };
})(window);
