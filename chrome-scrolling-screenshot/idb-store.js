// Shared between background.js (service worker) and stitch.js (extension
// page) to hand off captured screenshot slices. IndexedDB is used instead
// of chrome.storage.session because a tall page's full-resolution PNG
// slices can easily exceed session storage's ~10MB quota.

const PC_DB_NAME = 'page-capture-db';
const PC_STORE_NAME = 'captures';
const PC_DB_VERSION = 1;
const PC_KEY = 'latest';

function pcOpenDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(PC_DB_NAME, PC_DB_VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(PC_STORE_NAME);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function pcSaveCapture(data) {
  const db = await pcOpenDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PC_STORE_NAME, 'readwrite');
    tx.objectStore(PC_STORE_NAME).put(data, PC_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function pcLoadCapture() {
  const db = await pcOpenDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PC_STORE_NAME, 'readonly');
    const req = tx.objectStore(PC_STORE_NAME).get(PC_KEY);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
