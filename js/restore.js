const SUPPORTED_FORMAT_VERSION = 1;

const MAXIMUM_FILE_SIZE =
  10 * 1024 * 1024;

// ------------------------------
// Read JSON file
// ------------------------------

export async function readBackupFile(file) {
  if (!file) {
    throw new Error(
      "No backup file was selected."
    );
  }

  if (file.size > MAXIMUM_FILE_SIZE) {
    throw new Error(
      "The selected file is larger than 10 MB."
    );
  }

  let fileContent;

  try {
    fileContent = await file.text();
  } catch {
    throw new Error(
      "The selected file could not be read."
    );
  }

  let backupData;

  try {
    backupData = JSON.parse(
      fileContent
    );
  } catch {
    throw new Error(
      "The selected file does not contain valid JSON."
    );
  }

  validateBackupStructure(
    backupData
  );

  return backupData;
}

// ------------------------------
// Validate top-level structure
// ------------------------------

function validateBackupStructure(
  backupData
) {
  if (
    !backupData ||
    typeof backupData !== "object" ||
    Array.isArray(backupData)
  ) {
    throw new Error(
      "The backup must contain a JSON object."
    );
  }

  if (
    backupData.formatVersion !==
    SUPPORTED_FORMAT_VERSION
  ) {
    throw new Error(
      "This backup format is not supported. " +
      `Expected version ${
        SUPPORTED_FORMAT_VERSION
      }.`
    );
  }

  if (!Array.isArray(backupData.sessions)) {
    throw new Error(
      "The backup does not contain a sessions array."
    );
  }

  if (
    backupData.exportedAt !== undefined &&
    !isValidDate(
      backupData.exportedAt
    )
  ) {
    throw new Error(
      "The backup export date is invalid."
    );
  }
}

// ------------------------------
// Validate one session
// ------------------------------

function validateSession(
  originalSession,
  recordIndex
) {
  const errors = [];

  if (
    !originalSession ||
    typeof originalSession !== "object" ||
    Array.isArray(originalSession)
  ) {
    return {
      valid: false,
      recordIndex,
      originalSession,
      errors: [
        "The record is not an object."
      ]
    };
  }

  const id =
    typeof originalSession.id === "string"
      ? originalSession.id.trim()
      : "";

  if (!id) {
    errors.push(
      "The record does not have a valid ID."
    );
  }

  const clockIn = normalizeDate(
    originalSession.clockIn
  );

  if (!clockIn) {
    errors.push(
      "Clock In is missing or invalid."
    );
  }

  let clockOut = null;

  if (
    originalSession.clockOut !== null &&
    originalSession.clockOut !==
      undefined &&
    originalSession.clockOut !== ""
  ) {
    clockOut = normalizeDate(
      originalSession.clockOut
    );

    if (!clockOut) {
      errors.push(
        "Clock Out is invalid."
      );
    }
  }

  if (
    clockIn &&
    clockOut &&
    new Date(clockOut) <=
      new Date(clockIn)
  ) {
    errors.push(
      "Clock Out is not later than Clock In."
    );
  }

  let notes = "";

  if (
    originalSession.notes !== undefined &&
    originalSession.notes !== null
  ) {
    if (
      typeof originalSession.notes !==
      "string"
    ) {
      errors.push(
        "Notes must be text."
      );
    } else {
      notes =
        originalSession.notes.trim();

      if (notes.length > 500) {
        errors.push(
          "Notes exceed 500 characters."
        );
      }
    }
  }

  const createdAtResult =
    normalizeOptionalDate(
      originalSession.createdAt,
      clockIn
    );

  if (!createdAtResult.valid) {
    errors.push(
      "The creation date is invalid."
    );
  }

  const updatedAtResult =
    normalizeOptionalDate(
      originalSession.updatedAt,
      createdAtResult.value
    );

  if (!updatedAtResult.valid) {
    errors.push(
      "The update date is invalid."
    );
  }

  if (errors.length > 0) {
    return {
      valid: false,
      recordIndex,
      originalSession,
      errors
    };
  }

  return {
    valid: true,
    recordIndex,
    session: {
      id,
      clockIn,
      clockOut,
      notes,
      createdAt:
        createdAtResult.value,
      updatedAt:
        updatedAtResult.value
    }
  };
}

// ------------------------------
// Analyze complete backup
// ------------------------------

export function analyzeBackup(
  backupData,
  existingSessions
) {
  validateBackupStructure(
    backupData
  );

  const invalidRecords = [];
  const validRecords = [];

  backupData.sessions.forEach(
    (session, index) => {
      const result = validateSession(
        session,
        index
      );

      if (result.valid) {
        validRecords.push(result);
      } else {
        invalidRecords.push(result);
      }
    }
  );

  /*
   * First group valid records by ID.
   * This detects duplicate or conflicting IDs
   * inside the backup itself.
   */
  const recordsById = new Map();

  validRecords.forEach((record) => {
    const recordsWithSameId =
      recordsById.get(
        record.session.id
      ) ?? [];

    recordsWithSameId.push(record);

    recordsById.set(
      record.session.id,
      recordsWithSameId
    );
  });

  const uniqueImportedSessions = [];
  const internalDuplicates = [];
  const internalConflicts = [];

  recordsById.forEach(
    (recordsWithSameId) => {
      if (recordsWithSameId.length === 1) {
        uniqueImportedSessions.push(
          recordsWithSameId[0].session
        );

        return;
      }

      const firstSession =
        recordsWithSameId[0].session;

      const allRecordsAreEqual =
        recordsWithSameId.every(
          (record) => {
            return sessionsAreEqual(
              firstSession,
              record.session
            );
          }
        );

      /*
       * If all repeated records are identical,
       * keep the first and count the remaining
       * records as duplicates.
       */
      if (allRecordsAreEqual) {
        uniqueImportedSessions.push(
          firstSession
        );

        recordsWithSameId
          .slice(1)
          .forEach((record) => {
            internalDuplicates.push({
              session: record.session,
              recordIndex:
                record.recordIndex,
              reason:
                "Duplicate ID and identical data inside the backup."
            });
          });

        return;
      }

      /*
       * Different records with the same ID
       * are unsafe and are excluded.
       */
      recordsWithSameId.forEach(
        (record) => {
          internalConflicts.push({
            session: record.session,
            recordIndex:
              record.recordIndex,
            reason:
              "The backup contains different records with the same ID."
          });
        }
      );
    }
  );

  const conflictingIds = new Set(
    internalConflicts.map(
      (conflict) => {
        return conflict.session.id;
      }
    )
  );

  const safeImportedSessions =
    uniqueImportedSessions.filter(
      (session) => {
        return !conflictingIds.has(
          session.id
        );
      }
    );

  /*
   * Build a map of the records currently
   * saved in the application.
   */
  const existingSessionsById =
    new Map(
      existingSessions.map(
        (session) => {
          return [
            session.id,
            session
          ];
        }
      )
    );

  const newRecords = [];
  const duplicates = [];
  const conflicts = [];

  /*
   * Compare every safe imported record
   * against the application's current data.
   */
  safeImportedSessions.forEach(
    (importedSession) => {
      const existingSession =
        existingSessionsById.get(
          importedSession.id
        );

      if (!existingSession) {
        newRecords.push(
          importedSession
        );

        return;
      }

      if (
        sessionsAreEqual(
          importedSession,
          existingSession
        )
      ) {
        duplicates.push({
          importedSession,
          existingSession,
          reason:
            "The same record already exists."
        });

        return;
      }

      conflicts.push({
        importedSession,
        existingSession,
        reason:
          "The ID exists, but the record contents are different."
      });
    }
  );

  /*
   * Identify records that currently exist
   * in the application but do not exist in
   * the selected backup.
   */
  const importedSessionIds = new Set(
    safeImportedSessions.map(
      (session) => {
        return session.id;
      }
    )
  );

  const currentOnlyRecords =
    existingSessions.filter(
      (session) => {
        return !importedSessionIds.has(
          session.id
        );
      }
    );

  /*
   * Check currently open work sessions.
   */
  const importedOpenSessions =
    safeImportedSessions.filter(
      (session) => {
        return session.clockOut === null;
      }
    );

  const existingOpenSessions =
    existingSessions.filter(
      (session) => {
        return session.clockOut === null;
      }
    );

  const mergeOpenSessionIds =
    new Set(
      [
        ...existingOpenSessions,

        ...newRecords.filter(
          (session) => {
            return (
              session.clockOut === null
            );
          }
        )
      ].map((session) => {
        return session.id;
      })
    );

  const warnings = [];

  if (
    backupData.recordCount !==
      undefined &&
    backupData.recordCount !==
      backupData.sessions.length
  ) {
    warnings.push(
      "The recordCount value does not match the number of records in the file."
    );
  }

  if (
    importedOpenSessions.length > 1
  ) {
    warnings.push(
      "The backup contains more than one open work session."
    );
  }

  if (
    mergeOpenSessionIds.size > 1
  ) {
    warnings.push(
      "Merging this backup would result in more than one open work session."
    );
  }

  return {
    metadata: {
      app:
        backupData.app ??
        "Unknown",

      formatVersion:
        backupData.formatVersion,

      exportedAt:
        backupData.exportedAt ??
        null,

      declaredRecordCount:
        backupData.recordCount ??
        null,

      actualRecordCount:
        backupData.sessions.length
    },

    /*
     * All safe, unique and valid records from
     * the backup. Replace uses this collection.
     */
    validatedSessions:
      safeImportedSessions,

    /*
     * Records available for Merge.
     */
    newRecords,

    /*
     * Current application records that would
     * disappear if Replace were selected.
     */
    currentOnlyRecords,

    duplicates: [
      ...duplicates,
      ...internalDuplicates
    ],

    conflicts: [
      ...conflicts,
      ...internalConflicts
    ],

    invalidRecords,
    warnings,

    counts: {
      total:
        backupData.sessions.length,

      valid:
        safeImportedSessions.length,

      new:
        newRecords.length,

      currentOnly:
        currentOnlyRecords.length,

      duplicates:
        duplicates.length +
        internalDuplicates.length,

      conflicts:
        conflicts.length +
        internalConflicts.length,

      invalid:
        invalidRecords.length,

      openSessions:
        importedOpenSessions.length
    },

    /*
     * Merge is blocked if it would result
     * in multiple open sessions.
     */
    canMerge:
      mergeOpenSessionIds.size <= 1,

    /*
     * Replace is blocked if the backup itself
     * contains multiple open sessions.
     */
    canReplace:
      importedOpenSessions.length <= 1
  };
}

// ------------------------------
// Compare two sessions
// ------------------------------

function sessionsAreEqual(
  sessionA,
  sessionB
) {
  return (
    sessionA.id === sessionB.id &&

    normalizeDate(
      sessionA.clockIn
    ) ===
      normalizeDate(
        sessionB.clockIn
      ) &&

    normalizeNullableDate(
      sessionA.clockOut
    ) ===
      normalizeNullableDate(
        sessionB.clockOut
      ) &&

    (sessionA.notes ?? "").trim() ===
      (sessionB.notes ?? "").trim()
  );
}

// ------------------------------
// Date helpers
// ------------------------------

function normalizeDate(value) {
  if (!isValidDate(value)) {
    return null;
  }

  return new Date(
    value
  ).toISOString();
}

function normalizeNullableDate(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  return normalizeDate(value);
}

function normalizeOptionalDate(
  value,
  fallbackValue
) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return {
      valid: Boolean(
        fallbackValue
      ),

      value:
        fallbackValue
    };
  }

  const normalizedValue =
    normalizeDate(value);

  return {
    valid:
      normalizedValue !== null,

    value:
      normalizedValue ??
      fallbackValue
  };
}

function isValidDate(value) {
  if (
    typeof value !== "string" &&
    !(value instanceof Date)
  ) {
    return false;
  }

  const date = new Date(value);

  return !Number.isNaN(
    date.getTime()
  );
}