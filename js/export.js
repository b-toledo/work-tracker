const CSV_MIME_TYPE =
  "text/csv;charset=utf-8";

function calculateDurationMilliseconds(
  session
) {
  if (!session.clockOut) {
    return null;
  }

  const duration =
    new Date(session.clockOut) -
    new Date(session.clockIn);

  const completeSeconds = Math.floor(
    duration / 1000
  );

  return Math.max(
    0,
    completeSeconds
  ) * 1000;
}

function formatDuration(milliseconds) {
  if (milliseconds === null) {
    return "";
  }

  const totalSeconds = Math.floor(
    milliseconds / 1000
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
  if (!isoDate) {
    return "";
  }

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    }
  ).format(new Date(isoDate));
}

function calculateDecimalHours(
  milliseconds
) {
  if (milliseconds === null) {
    return "";
  }

  const hours =
    milliseconds /
    (1000 * 60 * 60);

  return hours.toFixed(4);
}

function protectSpreadsheetCell(value) {
  const text = String(
    value ?? ""
  );

  /*
   * Prevent text in Notes from being interpreted
   * as a spreadsheet formula.
   */
  if (/^[=+\-@\t\r]/.test(text)) {
    return `'${text}`;
  }

  return text;
}

function escapeCsvCell(value) {
  const protectedValue =
    protectSpreadsheetCell(value);

  const escapedValue =
    protectedValue.replaceAll(
      "\"",
      "\"\""
    );

  return `"${escapedValue}"`;
}

function createCsvContent(sessions) {
  const headers = [
    "Session ID",
    "Date",
    "Clock In",
    "Clock Out",
    "Duration",
    "Decimal Hours",
    "Notes",
    "Status"
  ];

  const orderedSessions = [
    ...sessions
  ].sort((sessionA, sessionB) => {
    return (
      new Date(sessionB.clockIn) -
      new Date(sessionA.clockIn)
    );
  });

  const rows = orderedSessions.map(
    (session) => {
      const duration =
        calculateDurationMilliseconds(
          session
        );

      const status =
        session.clockOut
          ? "Completed"
          : "Open";

      return [
        session.id,
        formatDate(session.clockIn),
        formatTime(session.clockIn),
        formatTime(session.clockOut),
        formatDuration(duration),
        calculateDecimalHours(duration),
        session.notes ?? "",
        status
      ];
    }
  );

  return [
    headers,
    ...rows
  ]
    .map((row) => {
      return row
        .map(escapeCsvCell)
        .join(",");
    })
    .join("\r\n");
}

function createCsvFilename() {
  const now = new Date();

  const year = now.getFullYear();

  const month = String(
    now.getMonth() + 1
  ).padStart(2, "0");

  const day = String(
    now.getDate()
  ).padStart(2, "0");

  return (
    "work-tracker-export-" +
    `${year}-${month}-${day}.csv`
  );
}

function downloadCsv(
  content,
  filename
) {
  /*
   * The UTF-8 BOM helps Excel recognize
   * accented and non-ASCII characters.
   */
  const utf8Bom = "\uFEFF";

  const fileBlob = new Blob(
    [
      utf8Bom,
      content
    ],
    {
      type: CSV_MIME_TYPE
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

export function exportSessionsToCsv(
  sessions
) {
  const csvContent =
    createCsvContent(sessions);

  const filename =
    createCsvFilename();

  downloadCsv(
    csvContent,
    filename
  );

  return {
    filename,
    recordCount: sessions.length
  };
}