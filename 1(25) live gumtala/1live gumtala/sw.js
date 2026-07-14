/* ============================================================================
   sw.js — the site's service worker.
   ============================================================================
   This exists for exactly one reason: Chrome/Android will only offer the
   automatic "Install app" prompt (and the install icon in the address bar)
   if the page is controlled by a registered service worker that has a
   `fetch` event listener. Without this file, manifest.json + the icons
   alone are NOT enough on Chrome (Safari/iOS doesn't need this at all —
   see the Add to Home Screen meta tags in each page's <head> instead).

   DELIBERATELY NOT a full offline-first cache. Every page here shows live
   data — the news feed, In Memoriam, the notification bell, the
   moderation queues — straight from Firestore. Aggressively caching pages
   would risk a moderator staring at a stale approval queue, or a visitor
   seeing yesterday's news and thinking that's current. So this only does
   the minimum needed for installability, plus one small, safe fallback:
   if you're fully offline and open the app, you get a cached copy of
   index.html (last seen while online) instead of the browser's default
   "no internet" error page. Nothing else is cached.
   ============================================================================ */
'use strict';

var SHELL_CACHE = 'gumtala-shell-v1';
var OFFLINE_URL = 'index.html';

self.addEventListener('install', function (event) {
  self.skipWaiting();
  event.waitUntil(
    caches.open(SHELL_CACHE).then(function (cache) {
      // Best-effort — if this single fetch fails (e.g. build/deploy
      // hiccup), installation should still succeed rather than block.
      return cache.add(OFFLINE_URL).catch(function () {});
    })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (key) { return key !== SHELL_CACHE; })
          .map(function (key) { return caches.delete(key); })
      );
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  var request = event.request;

  // Only ever handle same-origin page navigations. Everything else
  // (Firestore/Firebase Auth calls, the gstatic SDK scripts, images,
  // API calls) goes straight to the network untouched — this service
  // worker never intercepts or caches those.
  if (request.mode !== 'navigate') return;

  event.respondWith(
    fetch(request).catch(function () {
      // Offline and no cached page for this exact URL — fall back to
      // the last-seen shell instead of a browser error page.
      return caches.match(OFFLINE_URL).then(function (cached) {
        return cached || Response.error();
      });
    })
  );
});
