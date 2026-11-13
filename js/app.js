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
    cricketOversNewestFirst: false,
    cricketModalTab: "scorecard",
    cricketSelectedInnings: "all",
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

  function copyFootballEnrichment(src, dst) {
    if (!src || !dst || src === dst) return;
    if (!dst.stats && src.stats) dst.stats = src.stats;
    if (!dst.events && src.events) dst.events = src.events;
    if ((!dst.commentary || !dst.commentary.length) && src.commentary && src.commentary.length) {
      dst.commentary = src.commentary;
    }
    if (!dst.lineups && src.lineups) dst.lineups = src.lineups;
    if (!dst.venue && src.venue) dst.venue = src.venue;
  }

  function copyCricketEnrichment(src, dst) {
    if (!src || !dst || src === dst) return;
    if (src._summaryEnriched) {
      if ((!dst.inningsCards || !dst.inningsCards.length) && Array.isArray(src.inningsCards) && src.inningsCards.length) {
        dst.inningsCards = src.inningsCards;
      }
      if ((!dst.squads || !dst.squads.length) && Array.isArray(src.squads) && src.squads.length) {
        dst.squads = src.squads;
      }
      if (!dst._summaryEnriched) {
        if ((!dst.batters || !dst.batters.length) && src.batters && src.batters.length) dst.batters = src.batters;
        if (!dst.bowler && src.bowler) dst.bowler = src.bowler;
        if ((!dst.recentNotes || !dst.recentNotes.length) && src.recentNotes && src.recentNotes.length) {
          dst.recentNotes = src.recentNotes;
        }
        if (src.lastBallNote && (!dst.lastBallNote || dst.lastBallNote === dst.equation)) {
          dst.lastBallNote = src.lastBallNote;
        }
        if (src.venue && (!dst.venue || src.venue.length > dst.venue.length)) dst.venue = src.venue;
        if (src.crr && src.crr !== "-" && (!dst.crr || dst.crr === "-")) dst.crr = src.crr;
        if (src.rrr && !dst.rrr) dst.rrr = src.rrr;
        if (src.target && !dst.target) dst.target = src.target;
        dst._summaryEnriched = true;
      }
    }

    if ((!Array.isArray(dst.overByOver) || !dst.overByOver.length) && Array.isArray(src.overByOver)) {
      if (src.overByOver.length || src._oversLoaded) {
        dst.overByOver = src.overByOver;
        dst.overByOverPartial = Boolean(src.overByOverPartial);
        dst._oversLoaded = Boolean(src._oversLoaded);
        dst._oversCached = Boolean(src._oversCached);
        dst._oversError = Boolean(src._oversError);
        dst._oversLoading = Boolean(src._oversLoading);
        if (src._oversLastFetchTs) dst._oversLastFetchTs = src._oversLastFetchTs;
      }
    }
    if ((!Array.isArray(dst.recentBalls) || !dst.recentBalls.length) && Array.isArray(src.recentBalls) && src.recentBalls.length) {
      dst.recentBalls = src.recentBalls;
    }
  }

  function syncCricketMatchIntoState(crMatch) {
    if (!crMatch) return;
    const target = (state.cricket || []).find((m) => m.id === crMatch.id);
    if (target && target !== crMatch) {
      copyCricketEnrichment(crMatch, target);
    }
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

      const prevFbMap = new Map((state.football || []).map((m) => [m.id, m]));
      const prevCrMap = new Map((state.cricket || []).map((m) => [m.id, m]));

      (updated.football || []).forEach((m) => copyFootballEnrichment(prevFbMap.get(m.id), m));
      (updated.cricket || []).forEach((m) => copyCricketEnrichment(prevCrMap.get(m.id), m));

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

      if (activeModalKey.startsWith("cricket:")) {
        const openId = activeModalKey.slice("cricket:".length);
        const openCr = (state.cricket || []).find((m) => m.id === openId);
        if (openCr) {
          refreshModalIfOpen(activeModalKey, "cricket", openId);
          if (openCr.status === "LIVE" && ui.cricketModalTab === "overs" && !openCr._oversLoading) {
            ensureCricketOversLoaded(openCr, { force: true });
          }
        }
      }

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
      const bodyEl = document.getElementById("modal-body");
      const prevScroll = bodyEl ? bodyEl.scrollTop : 0;
      Apex.renderers.openInspectorModal(state, type, id, ui);
      if (bodyEl && prevScroll > 0) {
        bodyEl.scrollTop = prevScroll;
      }
    }
  }

  async function ensureCricketOversLoaded(crMatch, options) {
    if (!crMatch || !crMatch.leagueId || !crMatch.rawEventId) return null;
    if (typeof Apex.liveFeed.fetchCricketPlayByPlay !== "function") return null;
    const key = `cricket:${crMatch.id}`;
    const res = await Apex.liveFeed.fetchCricketPlayByPlay(crMatch, true, options);
    syncCricketMatchIntoState(crMatch);
    Apex.renderers.renderCricketPanel(state, ui);
    refreshModalIfOpen(key, "cricket", crMatch.id);
    return res;
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
    const isNewModal = activeModalKey !== key;
    if (isNewModal && type === "cricket") {
      ui.cricketModalTab = "scorecard";
      ui.cricketSelectedInnings = "all";
    }
    activeModalKey = key;
    Apex.renderers.openInspectorModal(state, type, id, ui);

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
      const enriched = await Apex.liveFeed.fetchCricketMatchSummary(crMatch, {
        includeOvers: true,
        forceOvers: crMatch.status === "LIVE",
        onSummaryReady: () => {
          syncCricketMatchIntoState(crMatch);
          Apex.renderers.renderCricketPanel(state, ui);
          refreshModalIfOpen(key, type, id);
        }
      });
      syncCricketMatchIntoState(crMatch);
      if (!enriched && !crMatch._oversError) return;
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
        const matchId = crDetailsBtn.dataset.id;
        ui.featuredCricketId = matchId;
        Apex.renderers.renderCricketPanel(state, ui);
        openAndEnrichModal("cricket", matchId);
        return;
      }

      const selectCr = target.closest("[data-select-cricket]");
      if (selectCr) {
        const matchId = selectCr.dataset.selectCricket;
        ui.featuredCricketId = matchId;
        Apex.renderers.renderCricketPanel(state, ui);
        openAndEnrichModal("cricket", matchId);
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

      if (target.closest("[data-toggle-overs-order]") && activeModalKey.startsWith("cricket:")) {
        ui.cricketOversNewestFirst = !ui.cricketOversNewestFirst;
        const matchId = activeModalKey.slice("cricket:".length);
        Apex.renderers.openInspectorModal(state, "cricket", matchId, ui);
        return;
      }

      const retryOversBtn = target.closest("[data-retry-overs]");
      if (retryOversBtn && activeModalKey.startsWith("cricket:")) {
        const matchId = activeModalKey.slice("cricket:".length);
        const crMatch = (state.cricket || []).find((m) => m.id === matchId);
        if (crMatch) {
          crMatch._oversError = false;
          crMatch._oversLoading = true;
          Apex.renderers.openInspectorModal(state, "cricket", matchId, ui);
          ensureCricketOversLoaded(crMatch, { force: true });
        }
        return;
      }

      const crTabBtn = target.closest("[data-cr-tab]");
      if (crTabBtn && activeModalKey.startsWith("cricket:")) {
        ui.cricketModalTab = crTabBtn.dataset.crTab || "scorecard";
        const matchId = activeModalKey.slice("cricket:".length);
        const crMatch = (state.cricket || []).find((m) => m.id === matchId);
        Apex.renderers.openInspectorModal(state, "cricket", matchId, ui);
        if (ui.cricketModalTab === "overs" && crMatch && crMatch.leagueId && crMatch.rawEventId && !crMatch._oversLoading) {
          const hasOvers = Array.isArray(crMatch.overByOver) && crMatch.overByOver.length > 0;
          if (!hasOvers && (!crMatch._oversLoaded || crMatch._oversError || crMatch.status === "LIVE")) {
            crMatch._oversError = false;
            crMatch._oversLoading = true;
            Apex.renderers.openInspectorModal(state, "cricket", matchId, ui);
            ensureCricketOversLoaded(crMatch, { force: Boolean(crMatch._oversError) });
          } else if (
            crMatch.status === "LIVE" &&
            (!crMatch._oversLastFetchTs || Date.now() - crMatch._oversLastFetchTs > 15000)
          ) {
            ensureCricketOversLoaded(crMatch, { force: true });
          }
        }
        return;
      }

      const crInnBtn = target.closest("[data-cr-inn]");
      if (crInnBtn && activeModalKey.startsWith("cricket:")) {
        ui.cricketSelectedInnings = crInnBtn.dataset.crInn || "all";
        const matchId = activeModalKey.slice("cricket:".length);
        Apex.renderers.openInspectorModal(state, "cricket", matchId, ui);
        return;
      }

      if (target.closest("#player-modal-close-btn") || target.id === "player-modal") {
        Apex.renderers.closePlayerModal();
        return;
      }

      const openPlayerEl = target.closest("[data-open-player]");
      if (openPlayerEl) {
        handleOpenPlayerProfile(openPlayerEl.dataset.openPlayer);
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

    let activePlayerRequestSeq = 0;
    async function handleOpenPlayerProfile(playerKey) {
      const hint = Apex.renderers.getModalPlayerHint ? Apex.renderers.getModalPlayerHint(playerKey) : null;
      if (!hint) return;
      activePlayerRequestSeq += 1;
      const reqSeq = activePlayerRequestSeq;
      Apex.renderers.openPlayerModalLoading(hint);
      try {
        const profile = await Apex.liveFeed.fetchPlayerProfile(hint);
        if (reqSeq !== activePlayerRequestSeq) return;
        Apex.renderers.updatePlayerModalContent(profile);
      } catch (err) {
        if (reqSeq !== activePlayerRequestSeq) return;
        Apex.renderers.openPlayerModalError(hint, err && err.message ? err.message : "Network error");
      }
    }

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
      if (e.key === "Enter" || e.key === " ") {
        const focusedPlayerEl = document.activeElement instanceof Element ? document.activeElement.closest("[data-open-player]") : null;
        if (focusedPlayerEl) {
          e.preventDefault();
          handleOpenPlayerProfile(focusedPlayerEl.dataset.openPlayer);
          return;
        }
      }
      if (e.key === "Escape") {
        const playerBackdrop = document.getElementById("player-modal");
        if (playerBackdrop && playerBackdrop.classList.contains("is-open")) {
          Apex.renderers.closePlayerModal();
          return;
        }
        activeModalKey = "";
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

    const dashboardMain = document.getElementById("dashboard-main");
    (dashboardMain || document).addEventListener(
      "wheel",
      (e) => {
        if (e.ctrlKey || !e.deltaY) return;
        const target = e.target instanceof Element ? e.target : null;
        const splitBox = target ? target.closest(".match-split-box") : null;
        if (!splitBox) return;

        const splitList =
          (target && target.closest(".match-split-list")) ||
          splitBox.querySelector(".match-split-list");
        if (!splitList) {
          e.preventDefault();
          return;
        }

        const linePx = 18;
        const pagePx = splitList.clientHeight || 240;
        const dy =
          e.deltaMode === 1 ? e.deltaY * linePx : e.deltaMode === 2 ? e.deltaY * pagePx : e.deltaY;
        if (!dy) return;

        const maxScroll = splitList.scrollHeight - splitList.clientHeight;
        if (maxScroll <= 1) {
          e.preventDefault();
          return;
        }

        if (!target.closest(".match-split-list")) {
          splitList.scrollTop = Math.max(0, Math.min(maxScroll, splitList.scrollTop + dy));
          e.preventDefault();
          return;
        }

        const atTop = splitList.scrollTop <= 0;
        const atBottom = splitList.scrollTop >= maxScroll - 1;
        if ((dy < 0 && atTop) || (dy > 0 && atBottom)) {
          e.preventDefault();
        }
      },
      { passive: false }
    );
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
