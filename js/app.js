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

const todayTotal = document.querySelector(
  "#today-total"
);

const weekTotal = document.querySelector(
  "#week-total"
);

const monthTotal = document.querySelector(
  "#month-total"
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
    view.classList.remove("active-view");
  });

  selectedView.hidden = false;
  selectedView.classList.add("active-view");

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
    renderStats();
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
    const dateKey = getLocalDateKey(
      session.clockIn
    );

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
// Stats date ranges
// ------------------------------

function getStartOfToday(referenceDate) {
  return new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate()
  );
}

function getStartOfWeek(referenceDate) {
  const startOfWeek =
    getStartOfToday(referenceDate);

  /*
   * Converts JavaScript's Sunday-based week
   * to a Monday-based week.
   */
  const daysSinceMonday =
    (startOfWeek.getDay() + 6) % 7;

  startOfWeek.setDate(
    startOfWeek.getDate() -
    daysSinceMonday
  );

  return startOfWeek;
}

function getStartOfMonth(referenceDate) {
  return new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    1
  );
}

// ------------------------------
// Stats calculations
// ------------------------------

function calculateTotalSince(
  startDate,
  endDate
) {
  return completedSessions.reduce(
    (total, session) => {
      const sessionStart = new Date(
        session.clockIn
      );

      const isInsidePeriod =
        sessionStart >= startDate &&
        sessionStart <= endDate;

      if (!isInsidePeriod) {
        return total;
      }

      return (
        total +
        calculateSessionDuration(session)
      );
    },
    0
  );
}

function renderStats() {
  const now = new Date();

  const startOfToday =
    getStartOfToday(now);

  const startOfWeek =
    getStartOfWeek(now);

  const startOfMonth =
    getStartOfMonth(now);

  const todayDuration = calculateTotalSince(
    startOfToday,
    now
  );

  const weekDuration = calculateTotalSince(
    startOfWeek,
    now
  );

  const monthDuration = calculateTotalSince(
    startOfMonth,
    now
  );

  todayTotal.textContent = formatDuration(
    todayDuration
  );

  weekTotal.textContent = formatDuration(
    weekDuration
  );

  monthTotal.textContent = formatDuration(
    monthDuration
  );
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