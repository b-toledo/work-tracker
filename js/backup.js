const BACKUP_FORMAT_VERSION = 1;

const LAST_BACKUP_KEY =
  "work-tracker-last-backup";

function createBackupData(sessions) {
  const exportedAt = new Date();

  exportedAt.setMilliseconds(0);

  const orderedSessions = [
    ...sessions
  ].sort((sessionA, sessionB) => {
    return (
      new Date(sessionB.clockIn) -
      new Date(sessionA.clockIn)
    );
  });

  return {
    app: "Work Tracker",
    formatVersion: BACKUP_FORMAT_VERSION,
    exportedAt: exportedAt.toISOString(),
    recordCount: orderedSessions.length,
    sessions: orderedSessions
  };
}

function createBackupFilename(exportedAt) {
  const date = new Date(exportedAt);

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
    "work-tracker-backup-" +
    `${year}-${month}-${day}_` +
    `${hours}-${minutes}-${seconds}.json`
  );
}

function downloadJsonFile(
  data,
  filename
) {
  const jsonContent = JSON.stringify(
    data,
    null,
    2
  );

  const fileBlob = new Blob(
    [jsonContent],
    {
      type: "application/json"
    }
  );

  const downloadUrl =
    URL.createObjectURL(fileBlob);

  const downloadLink =
    document.createElement("a");

  downloadLink.href = downloadUrl;
  downloadLink.download = filename;

  document.body.append(
    downloadLink
  );

  downloadLink.click();
  downloadLink.remove();

  window.setTimeout(() => {
    URL.revokeObjectURL(
      downloadUrl
    );
  }, 0);
}

export function exportBackup(
  sessions
) {
  const backupData =
    createBackupData(sessions);

  const filename =
    createBackupFilename(
      backupData.exportedAt
    );

  downloadJsonFile(
    backupData,
    filename
  );

  localStorage.setItem(
    LAST_BACKUP_KEY,
    backupData.exportedAt
  );

  return backupData;
}

export function getLastBackupDate() {
  const storedDate =
    localStorage.getItem(
      LAST_BACKUP_KEY
    );

  if (!storedDate) {
    return null;
  }

  const date = new Date(
    storedDate
  );

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}