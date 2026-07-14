# Firestore Composite Index Creation Guide — Gumtala Village Project

This document contains ready-to-paste browser console scripts that will make
Firestore tell you exactly which composite indexes this project needs — with
a clickable link that creates each one automatically in the Firebase Console.

## How to use this

1. Open the specified page on the live/deployed site (or localhost pointing
   at your real Firebase project) — Firebase must already be initialized on
   that page, so don't paste this into a blank tab.
2. If the section says "must be logged in," log in through the site's
   normal login flow first, in that role (member / moderator / admin).
3. Open DevTools (press **F12**, or right-click → Inspect) → go to the
   **Console** tab.
4. Paste the whole code block for that section → press **Enter**.
5. For each query, you'll see either:
   - `✅ OK` — nothing to do, no index needed (or it already exists).
   - `👉 ... click this link:` followed by a long URL — click that link.
6. On the Firebase Console page that opens, click **Create Index**.
7. Wait for its status to change from **Building** to **Enabled**
   (usually 1–5 minutes). Repeat for every link you get.
8. Work through all 6 sections below — some only fire once you're signed
   in with the right role, which is why they're split by page/login state.

You can do these sections in any order, on any device/browser, across
multiple sessions — re-running a script after its index is built will just
print `✅ OK` instead of a link.

---

## 1. `index.html` — no login needed

```js
(function(){
  const db = firebase.firestore();
  function check(name,q){
    q.get().then(()=>console.log('✅ OK, no action needed →', name))
     .catch(e=>console.error('👉 '+name+' — click this link:\n', e.message));
  }
  check('popupSlides (active + order)', db.collection('popupSlides').where('active','==',true).orderBy('order','asc'));
  check('memorials (published, newest first)', db.collection('memorials').where('status','==','published').orderBy('createdAt','desc'));
})();
```

---

## 2. `news.html` — no login needed

```js
(function(){
  const db = firebase.firestore();
  function check(name,q){
    q.get().then(()=>console.log('✅ OK →', name))
     .catch(e=>console.error('👉 '+name+' — click this link:\n', e.message));
  }
  check('news (published, newest first)', db.collection('news').where('status','==','published').orderBy('createdAt','desc'));
})();
```

---

## 3. `account.html` — must be logged in (any approved account)

```js
(function(){
  const db = firebase.firestore();
  const uid = firebase.auth().currentUser.uid;
  function check(name,q){
    q.get().then(()=>console.log('✅ OK →', name))
     .catch(e=>console.error('👉 '+name+' — click this link:\n', e.message));
  }
  check('news — your submissions', db.collection('news').where('authorId','==',uid).orderBy('createdAt','desc'));
  check('memorials — your submissions', db.collection('memorials').where('authorId','==',uid).orderBy('createdAt','desc'));
  check('notifications — your own', db.collection('notifications').where('recipientId','==',uid).orderBy('createdAt','desc'));
})();
```

---

## 4. `moderate.html` — must be logged in as moderator or admin

```js
(function(){
  const db = firebase.firestore();
  function check(name,q){
    q.get().then(()=>console.log('✅ OK →', name))
     .catch(e=>console.error('👉 '+name+' — click this link:\n', e.message));
  }
  check('news — pending queue', db.collection('news').where('status','==','pending').orderBy('createdAt','asc'));
  check('news — rejected list', db.collection('news').where('status','==','rejected').orderBy('reviewedAt','desc'));
  check('memorials — pending queue', db.collection('memorials').where('status','==','pending').orderBy('createdAt','asc'));
})();
```

---

## 5. `admin.html` — must be logged in as admin

```js
(function(){
  const db = firebase.firestore();
  function check(name,q){
    q.get().then(()=>console.log('✅ OK →', name))
     .catch(e=>console.error('👉 '+name+' — click this link:\n', e.message));
  }
  check('pageSuggestions — pending queue', db.collection('pageSuggestions').where('status','==','pending').orderBy('createdAt','asc'));
})();
```

---

## 6. Any page — no login needed
(covers the "new posts since last visit" bell counter, from `notifications.js`)

```js
(function(){
  const db = firebase.firestore();
  function check(name,q){
    q.get().then(()=>console.log('✅ OK →', name))
     .catch(e=>console.error('👉 '+name+' — click this link:\n', e.message));
  }
  const since = new Date(0);
  check('news — new-since-last-visit counter', db.collection('news').where('status','==','published').where('createdAt','>',since));
  check('memorials — new-since-last-visit counter', db.collection('memorials').where('status','==','published').where('createdAt','>',since));
})();
```

---

## Reference: all indexes this covers

| # | Collection | Filter | Order by | Needs login as |
|---|---|---|---|---|
| 1 | popupSlides | active == true | order asc | — |
| 2 | memorials | status == published | createdAt desc | — |
| 3 | news | status == published | createdAt desc | — |
| 4 | news | authorId == you | createdAt desc | any account |
| 5 | memorials | authorId == you | createdAt desc | any account |
| 6 | notifications | recipientId == you | createdAt desc | any account |
| 7 | news | status == pending | createdAt asc | moderator/admin |
| 8 | news | status == rejected | reviewedAt desc | moderator/admin |
| 9 | memorials | status == pending | createdAt asc | moderator/admin |
| 10 | pageSuggestions | status == pending | createdAt asc | admin |
| 11 | news | status == published, createdAt > since | — | — |
| 12 | memorials | status == published, createdAt > since | — | — |
