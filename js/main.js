(function () {
  "use strict";

  const data = window.MATCHPULSE_DATA;
  const state = { selectedId: data.matches[0].id, mode: "simple", newsFilter: "All" };
  const el = (id) => document.getElementById(id);
  const selectedMatch = () => data.matches.find((match) => match.id === state.selectedId);

  function getFollowedTeams() {
    try { return JSON.parse(localStorage.getItem("matchpulse-followed-teams")) || []; }
    catch (_) { return []; }
  }

  function setFollowedTeams(teams) {
    localStorage.setItem("matchpulse-followed-teams", JSON.stringify(teams));
  }

  function renderMatchCards() {
    el("match-list").innerHTML = data.matches.map((match) => `
      <button class="match-card" type="button" role="listitem" data-match-id="${match.id}" aria-current="${match.id === state.selectedId}">
        <span class="card-top">
          <span class="mini-status ${match.status}">${match.statusLabel}</span>
          <span class="card-series">${match.series}</span>
        </span>
        <span class="card-teams">
          ${match.teams.map((team) => `<span class="card-team"><span>${team.short}</span><span class="card-score">${team.score}</span></span>`).join("")}
        </span>
        <span class="card-result">${match.cardSummary}</span>
      </button>`).join("");
  }

  function renderScoreboard(match) {
    el("featured-status").className = `status-pill ${match.status}`;
    el("featured-status").textContent = match.statusLabel;
    el("featured-series").textContent = match.series;
    el("featured-venue").textContent = match.venue;
    el("scoreboard").innerHTML = match.teams.map((team) => `
      <div class="score-team">
        <span class="team-name">${team.name}</span>
        <span class="team-score">${team.score} ${team.overs ? `<small>${team.overs}</small>` : ""}</span>
      </div>`).join("");
    el("match-state").textContent = match.state;
    el("pulse-value").textContent = match.pulse;
    el("pulse-copy").textContent = match.pulseCopy;
  }

  function renderInsights(match) {
    const insight = match.insights[state.mode];
    el("momentum-title").textContent = match.momentumTitle;
    el("momentum-chart").setAttribute("aria-label", `${match.momentumTitle}. ${insight.caption}`);
    el("momentum-chart").innerHTML = match.momentum.map((value, index) => `
      <span class="momentum-bar" aria-hidden="true">
        <span class="momentum-fill ${value >= 0 ? "positive" : "negative"}" style="--height: ${Math.max(8, Math.abs(value))}%;"></span>
        <span class="momentum-label">${match.momentumLabels[index]}</span>
      </span>`).join("");
    el("momentum-caption").textContent = insight.caption;
    el("turning-over").textContent = match.turningOver;
    el("turning-title").textContent = insight.title;
    el("turning-copy").textContent = insight.copy;
    el("impact-stats").innerHTML = insight.stats.map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`).join("");
  }

  function renderTimeline(match) {
    el("timeline").innerHTML = match.timeline.map(([over, title, copy]) => `
      <li class="timeline-item"><span class="timeline-over">${over}</span><h3>${title}</h3><p>${copy}</p></li>`).join("");
  }

  function renderCatchUp(match) {
    el("catch-up-copy").innerHTML = match.catchUp.map(([label, copy]) => `<p><strong>${label}:</strong> ${copy}</p>`).join("");
  }

  function renderFollowButton(match) {
    const followed = getFollowedTeams().includes(match.followTeam);
    const button = el("follow-button");
    button.setAttribute("aria-pressed", String(followed));
    button.textContent = followed ? `Following ${match.followTeam}` : `Follow ${match.followTeam}`;
  }

  function renderSelectedMatch() {
    const match = selectedMatch();
    renderMatchCards();
    renderScoreboard(match);
    renderInsights(match);
    renderTimeline(match);
    renderCatchUp(match);
    renderFollowButton(match);
  }

  function renderNewsFilters() {
    const categories = ["All", ...new Set(data.news.map((story) => story.category)), "Following"];
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
        <div class="news-meta"><span class="team-tag">${story.category} / ${story.team}</span><span>${story.time}</span></div>
        <h3>${story.title}</h3><p>${story.excerpt}</p>
      </article>`).join("") : `<p class="empty-state">Follow a team from a match to see its stories here.</p>`;
  }

  el("match-list").addEventListener("click", (event) => {
    const card = event.target.closest("[data-match-id]");
    if (!card) return;
    state.selectedId = card.dataset.matchId;
    el("catch-up-panel").hidden = true;
    el("catch-up-button").setAttribute("aria-expanded", "false");
    renderSelectedMatch();
  });

  document.querySelector(".mode-switch").addEventListener("click", (event) => {
    const button = event.target.closest("[data-mode]");
    if (!button) return;
    state.mode = button.dataset.mode;
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
    const team = selectedMatch().followTeam;
    const followed = getFollowedTeams();
    const updated = followed.includes(team) ? followed.filter((item) => item !== team) : [...followed, team];
    setFollowedTeams(updated);
    renderFollowButton(selectedMatch());
    if (state.newsFilter === "Following") renderNews();
  });

  el("news-filters").addEventListener("click", (event) => {
    const button = event.target.closest("[data-news-filter]");
    if (!button) return;
    state.newsFilter = button.dataset.newsFilter;
    renderNewsFilters();
    renderNews();
  });

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

  renderSelectedMatch();
  renderNewsFilters();
  renderNews();
}());
