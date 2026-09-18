// ------------------------------
// Navigation configuration
// ------------------------------

const pageTitles = {
  home: "Home",
  worklog: "Work Log",
  summary: "Daily Summary",
  stats: "Stats",
  settings: "Settings"
};

// ------------------------------
// Application state
// ------------------------------

let currentSession = null;
let completedSessions = [];
let timerInterval = null;

// ------------------------------
// HTML elements
// ------------------------------

const pageTitle = document.querySelector("#page-title");

const navigationButtons = document.querySelectorAll(
  "[data-view]"
);

const bottomNavigationButtons = document.querySelectorAll(
  ".navigation-button"
);

const views = document.querySelectorAll(".view");

const clockButton = document.querySelector("#clock-button");
const workStatus = document.querySelector("#work-status");
const sessionTime = document.querySelector("#session-time");

const worklogEmptyState = document.querySelector(
  "#worklog-empty-state"
);

const worklogContainer = document.querySelector(
  "#worklog-container"
);

const worklogBody = document.querySelector(
  "#worklog-body"
);

// ------------------------------
// Navigation
// ------------------------------

function openView(viewName) {
  const selectedView = document.querySelector(
    `#${viewName}-view`
  );

  if (!selectedView) {
    console.error(`View "${viewName}" was not found.`);
    return;
  }

  views.forEach((view) => {
    view.hidden = true;
    view.classList.remove("active-view");
  });

  selectedView.hidden = false;
  selectedView.classList.add("active-view");

  pageTitle.textContent = pageTitles[viewName];

  bottomNavigationButtons.forEach((button) => {
    const isSelected =
      button.dataset.view === viewName;

    button.classList.toggle(
      "active-navigation",
      isSelected
    );

    if (isSelected) {
      button.setAttribute("aria-current", "page");
    } else {
      button.removeAttribute("aria-current");
    }
  });
}

// ------------------------------
// Clock In and Clock Out
// ------------------------------

function handleClockButton() {
  if (currentSession) {
    clockOut();
  } else {
    clockIn();
  }
}

function clockIn() {
  const now = new Date();

  currentSession = {
    id: crypto.randomUUID(),
    clockIn: now.toISOString(),
    clockOut: null,
    notes: ""
  };

  workStatus.textContent = "Working";
  clockButton.textContent = "Clock Out";
  clockButton.classList.add("clock-out-button");

  updateTimer();

  timerInterval = window.setInterval(
    updateTimer,
    1000
  );

  console.log("Session started:", currentSession);
}

function clockOut() {
  if (!currentSession) {
    return;
  }

  const now = new Date();

  currentSession.clockOut = now.toISOString();

  completedSessions.push(currentSession);

  currentSession = null;

  window.clearInterval(timerInterval);
  timerInterval = null;

  workStatus.textContent = "Not working";
  sessionTime.textContent = "00:00:00";
  clockButton.textContent = "Clock In";
  clockButton.classList.remove("clock-out-button");

  renderWorkLog();

  console.log("Session completed.");
}

// ------------------------------
// Timer
// ------------------------------

function updateTimer() {
  if (!currentSession) {
    sessionTime.textContent = "00:00:00";
    return;
  }

  const clockInTime = new Date(
    currentSession.clockIn
  );

  const currentTime = new Date();

  const elapsedMilliseconds =
    currentTime - clockInTime;

  sessionTime.textContent = formatDuration(
    elapsedMilliseconds
  );
}

function formatDuration(milliseconds) {
  const totalSeconds = Math.floor(
    milliseconds / 1000
  );

  const hours = Math.floor(
    totalSeconds / 3600
  );

  const minutes = Math.floor(
    (totalSeconds % 3600) / 60
  );

  const seconds = totalSeconds % 60;

  return [
    hours,
    minutes,
    seconds
  ]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
}

// ------------------------------
// Dates and times
// ------------------------------

function formatDate(isoDate) {
  return new Intl.DateTimeFormat(
    "en-GB",
    {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    }
  ).format(new Date(isoDate));
}

function formatTime(isoDate) {
  return new Intl.DateTimeFormat(
    "en-GB",
    {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    }
  ).format(new Date(isoDate));
}

// ------------------------------
// Work Log
// ------------------------------

function renderWorkLog() {
  const orderedSessions = [...completedSessions]
    .sort((sessionA, sessionB) => {
      const timeA = new Date(sessionA.clockIn);
      const timeB = new Date(sessionB.clockIn);

      return timeB - timeA;
    });

  worklogBody.replaceChildren();

  if (orderedSessions.length === 0) {
    worklogEmptyState.hidden = false;
    worklogContainer.hidden = true;
    return;
  }

  worklogEmptyState.hidden = true;
  worklogContainer.hidden = false;

  orderedSessions.forEach((session) => {
    const clockInDate = new Date(session.clockIn);
    const clockOutDate = new Date(session.clockOut);

    const duration =
      clockOutDate - clockInDate;

    const row = document.createElement("tr");

    const dateCell = document.createElement("td");
    const clockInCell = document.createElement("td");
    const clockOutCell = document.createElement("td");
    const durationCell = document.createElement("td");

    dateCell.textContent = formatDate(
      session.clockIn
    );

    clockInCell.textContent = formatTime(
      session.clockIn
    );

    clockOutCell.textContent = formatTime(
      session.clockOut
    );

    durationCell.textContent = formatDuration(
      duration
    );

    row.append(
      dateCell,
      clockInCell,
      clockOutCell,
      durationCell
    );

    worklogBody.append(row);
  });
}

// ------------------------------
// Events
// ------------------------------

navigationButtons.forEach((button) => {
  button.addEventListener("click", () => {
    openView(button.dataset.view);
  });
});

clockButton.addEventListener(
  "click",
  handleClockButton
);

// ------------------------------
// Application startup
// ------------------------------

openView("home");
renderWorkLog();

console.log("Work Tracker loaded successfully.");