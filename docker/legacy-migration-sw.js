/* Deactivate the previous installed-app redirect without touching saved data.
 * Served at its original worker URL so existing installations can remove it.
 * No redirect, client navigation, storage deletion or network request.
 */
self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => event.waitUntil((async () => {
  await self.clients.claim();
  await self.registration.unregister();
})()));
