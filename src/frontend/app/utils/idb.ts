/**
 * IndexedDB helpers for sharing data with the service worker.
 *
 * The service worker is a classic script and cannot import ES modules, so it
 * contains its own equivalent implementation. Keep the schema (DB name, version,
 * store names, and key shapes) in sync with the inline IDB code in pwa-worker.js.
 *
 * DB: "enmarcha-sw", version 1
 *   Store "favorites"   — { key: string, ids: string[] }
 *   Store "alertState"  — { alertId: string, silenced: boolean, lastVersion: number }
 */

const DB_NAME = "enmarcha-sw";
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("favorites")) {
        db.createObjectStore("favorites", { keyPath: "key" });
      }
      if (!db.objectStoreNames.contains("alertState")) {
        db.createObjectStore("alertState", { keyPath: "alertId" });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Persist a favourites list to IndexedDB so the service worker can read it. */
export async function writeFavorites(
  key: string,
  ids: string[]
): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("favorites", "readwrite");
    tx.objectStore("favorites").put({ key, ids });
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}

/** Read a favourites list from IndexedDB. */
export async function readFavorites(key: string): Promise<string[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("favorites", "readonly");
    const req = tx.objectStore("favorites").get(key);
    req.onsuccess = () => {
      db.close();
      resolve(
        (req.result as { key: string; ids: string[] } | undefined)?.ids ?? []
      );
    };
    req.onerror = () => reject(req.error);
  });
}

/** Persist per-alert notification state (silenced flag and last notified version). */
export async function writeAlertState(
  alertId: string,
  state: { silenced: boolean; lastVersion: number }
): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("alertState", "readwrite");
    tx.objectStore("alertState").put({ alertId, ...state });
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}
