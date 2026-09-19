const DATABASE_NAME =
  "work-tracker-database";

const DATABASE_VERSION = 2;

const SESSION_STORE = "sessions";
const SNAPSHOT_STORE = "snapshots";

// ------------------------------
// Open database
// ------------------------------

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(
      DATABASE_NAME,
      DATABASE_VERSION
    );

    request.addEventListener(
      "upgradeneeded",
      () => {
        const database = request.result;

        if (
          !database.objectStoreNames.contains(
            SESSION_STORE
          )
        ) {
          const sessionStore =
            database.createObjectStore(
              SESSION_STORE,
              {
                keyPath: "id"
              }
            );

          sessionStore.createIndex(
            "clockIn",
            "clockIn",
            {
              unique: false
            }
          );
        }

        if (
          !database.objectStoreNames.contains(
            SNAPSHOT_STORE
          )
        ) {
          const snapshotStore =
            database.createObjectStore(
              SNAPSHOT_STORE,
              {
                keyPath: "id"
              }
            );

          snapshotStore.createIndex(
            "createdAt",
            "createdAt",
            {
              unique: false
            }
          );
        }
      }
    );

    request.addEventListener(
      "success",
      () => {
        resolve(request.result);
      }
    );

    request.addEventListener(
      "error",
      () => {
        reject(request.error);
      }
    );

    request.addEventListener(
      "blocked",
      () => {
        reject(
          new Error(
            "The database update was blocked. " +
            "Close other tabs running the app."
          )
        );
      }
    );
  });
}

// ------------------------------
// Save or update one session
// ------------------------------

export async function saveSession(session) {
  const database = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(
      SESSION_STORE,
      "readwrite"
    );

    const sessionStore =
      transaction.objectStore(
        SESSION_STORE
      );

    sessionStore.put(session);

    transaction.addEventListener(
      "complete",
      () => {
        database.close();
        resolve();
      }
    );

    transaction.addEventListener(
      "error",
      () => {
        database.close();
        reject(transaction.error);
      }
    );

    transaction.addEventListener(
      "abort",
      () => {
        database.close();

        reject(
          transaction.error ??
          new Error(
            "The save transaction was aborted."
          )
        );
      }
    );
  });
}

// ------------------------------
// Save or update multiple sessions
// ------------------------------

export async function saveSessions(
  sessions
) {
  const database = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(
      SESSION_STORE,
      "readwrite"
    );

    const sessionStore =
      transaction.objectStore(
        SESSION_STORE
      );

    sessions.forEach((session) => {
      sessionStore.put(session);
    });

    transaction.addEventListener(
      "complete",
      () => {
        database.close();

        resolve({
          saved: sessions.length
        });
      }
    );

    transaction.addEventListener(
      "error",
      () => {
        database.close();
        reject(transaction.error);
      }
    );

    transaction.addEventListener(
      "abort",
      () => {
        database.close();

        reject(
          transaction.error ??
          new Error(
            "The bulk save transaction was aborted."
          )
        );
      }
    );
  });
}

// ------------------------------
// Replace all sessions
// ------------------------------

export async function replaceAllSessions(
  sessions
) {
  const database = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(
      SESSION_STORE,
      "readwrite"
    );

    const sessionStore =
      transaction.objectStore(
        SESSION_STORE
      );

    /*
     * clear() and all put() operations belong to
     * the same transaction. If any operation fails,
     * the complete transaction is rolled back.
     */
    sessionStore.clear();

    sessions.forEach((session) => {
      sessionStore.put(session);
    });

    transaction.addEventListener(
      "complete",
      () => {
        database.close();

        resolve({
          saved: sessions.length
        });
      }
    );

    transaction.addEventListener(
      "error",
      () => {
        database.close();
        reject(transaction.error);
      }
    );

    transaction.addEventListener(
      "abort",
      () => {
        database.close();

        reject(
          transaction.error ??
          new Error(
            "The replacement transaction was aborted."
          )
        );
      }
    );
  });
}

// ------------------------------
// Retrieve all sessions
// ------------------------------

export async function getAllSessions() {
  const database = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(
      SESSION_STORE,
      "readonly"
    );

    const sessionStore =
      transaction.objectStore(
        SESSION_STORE
      );

    const request =
      sessionStore.getAll();

    request.addEventListener(
      "success",
      () => {
        const sessions = request.result.sort(
          (sessionA, sessionB) => {
            return (
              new Date(sessionB.clockIn) -
              new Date(sessionA.clockIn)
            );
          }
        );

        resolve(sessions);
      }
    );

    request.addEventListener(
      "error",
      () => {
        reject(request.error);
      }
    );

    transaction.addEventListener(
      "complete",
      () => {
        database.close();
      }
    );
  });
}

// ------------------------------
// Delete one session
// ------------------------------

export async function deleteSession(
  sessionId
) {
  const database = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(
      SESSION_STORE,
      "readwrite"
    );

    const sessionStore =
      transaction.objectStore(
        SESSION_STORE
      );

    sessionStore.delete(sessionId);

    transaction.addEventListener(
      "complete",
      () => {
        database.close();
        resolve();
      }
    );

    transaction.addEventListener(
      "error",
      () => {
        database.close();
        reject(transaction.error);
      }
    );

    transaction.addEventListener(
      "abort",
      () => {
        database.close();

        reject(
          transaction.error ??
          new Error(
            "The delete transaction was aborted."
          )
        );
      }
    );
  });
}

// ------------------------------
// Create automatic safety snapshot
// ------------------------------

export async function createSafetySnapshot(
  sessions
) {
  const database = await openDatabase();

  const now = new Date();

  now.setMilliseconds(0);

  const snapshot = {
    id: crypto.randomUUID(),
    createdAt: now.toISOString(),
    reason: "before-import",
    recordCount: sessions.length,
    sessions
  };

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(
      SNAPSHOT_STORE,
      "readwrite"
    );

    const snapshotStore =
      transaction.objectStore(
        SNAPSHOT_STORE
      );

    /*
     * Only the most recent automatic snapshot is
     * retained. This snapshot can undo the last import.
     */
    snapshotStore.clear();
    snapshotStore.put(snapshot);

    transaction.addEventListener(
      "complete",
      () => {
        database.close();
        resolve(snapshot);
      }
    );

    transaction.addEventListener(
      "error",
      () => {
        database.close();
        reject(transaction.error);
      }
    );

    transaction.addEventListener(
      "abort",
      () => {
        database.close();

        reject(
          transaction.error ??
          new Error(
            "The safety snapshot could not be created."
          )
        );
      }
    );
  });
}

// ------------------------------
// Retrieve latest safety snapshot
// ------------------------------

export async function getLatestSnapshot() {
  const database = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(
      SNAPSHOT_STORE,
      "readonly"
    );

    const snapshotStore =
      transaction.objectStore(
        SNAPSHOT_STORE
      );

    const request =
      snapshotStore.getAll();

    request.addEventListener(
      "success",
      () => {
        const snapshots =
          request.result.sort(
            (snapshotA, snapshotB) => {
              return (
                new Date(
                  snapshotB.createdAt
                ) -
                new Date(
                  snapshotA.createdAt
                )
              );
            }
          );

        resolve(
          snapshots[0] ?? null
        );
      }
    );

    request.addEventListener(
      "error",
      () => {
        reject(request.error);
      }
    );

    transaction.addEventListener(
      "complete",
      () => {
        database.close();
      }
    );
  });
}

// ------------------------------
// Restore latest safety snapshot
// ------------------------------

export async function restoreLatestSnapshot() {
  const snapshot =
    await getLatestSnapshot();

  if (!snapshot) {
    throw new Error(
      "No safety snapshot is available."
    );
  }

  await replaceAllSessions(
    snapshot.sessions
  );

  return snapshot;
}