/* ============================================================================
   notifications.js — the site-wide notification bell.
   ============================================================================
   Included on every page with a single tag:
     <script src="notifications.js"></script>
   (after the three Firebase compat SDK <script> tags — see any page that
   already uses Firebase, e.g. account.html, for that boilerplate. Pages
   that don't otherwise use Firebase need those three SDK tags added too;
   this file checks for them and quietly does nothing if they're missing,
   so it never breaks a page.)

   WHAT THE BELL SHOWS — three independent things, combined into one badge
   count, because there is deliberately only ONE bell for the whole site:

     1. PERSONAL notifications — actual documents in the `notifications`
        collection (see firestore.rules), written by a moderator/admin at
        the moment they approve/reject something or correct someone
        else's memorial info. Only the recipient can read their own.
        These are the only ones a person can "mark read".

     2. REVIEW QUEUE size — for a signed-in moderator/admin only. NOT
        stored anywhere; it's a live count of how many news/memorial
        submissions (and, for admins, page-suggestions/contact messages/
        pending accounts) are currently waiting for a decision. This
        can't go stale or get "missed" the way a stored notification
        could, because it's just the true current state of those
        collections, always.

     3. PUBLIC "what's new" count — for literally anyone, signed in or
        not. How many news posts / In Memoriam announcements have been
        published since this browser last opened the bell. Tracked in
        localStorage (not Firestore — there's no per-visitor account to
        attach it to for a signed-out person), so it does NOT sync across
        devices, unlike #1.

   Where the bell physically sits: inside each page's `.header-actions`
   container, right before the "member-pill" account icon. That
   container is a sibling of `.nav-links` (not nested inside it), living
   in a shared `.nav-and-actions` wrapper alongside the mobile hamburger
   button — this is what keeps the bell and account icon visible and
   tappable on mobile even while `.nav-links` itself is collapsed behind
   the hamburger. (Earlier versions of this file mounted the bell inside
   `.nav-links`, which meant it was hidden behind the hamburger on
   mobile — that's been fixed by moving both the bell's mount point and
   the account icon out into `.header-actions`.)
   ============================================================================ */
(function () {
  'use strict';

  var NOTIF_FIREBASE_CONFIG = {
    apiKey: "AIzaSyA3gXYIGxSMzKYyY-TpK1i05jDjaHJ8km8",
  authDomain: "gumtala-skg.firebaseapp.com",
  projectId: "gumtala-skg",
  storageBucket: "gumtala-skg.firebasestorage.app",
  messagingSenderId: "1065356501378",
  appId: "1:1065356501378:web:ec59829f02efffbc80af9b"
  };

  // Fail quietly on any page where the SDK didn't load (or hasn't
  // loaded YET — script tags execute in order, so as long as this tag
  // comes after the three firebase-*-compat.js tags, window.firebase
  // will already be populated by the time this line runs).
  if (!window.firebase || !window.firebase.firestore) return;
  if (!window.firebase.apps.length) window.firebase.initializeApp(NOTIF_FIREBASE_CONFIG);
  var notifAuth = window.firebase.auth();
  var notifDb = window.firebase.firestore();

  var PUBLIC_LAST_SEEN_KEY = 'gumtala_notif_public_last_seen';
  // Separate from PUBLIC_LAST_SEEN_KEY: that one drives the bell's
  // unread count/list (cleared when the bell is opened). This one
  // tracks which specific item IDs have already been shown as a toast
  // on this browser, so a toast fires exactly once per item, ever —
  // independent of whether the bell has been opened — instead of
  // re-appearing on every page navigation while still "unread".
  var PUBLIC_TOASTED_KEY = 'gumtala_notif_public_toasted_ids';

  // ---------------------------------------------------------------------
  // CSS — injected once, so no page's own <style> block needs editing.
  // ---------------------------------------------------------------------
  var style = document.createElement('style');
  style.textContent = [
    '.notif-bell-item{position:relative;}',
    '.notif-bell{position:relative; background:none; border:none; cursor:pointer; padding:6px; color:var(--muted,#A9B4C4); display:inline-flex; align-items:center; justify-content:center;}',
    '.notif-bell:hover{color:var(--paper,#F6EEDC);}',
    '.notif-bell svg{width:20px; height:20px;}',
    '.notif-badge{position:absolute; top:0; right:0; min-width:16px; height:16px; padding:0 4px; border-radius:8px; background:var(--coral,#E1613D); color:#fff; font-size:0.65rem; font-weight:700; line-height:16px; text-align:center; font-family:"Work Sans",sans-serif;}',
    '.notif-dropdown{position:absolute; top:calc(100% + 10px); right:0; width:320px; max-width:88vw; max-height:420px; overflow-y:auto; background:var(--night-2,#1E2C46); border:1px solid var(--line,#2A3A57); border-radius:10px; box-shadow:0 12px 28px rgba(0,0,0,0.28); z-index:70;}',
    '.notif-dropdown-header{padding:12px 14px; font-family:"Bricolage Grotesque",sans-serif; font-weight:700; color:var(--paper,#F6EEDC); border-bottom:1px solid var(--line,#2A3A57); font-size:0.95rem;}',
    '.notif-list{display:flex; flex-direction:column;}',
    '.notif-item{display:block; padding:11px 14px; text-decoration:none; border-bottom:1px solid var(--line,#2A3A57); color:var(--muted,#A9B4C4);}',
    '.notif-item:hover{background:var(--night-3,rgba(255,255,255,0.04));}',
    '.notif-item-unread{background:rgba(242,169,59,0.08);}',
    '.notif-item-title{font-size:0.86rem; font-weight:600; color:var(--paper,#F6EEDC); margin-bottom:2px;}',
    '.notif-item-message{font-size:0.8rem; margin-bottom:4px;}',
    '.notif-row2, .notif-row1-wrap{display:flex; align-items:baseline; gap:5px; font-size:0.8rem; margin-top:1px;}',
    '.notif-row1-wrap{font-weight:600; color:var(--paper,#F6EEDC);}',
    '.notif-row2-prefix{flex-shrink:0; opacity:0.85;}',
    '.notif-row2-main{flex:1 1 auto; min-width:0; overflow:hidden; white-space:nowrap; text-overflow:ellipsis;}',
    '.notif-row2-time{flex-shrink:0; font-size:0.7rem; opacity:0.65;}',
    '.notif-item-time{font-size:0.7rem; opacity:0.7;}',
    '.notif-empty{padding:22px 14px; text-align:center; font-size:0.85rem; color:var(--muted,#A9B4C4);}',
    '.notif-queue-summary{padding:10px 14px; border-top:1px solid var(--line,#2A3A57);}',
    '.notif-queue-summary a{color:var(--gold,#F2A93B); font-size:0.82rem; font-weight:600; text-decoration:none;}',
    '.notif-queue-summary a:hover{text-decoration:underline;}',
    '@media (max-width:820px){ .notif-dropdown{position:fixed; top:76px; left:12px; right:12px; width:auto; max-width:none;} }',
    '.member-pill-initials{font-size:13px; font-weight:700; line-height:1; user-select:none; letter-spacing:0.02em;}',
    /* Public "news published" / "death published" rows and toasts — text
       WRAPS instead of truncating with an ellipsis, so the full title/
       name and detail are always readable, never cut off. */
    '.notif-public-row1{font-family:"Work Sans",sans-serif; font-weight:700; font-size:0.86rem; color:var(--paper,#F6EEDC); white-space:normal; word-break:break-word; margin-bottom:3px; line-height:1.3;}',
    '.notif-public-row2{font-size:0.8rem; color:var(--muted,#A9B4C4); white-space:normal; word-break:break-word; line-height:1.3;}',
    '.notif-public-row2 .notif-row2-time{margin-left:5px; opacity:0.65; font-size:0.7rem; white-space:nowrap;}',
    '.gv-toast-container{position:fixed; top:16px; right:16px; z-index:9999; display:flex; flex-direction:column; gap:10px; width:320px; max-width:90vw;}',
    '.gv-toast{display:block; background:var(--night-2,#1E2C46); border:1px solid var(--line,#2A3A57); border-radius:10px; padding:13px 15px; box-shadow:0 10px 24px rgba(0,0,0,0.32); cursor:pointer; text-decoration:none; animation:gv-toast-in 0.25s ease; transition:opacity 0.3s, transform 0.3s;}',
    '.gv-toast:hover{border-color:var(--gold,#F2A93B);}',
    '@keyframes gv-toast-in{from{opacity:0; transform:translateY(-10px);} to{opacity:1; transform:translateY(0);}}',
    '@media (max-width:640px){ .gv-toast-container{top:auto; bottom:12px; right:12px; left:12px; width:auto;} }'
  ].join('\n');
  document.head.appendChild(style);

  // ---------------------------------------------------------------------
  // Mount the bell into .nav-links, right before the member-pill <li>
  // (or appended at the end if there isn't one on this page).
  // ---------------------------------------------------------------------
  var BELL_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"></path>' +
    '<path d="M13.73 21a2 2 0 0 1-3.46 0"></path>' +
    '</svg>';

  function mountBell() {
    // Mounted into .header-actions (a sibling of .nav-links, not a
    // descendant of it) — this is what keeps the bell visible on
    // mobile even while .nav-links is collapsed behind the hamburger.
    // See the header markup comment on any page for the full picture.
    var actions = document.querySelector('.header-actions');
    if (!actions) return null;
    var wrap = document.createElement('div');
    wrap.className = 'notif-bell-item';
    wrap.innerHTML =
      '<button type="button" class="notif-bell" id="notif-bell-btn" aria-label="Notifications" aria-haspopup="true" aria-expanded="false">' +
        BELL_SVG +
        '<span class="notif-badge" id="notif-badge" style="display:none;">0</span>' +
      '</button>' +
      '<div class="notif-dropdown" id="notif-dropdown" style="display:none;">' +
        '<div class="notif-dropdown-header">Notifications</div>' +
        '<div id="notif-list" class="notif-list"><div class="notif-empty">Nothing yet.</div></div>' +
        '<div id="notif-queue-summary" class="notif-queue-summary" style="display:none;"></div>' +
      '</div>';
    var memberPillEl = actions.querySelector('.member-pill');
    if (memberPillEl) {
      actions.insertBefore(wrap, memberPillEl);
    } else {
      actions.appendChild(wrap);
    }
    return wrap;
  }

  var bellLi = mountBell();
  if (!bellLi) return; // this page has no .header-actions at all — nothing to attach to

  var bellBtn = document.getElementById('notif-bell-btn');
  var badgeEl = document.getElementById('notif-badge');
  var dropdownEl = document.getElementById('notif-dropdown');
  var listEl = document.getElementById('notif-list');
  var queueSummaryEl = document.getElementById('notif-queue-summary');

  // ---------------------------------------------------------------------
  // The account icon (the gold circle right after the bell, class
  // "member-pill" — name's left over from when it was a "sign up" pill;
  // it now always links to account.html). Signed out, it's the plain
  // person-outline icon it always was. Signed in, it becomes a small
  // initials avatar instead, so at a glance it's obviously "you" rather
  // than a generic account icon.
  // ---------------------------------------------------------------------
  var ACCOUNT_PERSON_ICON =
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<circle cx="12" cy="8" r="4"/>' +
      '<path d="M4 20c0-4.4 3.6-8 8-8s8 3.6 8 8"/>' +
    '</svg>';
  var accountIconEl = document.querySelector('.header-actions .member-pill');

  function initialsFor(profile, user) {
    var name = (profile && profile.name) ? String(profile.name).trim() : '';
    if (name) {
      var parts = name.split(/\s+/).filter(Boolean);
      if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
      return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
    }
    // No name on the profile (or no profile at all yet) — fall back to
    // the first letter of their email rather than showing nothing.
    var email = (user && user.email) ? user.email : '';
    return email ? email.charAt(0).toUpperCase() : '?';
  }

  function setAccountIconSignedOut() {
    if (!accountIconEl) return;
    accountIconEl.innerHTML = ACCOUNT_PERSON_ICON;
    accountIconEl.setAttribute('aria-label', 'Account');
    accountIconEl.setAttribute('title', 'Account');
  }

  function setAccountIconSignedIn(profile, user) {
    if (!accountIconEl) return;
    var initials = initialsFor(profile, user);
    var label = (profile && profile.name) ? profile.name : (user.email || 'Account');
    accountIconEl.innerHTML = '<span class="member-pill-initials" aria-hidden="true">' + escapeHtml(initials) + '</span>';
    accountIconEl.setAttribute('aria-label', label + ' — Account');
    accountIconEl.setAttribute('title', label);
  }

  bellBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    var opening = dropdownEl.style.display !== 'block';
    dropdownEl.style.display = opening ? 'block' : 'none';
    bellBtn.setAttribute('aria-expanded', opening ? 'true' : 'false');
    if (opening) markEverythingSeen();
  });
  document.addEventListener('click', function () {
    dropdownEl.style.display = 'none';
    bellBtn.setAttribute('aria-expanded', 'false');
  });
  dropdownEl.addEventListener('click', function (e) { e.stopPropagation(); });

  // ---------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------
  var personalItems = [];   // this browser's signed-in user's own notification docs
  var personalUnread = 0;
  var publicUnread = 0;     // published news/memorials since PUBLIC_LAST_SEEN_KEY
  var rawPublicNews = [];       // display-ready news items since PUBLIC_LAST_SEEN_KEY (unfiltered by author)
  var rawPublicMemorials = [];  // same, for memorials
  var publicItems = [];         // rawPublicNews + rawPublicMemorials merged, newest first, author's own posts excluded
  var toastedIds = loadToastedIds(); // item IDs already shown as a toast on this browser
  var queueUnread = 0;      // live pending-review count, moderator/admin only
  var queueItems = [];      // the actual pending docs behind that count, newest first
  var currentUid = null;
  var currentRole = null;   // 'member' | 'moderator' | 'admin' | null (signed out)

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str == null ? '' : str;
    return div.innerHTML;
  }
  function loadToastedIds() {
    try {
      var raw = localStorage.getItem(PUBLIC_TOASTED_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) { return []; }
  }
  function saveToastedIds(ids) {
    var trimmed = ids.slice(-200); // cap so localStorage doesn't grow forever
    try { localStorage.setItem(PUBLIC_TOASTED_KEY, JSON.stringify(trimmed)); } catch (e) {}
    return trimmed;
  }
  function compactTime(ts) {
    var date = ts && ts.toDate ? ts.toDate() : (ts ? new Date(ts) : null);
    if (!date || isNaN(date.getTime())) return '';
    var diffMs = Date.now() - date.getTime();
    var mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'now';
    if (mins < 60) return mins + 'M';
    var hrs = Math.floor(mins / 60);
    if (hrs < 24) return hrs + 'H';
    var days = Math.floor(hrs / 24);
    if (days < 7) return days + 'D';
    var weeks = Math.floor(days / 7);
    if (weeks < 5) return weeks + 'W';
    var months = Math.floor(days / 30);
    if (months < 12) return months + 'Mo';
    return Math.floor(days / 365) + 'Y';
  }

  // ---- Toast popups (top-right, auto-dismiss) --------------------------
  var toastContainer = null;
  function ensureToastContainer() {
    if (toastContainer) return toastContainer;
    toastContainer = document.createElement('div');
    toastContainer.className = 'gv-toast-container';
    document.body.appendChild(toastContainer);
    return toastContainer;
  }
  function showToast(item) {
    var container = ensureToastContainer();
    var el = document.createElement('a');
    el.className = 'gv-toast';
    el.href = item.link;
    el.innerHTML =
      '<div class="notif-public-row1">' + escapeHtml(item.row1) + '</div>' +
      '<div class="notif-public-row2">' + escapeHtml(item.row2Main) +
        '<span class="notif-row2-time">' + compactTime(item.createdAt) + '</span></div>';
    container.appendChild(el);
    setTimeout(function () {
      el.style.opacity = '0';
      el.style.transform = 'translateY(-10px)';
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 300);
    }, 8000);
  }

  // ---- Building a display-ready item from a raw news/memorial doc ------
  // A short, word-boundary-safe excerpt for the news "little detail" row —
  // deliberately SHORT by design (per the brief), but never further cut
  // off by CSS once built (the CSS wraps instead of ellipsis-truncating).
  function excerpt(text, maxLen) {
    if (!text) return '';
    var trimmed = String(text).trim();
    if (trimmed.length <= maxLen) return trimmed;
    var cut = trimmed.slice(0, maxLen);
    var lastSpace = cut.lastIndexOf(' ');
    if (lastSpace > 40) cut = cut.slice(0, lastSpace);
    return cut + '\u2026';
  }
  function formatJanazaTimeShort(d) {
    if (d.janazaConfirmed && d.janazaTime) {
      var parts = d.janazaTime.split(':');
      var h = parseInt(parts[0], 10), m = parts[1];
      var suffix = h >= 12 ? 'PM' : 'AM';
      var h12 = h % 12; if (h12 === 0) h12 = 12;
      return h12 + ':' + m + ' ' + suffix;
    }
    return 'To be announced';
  }
  function buildPublicItem(type, id, d) {
    if (type === 'news') {
      return {
        type: 'news', id: id, authorId: d.authorId, createdAt: d.createdAt,
        row1: 'NEWS: ' + (d.title || 'Untitled'),
        row2Main: excerpt(d.body, 90),
        link: 'news.html?open=' + id
      };
    }
    var name = d.name || d.relationTag || 'A member of our community';
    return {
      type: 'memorial', id: id, authorId: d.authorId, createdAt: d.createdAt,
      row1: 'In Memoriam: ' + name + ' has been passed',
      row2Main: 'Janaza: ' + formatJanazaTimeShort(d),
      link: 'in-memoriam.html?open=' + id
    };
  }

  // A "row2" is the label/title/name on the left plus the compact time on
  // the right, forced onto one line: the left text truncates with an
  // ellipsis instead of wrapping, so the time never gets pushed off.
  function row2Html(prefix, mainText, ts) {
    return '<div class="notif-row2">' +
      (prefix ? '<span class="notif-row2-prefix">' + escapeHtml(prefix) + '</span>' : '') +
      '<span class="notif-row2-main">' + escapeHtml(mainText || '') + '</span>' +
      '<span class="notif-row2-time">' + compactTime(ts) + '</span>' +
      '</div>';
  }
  // A "row1" with just a label + truncating text and no time (used for the
  // moderator/admin queue's first line, e.g. "NEWS: <title>").
  function row1WrapHtml(prefix, mainText) {
    return '<div class="notif-row1-wrap">' +
      '<span class="notif-row2-prefix">' + escapeHtml(prefix) + '</span>' +
      '<span class="notif-row2-main">' + escapeHtml(mainText || '') + '</span>' +
      '</div>';
  }

  // ---- Personal notification formatting --------------------------------
  // `itemTitle` (news title / memorial name-or-relationTag) is written by
  // admin.html and moderate.html's sendNotification() calls alongside the
  // older full-sentence `title` field, specifically so this row2 has a
  // short string to show instead of a whole sentence.
  //
  // All `type` values below are now CONFIRMED against the real
  // sendNotification() call sites in admin.html and moderate.html.
  var PERSONAL_TYPE_CONFIG = {
    news_approved:            { row1: 'NEWS Update: Published', prefix: '' },
    news_rejected:            { row1: 'NEWS Update: Rejected',  prefix: '' },
    page_suggestion_approved: { row1: 'PAGE Update: Approved',  prefix: '' },
    page_suggestion_rejected: { row1: 'PAGE Update: Rejected',  prefix: '' },
    memorial_approved:        { row1: 'Death News: Published',  prefix: 'Of: ' },
    memorial_rejected:        { row1: 'Death News: Rejected',   prefix: 'Of: ' },
    memorial_janaza_edited:   { row1: 'Janaza Time: Updated',   prefix: 'Of: ' }
  };
  function formatPersonalItem(n) {
    var cfg = PERSONAL_TYPE_CONFIG[n.type];
    if (!cfg) {
      // account_approved/account_rejected (and any other unrecognized
      // type) fall back here: `title` is already a full readable
      // sentence, `message` gives the detail — no fixed Row1/Row2
      // format was specified for these.
      return '<div class="notif-item-title">' + escapeHtml(n.title || 'Notification') + '</div>' +
        row2Html('', n.message || '', n.createdAt);
    }
    return '<div class="notif-item-title">' + escapeHtml(cfg.row1) + '</div>' +
      row2Html(cfg.prefix, n.itemTitle || n.title, n.createdAt);
  }

  function updateBadge() {
    var total = personalUnread + publicUnread + queueUnread;
    if (total > 0) {
      badgeEl.textContent = total > 99 ? '99+' : String(total);
      badgeEl.style.display = 'inline-block';
    } else {
      badgeEl.style.display = 'none';
    }
    // App icon badge (Badging API) — only has any visible effect once the
    // site is installed as an app (see loader.js); a normal browser tab
    // ignores this harmlessly. Not supported on iOS Safari even when
    // installed — that's a platform limitation, nothing to fix here.
    if (navigator.setAppBadge) {
      if (total > 0) {
        navigator.setAppBadge(total).catch(function () {});
      } else if (navigator.clearAppBadge) {
        navigator.clearAppBadge().catch(function () {});
      }
    }
  }

  function renderList() {
    var html = '';
    publicItems.forEach(function (item) {
      html += '<a class="notif-item notif-item-unread" href="' + escapeHtml(item.link) + '">' +
        '<div class="notif-public-row1">' + escapeHtml(item.row1) + '</div>' +
        '<div class="notif-public-row2">' + escapeHtml(item.row2Main) +
          '<span class="notif-row2-time">' + compactTime(item.createdAt) + '</span></div>' +
        '</a>';
    });
    // Merge personal notifications and queue items into one list sorted
    // by time, newest first — so a moderator/admin sees their own
    // submission updates interleaved with their review duties, rather
    // than two separate stacked sections.
    var merged = [];
    personalItems.forEach(function (n) {
      merged.push({ kind: 'personal', data: n, ts: n.createdAt && n.createdAt.toMillis ? n.createdAt.toMillis() : 0 });
    });
    queueItems.forEach(function (q) {
      merged.push({ kind: 'queue', data: q, ts: q.createdAt && q.createdAt.toMillis ? q.createdAt.toMillis() : 0 });
    });
    merged.sort(function (a, b) { return b.ts - a.ts; });

    merged.forEach(function (entry) {
      if (entry.kind === 'personal') {
        var n = entry.data;
        html += '<a class="notif-item' + (n.read ? '' : ' notif-item-unread') + '" href="' + escapeHtml(n.link || '#') + '" data-id="' + n.id + '">' +
          formatPersonalItem(n) +
          '</a>';
      } else {
        var q = entry.data;
        html += '<a class="notif-item notif-item-unread" href="' + escapeHtml(q.link) + '">' +
          row1WrapHtml(q.row1Prefix, q.title) +
          row2Html('By: ', q.author, q.createdAt) +
          '</a>';
      }
    });
    listEl.innerHTML = html || '<div class="notif-empty">Nothing yet.</div>';

    listEl.querySelectorAll('.notif-item[data-id]').forEach(function (a) {
      a.addEventListener('click', function () {
        var id = a.dataset.id;
        notifDb.collection('notifications').doc(id).update({ read: true }).catch(function () {});
      });
    });

    if (queueUnread > 0) {
      queueSummaryEl.style.display = 'block';
      var queueLink = currentRole === 'admin' ? 'admin.html' : 'moderate.html';
      queueSummaryEl.innerHTML = '<a href="' + queueLink + '">' +
        queueUnread + ' item' + (queueUnread === 1 ? '' : 's') + ' waiting for review &rarr;</a>';
    } else {
      queueSummaryEl.style.display = 'none';
    }

    updateBadge();
  }

  // Opening the bell "clears" the two things that behave like an inbox
  // (personal notifications, the public what's-new count) — it does
  // NOT touch queueUnread, since that's a live reflection of real
  // pending work, not a dismissible notice; it only goes down when
  // someone actually approves/rejects those items elsewhere.
  function markEverythingSeen() {
    if (currentUid && personalItems.length) {
      var batch = notifDb.batch();
      var anyUnread = false;
      personalItems.forEach(function (n) {
        if (!n.read) {
          anyUnread = true;
          batch.update(notifDb.collection('notifications').doc(n.id), { read: true });
        }
      });
      if (anyUnread) batch.commit().catch(function () {});
    }
    personalUnread = 0;
    // Re-point the "since" watermark at right now AND reattach the
    // public watchers against it, rather than just zeroing the count —
    // the old watchers would otherwise still be querying against the
    // stale original timestamp, so the very next Firestore update of
    // any kind would recompute from that old threshold and bring back
    // items that were just marked seen.
    localStorage.setItem(PUBLIC_LAST_SEEN_KEY, String(Date.now()));
    attachPublicWatchers();
    renderList(); // re-render immediately; the onSnapshot listener will confirm shortly after
  }

  // ---------------------------------------------------------------------
  // #3 Public "what's new" list — works for everyone, signed in or not.
  // First-ever visit on a browser starts clean (nothing retroactively
  // marked unread) rather than dumping a whole backlog on a brand new
  // visitor. Re-attachable (see markEverythingSeen above) so the
  // "since" watermark never goes stale.
  // ---------------------------------------------------------------------
  var publicUnsubs = [];
  function stopPublicWatchers() {
    publicUnsubs.forEach(function (unsub) { unsub(); });
    publicUnsubs = [];
  }

  function recomputePublicItems() {
    // Exclude items authored by the current signed-in user — never
    // notify someone about their own post. Anonymous visitors have no
    // uid, so nothing is excluded for them.
    var merged = rawPublicNews.concat(rawPublicMemorials).filter(function (item) {
      return !currentUid || item.authorId !== currentUid;
    });
    merged.sort(function (a, b) {
      var at = a.createdAt && a.createdAt.toMillis ? a.createdAt.toMillis() : 0;
      var bt = b.createdAt && b.createdAt.toMillis ? b.createdAt.toMillis() : 0;
      return bt - at;
    });
    publicItems = merged;
    publicUnread = merged.length;

    // Toast anything not already toasted on this browser, exactly once
    // per item ever (independent of the bell's read/unread state).
    var newlyToasted = [];
    merged.forEach(function (item) {
      if (toastedIds.indexOf(item.id) === -1) {
        showToast(item);
        newlyToasted.push(item.id);
      }
    });
    if (newlyToasted.length) {
      toastedIds = saveToastedIds(toastedIds.concat(newlyToasted));
    }

    renderList();
  }

  function attachPublicWatchers() {
    stopPublicWatchers();
    var storedRaw = localStorage.getItem(PUBLIC_LAST_SEEN_KEY);
    if (!storedRaw) {
      localStorage.setItem(PUBLIC_LAST_SEEN_KEY, String(Date.now()));
      rawPublicNews = [];
      rawPublicMemorials = [];
      recomputePublicItems();
      return;
    }
    var since = firebase.firestore.Timestamp.fromMillis(parseInt(storedRaw, 10));

    publicUnsubs.push(notifDb.collection('news')
      .where('status', '==', 'published')
      .where('createdAt', '>', since)
      .onSnapshot(function (snap) {
        rawPublicNews = snap.docs.map(function (doc) { return buildPublicItem('news', doc.id, doc.data()); });
        recomputePublicItems();
      }, function () {}));
    publicUnsubs.push(notifDb.collection('memorials')
      .where('status', '==', 'published')
      .where('createdAt', '>', since)
      .onSnapshot(function (snap) {
        rawPublicMemorials = snap.docs.map(function (doc) { return buildPublicItem('memorial', doc.id, doc.data()); });
        recomputePublicItems();
      }, function () {}));
  }

  // ---------------------------------------------------------------------
  // #2 Review queue count — moderator/admin only, live, nothing stored.
  // ---------------------------------------------------------------------
  var queueUnsubs = [];
  function stopQueueWatchers() {
    queueUnsubs.forEach(function (unsub) { unsub(); });
    queueUnsubs = [];
    queueUnread = 0;
    queueItems = [];
  }

  // ---- Field names — confirmed against firestore.rules ----------------
  // `link` builds a URL that should land the moderator/admin right on
  // that specific item. It assumes admin.html / moderate.html can read
  // a `?highlight=<id>` query param (or the `#<id>` hash) and scroll to
  // / open the matching row — you'll need a small bit of code on those
  // pages to act on it if they don't already (e.g. on load, read
  // `new URLSearchParams(location.search).get('highlight')` and call
  // `document.getElementById(id).scrollIntoView()`).
  var QUEUE_CONFIG = {
    news: {
      row1Prefix: 'NEWS: ',
      title: function (d) { return d.title || 'Untitled news post'; },
      author: function (d) { return d.authorName || 'Someone'; },
      time: function (d) { return d.createdAt || null; },
      // Both moderators AND admins review news on moderate.html —
      // admin.html has no news queue of its own, so admins must land
      // here too (previously this sent admins to admin.html, which
      // has nothing to highlight).
      link: function (role, id) { return 'moderate.html?highlight=' + id + '#' + id; }
    },
    memorials: {
      row1Prefix: 'DEATH of: ',
      // `name` is optional per the schema; `relationTag` (e.g. "Father
      // of Ahmed") is the fallback when no name was given.
      title: function (d) { return d.name || d.relationTag || 'Untitled memorial'; },
      author: function (d) { return d.authorName || 'Someone'; },
      time: function (d) { return d.createdAt || null; },
      // Same as news above: the pending-memorial queue only exists
      // on moderate.html, for both moderators and admins.
      link: function (role, id) { return 'moderate.html?highlight=' + id + '#' + id; }
    },
    pageSuggestions: {
      row1Prefix: 'PAGE Update: ',
      // `title` here IS the short title given in the suggestion form.
      title: function (d) { return d.title || 'New page suggestion'; },
      author: function (d) { return d.authorName || 'Someone'; },
      time: function (d) { return d.createdAt || null; },
      link: function (role, id) { return 'admin.html?highlight=' + id + '#' + id; }
    },
    suggestions: {
      row1Prefix: 'MESSAGE: ',
      title: function (d) { return d.message || 'New contact message'; },
      // No authorName field on this collection — just name + email.
      author: function (d) { return d.name || d.email || 'Someone'; },
      time: function (d) { return d.createdAt || null; },
      link: function (role, id) { return 'admin.html?highlight=' + id + '#' + id; }
    },
    users: {
      row1Prefix: 'ACCOUNT: ',
      title: function (d) { return d.name || d.email || 'Pending account'; },
      author: function (d) { return d.email || ''; },
      time: function (d) { return d.createdAt || null; },
      link: function (role, id) { return 'admin.html?highlight=' + id + '#' + id; }
    }
  };

  function startQueueWatchers(role) {
    stopQueueWatchers();
    var counts = {};
    var itemsByKey = {};

    function recompute() {
      var total = 0;
      var flat = [];
      Object.keys(counts).forEach(function (k) {
        total += counts[k];
        flat = flat.concat(itemsByKey[k] || []);
      });
      // Newest first; items without a timestamp sink to the bottom.
      flat.sort(function (a, b) {
        var at = a.createdAt && a.createdAt.toMillis ? a.createdAt.toMillis() : 0;
        var bt = b.createdAt && b.createdAt.toMillis ? b.createdAt.toMillis() : 0;
        return bt - at;
      });
      queueUnread = total;
      queueItems = flat.slice(0, 20); // cap so the dropdown doesn't get huge
      renderList();
    }

    function watch(key, query) {
      var cfg = QUEUE_CONFIG[key];
      counts[key] = 0;
      itemsByKey[key] = [];
      queueUnsubs.push(query.onSnapshot(function (snap) {
        counts[key] = snap.size;
        itemsByKey[key] = snap.docs.map(function (doc) {
          var d = doc.data();
          return {
            id: doc.id,
            row1Prefix: cfg.row1Prefix,
            title: cfg.title(d),
            author: cfg.author(d),
            createdAt: cfg.time(d),
            link: cfg.link(role, doc.id)
          };
        });
        recompute();
      }, function () { /* fail quietly — never block the page */ }));
    }

    // Every moderator and admin reviews news + memorials.
    watch('news', notifDb.collection('news').where('status', '==', 'pending'));
    watch('memorials', notifDb.collection('memorials').where('status', '==', 'pending'));
    // Admin-only queues.
    if (role === 'admin') {
      watch('pageSuggestions', notifDb.collection('pageSuggestions').where('status', '==', 'pending'));
      watch('suggestions', notifDb.collection('suggestions').where('status', '==', 'new'));
      watch('users', notifDb.collection('users').where('status', '==', 'pending'));
    }
  }

  // ---------------------------------------------------------------------
  // #1 Personal notifications — signed-in only.
  // ---------------------------------------------------------------------
  var personalUnsub = null;
  function stopPersonalWatcher() {
    if (personalUnsub) { personalUnsub(); personalUnsub = null; }
    personalItems = [];
    personalUnread = 0;
  }
  function startPersonalWatcher(uid) {
    stopPersonalWatcher();
    personalUnsub = notifDb.collection('notifications')
      .where('recipientId', '==', uid)
      .orderBy('createdAt', 'desc')
      .limit(30)
      .onSnapshot(function (snap) {
        personalItems = snap.docs.map(function (doc) {
          var d = doc.data();
          d.id = doc.id;
          return d;
        });
        personalUnread = personalItems.filter(function (n) { return !n.read; }).length;
        renderList();
      }, function () { /* fail quietly */ });
  }

  // ---------------------------------------------------------------------
  // Wire it all together.
  // ---------------------------------------------------------------------
  attachPublicWatchers(); // runs regardless of auth state

  notifAuth.onAuthStateChanged(function (user) {
    if (!user) {
      currentUid = null;
      currentRole = null;
      stopPersonalWatcher();
      stopQueueWatchers();
      setAccountIconSignedOut();
      recomputePublicItems(); // re-include anything that was excluded as "your own post"
      return;
    }
    currentUid = user.uid;
    recomputePublicItems(); // exclude this user's own posts from here on
    startPersonalWatcher(user.uid);
    notifDb.collection('users').doc(user.uid).get().then(function (doc) {
      var profile = doc.exists ? doc.data() : null;
      currentRole = profile ? profile.role : null;
      setAccountIconSignedIn(profile, user);
      if (profile && profile.status === 'approved' && (profile.role === 'moderator' || profile.role === 'admin')) {
        startQueueWatchers(profile.role);
      } else {
        stopQueueWatchers();
      }
      renderList();
    }).catch(function () {
      // Profile fetch failed — still show *something* signed-in rather
      // than silently leaving the signed-out icon up while they're
      // actually logged in.
      setAccountIconSignedIn(null, user);
    });
  });
})();
