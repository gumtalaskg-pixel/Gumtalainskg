# Setting up accounts, roles & moderation (Firebase)

This site's Login, My Account, Submit News, Moderation Queue, Admin
Panel, Contribute ("Update in Page"), Announce a Death, and In
Memoriam pages are all wired up to talk to **Firebase** (Google's
free backend service) — but they won't actually work until you
connect your own Firebase project. That takes about 10 minutes, no
coding required for this part.

Note: this site only uses **Firestore** (Firebase's database) and
**Authentication** — nothing else. News photos are compressed right
in the visitor's browser and stored as small text strings inside
Firestore documents, rather than uploaded to Firebase Storage. That
means the whole site runs on Firebase's free **Spark** plan — no
billing account or credit card needed, ever. (Firebase Storage now
requires the paid Blaze plan even for small/free usage, which is why
this site avoids it entirely.)

---

## 1. Create a Firebase project

1. Go to <https://console.firebase.google.com> and sign in with any
   Google account.
2. Click **Add project**, give it a name (e.g. "gumtala-village"),
   and finish the setup wizard (you can turn off Google Analytics —
   not needed here).

## 2. Turn on email/password sign-in

1. In your new project, go to **Build → Authentication**.
2. Click **Get started**.
3. Under **Sign-in method**, enable **Email/Password**.

## 3. Create the database

1. Go to **Build → Firestore Database**.
2. Click **Create database**.
3. Choose **Start in production mode** (the security rules in
   `firestore.rules`, included in this folder, will handle
   permissions properly — production mode just means Firebase
   doesn't leave it wide open by default).
4. Pick any region close to Pakistan (e.g. `asia-south1`) and click
   **Enable**.

That's the only database/storage product this site needs.

## 4. Deploy the security rules

These rules are what actually enforce "only admins can approve
people", "only moderators can approve/reject news", "only an
author's own photos can be added to their own submission", etc. —
without them, Firestore's production-mode default blocks _everyone_,
including your own admin account.

1. Go to **Firestore Database → Rules** tab.
2. Open `firestore.rules` (in this same folder), select all, copy it.
3. Paste it into the Rules editor, replacing what's there.
4. Click **Publish**.

## 5. Get your web app config

1. In the Firebase console, click the gear icon → **Project
   settings**.
2. Scroll to **Your apps**, click the **`</>`** (web) icon to add a
   web app.
3. Give it any nickname, click **Register app**. Firebase will show
   you a code block containing a `firebaseConfig` object that looks
   like this:

   ```js
   const firebaseConfig = {
     apiKey: "AIza...",
     authDomain: "gumtala-village.firebaseapp.com",
     projectId: "gumtala-village",
     storageBucket: "gumtala-village.appspot.com",
     messagingSenderId: "123456789",
     appId: "1:123456789:web:abcdef123456",
   };
   ```

   (The `storageBucket` value is included automatically but isn't
   actually used by this site — safe to paste in anyway or leave as
   the placeholder, it makes no difference.)

4. Copy those six values — you'll paste them into the site next.

## 6. Paste your config into the site

Nine pages each carry their own copy of this config (that's on
purpose — every page in this site is self-contained, with no shared
files to link to): `login.html`, `account.html`, `news.html`,
`contribute.html`, `moderate.html`, `admin.html`, `announce-death.html`,
and `in-memoriam.html` 2 times. `contact.html`, 'notifications.js', card-actions.js, loader.js also talks to Firestore (for
the anonymous "Send a note" form), but only needs the config pasted
in the same way — it doesn't use sign-in at all, so there's one less
SDK script tag there.

`index.html` is the one exception: it carries **two** separate copies
of the config instead of one — one for the homepage's recent-death
banner (`MEMORIAL_CONFIG`) and one for the site-wide popup
(`POPUP_CONFIG`). Both need the same real values pasted in, in the
same way as below.

In **each** of those files, find this block near the bottom
(search for `YOUR_API_KEY`):

```js
const FIREBASE_CONFIG = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID",
};
```

...and replace the placeholder values with your real ones from step 5.

**Faster option:** if you're comfortable with the command line, this
one command does all ten files at once (run it from inside the
`gumtala-site` folder, after editing the values on the first line).
Since `index.html` carries two copies of the config, this also
correctly fills in both of them in one pass:

```bash
API_KEY="AIza..." AUTH_DOMAIN="gumtala-village.firebaseapp.com" \
PROJECT_ID="gumtala-village" STORAGE_BUCKET="gumtala-village.appspot.com" \
SENDER_ID="123456789" APP_ID="1:123456789:web:abcdef123456" \
sed -i \
  -e "s/YOUR_API_KEY/${API_KEY}/" \
  -e "s/YOUR_PROJECT\.firebaseapp\.com/${AUTH_DOMAIN}/" \
  -e "s/YOUR_PROJECT_ID/${PROJECT_ID}/" \
  -e "s/YOUR_PROJECT\.appspot\.com/${STORAGE_BUCKET}/" \
  -e "s/YOUR_SENDER_ID/${SENDER_ID}/" \
  -e "s/YOUR_APP_ID/${APP_ID}/" \
  login.html account.html news.html contribute.html moderate.html admin.html \
  announce-death.html in-memoriam.html contact.html index.html
```

## 7. Creating the first admin

Every new sign-up now starts as an **approved member** automatically
(`status: "approved"` is set the moment the account is created —
sign-up approval by an admin is not part of the current flow). What's
still gated is the **role**: nobody can sign themselves up as a
moderator or admin — `firestore.rules` only allows a brand-new
account to create its own doc with `role: "member"`. So the first
admin still has to be promoted by hand, once:

1. Open the site's `login.html`, click **Sign up**, and create your
   own account.
2. In the Firebase console, go to **Build → Firestore Database →
   Data**.
3. Open the `users` collection, find the document with your account
   (it's keyed by a long ID — match it by the `email` field).
4. Edit that document: change `role` from `member` to `admin`.
   (`status` is already `"approved"` — you don't need to touch it.)
5. Reload `account.html` on the site — you should now see an **Open
   Admin panel** link. From here on, you can manage everyone else's
   role through the Admin Panel UI instead of editing Firestore by
   hand.

Note: full access to submitting content also requires a **verified
email** and, after that, a **day-3 re-confirmation** — see "Email
verification & the 3-day re-confirmation window" below. A brand-new
account can browse and sign in right away, but submitting news, a
memorial, or a page-update suggestion will be blocked until email
verification (and later, re-confirmation) is done.

## 8. Hosting the site

Firebase Authentication works from any domain you add to the
**Authorized domains** list (Authentication → Settings → Authorized
domains) — `localhost` is allowed by default for local testing.
When you host the site for real (Netlify, GitHub Pages, Firebase
Hosting itself, etc.), add that domain to the list or sign-in will
be blocked.

---

## What each role can actually do

|                                         | Member                                                                         | Moderator                     | Admin                         |
| --------------------------------------- | ------------------------------------------------------------------------------ | ----------------------------- | ----------------------------- |
| Sign up                                 | ✅ (auto-approved; still needs email verification + re-confirmation to submit) | —                             | —                             |
| Submit news (with up to 3 photos)       | ✅, goes to "pending"                                                          | ✅, goes to "pending"         | ✅, **publishes immediately** |
| Approve/reject news                     | ❌                                                                             | ✅, but not their own         | ✅, anyone's                  |
| Announce a death / In Memoriam          | ✅, goes to "pending"                                                          | ✅, **publishes immediately** | ✅, **publishes immediately** |
| Approve/reject memorials                | ❌                                                                             | ✅, but not their own         | ✅, anyone's                  |
| Suggest a page update (photos + note)   | ✅ once verified                                                               | ✅                            | ✅                            |
| Review page-update suggestions          | ❌                                                                             | ❌                            | ✅ only                       |
| Assign roles (member/moderator/admin)   | ❌                                                                             | ❌                            | ✅                            |
| Change anyone's role or badges          | ❌                                                                             | ❌                            | ✅                            |
| Read messages sent via the Contact page | ❌                                                                             | ❌                            | ✅                            |

A moderator can't approve or reject their own news submission — the
Moderation Queue hides the Approve/Reject buttons on their own
pending items and shows a note instead ("this needs a different
moderator or an admin"). This is enforced in `firestore.rules`, not
just the page's UI, so it can't be bypassed from the browser console.

## Page update suggestions ("Update in Page")

Any approved member/moderator/admin can go to `contribute.html`
(linked from a button on `account.html`) to suggest photos or content
for an _existing_ page — e.g. "here are better photos of Jamia Masjid
Abubakar for the Landmarks page." It works exactly like submitting
news (same photo compression, same "pending" starting state), but:

- It's saved to a separate `pageSuggestions` collection, not `news`.
- Only **admins** review these (not moderators) — see the "Page
  update suggestions" section on `admin.html`.
- Approving one is just a signal to yourself/other admins ("go ahead
  and add this") — the site doesn't auto-insert anything into the
  target page. You still add the photos/content by hand.
- Rejecting one requires a comment, same as rejecting news.

## Announce a death / In Memoriam

Any signed-in, verified member/moderator/admin can go to
`announce-death.html` to post a death announcement — name or
relation, date of death, Namaz-e-Janaza date/time (confirmed or a
rough estimate), locations, an optional photo, and notes. Published
announcements show on `in-memoriam.html`, and prominently (a homepage
banner on `index.html`) for 3 days after the janaza date, after which
they quietly move into the permanent archive list further down
`in-memoriam.html`.

- Saved to its own `memorials` collection, separate from `news`.
- Unlike news, **moderators can publish directly here too**, not just
  admins — a member's own submission still starts "pending" either
  way.
- A moderator can't approve/reject their own submission, same rule as
  news — needs a different moderator or an admin.
- A contact number can only be attached by a moderator or admin
  author; a plain member's submission can never carry one, even if
  the browser sends one — `firestore.rules` enforces this server-side.
- If the janaza date/time was submitted as an estimate (not
  confirmed), the original author gets exactly **one** later
  correction to fix it, but only until the end of that estimated day —
  after that, only an admin can change it.

## Messages from the Contact page

The "Send a note" form on `contact.html` works without signing in —
anyone can send a message. It's saved to a `suggestions` collection
and shows up under "Notes from the Contact page" on `admin.html`,
where an admin can mark it read or delete it. Since it's open to
anonymous writes, `firestore.rules` caps the length of each field to
stop it being used to stuff junk data into the database.

## Site-wide welcome popup

A small popup can show a photo and/or a short message to every
visitor — signed in or not — shortly after the page loads. It's
managed entirely from `account.html`: only admins see a "Site Popup"
section there, where they can add slides (a photo, a description, or
both), reorder them, pause/reactivate one without deleting it, or
delete it for good. With more than one active slide, the popup shows
Prev/Next buttons so visitors can flip between them.

- Slides live in a public `popupSlides` collection — anyone can read
  it (that's how the popup shows for signed-out visitors too), only
  admins can write to it. `firestore.rules` already has this rule.
- It shows at most once every 24 hours per browser/device, tracked
  with a timestamp in `localStorage` (not tied to any Firestore
  field) — so the same visitor won't see it again until a day has
  passed, even across page reloads or new tabs.
- It currently only appears on `index.html`, `login.html`,
  `account.html`, `admin.html`, `moderate.html`, `news.html`,
  `contribute.html`, `announce-death.html`, and `in-memoriam.html` —
  not on the other, purely static pages (About, Gallery, Landmarks,
  Directory, etc.).
- Each of those 9 pages carries its own small, self-contained copy of
  this popup script (with its own Firebase config — on `index.html`
  this is the separate `POPUP_CONFIG` block mentioned in step 6) so
  it works regardless of whatever else that page's script is doing —
  you don't need to wire anything else up for it to work once your
  Firebase config is pasted in per step 6.

## How photos work (no Firebase Storage / Blaze plan needed)

When a member attaches up to 3 photos on `news.html` (submitting news)
or `contribute.html` (suggesting a page update), each one is
compressed **in the browser** (via a `<canvas>`, in
`compressImageTwoSizes()` — see the shared script block near the
bottom of that file) into two versions, and neither one ever leaves
Firestore:

- A **thumbnail** (~200px, heavily compressed, a few KB) — saved
  directly on the `news` document itself, in a `thumbnails` array.
  This is what's shown in `news.html`'s card grid and in
  `moderate.html`'s Moderation Queue, so those list views stay fast
  no matter how many photos accumulate over time.
- A **full-size version** (~900px, moderately compressed, still well
  under Firestore's 1 MiB per-document limit) — saved in its own
  small document, in a `photos` subcollection under that news item
  (`news/{id}/photos/{index}`). This is only ever fetched when
  someone actually clicks a news item to open its photo modal on
  `news.html` — never as part of loading the list.

Because everything is a plain Firestore read/write, there's no
Storage bucket to provision and no requirement to be on the paid
Blaze plan — the site stays entirely on the free Spark plan.

## Email verification & the 3-day re-confirmation window

Every new sign-up automatically gets Firebase's built-in verification
email (a link to click, not a code — no extra setup needed for this,
it works as soon as Email/Password sign-in is enabled in step 2).
Members can resend it any time from "My Account" if it's needed.
Submitting news, a memorial, or a page-update suggestion requires a
verified email — the account itself is approved from the moment it's
created (see step 7), but new content can only be _submitted_ once
verification is done.

There's a second, later check as well: once an account's email first
verifies, it has **3 days** to re-confirm (a link sent from
`account.html`/checked on every page load) or it becomes
**restricted** — this only blocks _new_ submissions, not signing in,
browsing, or reading anything already there. Re-confirming clears the
restriction. This is tracked on the `users/{uid}` document with the
`firstVerifiedAt`, `restricted`, `reconfirmedAt`, and
`lastReverifySentAt` fields — if you see a user with `restricted:
true` in the Firestore console, that's why, and no admin action is
needed; the member just needs to re-confirm from their end.

Optional: by default the verification link takes people to a generic
Firebase-hosted page. To send them back to your own site instead, go
to **Authentication → Templates → Email address verification → Edit
template (pencil icon) → Customize action URL**, and point it at your
site's `account.html`.

## Password rules

Sign-up requires a password of at least 8 characters containing at
least one letter, one number, and one symbol (checked in the
browser, in `passwordStrengthError()` inside each page's script).
"Forgot password?" on the Sign In tab sends a standard Firebase
password-reset email; no setup needed for that beyond enabling
Email/Password sign-in in step 2.

## Troubleshooting

- **"Firebase is not connected yet" toast on the site** — you
  haven't pasted your config into that page yet (step 6).
- **Permission-denied errors in the browser console** — the security
  rules (step 4) haven't been published yet, or don't match
  `firestore.rules` exactly.
- **Signed in but nothing happens on Admin/Moderate pages** — your
  account's `role`/`status` fields in Firestore don't match what
  that page expects; double check them in the Firestore console.
- **"The query requires an index" error** — click the link included
  right in that error message, then click **Save** in the Firebase
  console dialog it opens, and wait for its status to go from
  "Building" to "Enabled" (usually 1–2 minutes). This is normal and
  only needs doing once per distinct query the site uses (e.g. once
  for the Moderation Queue, once for "your submissions" on the
  account page).
- **Photo previews look blank / modal photos never load** — usually
  a permission-denied error on the `news/{id}/photos` subcollection;
  double-check `firestore.rules` was deployed exactly as included
  (step 4).
