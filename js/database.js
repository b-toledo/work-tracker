const DATABASE_NAME = "work-tracker-database";
const DATABASE_VERSION = 1;
const SESSION_STORE = "sessions";

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(
      DATABASE_NAME,
      DATABASE_VERSION
    );

    request.addEventListener("upgradeneeded", () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(SESSION_STORE)) {
        const sessionStore = database.createObjectStore(
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
    });

    request.addEventListener("success", () => {
      resolve(request.result);
    });

    request.addEventListener("error", () => {
      reject(request.error);
    });
  });
}

export async function saveSession(session) {
  const database = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(
      SESSION_STORE,
      "readwrite"
    );

    const sessionStore = transaction.objectStore(
      SESSION_STORE
    );

    sessionStore.put(session);

    transaction.addEventListener("complete", () => {
      database.close();
      resolve();
    });

    transaction.addEventListener("error", () => {
      database.close();
      reject(transaction.error);
    });
  });
}

export async function getAllSessions() {
  const database = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(
      SESSION_STORE,
      "readonly"
    );

    const sessionStore = transaction.objectStore(
      SESSION_STORE
    );

    const request = sessionStore.getAll();

    request.addEventListener("success", () => {
      const sessions = request.result.sort(
        (sessionA, sessionB) => {
          return (
            new Date(sessionB.clockIn) -
            new Date(sessionA.clockIn)
          );
        }
      );

      resolve(sessions);
    });

    request.addEventListener("error", () => {
      reject(request.error);
    });

    transaction.addEventListener("complete", () => {
      database.close();
    });
  });
}