import {
  createSafetySnapshot,
  deleteSession,
  getAllSessions,
  getLatestSnapshot,
  replaceAllSessions,
  restoreLatestSnapshot,
  saveSession,
  saveSessions
} from "./database.js";

import {
  exportBackup,
  getLastBackupDate
} from "./backup.js";

import {
  analyzeBackup,
  readBackupFile
} from "./restore.js";

// ------------------------------
// Configuration
// ------------------------------

const pageTitles = {
  home: "Home",
  worklog: "Work Log",
  summary: "Daily Summary",
  stats: "Stats",
  settings: "Settings"
};

const USED_SNAPSHOT_KEY =
  "work-tracker-used-snapshot-id";

// ------------------------------
// Application state
// ------------------------------

let currentSession = null;
let completedSessions = [];
let timerInterval = null;
let isProcessingClockAction = false;
let isSavingForm = false;
let isImporting = false;
let pendingRestoreAnalysis = null;

// ------------------------------
// General elements
// ------------------------------

const pageTitle = document.querySelector(
  "#page-title"
);

const navigationButtons =
  document.querySelectorAll("[data-view]");

const bottomNavigationButtons =
  document.querySelectorAll(
    ".navigation-button"
  );

const views =
  document.querySelectorAll(".view");

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

const worklogEmptyState =
  document.querySelector(
    "#worklog-empty-state"
  );

const worklogContainer =
  document.querySelector(
    "#worklog-container"
  );

const worklogBody = document.querySelector(
  "#worklog-body"
);

// ------------------------------
// Daily Summary elements
// ------------------------------

const summaryEmptyState =
  document.querySelector(
    "#summary-empty-state"
  );

const summaryContainer =
  document.querySelector(
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

const restoreBackupButton =
  document.querySelector(
    "#restore-backup-button"
  );

const backupFileInput =
  document.querySelector(
    "#backup-file-input"
  );

const undoImportButton =
  document.querySelector(
    "#undo-import-button"
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

const sessionDialogTitle =
  document.querySelector(
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

const sessionNotesInput =
  document.querySelector(
    "#session-notes"
  );

const sessionFormError =
  document.querySelector(
    "#session-form-error"
  );

const saveSessionButton =
  document.querySelector(
    "#save-session-button"
  );

const closeSessionDialogButton =
  document.querySelector(
    "#close-session-dialog"
  );

const cancelSessionButton =
  document.querySelector(
    "#cancel-session-button"
  );

// ------------------------------
// Restore preview elements
// ------------------------------

const restoreDialog = document.querySelector(
  "#restore-dialog"
);

const closeRestoreDialogButton =
  document.querySelector(
    "#close-restore-dialog"
  );

const cancelRestoreButton =
  document.querySelector(
    "#cancel-restore-button"
  );

const mergeBackupButton =
  document.querySelector(
    "#merge-backup-button"
  );

const replaceBackupButton =
  document.querySelector(
    "#replace-backup-button"
  );

const restoreFormError =
  document.querySelector(
    "#restore-form-error"
  );

const restoreTotalCount =
  document.querySelector(
    "#restore-total-count"
  );

const restoreValidCount =
  document.querySelector(
    "#restore-valid-count"
  );

const restoreNewCount =
  document.querySelector(
    "#restore-new-count"
  );

const restoreCurrentOnlyCount =
  document.querySelector(
    "#restore-current-only-count"
  );

const restoreDuplicateCount =
  document.querySelector(
    "#restore-duplicate-count"
  );

const restoreConflictCount =
  document.querySelector(
    "#restore-conflict-count"
  );

const restoreInvalidCount =
  document.querySelector(
    "#restore-invalid-count"
  );

const restoreOpenCount =
  document.querySelector(
    "#restore-open-count"
  );

const restoreWarningSection =
  document.querySelector(
    "#restore-warning-section"
  );

const restoreWarningList =
  document.querySelector(
    "#restore-warning-list"
  );

// ------------------------------
// Import report elements
// ------------------------------

const importReportDialog =
  document.querySelector(
    "#import-report-dialog"
  );

const closeImportReportButton =
  document.querySelector(
    "#close-import-report"
  );

const finishImportReportButton =
  document.querySelector(
    "#finish-import-report"
  );

const reportImportedCount =
  document.querySelector(
    "#report-imported-count"
  );

const reportDuplicateCount =
  document.querySelector(
    "#report-duplicate-count"
  );

const reportConflictCount =
  document.querySelector(
    "#report-conflict-count"
  );

const reportInvalidCount =
  document.querySelector(
    "#report-invalid-count"
  );

const reportTotalCount =
  document.querySelector(
    "#report-total-count"
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
// Home
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

  const elapsedMilliseconds =
    new Date() -
    new Date(currentSession.clockIn);

  sessionTime.textContent = formatDuration(
    elapsedMilliseconds
  );
}

// ------------------------------
// Duration
// ------------------------------

function calculateSessionDuration(session) {
  const durationInMilliseconds =
    new Date(session.clockOut) -
    new Date(session.clockIn);

  const durationInSeconds = Math.floor(
    durationInMilliseconds / 1000
  );

  return Math.max(
    0,
    durationInSeconds
  ) * 1000;
}

function formatDuration(milliseconds) {
  const totalSeconds = Math.floor(
    Math.max(0, milliseconds) / 1000
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
// Date formatting
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
// Load sessions
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
      "Could not load sessions:",
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

  sessionClockInInput.value =
    formatDateTimeLocal(
      now.toISOString()
    );

  sessionClockOutInput.value = "";
  sessionNotesInput.value = "";

  sessionDialog.showModal();
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

  const existingSession =
    completedSessions.find(
      (session) => {
        return (
          session.id ===
          sessionIdInput.value
        );
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
      "Could not save session:",
      error
    );

    showSessionFormError(
      "The session could not be saved."
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
  } catch (error) {
    console.error(
      "Could not delete session:",
      error
    );

    window.alert(
      "The session could not be deleted."
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
    } else {
      summariesByDate.set(dateKey, {
        dateKey,
        totalDuration: duration
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
  const summaries =
    calculateDailySummaries();

  summaryBody.replaceChildren();

  if (summaries.length === 0) {
    summaryEmptyState.hidden = false;
    summaryContainer.hidden = true;
    return;
  }

  summaryEmptyState.hidden = true;
  summaryContainer.hidden = false;

  summaries.forEach((summary) => {
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
  const start = getStartOfToday(
    referenceDate
  );

  const daysSinceMonday =
    (start.getDay() + 6) % 7;

  start.setDate(
    start.getDate() -
    daysSinceMonday
  );

  return start;
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

      if (
        sessionStart < startDate ||
        sessionStart > endDate
      ) {
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

  todayTotal.textContent =
    formatDuration(
      calculateTotalSince(
        getStartOfToday(now),
        now
      )
    );

  weekTotal.textContent =
    formatDuration(
      calculateTotalSince(
        getStartOfWeek(now),
        now
      )
    );

  monthTotal.textContent =
    formatDuration(
      calculateTotalSince(
        getStartOfMonth(now),
        now
      )
    );
}

// ------------------------------
// Backup export
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
  const storedDate =
    getLastBackupDate();

  lastBackupDate.textContent =
    storedDate
      ? formatBackupDate(storedDate)
      : "Never";
}

async function handleExportBackup() {
  exportBackupButton.disabled = true;

  try {
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
      "Could not create backup:",
      error
    );

    window.alert(
      "The backup could not be created."
    );
  } finally {
    exportBackupButton.disabled = false;
  }
}

// ------------------------------
// Restore file selection
// ------------------------------

function handleRestoreBackupButton() {
  backupFileInput.value = "";
  backupFileInput.click();
}

async function handleBackupFileSelection(
  event
) {
  const file =
    event.target.files?.[0];

  if (!file) {
    return;
  }

  restoreBackupButton.disabled = true;

  try {
    const backupData =
      await readBackupFile(file);

    const existingSessions =
      await getAllSessions();

    pendingRestoreAnalysis =
      analyzeBackup(
        backupData,
        existingSessions
      );

    renderRestorePreview(
      pendingRestoreAnalysis
    );

    restoreDialog.showModal();
  } catch (error) {
    console.error(
      "Could not read backup:",
      error
    );

    window.alert(
      error.message ??
      "The backup could not be read."
    );
  } finally {
    restoreBackupButton.disabled = false;
  }
}

// ------------------------------
// Restore preview
// ------------------------------

function renderRestorePreview(analysis) {
  const { counts } = analysis;

  restoreTotalCount.textContent =
    counts.total;

  restoreValidCount.textContent =
    counts.valid;

  restoreNewCount.textContent =
    counts.new;
  
  restoreCurrentOnlyCount.textContent =
    counts.currentOnly;

  restoreDuplicateCount.textContent =
    counts.duplicates;

  restoreConflictCount.textContent =
    counts.conflicts;

  restoreInvalidCount.textContent =
    counts.invalid;

  restoreOpenCount.textContent =
    counts.openSessions;

  const warnings = [
    ...analysis.warnings
  ];

  if (currentSession) {
    warnings.push(
      "A work session is currently open in this app."
    );
  }

  restoreWarningList.replaceChildren();

  warnings.forEach((warning) => {
    const item =
      document.createElement("li");

    item.textContent = warning;

    restoreWarningList.append(item);
  });

  restoreWarningSection.hidden =
    warnings.length === 0;

  restoreFormError.hidden = true;
  restoreFormError.textContent = "";

  mergeBackupButton.disabled =
    !analysis.canMerge ||
    analysis.newRecords.length === 0;

  replaceBackupButton.disabled =
    !analysis.canReplace;
}

function closeRestoreDialog() {
  if (restoreDialog.open) {
    restoreDialog.close();
  }
}

function resetRestoreDialog() {
  if (!isImporting) {
    pendingRestoreAnalysis = null;
    backupFileInput.value = "";
  }

  restoreFormError.hidden = true;
  restoreFormError.textContent = "";

  mergeBackupButton.disabled = false;
  replaceBackupButton.disabled = false;

  mergeBackupButton.textContent =
    "Merge";

  replaceBackupButton.textContent =
    "Replace";
}

function showRestoreError(message) {
  restoreFormError.textContent = message;
  restoreFormError.hidden = false;
}

function setRestoreBusy(isBusy) {
  isImporting = isBusy;

  mergeBackupButton.disabled = isBusy;
  replaceBackupButton.disabled = isBusy;
  cancelRestoreButton.disabled = isBusy;
  closeRestoreDialogButton.disabled =
    isBusy;

  if (isBusy) {
    mergeBackupButton.textContent =
      "Importing...";

    replaceBackupButton.textContent =
      "Importing...";
  } else {
    mergeBackupButton.textContent =
      "Merge";

    replaceBackupButton.textContent =
      "Replace";

    cancelRestoreButton.disabled = false;

    closeRestoreDialogButton.disabled =
      false;
  }
}

// ------------------------------
// Merge and Replace
// ------------------------------

async function handleMergeBackup() {
  if (!pendingRestoreAnalysis) {
    return;
  }

  const confirmation = window.confirm(
    "Merge this backup?\n\n" +
    `${pendingRestoreAnalysis.counts.new} ` +
    "new records will be added.\n" +
    "Existing records will be kept.\n" +
    "Duplicates and conflicts will be ignored."
  );

  if (!confirmation) {
    return;
  }

  await performImport("merge");
}

async function handleReplaceBackup() {
  if (!pendingRestoreAnalysis) {
    return;
  }

  const currentRecords =
    await getAllSessions();

  const confirmation = window.confirm(
    "Replace all existing records?\n\n" +
    `Current records: ${
      currentRecords.length
    }\n` +
    `Valid backup records: ${
      pendingRestoreAnalysis.counts.valid
    }\n\n` +
    "A safety snapshot will be created first."
  );

  if (!confirmation) {
    return;
  }

  await performImport("replace");
}

async function performImport(mode) {
  if (
    !pendingRestoreAnalysis ||
    isImporting
  ) {
    return;
  }

  const analysis =
    pendingRestoreAnalysis;

  setRestoreBusy(true);

  try {
    const existingSessions =
      await getAllSessions();

    /*
     * This must finish successfully before
     * the database is changed.
     */
    await createSafetySnapshot(
      existingSessions
    );

    if (mode === "merge") {
      await saveSessions(
        analysis.newRecords
      );
    } else {
      await replaceAllSessions(
        analysis.validatedSessions
      );
    }

    const importedCount =
      mode === "merge"
        ? analysis.newRecords.length
        : analysis.validatedSessions.length;

    closeRestoreDialog();

    await loadSessions();
    await updateUndoAvailability();

    const allSessionsAfterImport =
      await getAllSessions();

    showImportReport({
      imported:
        importedCount,

      duplicates:
        mode === "merge"
          ? analysis.counts.duplicates
          : 0,

      conflicts:
        mode === "merge"
          ? analysis.counts.conflicts
          : 0,

      invalid:
        analysis.counts.invalid,

      total:
        allSessionsAfterImport.length
    });
  } catch (error) {
    console.error(
      "Could not import backup:",
      error
    );

    showRestoreError(
      "The backup could not be imported. " +
      "Your previous data was preserved."
    );
  } finally {
    setRestoreBusy(false);
  }
}

// ------------------------------
// Import report
// ------------------------------

function showImportReport(report) {
  reportImportedCount.textContent =
    report.imported;

  reportDuplicateCount.textContent =
    report.duplicates;

  reportConflictCount.textContent =
    report.conflicts;

  reportInvalidCount.textContent =
    report.invalid;

  reportTotalCount.textContent =
    report.total;

  importReportDialog.showModal();
}

function closeImportReport() {
  if (importReportDialog.open) {
    importReportDialog.close();
  }
}

// ------------------------------
// Undo last import
// ------------------------------

async function updateUndoAvailability() {
  try {
    const snapshot =
      await getLatestSnapshot();

    const usedSnapshotId =
      localStorage.getItem(
        USED_SNAPSHOT_KEY
      );

    undoImportButton.disabled =
      !snapshot ||
      snapshot.id === usedSnapshotId;
  } catch (error) {
    console.error(
      "Could not check snapshot:",
      error
    );

    undoImportButton.disabled = true;
  }
}

async function handleUndoLastImport() {
  try {
    const snapshot =
      await getLatestSnapshot();

    if (!snapshot) {
      window.alert(
        "No safety snapshot is available."
      );

      await updateUndoAvailability();
      return;
    }

    const usedSnapshotId =
      localStorage.getItem(
        USED_SNAPSHOT_KEY
      );

    if (usedSnapshotId === snapshot.id) {
      window.alert(
        "The last import has already been undone."
      );

      await updateUndoAvailability();
      return;
    }

    const confirmation = window.confirm(
      "Undo the last import?\n\n" +
      "The current data will be exported as " +
      "a JSON backup first. The application " +
      "will then restore the automatic snapshot."
    );

    if (!confirmation) {
      return;
    }

    undoImportButton.disabled = true;

    /*
     * Create a downloadable copy of the current
     * state before restoring the older snapshot.
     */
    const currentData =
      await getAllSessions();

    exportBackup(currentData);
    renderLastBackupDate();

    const restoredSnapshot =
      await restoreLatestSnapshot();

    localStorage.setItem(
      USED_SNAPSHOT_KEY,
      restoredSnapshot.id
    );

    await loadSessions();
    await updateUndoAvailability();

    window.alert(
      "The last import was undone successfully.\n\n" +
      `Records restored: ${
        restoredSnapshot.recordCount
      }`
    );
  } catch (error) {
    console.error(
      "Could not undo import:",
      error
    );

    window.alert(
      "The last import could not be undone."
    );

    await updateUndoAvailability();
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

exportBackupButton.addEventListener(
  "click",
  handleExportBackup
);

restoreBackupButton.addEventListener(
  "click",
  handleRestoreBackupButton
);

backupFileInput.addEventListener(
  "change",
  handleBackupFileSelection
);

closeRestoreDialogButton.addEventListener(
  "click",
  closeRestoreDialog
);

cancelRestoreButton.addEventListener(
  "click",
  closeRestoreDialog
);

restoreDialog.addEventListener(
  "close",
  resetRestoreDialog
);

mergeBackupButton.addEventListener(
  "click",
  handleMergeBackup
);

replaceBackupButton.addEventListener(
  "click",
  handleReplaceBackup
);

closeImportReportButton.addEventListener(
  "click",
  closeImportReport
);

finishImportReportButton.addEventListener(
  "click",
  closeImportReport
);

undoImportButton.addEventListener(
  "click",
  handleUndoLastImport
);

// ------------------------------
// Initialization
// ------------------------------

async function initializeApplication() {
  openView("home");

  await loadSessions();

  renderLastBackupDate();

  await updateUndoAvailability();

  console.log(
    "Work Tracker loaded successfully."
  );
}

initializeApplication();