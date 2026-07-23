(function () {
  "use strict";

  const data = window.MATCHPULSE_DATA;
  const demoMatches = data.matches.slice();
  const SPORT_SCORE_URL = "https://sportscore.com/api/widget/matches/?sport=cricket&limit=12&src=matchpulse";
  const REFRESH_INTERVAL = 60000;
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
    mode: storedPreferences.mode === "expert" ? "expert" : "simple",
    newsFilter: storedPreferences.newsFilter || "All",
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
      selectedId: state.selectedId,
      mode: state.mode,
      newsFilter: state.newsFilter
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
        { name: match.home, short: shortTeamName(match.home), score: homeScore, overs: "" },
        { name: match.away, short: shortTeamName(match.away), score: awayScore, overs: "" }
      ],
      state: statusText,
      cardSummary: statusText,
      followTeam: match.home,
      pulse: 50,
      pulseCopy: "Score and match status are available. A confidence index needs ball-by-ball data, which this feed does not currently provide.",
      momentumTitle: "Momentum data is not available for this match",
      momentum: Array(12).fill(0),
      momentumLabels: Array.from({ length: 12 }, (_, itemIndex) => String(itemIndex + 1)),
      insights: {
        simple: {
          caption: "SportScore currently supplies the score and match status, but not the ball-level events needed to calculate honest momentum.",
          title: "Waiting for ball-by-ball context",
          copy: "MatchPulse will not infer a turning point from the total alone. Scores continue to update while deeper analysis remains unavailable.",
          stats: [["Feed status", sourceStatus], ["Data depth", "Score only"]]
        },
        expert: {
          caption: "Control percentage, rolling expected runs, false-shot rate, and win probability cannot be calculated from aggregate scores alone.",
          title: "No analytical event stream is present",
          copy: "An expert model requires delivery-level timestamps and outcomes. Until those fields are available, MatchPulse deliberately avoids synthetic metrics.",
          stats: [["Provider", "SportScore"], ["Refresh", "60 seconds"]]
        }
      },
      turningOver: "Data availability",
      catchUp: [
        ["Score", `${match.home} ${homeScore}; ${match.away} ${awayScore}.`],
        ["Status", statusText],
        ["Context", "Ball-by-ball analysis is unavailable from the current SportScore response."]
      ],
      timeline: [
        ["Feed", sourceStatus, sourceMessage],
        ["Start", readableTime(match.time), match.competition || "Cricket fixture"],
        ["Analysis", "Awaiting events", "Momentum and turning points need ball-level match data."]
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
          ${match.teams.map((team) => `<span class="card-team"><span>${escapeHtml(team.short)}</span><span class="card-score">${escapeHtml(team.score)}</span></span>`).join("")}
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
        <span class="team-name">${escapeHtml(team.name)}</span>
        <span class="team-score">${escapeHtml(team.score)} ${team.overs ? `<small>${escapeHtml(team.overs)}</small>` : ""}</span>
      </div>`).join("");
    el("match-state").textContent = match.state;
    el("score-source-note").innerHTML = match.source === "sportscore"
      ? `${escapeHtml(match.sourceMessage)} <a href="${escapeHtml(match.sourceUrl)}" rel="dofollow">View on SportScore</a>.`
      : "Scores shown are demonstration data, not live scores.";
    el("pulse-value").textContent = match.pulse;
    el("pulse-copy").textContent = match.pulseCopy;
  }

  function renderInsights(match) {
    const insight = match.insights[state.mode];
    el("momentum-title").textContent = match.momentumTitle;
    el("momentum-chart").setAttribute("aria-label", `${match.momentumTitle}. ${insight.caption}`);
    el("momentum-chart").innerHTML = match.momentum.map((value, index) => `
      <span class="momentum-bar" aria-hidden="true">
        <span class="momentum-fill ${value > 0 ? "positive" : value < 0 ? "negative" : "neutral"}" style="--height: ${value === 0 ? 0 : Math.max(8, Math.abs(value))}%;"></span>
        <span class="momentum-label">${escapeHtml(match.momentumLabels[index])}</span>
      </span>`).join("");
    el("momentum-caption").textContent = insight.caption;
    el("turning-over").textContent = match.turningOver;
    el("turning-title").textContent = insight.title;
    el("turning-copy").textContent = insight.copy;
    el("impact-stats").innerHTML = insight.stats.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join("");
  }

  function renderTimeline(match) {
    el("timeline").innerHTML = match.timeline.map(([over, title, copy]) => `
      <li class="timeline-item"><span class="timeline-over">${escapeHtml(over)}</span><h3>${escapeHtml(title)}</h3><p>${escapeHtml(copy)}</p></li>`).join("");
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
    if (state.newsFilter === "Following") renderNews();
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
    renderInsights(match);
    renderTimeline(match);
    renderCatchUp(match);
    renderFollowButton(match);
    renderMyCricket();
  }

  function renderNewsFilters() {
    const categories = ["All", ...new Set(data.news.map((story) => story.category)), "Following"];
    if (!categories.includes(state.newsFilter)) state.newsFilter = "All";
    el("news-filters").innerHTML = categories.map((category) => `
      <button type="button" data-news-filter="${category}" aria-pressed="${category === state.newsFilter}">${category}</button>`).join("");
  }

  function renderNews() {
    const followed = getFollowedTeams();
    const stories = data.news.filter((story) => {
      if (state.newsFilter === "All") return true;
      if (state.newsFilter === "Following") return followed.includes(story.team);
      return story.category === state.newsFilter;
    });
    el("news-grid").innerHTML = stories.length ? stories.map((story) => `
      <article class="news-card">
        <div class="news-meta"><span class="team-tag">${escapeHtml(story.category)} / ${escapeHtml(story.team)}</span><span>${escapeHtml(story.time)}</span></div>
        <h3>${escapeHtml(story.title)}</h3><p>${escapeHtml(story.excerpt)}</p>
      </article>`).join("") : `<p class="empty-state">Follow a team from a match to see its stories here.</p>`;
  }

  function renderDataStatus(message) {
    el("data-status").textContent = message;
    el("header-data-label").textContent = state.scoreSource === "sportscore"
      ? "SportScore data"
      : state.scoreSource === "stale" ? "SportScore cached" : "Demonstration fallback";
  }

  async function loadSportScoreMatches(options = {}) {
    const refreshButton = el("refresh-scores");
    refreshButton.disabled = true;
    refreshButton.textContent = "Refreshing...";
    if (!options.silent) el("data-status").textContent = "Loading SportScore cricket data...";

    try {
      const response = await fetch(SPORT_SCORE_URL, { headers: { Accept: "application/json" } });
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
      ].slice(0, 6);
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

  document.querySelector(".mode-switch").addEventListener("click", (event) => {
    const button = event.target.closest("[data-mode]");
    if (!button) return;
    state.mode = button.dataset.mode;
    savePreferences();
    document.querySelectorAll("[data-mode]").forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
    renderInsights(selectedMatch());
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

  el("news-filters").addEventListener("click", (event) => {
    const button = event.target.closest("[data-news-filter]");
    if (!button) return;
    state.newsFilter = button.dataset.newsFilter;
    savePreferences();
    renderNewsFilters();
    renderNews();
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

  document.querySelectorAll("[data-mode]").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.mode === state.mode));
  });
  const storedAlerts = readStoredJson(STORAGE_KEYS.alerts, false);
  el("alerts-toggle").checked = Boolean(storedAlerts && "Notification" in window && Notification.permission === "granted");
  renderSelectedMatch();
  renderNewsFilters();
  renderNews();
  loadSportScoreMatches();
  window.setInterval(() => loadSportScoreMatches({ silent: true }), REFRESH_INTERVAL);
}());
