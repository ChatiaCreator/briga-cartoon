// Service worker: every file of the game is checked with the server before the browser's cached
// copy is used (cache "no-cache": a quick "not modified" answer when nothing changed), so a new
// version shows up on the next load instead of after the host's 10-minute cache (no Ctrl+F5).
// Nothing is stored here; files from other sites (PeerJS server, fonts) are left alone.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  // A navigation request can't be copied with new options: fetch its URL instead.
  const fresh = req.mode === 'navigate'
    ? fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' })
    : fetch(req, { cache: 'no-cache' });
  e.respondWith(fresh.catch(() => fetch(req)));
});
