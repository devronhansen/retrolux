// Galerie-Speicher in IndexedDB (Blobs bleiben lokal auf dem Gerät).
(function () {
  const DB = 'retrolux', STORE = 'shots';
  let dbp;

  function open() {
    if (!dbp) {
      dbp = new Promise((resolve, reject) => {
        const req = indexedDB.open(DB, 1);
        req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }
    return dbp;
  }

  async function tx(mode, fn) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const t = db.transaction(STORE, mode);
      const result = fn(t.objectStore(STORE));
      t.oncomplete = () => resolve(result && 'result' in result ? result.result : result);
      t.onerror = () => reject(t.error);
    });
  }

  const Store = {
    add: (shot) => tx('readwrite', (s) => s.put(shot)),
    remove: (id) => tx('readwrite', (s) => s.delete(id)),
    async all() {
      const list = await tx('readonly', (s) => s.getAll());
      return list.sort((a, b) => b.created - a.created);
    },
  };

  window.Store = Store;
})();
