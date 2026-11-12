/* ==========================================================================
   Matchday Live Simulation Engine
   Drives realistic real-time progression across Football, Cricket, and F1,
   emitting live important updates into the bottom scrolling ticker.
   ========================================================================== */

(function (root) {
  "use strict";

  const Apex = (root.ApexSports = root.ApexSports || {});

  const FOOTBALL_PLAYERS = {
    ARS: ["Saka", "Odegaard", "Havertz", "Martinelli", "Rice"],
    MCI: ["Haaland", "Foden", "De Bruyne", "Savinho", "Gvardiol"],
    RMA: ["Vinicius Jr", "Bellingham", "Mbappe", "Rodrygo", "Valverde"],
    BAY: ["Kane", "Musiala", "Olise", "Sane", "Kimmich"],
    LIV: ["Salah", "Diaz", "Nunez", "Mac Allister", "Szoboszlai"],
    CHE: ["Palmer", "Jackson", "Neto", "Madueke", "Fernandez"]
  };

  function pickRandom(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  function pushTickerEvent(state, item) {
    const entry = {
      id: `tk-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      sport: item.sport,
      tag: item.tag,
      time: item.time,
      targetType: item.targetType,
      targetId: item.targetId,
      text: item.text
    };
    state.ticker.unshift(entry);
    if (state.ticker.length > 18) {
      state.ticker.length = 18;
    }
    return entry;
  }

  function advanceFootballMatch(match, state, forceGoal) {
    if (match.status !== "LIVE") return null;

    if (match.minute < 90) {
      match.minute += 1;
      match.clock = `${match.minute}'`;
      if (match.minute === 45) {
        match.status = "HT";
        match.clock = "HT";
        const note = `HT: ${match.home.name} ${match.home.score}-${match.away.score} ${match.away.name}`;
        match.latestEvent = note;
        return pushTickerEvent(state, {
          sport: "football",
          tag: "HALF TIME",
          time: "HT",
          targetType: "football",
          targetId: match.id,
          text: note
        });
      }
      if (match.minute >= 90) {
        match.status = "FT";
        match.clock = "FT";
        const note = `FT: ${match.home.name} ${match.home.score}-${match.away.score} ${match.away.name}`;
        match.latestEvent = note;
        return pushTickerEvent(state, {
          sport: "football",
          tag: "FULL TIME",
          time: "FT",
          targetType: "football",
          targetId: match.id,
          text: note
        });
      }
    }

    // Subtle live possession & xG updates
    const shift = Math.random() < 0.5 ? 1 : -1;
    const nextHomePoss = Math.max(30, Math.min(72, match.stats.possession[0] + shift));
    match.stats.possession = [nextHomePoss, 100 - nextHomePoss];

    const roll = forceGoal ? 0.01 : Math.random();
    if (roll < 0.11) {
      const isHome = Math.random() < 0.54;
      const side = isHome ? match.home : match.away;
      const pool = FOOTBALL_PLAYERS[side.abbr] || [side.abbr + " Striker"];
      const scorer = pickRandom(pool);
      side.score += 1;
      side.scorers.push(`${scorer} ${match.minute}'`);
      if (isHome) {
        match.stats.shotsOnTarget[0] += 1;
        match.stats.xg[0] = Number((match.stats.xg[0] + 0.36).toFixed(2));
      } else {
        match.stats.shotsOnTarget[1] += 1;
        match.stats.xg[1] = Number((match.stats.xg[1] + 0.36).toFixed(2));
      }
      const eventText = `GOAL! ${scorer} strikes in the ${match.minute}' — ${match.home.name} ${match.home.score}-${match.away.score} ${match.away.name}!`;
      match.latestEvent = eventText;
      match.events.push({
        minute: `${match.minute}'`,
        team: side.abbr,
        type: "GOAL",
        text: eventText
      });
      match._flashUntil = Date.now() + 1800;

      return pushTickerEvent(state, {
        sport: "football",
        tag: "GOAL",
        time: `${match.minute}'`,
        targetType: "football",
        targetId: match.id,
        text: `${match.home.name} ${match.home.score}-${match.away.score} ${match.away.name} — ${scorer} finds the net (${match.leagueName})`
      });
    }

    if (roll >= 0.11 && roll < 0.17) {
      const isHome = Math.random() < 0.5;
      const side = isHome ? match.home : match.away;
      side.yellowCards += 1;
      const player = pickRandom(FOOTBALL_PLAYERS[side.abbr] || ["Defender"]);
      const cardText = `${match.minute}' Yellow card shown to ${player} (${side.abbr}) for a late challenge`;
      match.latestEvent = cardText;
      match.events.push({
        minute: `${match.minute}'`,
        team: side.abbr,
        type: "CARD",
        text: cardText
      });
    }

    return null;
  }

  function advanceCricketMatch(match, state, forceHighlight) {
    if (!match || match.status !== "LIVE") return null;
    const battingTeam = match.team2.isBatting ? match.team2 : match.team1;
    const outcomes = forceHighlight
      ? ["6", "4", "W"]
      : ["0", "1", "1", "2", "4", "0", "1", "6", "W"];
    const ball = pickRandom(outcomes);

    battingTeam.ballsInOver = (battingTeam.ballsInOver || 0) + 1;
    if (battingTeam.ballsInOver >= 6) {
      battingTeam.totalOvers = (battingTeam.totalOvers || 0) + 1;
      battingTeam.ballsInOver = 0;
    }
    battingTeam.overs = `${battingTeam.totalOvers}.${battingTeam.ballsInOver}`;

    const striker = match.batters.find((b) => b.striker) || match.batters[0];
    const nonStriker = match.batters.find((b) => !b.striker) || match.batters[1];

    let runsAdded = 0;
    let tickerUpdate = null;

    if (ball === "W") {
      battingTeam.wickets = Math.min(10, battingTeam.wickets + 1);
      if (match.bowler) match.bowler.wickets += 1;
      if (striker) {
        const dismissedName = striker.name;
        const dismissedScore = `${striker.runs} (${striker.balls + 1})`;
        striker.name = match.format === "T20I" ? "Rinku Singh" : "Kagiso Rabada";
        striker.runs = 0;
        striker.balls = 0;
        striker.fours = 0;
        striker.sixes = 0;
        striker.sr = "0.0";
        match.lastBallNote = `${battingTeam.overs}: WICKET! ${dismissedName} departs for ${dismissedScore}!`;
        tickerUpdate = pushTickerEvent(state, {
          sport: "cricket",
          tag: "WICKET",
          time: `${battingTeam.overs} ov`,
          targetType: "cricket",
          targetId: match.id,
          text: `${battingTeam.abbr} ${battingTeam.runs}/${battingTeam.wickets} — ${dismissedName} out for ${dismissedScore} (${match.series})`
        });
      }
    } else {
      runsAdded = parseInt(ball, 10) || 0;
      battingTeam.runs += runsAdded;
      if (match.bowler) {
        match.bowler.runs += runsAdded;
      }
      if (striker) {
        striker.runs += runsAdded;
        striker.balls += 1;
        if (runsAdded === 4) striker.fours += 1;
        if (runsAdded === 6) striker.sixes += 1;
        striker.sr = striker.balls > 0 ? ((striker.runs / striker.balls) * 100).toFixed(1) : "0.0";
      }

      if (runsAdded === 6 || runsAdded === 4) {
        const shotType = runsAdded === 6 ? "MAXIMUM SIX" : "CRACKING FOUR";
        match.lastBallNote = `${battingTeam.overs}: ${striker ? striker.name : "Batter"} launches ${shotType}!`;
        if (runsAdded === 6 || forceHighlight) {
          tickerUpdate = pushTickerEvent(state, {
            sport: "cricket",
            tag: runsAdded === 6 ? "SIX!" : "FOUR!",
            time: `${battingTeam.overs} ov`,
            targetType: "cricket",
            targetId: match.id,
            text: `${battingTeam.abbr} ${battingTeam.runs}/${battingTeam.wickets} (${battingTeam.overs}) — ${striker ? striker.name : "Batter"} smashes ${runsAdded} runs!`
          });
        }
      } else {
        match.lastBallNote = `${battingTeam.overs}: ${runsAdded === 0 ? "Dot ball, tight line outside off." : `${runsAdded} run${runsAdded > 1 ? "s" : ""} rotated into the gap.`}`;
      }

      if (runsAdded % 2 === 1 && striker && nonStriker) {
        striker.striker = false;
        nonStriker.striker = true;
      }
    }

    if (battingTeam.ballsInOver === 0 && striker && nonStriker) {
      striker.striker = !striker.striker;
      nonStriker.striker = !nonStriker.striker;
    }

    match.recentBalls.push(ball);
    if (match.recentBalls.length > 8) {
      match.recentBalls.shift();
    }

    // Recompute rates & equation
    const totalBallsBowled = battingTeam.totalOvers * 6 + battingTeam.ballsInOver;
    if (totalBallsBowled > 0) {
      match.crr = ((battingTeam.runs / totalBallsBowled) * 6).toFixed(2);
    }

    if (match.format === "T20I" && match.target) {
      const remRuns = Math.max(0, match.target - battingTeam.runs);
      const remBalls = Math.max(0, 120 - totalBallsBowled);
      if (remRuns === 0) {
        match.status = "FT";
        match.clock = "FINAL";
        match.equation = `${battingTeam.name} won by ${10 - battingTeam.wickets} wickets!`;
        tickerUpdate = pushTickerEvent(state, {
          sport: "cricket",
          tag: "RESULT",
          time: "FINAL",
          targetType: "cricket",
          targetId: match.id,
          text: `${battingTeam.name} chase down ${match.target} to win with ${remBalls} balls to spare!`
        });
      } else if (remBalls === 0 || battingTeam.wickets >= 10) {
        match.status = "FT";
        match.clock = "FINAL";
        match.equation = `${match.team1.name} won by ${remRuns - 1} runs!`;
      } else {
        match.rrr = ((remRuns / remBalls) * 6).toFixed(2);
        match.equation = `${battingTeam.abbr} need ${remRuns} runs in ${remBalls} balls`;
      }
    } else if (match.format === "TEST") {
      const diff = match.team1.runs - battingTeam.runs;
      match.equation =
        diff > 0
          ? `${battingTeam.abbr} trail by ${diff} runs with ${10 - battingTeam.wickets} wickets remaining`
          : `${battingTeam.abbr} lead by ${Math.abs(diff)} runs`;
    }

    if (match.bowler) {
      const bOvers = `${Math.floor((totalBallsBowled % 24) / 6) + 2}.${battingTeam.ballsInOver}`;
      match.bowler.overs = bOvers;
      const parts = bOvers.split(".");
      const bDecimal = Number(parts[0]) + Number(parts[1]) / 6;
      if (bDecimal > 0) {
        match.bowler.econ = (match.bowler.runs / bDecimal).toFixed(2);
      }
    }

    match._flashUntil = tickerUpdate ? Date.now() + 1800 : match._flashUntil;
    return tickerUpdate;
  }

  function advanceF1(f1, state, forceHighlight) {
    if (!f1 || !Array.isArray(f1.drivers) || f1.drivers.length < 4) return null;

    if (f1.lap < f1.totalLaps && Math.random() < 0.45) {
      f1.lap += 1;
    }

    f1.drivers.forEach((d) => {
      d.tyreAge += 1;
      if (d.pos > 1 && d.gap.startsWith("+")) {
        const currentGap = parseFloat(d.gap.slice(1)) || 2.0;
        const delta = (Math.random() - 0.5) * 0.42;
        const nextGap = Math.max(0.28, currentGap + delta);
        d.gap = `+${nextGap.toFixed(3)}`;
      }
    });

    const roll = forceHighlight ? 0.05 : Math.random();
    if (roll < 0.25) {
      // Overtake between adjacent mid/top cars
      const idx = Math.floor(Math.random() * Math.min(6, f1.drivers.length - 1)) + 1;
      const challenger = f1.drivers[idx];
      const ahead = f1.drivers[idx - 1];
      if (challenger && ahead && idx > 0) {
        f1.drivers[idx - 1] = challenger;
        f1.drivers[idx] = ahead;
        challenger.pos = idx;
        ahead.pos = idx + 1;
        challenger.delta += 1;
        ahead.delta -= 1;
        if (challenger.pos === 1) {
          challenger.gap = "LEADER";
          ahead.gap = "+0.614";
        } else {
          const tempGap = challenger.gap;
          challenger.gap = ahead.gap === "LEADER" ? "+0.412" : ahead.gap;
          ahead.gap = tempGap;
        }
        const msg = `Lap ${f1.lap}: ${challenger.code} sweeps past ${ahead.code} for P${challenger.pos}!`;
        f1.raceControlNotes.unshift(msg);
        if (f1.raceControlNotes.length > 5) f1.raceControlNotes.length = 5;

        return pushTickerEvent(state, {
          sport: "f1",
          tag: "OVERTAKE",
          time: `LAP ${f1.lap}/${f1.totalLaps}`,
          targetType: "f1",
          targetId: f1.id,
          text: `${f1.grandPrix} — ${challenger.name} (${challenger.code}) takes P${challenger.pos} from ${ahead.code}!`
        });
      }
    }

    if (roll >= 0.25 && roll < 0.38) {
      // Fastest lap purple sector
      const candidate = f1.drivers[Math.floor(Math.random() * 4)];
      const baseMs = 92800 + Math.floor(Math.random() * 750);
      const mins = Math.floor(baseMs / 60000);
      const secs = ((baseMs % 60000) / 1000).toFixed(3).padStart(6, "0");
      const lapStr = `${mins}:${secs}`;
      candidate.lastLap = lapStr;
      f1.fastestLapOwner = candidate.code;
      f1.fastestLapTime = lapStr;

      const msg = `Lap ${f1.lap}: ${candidate.code} sets new Purple Fastest Lap (${lapStr})`;
      f1.raceControlNotes.unshift(msg);
      if (f1.raceControlNotes.length > 5) f1.raceControlNotes.length = 5;

      return pushTickerEvent(state, {
        sport: "f1",
        tag: "FASTEST LAP",
        time: `LAP ${f1.lap}/${f1.totalLaps}`,
        targetType: "f1",
        targetId: f1.id,
        text: `${f1.grandPrix} — ${candidate.name} clocks ${lapStr} (Purple Sector)!`
      });
    }

    // Track status occasional VSC recovery
    if (f1.trackStatus !== "GREEN" && Math.random() < 0.5) {
      f1.trackStatus = "GREEN";
    } else if (roll > 0.94) {
      f1.trackStatus = "VSC";
      return pushTickerEvent(state, {
        sport: "f1",
        tag: "VSC DEPLOYED",
        time: `LAP ${f1.lap}/${f1.totalLaps}`,
        targetType: "f1",
        targetId: f1.id,
        text: `${f1.grandPrix} — Virtual Safety Car deployed for debris clearance in Sector 2.`
      });
    }

    return null;
  }

  function stepSimulation(state, options) {
    const opts = options || {};
    const emitted = [];

    // Advance live football fixtures
    const liveMatches = state.football.filter((m) => m.status === "LIVE");
    if (liveMatches.length > 0) {
      if (opts.forceEvent === "football") {
        const note = advanceFootballMatch(liveMatches[0], state, true);
        if (note) emitted.push(note);
      } else {
        liveMatches.forEach((m) => {
          const note = advanceFootballMatch(m, state, false);
          if (note) emitted.push(note);
        });
      }
    }

    // Advance featured live cricket fixture
    const liveCricket = state.cricket.find((m) => m.status === "LIVE");
    if (liveCricket) {
      if (opts.forceEvent === "cricket" || Math.random() < 0.72) {
        const note = advanceCricketMatch(liveCricket, state, opts.forceEvent === "cricket");
        if (note) emitted.push(note);
      }
    }

    // Advance F1 timing tower
    if (opts.forceEvent === "f1" || Math.random() < 0.75) {
      const note = advanceF1(state.f1, state, opts.forceEvent === "f1");
      if (note) emitted.push(note);
    }

    return emitted;
  }

  Apex.simulator = {
    stepSimulation
  };
})(window);
