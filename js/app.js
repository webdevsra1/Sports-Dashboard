/* ==========================================================================
   Sports Dashboard — Main Application Controller
   ========================================================================== */

(function (root) {
  "use strict";

  const Apex = (root.ApexSports = root.ApexSports || {});

  const ui = {
    activeSport: "all", // all | football | cricket | f1
    theme: "dark",
    footballLeagueFilter: "ALL",
    featuredFootballId: "",
    featuredCricketId: "",
    isInitialLoading: true,
    tickerPaused: false,
    tickerSpeed: 1,
    tickerSportFilter: "all",
    pollSeconds: 20,
    cricApiKey: "",
    feedStatusText: "SYNCING..."
  };

  let state = {
    football: [],
    cricket: [],
    f1: null,
    ticker: []
  };
  let lastFeedReport = null;
  let liveIntervalId = null;
  let clockIntervalId = null;
  let isSyncing = false;
  let activeModalKey = "";

  function renderAll() {
    updateHeaderChrome();
    applyLayoutVisibility();
    Apex.renderers.renderFootballPanel(state, ui);
    Apex.renderers.renderCricketPanel(state, ui);
    Apex.renderers.renderF1Panel(state, ui);
    Apex.renderers.renderTicker(state, ui);
  }

  function updateHeaderChrome() {
    const footballLive = (state.football || []).filter((m) => m.status === "LIVE" || m.status === "HT").length;
    const cricketLive = (state.cricket || []).filter((m) => m.status === "LIVE").length;
    const f1Lap = state.f1 ? `L${state.f1.lap}` : "GP";

    const fbTabCount = document.getElementById("tab-count-football");
    const crTabCount = document.getElementById("tab-count-cricket");
    const f1TabCount = document.getElementById("tab-count-f1");
    if (fbTabCount) fbTabCount.textContent = footballLive;
    if (crTabCount) crTabCount.textContent = cricketLive;
    if (f1TabCount) f1TabCount.textContent = f1Lap;

    document.querySelectorAll("[data-sport-tab]").forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.sportTab === ui.activeSport);
    });

    document.querySelectorAll("[data-ticker-filter]").forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.tickerFilter === ui.tickerSportFilter);
    });

    const pauseBtn = document.getElementById("ticker-pause-btn");
    if (pauseBtn) {
      pauseBtn.textContent = ui.tickerPaused ? "▶ Play" : "❚❚ Pause";
      pauseBtn.classList.toggle("is-active", ui.tickerPaused);
    }

    const speedBtn = document.getElementById("ticker-speed-btn");
    if (speedBtn) {
      speedBtn.textContent = `${ui.tickerSpeed}x`;
    }

    const syncBtn = document.getElementById("sync-now-btn");
    if (syncBtn) {
      syncBtn.textContent = isSyncing ? "↻ Syncing" : "↻ Sync";
    }

    const statusEl = document.getElementById("feed-status-label");
    if (statusEl) {
      statusEl.textContent = ui.feedStatusText;
    }

    const themeBtn = document.getElementById("theme-toggle-btn");
    if (themeBtn) {
      themeBtn.textContent = ui.theme === "dark" ? "☀ Light" : "☾ Dark";
    }
  }

  function applyLayoutVisibility() {
    const main = document.getElementById("dashboard-main");
    const panels = {
      football: document.getElementById("panel-football"),
      cricket: document.getElementById("panel-cricket"),
      f1: document.getElementById("panel-f1")
    };

    if (!main) return;
    main.classList.toggle("focus-single", ui.activeSport !== "all");

    Object.keys(panels).forEach((key) => {
      const el = panels[key];
      if (!el) return;
      const shouldHide = ui.activeSport !== "all" && ui.activeSport !== key;
      el.classList.toggle("is-hidden", shouldHide);
    });
  }

  async function syncLiveFeeds() {
    if (isSyncing) return;
    isSyncing = true;
    ui.feedStatusText = "SYNCING...";
    updateHeaderChrome();

    try {
      const updated = await Apex.liveFeed.fetchLiveSnapshot(state, {
        featuredFootballId: ui.featuredFootballId,
        featuredCricketId: ui.featuredCricketId,
        cricApiKey: ui.cricApiKey
      });

      state.football = updated.football;
      state.cricket = updated.cricket;
      state.f1 = updated.f1;
      state.ticker = updated.ticker;
      lastFeedReport = updated.feedReport;
      ui.isInitialLoading = false;

      // Ensure spotlight selections stay aligned with live or recent match IDs
      if (state.football.length && !state.football.some((m) => m.id === ui.featuredFootballId)) {
        ui.featuredFootballId = state.football[0].id;
      }
      if (state.cricket.length && !state.cricket.some((m) => m.id === ui.featuredCricketId)) {
        ui.featuredCricketId = state.cricket[0].id;
      }

      const syncTime = Apex.utils.formatLocalClock(new Date()).slice(0, 5);
      ui.feedStatusText = updated.feedReport && updated.feedReport.proxy ? `LIVE • ${syncTime}` : `DIRECT • ${syncTime}`;
      renderAll();

      if (updated.emittedBreaking && updated.emittedBreaking.length > 0) {
        Apex.renderers.showBreakingToast(updated.emittedBreaking[0]);
      }
    } catch (err) {
      ui.isInitialLoading = false;
      ui.feedStatusText = "OFFLINE";
      lastFeedReport = {
        proxy: false,
        footballSource: "Unavailable (CORS / Offline)",
        cricketSource: "Unavailable (CORS / Offline)",
        f1Source: "Unavailable (CORS / Offline)"
      };
      if (!state.ticker.length) {
        state.ticker.unshift({
          id: `tk-offline-${Date.now()}`,
          sport: "football",
          tag: "FEED NOTICE",
          time: Apex.utils.formatLocalClock(new Date()).slice(0, 5),
          targetType: "football",
          targetId: state.football[0] ? state.football[0].id : "",
          text: "Live feeds require Launch-Dashboard.bat (local proxy) or internet access."
        });
      }
      renderAll();
    } finally {
      isSyncing = false;
      updateHeaderChrome();
    }
  }

  function refreshModalIfOpen(key, type, id) {
    const modal = document.getElementById("inspector-modal");
    if (modal && modal.classList.contains("is-open") && activeModalKey === key) {
      Apex.renderers.openInspectorModal(state, type, id);
    }
  }

  async function enrichFootballMatchIfNeeded(match) {
    if (!match || !match.rawEventId) return false;
    const sum = await Apex.liveFeed.fetchFootballMatchSummary(match);
    if (!sum) return false;
    if (sum.possession) match.stats.possession = sum.possession;
    if (sum.shotsOnTarget) match.stats.shotsOnTarget = sum.shotsOnTarget;
    if (sum.events) match.events = sum.events;
    if (sum.commentary && sum.commentary.length) match.commentary = sum.commentary;
    if (sum.lineups) match.lineups = sum.lineups;
    if (sum.venue) match.venue = sum.venue;
    return true;
  }

  async function openAndEnrichModal(type, id) {
    const key = `${type}:${id}`;
    activeModalKey = key;
    Apex.renderers.openInspectorModal(state, type, id);

    if (type === "football") {
      const match = (state.football || []).find((m) => m.id === id);
      if (!match || !match.rawEventId) return;
      const ok = await enrichFootballMatchIfNeeded(match);
      if (!ok) return;
      Apex.renderers.renderFootballPanel(state, ui);
      refreshModalIfOpen(key, type, id);
    } else if (type === "cricket") {
      const crMatch = (state.cricket || []).find((m) => m.id === id);
      if (!crMatch || !crMatch.leagueId || !crMatch.rawEventId) return;
      const enriched = await Apex.liveFeed.fetchCricketMatchSummary(crMatch);
      if (!enriched) return;
      Apex.renderers.renderCricketPanel(state, ui);
      refreshModalIfOpen(key, type, id);
    }
  }

  function startLoops() {
    if (liveIntervalId) clearInterval(liveIntervalId);
    if (clockIntervalId) clearInterval(clockIntervalId);

    liveIntervalId = setInterval(() => {
      syncLiveFeeds();
    }, Math.max(10, ui.pollSeconds) * 1000);

    const updateClock = () => {
      const clockEl = document.getElementById("header-clock-time");
      if (clockEl) clockEl.textContent = Apex.utils.formatLocalClock(new Date());
    };
    updateClock();
    clockIntervalId = setInterval(updateClock, 1000);
  }

  function setTheme(nextTheme) {
    ui.theme = nextTheme === "light" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", ui.theme);
    try {
      localStorage.setItem("sd_theme", ui.theme);
    } catch (_) {
      // Ignore storage errors
    }
    updateHeaderChrome();
  }

  function bindEvents() {
    document.addEventListener("click", (e) => {
      const target = e.target;

      const sportTab = target.closest("[data-sport-tab]");
      if (sportTab) {
        ui.activeSport = sportTab.dataset.sportTab;
        renderAll();
        return;
      }

      const fbFilter = target.closest("[data-fb-filter]");
      if (fbFilter) {
        ui.footballLeagueFilter = fbFilter.dataset.fbFilter;
        Apex.renderers.renderFootballPanel(state, ui);
        return;
      }

      const pinFb = target.closest("[data-pin-football]");
      if (pinFb) {
        e.stopPropagation();
        ui.featuredFootballId = pinFb.dataset.pinFootball;
        Apex.renderers.renderFootballPanel(state, ui);
        const pinnedFb = (state.football || []).find((m) => m.id === ui.featuredFootballId);
        if (pinnedFb && !pinnedFb.lineups && pinnedFb.rawEventId) {
          enrichFootballMatchIfNeeded(pinnedFb).then((ok) => {
            if (ok && ui.featuredFootballId === pinnedFb.id) {
              Apex.renderers.renderFootballPanel(state, ui);
            }
          });
        }
        return;
      }

      const pinFbModal = target.closest("[data-pin-football-modal]");
      if (pinFbModal) {
        ui.featuredFootballId = pinFbModal.dataset.pinFootballModal;
        Apex.renderers.renderFootballPanel(state, ui);
        Apex.renderers.closeInspectorModal();
        return;
      }

      const crDetailsBtn = target.closest(".cr-mini-details-btn");
      if (crDetailsBtn) {
        e.stopPropagation();
        openAndEnrichModal("cricket", crDetailsBtn.dataset.id);
        return;
      }

      const selectCr = target.closest("[data-select-cricket]");
      if (selectCr) {
        ui.featuredCricketId = selectCr.dataset.selectCricket;
        Apex.renderers.renderCricketPanel(state, ui);
        const focusedCr = (state.cricket || []).find((m) => m.id === ui.featuredCricketId);
        if (focusedCr && !focusedCr._summaryEnriched && focusedCr.leagueId && focusedCr.rawEventId) {
          Apex.liveFeed.fetchCricketMatchSummary(focusedCr).then((res) => {
            if (res && ui.featuredCricketId === focusedCr.id) {
              Apex.renderers.renderCricketPanel(state, ui);
            }
          });
        }
        return;
      }

      const tickerPause = target.closest("#ticker-pause-btn");
      if (tickerPause) {
        ui.tickerPaused = !ui.tickerPaused;
        updateHeaderChrome();
        const bar = document.getElementById("bottom-ticker");
        if (bar) bar.classList.toggle("is-paused", ui.tickerPaused);
        return;
      }

      const tickerSpeed = target.closest("#ticker-speed-btn");
      if (tickerSpeed) {
        const cycle = [1, 1.5, 0.75];
        const idx = cycle.indexOf(ui.tickerSpeed);
        ui.tickerSpeed = cycle[(idx + 1) % cycle.length];
        updateHeaderChrome();
        Apex.renderers.renderTicker(state, ui);
        return;
      }

      const tickerFilter = target.closest("[data-ticker-filter]");
      if (tickerFilter) {
        ui.tickerSportFilter = tickerFilter.dataset.tickerFilter;
        updateHeaderChrome();
        Apex.renderers.renderTicker(state, ui);
        return;
      }

      const tickerItem = target.closest("[data-ticker-target]");
      if (tickerItem) {
        openAndEnrichModal(tickerItem.dataset.tickerTarget, tickerItem.dataset.tickerId);
        return;
      }

      const toast = target.closest("#breaking-toast");
      if (toast && toast.dataset.targetType) {
        openAndEnrichModal(toast.dataset.targetType, toast.dataset.targetId);
        toast.classList.remove("is-visible");
        return;
      }

      const openModalEl = target.closest("[data-open-modal]");
      if (openModalEl) {
        openAndEnrichModal(openModalEl.dataset.openModal, openModalEl.dataset.id);
        return;
      }

      if (target.closest("#feed-settings-btn")) {
        activeModalKey = "settings";
        Apex.renderers.openSettingsModal(ui, lastFeedReport);
        return;
      }

      if (target.closest("#modal-close-btn") || target.id === "inspector-modal") {
        activeModalKey = "";
        Apex.renderers.closeInspectorModal();
        return;
      }

      if (target.closest("#theme-toggle-btn")) {
        setTheme(ui.theme === "dark" ? "light" : "dark");
        return;
      }

      if (target.closest("#sync-now-btn")) {
        syncLiveFeeds();
      }
    });

    document.addEventListener("submit", (e) => {
      if (e.target && e.target.id === "feed-settings-form") {
        e.preventDefault();
        const pollEl = document.getElementById("setting-poll-seconds");
        const keyEl = document.getElementById("setting-cricapi-key");
        if (pollEl) ui.pollSeconds = parseInt(pollEl.value, 10) || 20;
        if (keyEl) ui.cricApiKey = keyEl.value.trim();
        try {
          localStorage.setItem("sd_poll_seconds", String(ui.pollSeconds));
          localStorage.setItem("sd_cricapi_key", ui.cricApiKey);
        } catch (_) {
          // Ignore storage failures
        }
        Apex.renderers.closeInspectorModal();
        startLoops();
        syncLiveFeeds();
      }
    });

    document.addEventListener("keydown", (e) => {
      if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "SELECT")) return;
      if (e.key === "Escape") {
        Apex.renderers.closeInspectorModal();
      } else if (e.key === "1" && !e.ctrlKey && !e.metaKey) {
        ui.activeSport = "all";
        renderAll();
      } else if (e.key === "2" && !e.ctrlKey && !e.metaKey) {
        ui.activeSport = "football";
        renderAll();
      } else if (e.key === "3" && !e.ctrlKey && !e.metaKey) {
        ui.activeSport = "cricket";
        renderAll();
      } else if (e.key === "4" && !e.ctrlKey && !e.metaKey) {
        ui.activeSport = "f1";
        renderAll();
      }
    });
  }

  function init() {
    try {
      const savedTheme = localStorage.getItem("sd_theme");
      if (savedTheme === "light" || savedTheme === "dark") {
        ui.theme = savedTheme;
      }
      const savedPoll = parseInt(localStorage.getItem("sd_poll_seconds"), 10);
      if (savedPoll >= 15 && savedPoll <= 120) {
        ui.pollSeconds = savedPoll;
      }
      const savedKey = localStorage.getItem("sd_cricapi_key");
      if (savedKey) ui.cricApiKey = savedKey;
    } catch (_) {
      // Ignore storage access errors
    }
    document.documentElement.setAttribute("data-theme", ui.theme);

    bindEvents();
    renderAll();
    startLoops();
    syncLiveFeeds();
  }

  document.addEventListener("DOMContentLoaded", init);
})(window);
