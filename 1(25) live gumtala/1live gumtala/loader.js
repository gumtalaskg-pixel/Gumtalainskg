/* ============================================================================
   loader.js — fades out the full-page branded loading overlay.
   ============================================================================
   The overlay's HTML/CSS lives INLINE at the top of every page (a <style>
   block right after <head>, and a <div id="page-loader"> as the very first
   thing in <body>) — NOT injected by this file. That's deliberate: if the
   overlay were only added once this external script finishes loading and
   runs, the underlying page would already have painted first, defeating the
   whole point of a "covers everything on initial load" overlay. This file
   only handles taking it back OFF once the page is actually ready.

   "Ready" here means: the page's own HTML has finished loading, AND (on any
   page that uses Firebase) the first auth-state check has resolved — so the
   header's account-dependent bits (and the notification bell) don't visibly
   pop in after the overlay disappears. A safety timeout guarantees the
   overlay is removed regardless, in case Firestore/auth is slow, offline, or
   fails to load, so a real connection problem never leaves a visitor stuck
   staring at a loader forever.

   Include this AFTER the Firebase SDK <script> tags (if present on the
   page) and after notifications.js, so window.firebase is already set up
   the same way it is there.
   ============================================================================ */
(function () {
  'use strict';

  var LOADER_FIREBASE_CONFIG = {
    apiKey: "AIzaSyA3gXYIGxSMzKYyY-TpK1i05jDjaHJ8km8",
  authDomain: "gumtala-skg.firebaseapp.com",
  projectId: "gumtala-skg",
  storageBucket: "gumtala-skg.firebasestorage.app",
  messagingSenderId: "1065356501378",
  appId: "1:1065356501378:web:ec59829f02efffbc80af9b"
  };

  var SAFETY_TIMEOUT_MS = 4000; // never let a slow/offline Firestore call trap a visitor behind the overlay
  var FADE_DURATION_MS = 500;   // must match the CSS transition duration in the inline <style> block

  var domReady = false;
  var authReady = false;
  var hidden = false;

  function hideOverlay() {
    if (hidden) return;
    hidden = true;
    var el = document.getElementById('page-loader');
    if (!el) return;
    el.classList.add('page-loader-hide');
    setTimeout(function () {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, FADE_DURATION_MS);
  }

  function maybeHide() {
    if (domReady && authReady) hideOverlay();
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    domReady = true;
  } else {
    document.addEventListener('DOMContentLoaded', function () {
      domReady = true;
      maybeHide();
    });
  }

  // Safety net — fires regardless of what else happens.
  setTimeout(hideOverlay, SAFETY_TIMEOUT_MS);

  // Public pages with no Firebase usage at all (e.g. gallery.html,
  // landmarks.html) never get an auth callback, so don't wait on one.
  // (Note: this no longer `return`s early — the service worker
  // registration and install-button setup below need to run on every
  // page, not just ones that use Firebase.)
  if (!window.firebase || !window.firebase.auth) {
    authReady = true;
    maybeHide();
  } else {
    try {
      if (!window.firebase.apps.length) window.firebase.initializeApp(LOADER_FIREBASE_CONFIG);
      window.firebase.auth().onAuthStateChanged(function () {
        authReady = true;
        maybeHide();
      }, function () {
        // Auth itself errored out — don't block the page over it.
        authReady = true;
        maybeHide();
      });
    } catch (e) {
      authReady = true;
      maybeHide();
    }
  }

  maybeHide(); // covers the rare case where domReady was already true above

  // ---------------------------------------------------------------------
  // PWA install support. Piggybacking the service worker registration on
  // this file (rather than adding yet another <script src> to all 26
  // pages) since loader.js is already the last script on every one of
  // them. See sw.js for what it actually does (short version:
  // network-first, only enough for Chrome's install prompt — it does
  // NOT cache live data pages).
  // ---------------------------------------------------------------------
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () {
        // Fails quietly on file:// (local testing) or if sw.js 404s —
        // never block the page over install-prompt plumbing.
      });
    });
  }

  // ---------------------------------------------------------------------
  // Custom "Install App" button. Chrome's overflow-menu "Add to Home
  // screen" item now opens a two-option chooser (Install vs. Create
  // shortcut) — that's Chrome's own menu UI, not something a manifest or
  // service worker can turn off. Capturing beforeinstallprompt ourselves
  // and firing it from our own button skips that chooser entirely:
  // Chrome shows its plain, single-step "Install app?" dialog instead.
  // This never appears on iOS Safari (which doesn't fire this event at
  // all — installing there is still Share → Add to Home Screen) or once
  // the site is already installed.
  // ---------------------------------------------------------------------
  var deferredInstallPrompt = null;
  var installBtn = null;

  function isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  }

  function hideInstallButton() {
    if (installBtn && installBtn.parentNode) installBtn.parentNode.removeChild(installBtn);
    installBtn = null;
  }

  function showInstallButton() {
    if (installBtn || isStandalone()) return;
    installBtn = document.createElement('button');
    installBtn.id = 'pwa-install-btn';
    installBtn.type = 'button';
    installBtn.textContent = '⬇ Install App';
    installBtn.style.cssText =
      'position:fixed;right:16px;bottom:16px;z-index:9999;' +
      'padding:10px 18px;border:none;border-radius:999px;' +
      'background:#16233B;color:#fff;font-size:14px;font-weight:600;' +
      'font-family:inherit;box-shadow:0 4px 14px rgba(0,0,0,.25);cursor:pointer;';
    installBtn.addEventListener('click', function () {
      if (!deferredInstallPrompt) { hideInstallButton(); return; }
      installBtn.disabled = true;
      deferredInstallPrompt.prompt();
      deferredInstallPrompt.userChoice.finally(function () {
        deferredInstallPrompt = null;
        hideInstallButton();
      });
    });
    document.body.appendChild(installBtn);
  }

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault(); // stop Chrome's own mini-infobar; we show our own button instead
    deferredInstallPrompt = e;
    showInstallButton();
  });

  window.addEventListener('appinstalled', function () {
    deferredInstallPrompt = null;
    hideInstallButton();
  });
})();