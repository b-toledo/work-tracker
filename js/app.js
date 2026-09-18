import {
  getAllSessions,
  saveSession
} from "./database.js";

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
let isProcessingClockAction = false;

// ------------------------------
// HTML elements
// ------------------------------

const pageTitle = document.querySelector(
  "#page-title"
);

const navigationButtons = document.querySelectorAll(
  "[data-view]"
);

const bottomNavigationButtons = document.querySelectorAll(
  ".navigation-button"
);

const views = document.querySelectorAll(
  ".view"
);

const clockButton = document.querySelector(
  "#clock-button"
);

const workStatus = document.querySelector(
  "#work-status"
);

const sessionTime = document.querySelector(
  "#session-time"
);

const worklogEmptyState = document.querySelector(
  "#worklog-empty-state"
);

const worklogContainer = document.querySelector(
  "#worklog-container"
);

const worklogBody = document.querySelector(
  "#worklog-body"
);

const summaryEmptyState = document.querySelector(
  "#summary-empty-state"
);

const summaryContainer = document.querySelector(
  "#summary-container"
);

const summaryBody = document.querySelector(
  "#summary-body"
);

// ------------------------------
// Navigation
// ------------------------------

function openView(viewName) {
  const selectedView = document.querySelector(
    `#${viewName}-view`
  );

  if (!selectedView) {
    console.error(
      `View "${viewName}" was not found.`
    );

    return;
  }

  views.forEach((view) => {
    view.hidden = true;

    view.classList.remove(
      "active-view"
    );
  });

  selectedView.hidden = false;

  selectedView.classList.add(
    "active-view"
  );

  pageTitle.textContent =
    pageTitles[viewName];

  bottomNavigationButtons.forEach(
    (button) => {
      const isSelected =
        button.dataset.view === viewName;

      button.classList.toggle(
        "active-navigation",
        isSelected
      );

      if (isSelected) {
        button.setAttribute(
          "aria-current",
          "page"
        );
      } else {
        button.removeAttribute(
          "aria-current"
        );
      }
    }
  );
}

// ------------------------------
// Clock button
// ------------------------------

async function handleClockButton() {
  if (isProcessingClockAction) {
    return;
  }

  isProcessingClockAction = true;
  clockButton.disabled = true;

  try {
    if (currentSession) {
      await clockOut();
    } else {
      await clockIn();
    }
  } finally {
    isProcessingClockAction = false;
    clockButton.disabled = false;
  }
}

// ------------------------------
// Clock In
// ------------------------------

async function clockIn() {
  const now = new Date();

  /*
   * Seconds are the smallest time unit displayed
   * by the application. Milliseconds are removed
   * so visible times and durations remain consistent.
   */
  now.setMilliseconds(0);

  const newSession = {
    id: crypto.randomUUID(),
    clockIn: now.toISOString(),
    clockOut: null,
    notes: "",
    createdAt: now.toISOString(),
    updatedAt: now.toISOString()
  };

  try {
    await saveSession(newSession);

    currentSession = newSession;

    updateHomeForOpenSession();

    console.log(
      "Session started:",
      currentSession
    );
  } catch (error) {
    console.error(
      "Could not save the new session:",
      error
    );

    window.alert(
      "The work session could not be started."
    );
  }
}

// ------------------------------
// Clock Out
// ------------------------------

async function clockOut() {
  if (!currentSession) {
    return;
  }

  const now = new Date();

  /*
   * Remove milliseconds so Clock In, Clock Out
   * and Duration use the same precision.
   */
  now.setMilliseconds(0);

  const completedSession = {
    ...currentSession,
    clockOut: now.toISOString(),
    updatedAt: now.toISOString()
  };

  try {
    await saveSession(completedSession);

    currentSession = null;

    stopTimer();
    updateHomeForClosedSession();

    await loadSessions();

    console.log(
      "Session completed:",
      completedSession
    );
  } catch (error) {
    console.error(
      "Could not complete the session:",
      error
    );

    window.alert(
      "The session could not be completed. " +
      "It remains open."
    );
  }
}

// ------------------------------
// Home screen state
// ------------------------------

function updateHomeForOpenSession() {
  workStatus.textContent = "Working";
  clockButton.textContent = "Clock Out";

  clockButton.classList.add(
    "clock-out-button"
  );

  startTimer();
}

function updateHomeForClosedSession() {
  workStatus.textContent = "Not working";
  sessionTime.textContent = "00:00:00";
  clockButton.textContent = "Clock In";

  clockButton.classList.remove(
    "clock-out-button"
  );
}

function restoreCurrentSession() {
  stopTimer();

  if (!currentSession) {
    updateHomeForClosedSession();
    return;
  }

  updateHomeForOpenSession();
}

// ------------------------------
// Timer
// ------------------------------

function startTimer() {
  stopTimer();
  updateTimer();

  timerInterval = window.setInterval(
    updateTimer,
    1000
  );
}

function stopTimer() {
  if (timerInterval !== null) {
    window.clearInterval(timerInterval);
    timerInterval = null;
  }
}

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

// ------------------------------
// Duration calculations
// ------------------------------

function calculateSessionDuration(session) {
  const clockInTime = new Date(
    session.clockIn
  );

  const clockOutTime = new Date(
    session.clockOut
  );

  const durationInMilliseconds =
    clockOutTime - clockInTime;

  /*
   * Each session is converted to complete seconds
   * before being displayed or included in a sum.
   *
   * This also corrects older records that contain
   * hidden milliseconds.
   */
  const durationInSeconds = Math.floor(
    durationInMilliseconds / 1000
  );

  return Math.max(
    0,
    durationInSeconds
  ) * 1000;
}

function formatDuration(milliseconds) {
  const safeMilliseconds = Math.max(
    0,
    milliseconds
  );

  const totalSeconds = Math.floor(
    safeMilliseconds / 1000
  );

  const hours = Math.floor(
    totalSeconds / 3600
  );

  const minutes = Math.floor(
    (totalSeconds % 3600) / 60
  );

  const seconds =
    totalSeconds % 60;

  return [
    hours,
    minutes,
    seconds
  ]
    .map((value) => {
      return String(value).padStart(
        2,
        "0"
      );
    })
    .join(":");
}

// ------------------------------
// Date and time formatting
// ------------------------------

function formatDate(isoDate) {
  const date = new Date(isoDate);

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    }
  ).format(date);
}

function formatTime(isoDate) {
  const date = new Date(isoDate);

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    }
  ).format(date);
}

function getLocalDateKey(isoDate) {
  const date = new Date(isoDate);

  const year = date.getFullYear();

  const month = String(
    date.getMonth() + 1
  ).padStart(2, "0");

  const day = String(
    date.getDate()
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatDateKey(dateKey) {
  const [
    year,
    month,
    day
  ] = dateKey.split("-");

  return `${day}/${month}/${year}`;
}

// ------------------------------
// Loading stored sessions
// ------------------------------

async function loadSessions() {
  try {
    const storedSessions =
      await getAllSessions();

    currentSession =
      storedSessions.find((session) => {
        return session.clockOut === null;
      }) ?? null;

    completedSessions =
      storedSessions.filter((session) => {
        return session.clockOut !== null;
      });

    renderWorkLog();
    renderDailySummary();
    restoreCurrentSession();
  } catch (error) {
    console.error(
      "Could not load saved sessions:",
      error
    );

    window.alert(
      "The saved work sessions could not be loaded."
    );
  }
}

// ------------------------------
// Work Log
// ------------------------------

function renderWorkLog() {
  const orderedSessions = [
    ...completedSessions
  ].sort((sessionA, sessionB) => {
    const timeA = new Date(
      sessionA.clockIn
    );

    const timeB = new Date(
      sessionB.clockIn
    );

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
    const row = createWorkLogRow(
      session
    );

    worklogBody.append(row);
  });
}

function createWorkLogRow(session) {
  const duration =
    calculateSessionDuration(session);

  const row = document.createElement(
    "tr"
  );

  const dateCell = document.createElement(
    "td"
  );

  const clockInCell = document.createElement(
    "td"
  );

  const clockOutCell = document.createElement(
    "td"
  );

  const durationCell = document.createElement(
    "td"
  );

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

  return row;
}

// ------------------------------
// Daily Summary
// ------------------------------

function calculateDailySummaries() {
  const summariesByDate = new Map();

  completedSessions.forEach((session) => {
    /*
     * The work session belongs to the local
     * calendar date on which Clock In occurred.
     */
    const dateKey = getLocalDateKey(
      session.clockIn
    );

    /*
     * This uses the same function as the Work Log.
     * Therefore the Summary is exactly the sum of
     * the durations displayed in the individual rows.
     */
    const duration =
      calculateSessionDuration(session);

    const existingSummary =
      summariesByDate.get(dateKey);

    if (existingSummary) {
      existingSummary.totalDuration += duration;
      existingSummary.sessionCount += 1;
    } else {
      summariesByDate.set(dateKey, {
        dateKey,
        totalDuration: duration,
        sessionCount: 1
      });
    }
  });

  return Array.from(
    summariesByDate.values()
  ).sort((summaryA, summaryB) => {
    /*
     * YYYY-MM-DD sorts chronologically.
     * B before A places the newest date first.
     */
    return summaryB.dateKey.localeCompare(
      summaryA.dateKey
    );
  });
}

function renderDailySummary() {
  const dailySummaries =
    calculateDailySummaries();

  summaryBody.replaceChildren();

  if (dailySummaries.length === 0) {
    summaryEmptyState.hidden = false;
    summaryContainer.hidden = true;

    return;
  }

  summaryEmptyState.hidden = true;
  summaryContainer.hidden = false;

  dailySummaries.forEach((summary) => {
    const row = createDailySummaryRow(
      summary
    );

    summaryBody.append(row);
  });
}

function createDailySummaryRow(summary) {
  const row = document.createElement(
    "tr"
  );

  const dateCell = document.createElement(
    "td"
  );

  const durationCell = document.createElement(
    "td"
  );

  dateCell.textContent = formatDateKey(
    summary.dateKey
  );

  durationCell.textContent = formatDuration(
    summary.totalDuration
  );

  row.append(
    dateCell,
    durationCell
  );

  return row;
}

// ------------------------------
// Events
// ------------------------------

navigationButtons.forEach((button) => {
  button.addEventListener(
    "click",
    () => {
      openView(
        button.dataset.view
      );
    }
  );
});

clockButton.addEventListener(
  "click",
  handleClockButton
);

// ------------------------------
// Application initialization
// ------------------------------

async function initializeApplication() {
  openView("home");

  await loadSessions();

  console.log(
    "Work Tracker loaded successfully."
  );
}

initializeApplication();