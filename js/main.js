(function () {
  "use strict";

  const data = window.MATCHPULSE_DATA;
  const demoMatches = data.matches.slice();
  const SPORT_SCORE_URL = "https://sportscore.com/api/widget/matches/?sport=cricket&limit=12&src=matchpulse";
  const REFRESH_INTERVAL = 60000;
  const REQUEST_TIMEOUT = 6000;
  const STORAGE_KEYS = {
    follows: "matchpulse-followed-teams",
    preferences: "matchpulse-preferences",
    snapshots: "matchpulse-score-snapshots",
    alerts: "matchpulse-alerts"
  };
  const storedPreferences = readStoredJson(STORAGE_KEYS.preferences, {});
  const previousVisitSnapshots = readStoredJson(STORAGE_KEYS.snapshots, {});
  let lastFeedSnapshots = {};
  const state = {
    selectedId: data.matches.some((match) => match.id === storedPreferences.selectedId)
      ? storedPreferences.selectedId : data.matches[0].id,
    scoreSource: "demo",
    lastUpdated: null
  };
  const el = (id) => document.getElementById(id);
  const selectedMatch = () => data.matches.find((match) => match.id === state.selectedId);
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;"
  })[character]);

  function readStoredJson(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return value ?? fallback;
    } catch (_) {
      return fallback;
    }
  }

  function writeStoredJson(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); }
    catch (_) { /* Personalisation remains optional when storage is unavailable. */ }
  }

  function savePreferences() {
    writeStoredJson(STORAGE_KEYS.preferences, {
      selectedId: state.selectedId
    });
  }

  function shortTeamName(name) {
    const initials = name.split(/\s+/).filter(Boolean).map((word) => word[0]).join("");
    return initials.length >= 2 && initials.length <= 4 ? initials.toUpperCase() : name.slice(0, 3).toUpperCase();
  }

  function matchSlug(path, index) {
    const parts = String(path || "").split("/").filter(Boolean);
    return (parts[parts.length - 1] || `sportscore-match-${index}`).replace(/[^a-z0-9-]/gi, "-");
  }

  function readableTime(value) {
    if (!value) return "Time unavailable";
    return new Intl.DateTimeFormat(undefined, {
      weekday: "short",
      hour: "numeric",
      minute: "2-digit"
    }).format(new Date(value));
  }

  function sportScoreMatchUrl(path) {
    try {
      const url = new URL(path, "https://sportscore.com/");
      return url.origin === "https://sportscore.com" ? url.href : "https://sportscore.com/";
    } catch (_) {
      return "https://sportscore.com/";
    }
  }

  function safeImageUrl(value) {
    try {
      const url = new URL(value);
      return url.protocol === "https:" ? url.href : "";
    } catch (_) {
      return "";
    }
  }

  function mapSportScoreMatch(match, index, updated) {
    const status = match.status === "finished"
      ? "complete"
      : ["live", "inprogress", "in_progress"].includes(match.status) ? "live" : "upcoming";
    const sourceStatus = status === "live"
      ? "Live - SportScore"
      : status === "complete" ? "Completed" : "Upcoming";
    const homeScore = match.home_score || "Yet to bat";
    const awayScore = match.away_score || "Yet to bat";
    const statusText = match.status_text && match.status_text !== "Abnormal"
      ? match.status_text
      : status === "upcoming" ? `Starts ${readableTime(match.time)}` : sourceStatus;
    const sourceMessage = `Score data from SportScore. Feed updated ${readableTime(updated)}.`;

    return {
      id: `sportscore-${matchSlug(match.url, index)}`,
      source: "sportscore",
      sourceUrl: sportScoreMatchUrl(match.url),
      status,
      statusLabel: sourceStatus,
      series: match.competition || "Cricket",
      venue: "SportScore cricket feed",
      teams: [
        { name: match.home, short: shortTeamName(match.home), score: homeScore, overs: "", logo: safeImageUrl(match.home_logo) },
        { name: match.away, short: shortTeamName(match.away), score: awayScore, overs: "", logo: safeImageUrl(match.away_logo) }
      ],
      state: statusText,
      cardSummary: statusText,
      followTeam: match.home,
      catchUp: [
        ["Score", `${match.home} ${homeScore}; ${match.away} ${awayScore}.`],
        ["Status", statusText]
      ],
      sourceMessage
    };
  }

  function getFollowedTeams() {
    return readStoredJson(STORAGE_KEYS.follows, []);
  }

  function setFollowedTeams(teams) {
    writeStoredJson(STORAGE_KEYS.follows, teams);
  }

  function matchSnapshot(match) {
    return {
      status: match.status,
      updatedAt: state.lastUpdated || new Date().toISOString(),
      teams: match.teams.map((team) => ({ name: team.name, score: team.score }))
    };
  }

  function parseCricketScore(value) {
    const match = String(value || "").match(/^(\d+)(?:\/(\d+))?/);
    return match ? { runs: Number(match[1]), wickets: Number(match[2] || 0) } : null;
  }

  function scoreChangeSummary(previous, current) {
    if (!previous) return "This is the first score saved for this match.";
    if (previous.status === "upcoming" && current.status === "live") return "The match has started since your last visit.";
    if (previous.status !== "complete" && current.status === "complete") return "The match reached its final result since your last visit.";

    const changes = current.teams.flatMap((team) => {
      const oldTeam = previous.teams?.find((item) => item.name === team.name);
      const oldScore = parseCricketScore(oldTeam?.score);
      const newScore = parseCricketScore(team.score);
      if (!oldScore || !newScore) return [];
      const runs = newScore.runs - oldScore.runs;
      const wickets = newScore.wickets - oldScore.wickets;
      if (runs <= 0 && wickets <= 0) return [];
      const parts = [];
      if (runs > 0) parts.push(`added ${runs} run${runs === 1 ? "" : "s"}`);
      if (wickets > 0) parts.push(`lost ${wickets} wicket${wickets === 1 ? "" : "s"}`);
      return [`${team.name} ${parts.join(" and ")}.`];
    });

    return changes.length ? changes.join(" ") : "No score change since your last visit.";
  }

  function sendMatchAlert(match, summary) {
    const alertsEnabled = readStoredJson(STORAGE_KEYS.alerts, false);
    if (!alertsEnabled || !document.hidden || !("Notification" in window) || Notification.permission !== "granted") return;
    if (/No score change|first score/i.test(summary)) return;
    new Notification(`${match.teams[0].short} v ${match.teams[1].short}`, {
      body: summary,
      tag: `matchpulse-${match.id}`
    });
  }

  function attachScoreHistory(matches) {
    const savedSnapshots = readStoredJson(STORAGE_KEYS.snapshots, {});
    const currentSnapshots = {};
    matches.forEach((match) => {
      const snapshot = matchSnapshot(match);
      match.sinceYouLeft = scoreChangeSummary(previousVisitSnapshots[match.id], snapshot);
      if (lastFeedSnapshots[match.id]) {
        sendMatchAlert(match, scoreChangeSummary(lastFeedSnapshots[match.id], snapshot));
      }
      currentSnapshots[match.id] = snapshot;
    });
    lastFeedSnapshots = currentSnapshots;
    writeStoredJson(STORAGE_KEYS.snapshots, { ...savedSnapshots, ...currentSnapshots });
  }

  function renderMatchCards() {
    el("match-list").innerHTML = data.matches.map((match) => `
      <button class="match-card" type="button" role="listitem" data-match-id="${match.id}" aria-current="${match.id === state.selectedId}">
        <span class="card-top">
          <span class="mini-status ${match.status}">${escapeHtml(match.statusLabel)}</span>
          <span class="card-series">${escapeHtml(match.series)}</span>
        </span>
        <span class="card-teams">
          ${match.teams.map((team) => `<span class="card-team">
            <span class="card-team-name">
              <span class="team-mark">${team.logo ? `<img src="${escapeHtml(team.logo)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : escapeHtml(team.short.slice(0, 2))}</span>
              <span>${escapeHtml(team.short)}</span>
            </span>
            <span class="card-score">${escapeHtml(team.score)}</span>
          </span>`).join("")}
        </span>
        <span class="card-result">${escapeHtml(match.cardSummary)}</span>
      </button>`).join("");
  }

  function renderScoreboard(match) {
    el("featured-status").className = `status-pill ${match.status}`;
    el("featured-status").textContent = match.statusLabel;
    el("featured-series").textContent = match.series;
    el("featured-venue").textContent = match.venue;
    el("scoreboard").innerHTML = match.teams.map((team) => `
      <div class="score-team">
        <span class="team-identity">
          <span class="score-team-mark">${team.logo ? `<img src="${escapeHtml(team.logo)}" alt="" referrerpolicy="no-referrer">` : escapeHtml(team.short.slice(0, 2))}</span>
          <span class="team-name">${escapeHtml(team.name)}</span>
        </span>
        <span class="team-score">${escapeHtml(team.score)} ${team.overs ? `<small>${escapeHtml(team.overs)}</small>` : ""}</span>
      </div>`).join("");
    el("match-state").textContent = match.state;
    el("score-source-note").innerHTML = match.source === "sportscore"
      ? `${escapeHtml(match.sourceMessage)} <a href="${escapeHtml(match.sourceUrl)}" rel="dofollow">View on SportScore</a>.`
      : "Scores shown are demonstration data, not live scores.";
  }

  function renderCatchUp(match) {
    el("catch-up-copy").innerHTML = match.catchUp.map(([label, copy]) => `<p><strong>${escapeHtml(label)}:</strong> ${escapeHtml(copy)}</p>`).join("");
  }

  function renderFollowButton(match) {
    const followed = getFollowedTeams().includes(match.followTeam);
    const button = el("follow-button");
    button.setAttribute("aria-pressed", String(followed));
    button.textContent = followed ? `Following ${match.followTeam}` : `Follow ${match.followTeam}`;
  }

  function toggleTeamFollow(team) {
    const followed = getFollowedTeams();
    const updated = followed.includes(team)
      ? followed.filter((item) => item !== team)
      : [...followed, team];
    setFollowedTeams(updated);
    renderFollowButton(selectedMatch());
    renderMyCricket();
  }

  function renderMyCricket() {
    const followed = getFollowedTeams();
    const followedContainer = el("followed-teams");
    const briefing = el("personal-briefing");
    const current = selectedMatch();
    const followedMatches = data.matches.filter((match) =>
      match.teams.some((team) => followed.includes(team.name))
    );

    followedContainer.innerHTML = followed.length
      ? followed.map((team) => `
        <button class="team-follow-chip" type="button" data-unfollow-team="${escapeHtml(team)}" aria-label="Unfollow ${escapeHtml(team)}">
          ${escapeHtml(team)} <span aria-hidden="true">x</span>
        </button>`).join("")
      : "";

    if (followedMatches.length) {
      briefing.innerHTML = followedMatches.slice(0, 4).map((match) => `
        <button class="briefing-match" type="button" data-personal-match="${match.id}">
          <strong>${escapeHtml(match.teams[0].name)} v ${escapeHtml(match.teams[1].name)}</strong>
          <span>${escapeHtml(match.cardSummary)}</span>
          <span class="briefing-score">${escapeHtml(match.teams.map((team) => team.score).join(" / "))}</span>
        </button>`).join("");
    } else {
      const availableTeams = [...new Set(data.matches.flatMap((match) => match.teams.map((team) => team.name)))].slice(0, 4);
      briefing.innerHTML = `
        <p class="personal-empty">No teams followed yet.</p>
        <div class="quick-follow-list">
          ${availableTeams.map((team) => `<button class="quick-follow-button" type="button" data-quick-follow="${escapeHtml(team)}">Follow ${escapeHtml(team)}</button>`).join("")}
        </div>`;
    }

    el("since-you-left").innerHTML = current
      ? `<p class="since-match">${escapeHtml(current.teams[0].name)} v ${escapeHtml(current.teams[1].name)}</p>
         <p class="since-copy">${escapeHtml(current.sinceYouLeft || "Score tracking will begin with the next SportScore update.")}</p>`
      : `<p class="since-copy">No match selected.</p>`;
  }

  function renderSelectedMatch() {
    const match = selectedMatch();
    if (!match) return;
    renderMatchCards();
    renderScoreboard(match);
    renderCatchUp(match);
    renderFollowButton(match);
    renderMyCricket();
  }

  function renderDataStatus(message) {
    el("data-status").textContent = message;
    el("header-data-label").textContent = state.scoreSource === "sportscore"
      ? "SportScore data"
      : state.scoreSource === "stale" ? "SportScore cached" : "Demonstration fallback";
  }

  async function loadSportScoreMatches(options = {}) {
    const refreshButton = el("refresh-scores");
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
    refreshButton.disabled = true;
    refreshButton.textContent = "Refreshing...";
    if (!options.silent) el("data-status").textContent = "Loading SportScore cricket data...";

    try {
      const response = await fetch(SPORT_SCORE_URL, {
        headers: { Accept: "application/json" },
        signal: controller.signal
      });
      if (!response.ok) throw new Error(`SportScore returned ${response.status}`);
      const payload = await response.json();
      if (!Array.isArray(payload.matches) || payload.matches.length === 0) {
        throw new Error("SportScore returned no cricket matches");
      }

      const previousId = state.selectedId;
      const prioritisedMatches = [
        ...payload.matches.filter((match) => ["live", "inprogress", "in_progress"].includes(match.status)),
        ...payload.matches.filter((match) => match.status === "upcoming"),
        ...payload.matches.filter((match) => match.status === "finished")
      ].slice(0, 4);
      data.matches = prioritisedMatches.map((match, index) => mapSportScoreMatch(match, index, payload.updated));
      state.scoreSource = "sportscore";
      state.lastUpdated = payload.updated || new Date().toISOString();
      attachScoreHistory(data.matches);
      const preferredId = storedPreferences.selectedId;
      state.selectedId = data.matches.some((match) => match.id === preferredId)
        ? preferredId
        : data.matches.some((match) => match.id === previousId) ? previousId
        : (data.matches.find((match) => match.status === "live") || data.matches.find((match) => match.status === "upcoming") || data.matches[0]).id;
      renderSelectedMatch();
      renderDataStatus(`SportScore cricket feed - updated ${readableTime(state.lastUpdated)}.`);
    } catch (error) {
      const hasSportScoreData = data.matches.some((match) => match.source === "sportscore");
      if (hasSportScoreData) {
        state.scoreSource = "stale";
        renderDataStatus(`Unable to refresh SportScore. Showing the last update from ${readableTime(state.lastUpdated)}.`);
      } else {
        data.matches = demoMatches.slice();
        state.scoreSource = "demo";
        renderDataStatus("SportScore is unavailable. Showing clearly labelled demonstration fallback data.");
      }
      console.warn("MatchPulse data fallback:", error.message);
    } finally {
      window.clearTimeout(timeout);
      refreshButton.disabled = false;
      refreshButton.textContent = "Refresh scores";
    }
  }

  function selectMatch(matchId) {
    if (!data.matches.some((match) => match.id === matchId)) return;
    state.selectedId = matchId;
    savePreferences();
    el("catch-up-panel").hidden = true;
    el("catch-up-button").setAttribute("aria-expanded", "false");
    renderSelectedMatch();
  }

  async function shareCatchUp() {
    const match = selectedMatch();
    const shareStatus = el("share-status");
    const text = `${match.teams[0].name} ${match.teams[0].score} - ${match.teams[1].name} ${match.teams[1].score}. ${match.state} ${match.catchUp.map(([label, copy]) => `${label}: ${copy}`).join(" ")}`;
    const shareData = {
      title: `${match.teams[0].name} v ${match.teams[1].name} | MatchPulse`,
      text,
      url: `${location.origin}${location.pathname}#matches`
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        shareStatus.textContent = "Shared";
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(`${shareData.title}\n${text}\n${shareData.url}`);
        shareStatus.textContent = "Summary copied";
      } else {
        const field = document.createElement("textarea");
        field.value = `${shareData.title}\n${text}\n${shareData.url}`;
        field.setAttribute("readonly", "");
        field.style.position = "fixed";
        field.style.opacity = "0";
        document.body.appendChild(field);
        field.select();
        document.execCommand("copy");
        field.remove();
        shareStatus.textContent = "Summary copied";
      }
    } catch (error) {
      if (error.name !== "AbortError") shareStatus.textContent = "Sharing unavailable";
    }
  }

  async function updateAlertPreference(enabled) {
    const toggle = el("alerts-toggle");
    const status = el("alert-status");
    if (!enabled) {
      writeStoredJson(STORAGE_KEYS.alerts, false);
      status.textContent = "Match alerts off";
      return;
    }
    if (!("Notification" in window)) {
      toggle.checked = false;
      status.textContent = "Notifications are not supported in this browser";
      return;
    }
    const permission = Notification.permission === "default"
      ? await Notification.requestPermission()
      : Notification.permission;
    const granted = permission === "granted";
    toggle.checked = granted;
    writeStoredJson(STORAGE_KEYS.alerts, granted);
    status.textContent = granted ? "Match alerts on" : "Notification permission was not granted";
  }

  el("match-list").addEventListener("click", (event) => {
    const card = event.target.closest("[data-match-id]");
    if (!card) return;
    selectMatch(card.dataset.matchId);
  });

  el("catch-up-button").addEventListener("click", () => {
    const panel = el("catch-up-panel");
    panel.hidden = !panel.hidden;
    el("catch-up-button").setAttribute("aria-expanded", String(!panel.hidden));
    if (!panel.hidden) el("catch-up-title").focus?.();
  });

  el("close-catch-up").addEventListener("click", () => {
    el("catch-up-panel").hidden = true;
    el("catch-up-button").setAttribute("aria-expanded", "false");
    el("catch-up-button").focus();
  });

  el("follow-button").addEventListener("click", () => {
    toggleTeamFollow(selectedMatch().followTeam);
  });

  el("my-cricket").addEventListener("click", (event) => {
    const unfollowButton = event.target.closest("[data-unfollow-team]");
    const quickFollowButton = event.target.closest("[data-quick-follow]");
    const personalMatch = event.target.closest("[data-personal-match]");
    if (unfollowButton) toggleTeamFollow(unfollowButton.dataset.unfollowTeam);
    if (quickFollowButton) toggleTeamFollow(quickFollowButton.dataset.quickFollow);
    if (personalMatch) {
      selectMatch(personalMatch.dataset.personalMatch);
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      el("matches").scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
    }
  });

  el("refresh-scores").addEventListener("click", () => loadSportScoreMatches());
  el("share-catch-up").addEventListener("click", shareCatchUp);
  el("alerts-toggle").addEventListener("change", (event) => updateAlertPreference(event.target.checked));

  const menuButton = document.querySelector(".menu-button");
  menuButton.addEventListener("click", () => {
    const nav = el("mobile-nav");
    nav.hidden = !nav.hidden;
    menuButton.setAttribute("aria-expanded", String(!nav.hidden));
    menuButton.textContent = nav.hidden ? "Menu" : "Close";
  });
  el("mobile-nav").addEventListener("click", (event) => {
    if (event.target.tagName !== "A") return;
    el("mobile-nav").hidden = true;
    menuButton.setAttribute("aria-expanded", "false");
    menuButton.textContent = "Menu";
  });

  const storedAlerts = readStoredJson(STORAGE_KEYS.alerts, false);
  el("alerts-toggle").checked = Boolean(storedAlerts && "Notification" in window && Notification.permission === "granted");
  renderSelectedMatch();
  loadSportScoreMatches();
  window.setInterval(() => loadSportScoreMatches({ silent: true }), REFRESH_INTERVAL);
}());
