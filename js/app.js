import {
  deleteSession,
  getAllSessions,
  saveSession
} from "./database.js";

import {
  exportBackup,
  getLastBackupDate
} from "./backup.js";

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
let isSavingForm = false;

// ------------------------------
// General HTML elements
// ------------------------------

const pageTitle = document.querySelector(
  "#page-title"
);

const navigationButtons = document.querySelectorAll(
  "[data-view]"
);

const bottomNavigationButtons =
  document.querySelectorAll(
    ".navigation-button"
  );

const views = document.querySelectorAll(
  ".view"
);

// ------------------------------
// Home elements
// ------------------------------

const clockButton = document.querySelector(
  "#clock-button"
);

const workStatus = document.querySelector(
  "#work-status"
);

const sessionTime = document.querySelector(
  "#session-time"
);

// ------------------------------
// Work Log elements
// ------------------------------

const addRecordButton = document.querySelector(
  "#add-record-button"
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

// ------------------------------
// Daily Summary elements
// ------------------------------

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
// Stats elements
// ------------------------------

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
// Backup elements
// ------------------------------

const exportBackupButton =
  document.querySelector(
    "#export-backup-button"
  );

const lastBackupDate =
  document.querySelector(
    "#last-backup-date"
  );

// ------------------------------
// Session form elements
// ------------------------------

const sessionDialog = document.querySelector(
  "#session-dialog"
);

const sessionDialogTitle = document.querySelector(
  "#session-dialog-title"
);

const sessionForm = document.querySelector(
  "#session-form"
);

const sessionIdInput = document.querySelector(
  "#session-id"
);

const sessionClockInInput =
  document.querySelector(
    "#session-clock-in"
  );

const sessionClockOutInput =
  document.querySelector(
    "#session-clock-out"
  );

const sessionNotesInput = document.querySelector(
  "#session-notes"
);

const sessionFormError = document.querySelector(
  "#session-form-error"
);

const saveSessionButton = document.querySelector(
  "#save-session-button"
);

const closeSessionDialogButton =
  document.querySelector(
    "#close-session-dialog"
  );

const cancelSessionButton = document.querySelector(
  "#cancel-session-button"
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
// Clock In and Clock Out
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
// Home screen
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

function formatDateTimeLocal(isoDate) {
  const date = new Date(isoDate);

  const year = date.getFullYear();

  const month = String(
    date.getMonth() + 1
  ).padStart(2, "0");

  const day = String(
    date.getDate()
  ).padStart(2, "0");

  const hours = String(
    date.getHours()
  ).padStart(2, "0");

  const minutes = String(
    date.getMinutes()
  ).padStart(2, "0");

  const seconds = String(
    date.getSeconds()
  ).padStart(2, "0");

  return (
    `${year}-${month}-${day}` +
    `T${hours}:${minutes}:${seconds}`
  );
}

function parseDateTimeLocal(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  date.setMilliseconds(0);

  return date;
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
    return (
      new Date(sessionB.clockIn) -
      new Date(sessionA.clockIn)
    );
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
    worklogBody.append(
      createWorkLogRow(session)
    );
  });
}

function createWorkLogRow(session) {
  const row = document.createElement("tr");

  const dateCell = document.createElement("td");
  const clockInCell = document.createElement("td");
  const clockOutCell = document.createElement("td");
  const durationCell = document.createElement("td");
  const notesCell = document.createElement("td");
  const actionsCell = document.createElement("td");

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
    calculateSessionDuration(session)
  );

  notesCell.classList.add("notes-cell");

  if (session.notes) {
    notesCell.textContent = session.notes;
  } else {
    notesCell.textContent = "—";
    notesCell.classList.add("notes-empty");
  }

  const actionButtons =
    document.createElement("div");

  actionButtons.classList.add(
    "action-buttons"
  );

  const editButton =
    document.createElement("button");

  editButton.type = "button";
  editButton.textContent = "Edit";
  editButton.classList.add("edit-button");

  editButton.setAttribute(
    "aria-label",
    `Edit session from ${formatDate(
      session.clockIn
    )}`
  );

  editButton.addEventListener(
    "click",
    () => {
      openEditSessionDialog(
        session.id
      );
    }
  );

  const removeButton =
    document.createElement("button");

  removeButton.type = "button";
  removeButton.textContent = "Delete";

  removeButton.classList.add(
    "delete-button"
  );

  removeButton.setAttribute(
    "aria-label",
    `Delete session from ${formatDate(
      session.clockIn
    )}`
  );

  removeButton.addEventListener(
    "click",
    () => {
      handleDeleteSession(
        session.id
      );
    }
  );

  actionButtons.append(
    editButton,
    removeButton
  );

  actionsCell.append(actionButtons);

  row.append(
    dateCell,
    clockInCell,
    clockOutCell,
    durationCell,
    notesCell,
    actionsCell
  );

  return row;
}

// ------------------------------
// Add and edit form
// ------------------------------

function openAddSessionDialog() {
  resetSessionForm();

  const now = new Date();

  now.setMilliseconds(0);

  sessionDialogTitle.textContent =
    "Add work session";

  sessionIdInput.value = "";

  sessionClockInInput.value =
    formatDateTimeLocal(
      now.toISOString()
    );

  sessionClockOutInput.value = "";
  sessionNotesInput.value = "";

  sessionDialog.showModal();

  sessionClockInInput.focus();
}

function openEditSessionDialog(sessionId) {
  const session = completedSessions.find(
    (item) => item.id === sessionId
  );

  if (!session) {
    window.alert(
      "The selected session could not be found."
    );

    return;
  }

  resetSessionForm();

  sessionDialogTitle.textContent =
    "Edit work session";

  sessionIdInput.value = session.id;

  sessionClockInInput.value =
    formatDateTimeLocal(
      session.clockIn
    );

  sessionClockOutInput.value =
    formatDateTimeLocal(
      session.clockOut
    );

  sessionNotesInput.value =
    session.notes ?? "";

  sessionDialog.showModal();

  sessionClockInInput.focus();
}

function closeSessionDialog() {
  if (sessionDialog.open) {
    sessionDialog.close();
  }
}

function resetSessionForm() {
  sessionForm.reset();

  sessionIdInput.value = "";
  sessionFormError.textContent = "";
  sessionFormError.hidden = true;

  saveSessionButton.disabled = false;

  saveSessionButton.textContent =
    "Save session";

  isSavingForm = false;
}

function showSessionFormError(message) {
  sessionFormError.textContent = message;
  sessionFormError.hidden = false;
}

async function handleSessionFormSubmit(event) {
  event.preventDefault();

  if (isSavingForm) {
    return;
  }

  sessionFormError.hidden = true;
  sessionFormError.textContent = "";

  const clockInDate = parseDateTimeLocal(
    sessionClockInInput.value
  );

  const clockOutDate = parseDateTimeLocal(
    sessionClockOutInput.value
  );

  if (!clockInDate || !clockOutDate) {
    showSessionFormError(
      "Enter valid Clock In and Clock Out times."
    );

    return;
  }

  if (clockOutDate <= clockInDate) {
    showSessionFormError(
      "Clock Out must be later than Clock In."
    );

    return;
  }

  const notes =
    sessionNotesInput.value.trim();

  if (notes.length > 500) {
    showSessionFormError(
      "Notes cannot exceed 500 characters."
    );

    return;
  }

  const existingId =
    sessionIdInput.value;

  const existingSession =
    completedSessions.find(
      (session) => {
        return session.id === existingId;
      }
    );

  const now = new Date();

  now.setMilliseconds(0);

  const sessionToSave = {
    id:
      existingSession?.id ??
      crypto.randomUUID(),

    clockIn:
      clockInDate.toISOString(),

    clockOut:
      clockOutDate.toISOString(),

    notes,

    createdAt:
      existingSession?.createdAt ??
      now.toISOString(),

    updatedAt:
      now.toISOString()
  };

  isSavingForm = true;
  saveSessionButton.disabled = true;

  saveSessionButton.textContent =
    "Saving...";

  try {
    await saveSession(sessionToSave);

    closeSessionDialog();
    await loadSessions();

    openView("worklog");
  } catch (error) {
    console.error(
      "Could not save the session:",
      error
    );

    showSessionFormError(
      "The session could not be saved. " +
      "Your existing data was not changed."
    );

    isSavingForm = false;
    saveSessionButton.disabled = false;

    saveSessionButton.textContent =
      "Save session";
  }
}

// ------------------------------
// Delete session
// ------------------------------

async function handleDeleteSession(sessionId) {
  const session = completedSessions.find(
    (item) => item.id === sessionId
  );

  if (!session) {
    window.alert(
      "The selected session could not be found."
    );

    return;
  }

  const confirmation = window.confirm(
    "Delete this work session?\n\n" +
    `Date: ${formatDate(session.clockIn)}\n` +
    `Clock In: ${formatTime(session.clockIn)}\n` +
    `Clock Out: ${formatTime(session.clockOut)}\n` +
    `Duration: ${formatDuration(
      calculateSessionDuration(session)
    )}\n\n` +
    "This action cannot currently be undone."
  );

  if (!confirmation) {
    return;
  }

  try {
    await deleteSession(session.id);
    await loadSessions();

    console.log(
      "Session deleted:",
      session.id
    );
  } catch (error) {
    console.error(
      "Could not delete the session:",
      error
    );

    window.alert(
      "The session could not be deleted. " +
      "Your data was not changed."
    );
  }
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
      existingSummary.totalDuration +=
        duration;

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
    const row =
      document.createElement("tr");

    const dateCell =
      document.createElement("td");

    const durationCell =
      document.createElement("td");

    dateCell.textContent = formatDateKey(
      summary.dateKey
    );

    durationCell.textContent =
      formatDuration(
        summary.totalDuration
      );

    row.append(
      dateCell,
      durationCell
    );

    summaryBody.append(row);
  });
}

// ------------------------------
// Stats
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

  const todayDuration =
    calculateTotalSince(
      getStartOfToday(now),
      now
    );

  const weekDuration =
    calculateTotalSince(
      getStartOfWeek(now),
      now
    );

  const monthDuration =
    calculateTotalSince(
      getStartOfMonth(now),
      now
    );

  todayTotal.textContent =
    formatDuration(todayDuration);

  weekTotal.textContent =
    formatDuration(weekDuration);

  monthTotal.textContent =
    formatDuration(monthDuration);
}

// ------------------------------
// Backup
// ------------------------------

function formatBackupDate(date) {
  return new Intl.DateTimeFormat(
    "en-GB",
    {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }
  ).format(date);
}

function renderLastBackupDate() {
  const storedBackupDate =
    getLastBackupDate();

  if (!storedBackupDate) {
    lastBackupDate.textContent =
      "Never";

    return;
  }

  lastBackupDate.textContent =
    formatBackupDate(
      storedBackupDate
    );
}

async function handleExportBackup() {
  exportBackupButton.disabled = true;

  exportBackupButton.textContent =
    "Creating backup...";

  try {
    /*
     * Reading directly from IndexedDB includes
     * both completed and currently open sessions.
     */
    const allSessions =
      await getAllSessions();

    const backupData =
      exportBackup(allSessions);

    renderLastBackupDate();

    window.alert(
      "Backup created successfully.\n\n" +
      `Records exported: ${
        backupData.recordCount
      }`
    );
  } catch (error) {
    console.error(
      "Could not create the backup:",
      error
    );

    window.alert(
      "The backup could not be created. " +
      "Your existing data was not changed."
    );
  } finally {
    exportBackupButton.disabled = false;

    exportBackupButton.textContent =
      "Export backup";
  }
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

addRecordButton.addEventListener(
  "click",
  openAddSessionDialog
);

sessionForm.addEventListener(
  "submit",
  handleSessionFormSubmit
);

closeSessionDialogButton.addEventListener(
  "click",
  closeSessionDialog
);

cancelSessionButton.addEventListener(
  "click",
  closeSessionDialog
);

sessionDialog.addEventListener(
  "close",
  resetSessionForm
);

sessionDialog.addEventListener(
  "click",
  (event) => {
    if (event.target === sessionDialog) {
      closeSessionDialog();
    }
  }
);

exportBackupButton.addEventListener(
  "click",
  handleExportBackup
);

// ------------------------------
// Application initialization
// ------------------------------

async function initializeApplication() {
  openView("home");

  await loadSessions();

  renderLastBackupDate();

  console.log(
    "Work Tracker loaded successfully."
  );
}

initializeApplication();