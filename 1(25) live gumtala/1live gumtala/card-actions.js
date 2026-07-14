/* ============================================================================
   card-actions.js — shared ❤️ Like / 🤲 Condolences + Share buttons for any
   "card" on the site.
   ============================================================================
   Included on every page with cards:
     <script src="card-actions.js"></script>
   (after the three Firebase compat SDK <script> tags, same placement rule
   as notifications.js — this file carries its own Firebase config and
   bootstraps the app itself if no page has done so yet, so it works
   standalone even on a page with no other Firebase usage at all, e.g.
   landmarks.html.)

   HOW TO MARK UP A CARD
   ----------------------
   Add data-card-id to any card element you want this to work on:

     <div class="card" data-card-id="landmark-old-well">...</div>

   That's the ONLY thing required — this script finds every element with a
   data-card-id on the page, appends a small action bar to the end of it,
   and wires it up. No JavaScript editing needed to add more cards later —
   the id just needs to be unique and, once used, never renamed (renaming
   it makes it look like a brand-new card with 0 reactions, since the id
   IS the database key).

   For a memorial/death-announcement card, add data-card-type="condolence"
   too, to swap ❤️ Like → 🤲 Condolences (same underlying mechanism, just
   different icon/wording — deliberately never a literal "like" count on
   a death announcement).

   For content built by JavaScript rather than hand-written HTML (news.html,
   in-memoriam.html, food-point.html, the homepage's memorial banner) —
   call window.CardActions.rescan() right after rendering new cards into
   the DOM, since this script's own automatic scan only runs once, on
   page load, before that content exists yet.

   DATA MODEL
   ----------
   cardLikes/{cardId}/likedBy/{uid}   one doc per person who reacted to
                                      that card. Fields: createdAt. Its
                                      mere existence IS the reaction —
                                      there is no separate counter field
                                      anywhere; the count shown is a live
                                      Firestore count() aggregation query
                                      over this subcollection, so it can
                                      never drift out of sync with reality
                                      (nothing to increment/decrement
                                      badly, no race between two people
                                      reacting at once). See
                                      firestore.rules for why this is safe
                                      to read publicly (anyone, signed in
                                      or not, can see "24 people liked
                                      this") while still only ever being
                                      writable by the signed-in person
                                      it's about.
   ============================================================================ */
(function () {
  'use strict';

  var CARD_FIREBASE_CONFIG = {
    apiKey: "AIzaSyA3gXYIGxSMzKYyY-TpK1i05jDjaHJ8km8",
  authDomain: "gumtala-skg.firebaseapp.com",
  projectId: "gumtala-skg",
  storageBucket: "gumtala-skg.firebasestorage.app",
  messagingSenderId: "1065356501378",
  appId: "1:1065356501378:web:ec59829f02efffbc80af9b"
  };

  // Fail quietly on any page where the SDK didn't load — same reasoning
  // as notifications.js.
  if (!window.firebase || !window.firebase.firestore) return;
  if (!window.firebase.apps.length) window.firebase.initializeApp(CARD_FIREBASE_CONFIG);
  var cardAuth = window.firebase.auth();
  var cardDb = window.firebase.firestore();

  var currentUser = null;
  cardAuth.onAuthStateChanged(function (user) { currentUser = user; });

  function toast(message, type) {
    if (window.showToast) { window.showToast(message, type); }
    else { window.alert(message); }
  }

  // ---------------------------------------------------------------------
  // CSS — injected once, same convention as notifications.js, so no
  // page's own <style> block needs editing.
  // ---------------------------------------------------------------------
  var style = document.createElement('style');
  style.textContent = [
    '.card-actions-bar{display:flex; align-items:center; gap:16px; margin-top:10px; padding-top:10px; border-top:1px solid var(--line,#2A3A57);}',
    '.card-react-btn, .card-share-btn{display:inline-flex; align-items:center; gap:6px; background:none; border:none; cursor:pointer; padding:4px 2px; font-size:0.85rem; color:var(--muted,#A9B4C4); font-family:"Work Sans",sans-serif;}',
    '.card-react-btn .card-react-icon{font-size:1rem; line-height:1; filter:grayscale(1); opacity:0.65; transition:filter .15s ease, opacity .15s ease, transform .15s ease; display:inline-block;}',
    '.card-react-btn.reacted .card-react-icon{filter:none; opacity:1; transform:scale(1.15);}',
    '.card-react-btn:hover .card-react-icon{transform:scale(1.15);}',
    '.card-share-btn:hover{color:var(--paper,#F6EEDC);}',
    '.card-share-btn svg{width:15px; height:15px;}',
    '.card-highlight{animation:cardHighlightPulse 1.8s ease;}',
    '@keyframes cardHighlightPulse{0%{box-shadow:0 0 0 3px var(--gold,#F2A93B);} 100%{box-shadow:0 0 0 0 rgba(0,0,0,0);}}'
  ].join('\n');
  document.head.appendChild(style);

  var SHARE_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.6" y1="10.6" x2="15.4" y2="6.4"/><line x1="8.6" y1="13.4" x2="15.4" y2="17.6"/></svg>';

  var REACTION_ICON = { like: '❤️', condolence: '🤲' };

  function countLabel(n, reactionType) {
    if (n === 0) return reactionType === 'condolence' ? 'Be the first to send condolences' : 'Be the first to like this';
    if (reactionType === 'condolence') return n + ' ' + (n === 1 ? 'person sent condolences' : 'people sent condolences');
    return n + ' ' + (n === 1 ? 'like' : 'likes');
  }

  function initCard(el) {
    try {
      initCardUnsafe(el);
    } catch (err) {
      // A failure on ONE card must never stop the rest of the page's
      // cards from getting their buttons — forEach below has no
      // built-in protection against that, so this try/catch is it.
      console.error('card-actions.js: failed to set up a card, skipping just this one.', el, err);
    }
  }

  function initCardUnsafe(el) {
    if (el.dataset.cardActionsReady) return;
    el.dataset.cardActionsReady = '1';

    var cardId = el.dataset.cardId;
    if (!cardId) {
      console.warn('card-actions.js: found a card with no data-card-id — skipping it.', el);
      return;
    }
    var reactionType = el.dataset.cardType === 'condolence' ? 'condolence' : 'like';

    var bar = document.createElement('div');
    bar.className = 'card-actions-bar';
    bar.innerHTML =
      '<button type="button" class="card-react-btn" aria-pressed="false">' +
        '<span class="card-react-icon">' + REACTION_ICON[reactionType] + '</span>' +
        '<span class="card-react-count">…</span>' +
      '</button>' +
      '<button type="button" class="card-share-btn">' + SHARE_SVG + '<span>Share</span></button>';
    // Several pages (news.html, food-point.html) put a "click anywhere
    // on this card opens a detail modal" listener directly on the card
    // element itself — stopping propagation here keeps a tap on Like/
    // Share from also triggering that.
    bar.addEventListener('click', function (e) { e.stopPropagation(); });
    el.appendChild(bar);

    var reactBtn = bar.querySelector('.card-react-btn');
    var countEl = bar.querySelector('.card-react-count');
    var shareBtn = bar.querySelector('.card-share-btn');

    var likedByCol = cardDb.collection('cardLikes').doc(cardId).collection('likedBy');
    var myReacted = false;

    function refreshCount() {
      // Plain query + snap.size rather than a count() aggregation query —
      // count() aggregation isn't available on every Firestore compat
      // SDK build, so this reads the (typically small) likedBy
      // subcollection directly instead, which works everywhere.
      likedByCol.get().then(function (snap) {
        countEl.textContent = countLabel(snap.size, reactionType);
      }).catch(function () {
        countEl.textContent = ''; // never block the card over a failed count
      });
    }
    refreshCount();

    function refreshMyState() {
      if (!currentUser) {
        myReacted = false;
        reactBtn.classList.remove('reacted');
        reactBtn.setAttribute('aria-pressed', 'false');
        return;
      }
      likedByCol.doc(currentUser.uid).get().then(function (doc) {
        myReacted = doc.exists;
        reactBtn.classList.toggle('reacted', myReacted);
        reactBtn.setAttribute('aria-pressed', String(myReacted));
      }).catch(function () { /* button just won't show as pressed */ });
    }
    cardAuth.onAuthStateChanged(refreshMyState);

    reactBtn.addEventListener('click', function () {
      if (!currentUser) {
        toast('Sign in to your account to react to posts.', 'info');
        return;
      }
      reactBtn.disabled = true;
      var myDoc = likedByCol.doc(currentUser.uid);
      var action = myReacted
        ? myDoc.delete()
        : myDoc.set({ createdAt: firebase.firestore.FieldValue.serverTimestamp() });
      action.then(function () {
        myReacted = !myReacted;
        reactBtn.classList.toggle('reacted', myReacted);
        reactBtn.setAttribute('aria-pressed', String(myReacted));
        refreshCount();
      }).catch(function (err) {
        toast('Could not update that — ' + err.message, 'error');
      }).then(function () {
        reactBtn.disabled = false;
      });
    });

    shareBtn.addEventListener('click', function () {
      var url = window.location.origin + window.location.pathname + '#' + cardId;
      var titleEl = el.querySelector('h3');
      var title = (titleEl && titleEl.textContent.trim()) || document.title;
      if (navigator.share) {
        navigator.share({ title: title, url: url }).catch(function () { /* user cancelled — not an error */ });
      } else if (navigator.clipboard) {
        navigator.clipboard.writeText(url).then(function () {
          toast('Link copied to clipboard.', 'success');
        }).catch(function () {
          toast(url, 'info');
        });
      } else {
        toast(url, 'info');
      }
    });
  }

  function scanCards() {
    document.querySelectorAll('[data-card-id]').forEach(initCard);
  }

  // If someone opens a shared link (page.html#some-card-id), scroll to
  // that card and briefly highlight it, same idea as the notification
  // bell's existing deep-link handling elsewhere on the site.
  function scrollToHashCard() {
    var hash = window.location.hash;
    if (!hash || hash.length < 2) return;
    var id = hash.slice(1);
    var el;
    try { el = document.querySelector('[data-card-id="' + CSS.escape(id) + '"]'); } catch (e) { return; }
    if (!el) return;
    setTimeout(function () {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('card-highlight');
      setTimeout(function () { el.classList.remove('card-highlight'); }, 1900);
    }, 300); // small delay so the page's own layout/scroll settles first
  }

  window.CardActions = {
    rescan: function () {
      scanCards();
      scrollToHashCard();
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { scanCards(); scrollToHashCard(); });
  } else {
    scanCards();
    scrollToHashCard();
  }
})();