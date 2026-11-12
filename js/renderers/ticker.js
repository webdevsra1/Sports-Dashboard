/* ==========================================================================
   Bottom Broadcast Ticker & Breaking Alert Toast Renderer
   ========================================================================== */

(function (root) {
  "use strict";

  const Apex = (root.ApexSports = root.ApexSports || {});
  let toastTimeout = null;
  let lastTickerSignature = "";

  function sportTagClass(sport, tag) {
    if (tag === "GOAL" || tag === "WICKET" || tag === "VSC DEPLOYED" || tag === "RED CARD") {
      return "is-alert";
    }
    if (sport === "football") return "is-football";
    if (sport === "cricket") return "is-cricket";
    if (sport === "f1") return "is-f1";
    return "is-football";
  }

  function sportIcon(sport) {
    if (sport === "football") return "⚽";
    if (sport === "cricket") return "🏏";
    if (sport === "f1") return "🏎️";
    return "•";
  }

  function renderTickerItems(items) {
    const { escapeHtml } = Apex.utils;
    return items
      .map(
        (item) => `
        <span class="ticker-item" data-ticker-target="${escapeHtml(item.targetType)}" data-ticker-id="${escapeHtml(item.targetId)}" title="Click to inspect details">
          <span>${sportIcon(item.sport)}</span>
          <span class="ticker-tag ${sportTagClass(item.sport, item.tag)}">${escapeHtml(item.tag)}</span>
          <span class="ticker-time tabular">${escapeHtml(item.time)}</span>
          <span class="ticker-text">${escapeHtml(item.text)}</span>
        </span>
      `
      )
      .join("");
  }

  function renderTicker(state, ui) {
    const bar = document.getElementById("bottom-ticker");
    const track = document.getElementById("ticker-track");
    if (!bar || !track) return;

    bar.classList.toggle("is-paused", Boolean(ui.tickerPaused));

    const allItems = state.ticker || [];
    const filtered =
      ui.tickerSportFilter === "all"
        ? allItems
        : allItems.filter((item) => item.sport === ui.tickerSportFilter);

    const effective = filtered.length
      ? filtered
      : [
          {
            id: "empty-tk",
            sport: "football",
            tag: "LIVE WIRE",
            time: "NOW",
            targetType: "football",
            targetId: state.football[0] ? state.football[0].id : "",
            text: "Monitoring live football, cricket, and Formula 1 feeds..."
          }
        ];

    const signature = `${ui.tickerSportFilter}|${ui.tickerSpeed}|${effective.map((i) => i.id).join(",")}`;
    if (signature === lastTickerSignature) {
      return;
    }
    lastTickerSignature = signature;

    const totalChars = effective.reduce((acc, item) => acc + (item.text ? item.text.length : 0) + 18, 0);
    const baseSeconds = Math.max(26, Math.round(totalChars * 0.14));
    const speedFactor = ui.tickerSpeed || 1;
    const duration = Math.max(14, Math.round(baseSeconds / speedFactor));
    track.style.setProperty("--ticker-duration", `${duration}s`);

    const singleChunk = renderTickerItems(effective);
    track.innerHTML = singleChunk + singleChunk;
  }

  function showBreakingToast(entry) {
    const toast = document.getElementById("breaking-toast");
    const labelEl = document.getElementById("breaking-toast-label");
    const bodyEl = document.getElementById("breaking-toast-body");
    if (!toast || !labelEl || !bodyEl || !entry) return;

    labelEl.textContent = `${sportIcon(entry.sport)} ${entry.tag} • ${entry.time}`;
    bodyEl.textContent = entry.text;
    toast.dataset.targetType = entry.targetType || "";
    toast.dataset.targetId = entry.targetId || "";
    toast.classList.add("is-visible");

    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
      toast.classList.remove("is-visible");
    }, 4500);
  }

  Apex.renderers = Apex.renderers || {};
  Apex.renderers.renderTicker = renderTicker;
  Apex.renderers.showBreakingToast = showBreakingToast;
})(window);
