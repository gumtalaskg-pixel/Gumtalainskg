# Gumtala Village — Who Can Do What, Per Page

This is a page-by-page breakdown of the site for each of the four
"roles" a visitor to gumtala-village can be in. It reflects the code
as it currently stands (not the original brief), so a few things
here may look different from earlier plans — e.g. sign-ups are now
auto-approved, and the old "Submit News" / "Update in Page" pages
were merged into one page, `contribute.html`.

**The four roles:**

| Role | What it means |
|---|---|
| **Visitor** | Nobody signed in — anyone browsing the site with no account, or not currently logged in. |
| **Member** | Signed in, `role: "member"`. This is what every new sign-up becomes automatically. |
| **Moderator** | Signed in, `role: "moderator"` — promoted by an admin. |
| **Admin** | Signed in, `role: "admin"` — promoted by hand once (see `SETUP-GUIDE.md` step 7), can promote others afterward. |

**Two things that gate a Member/Moderator/Admin regardless of role,**
checked on every content-submitting page:
- **Email verified** — required before submitting anything (news,
  memorials, page suggestions). Browsing/signing in works before
  this.
- **Not "restricted"** — an account becomes restricted if it doesn't
  re-confirm within 3 days of first verifying its email. Also only
  blocks new submissions, nothing else. See `SETUP-GUIDE.md`.

The 16 purely informational pages (About, Achievements, Attractions,
Council, Directory, Education, Emergency, Faith, Food Point, Gallery,
Health, History, Landmarks, Products, Sports, Weather) show **the
exact same content to all four roles** — there's no role-based logic
on any of them. They're listed once at the top of each role's block
for completeness, then the role-specific pages are covered in detail.

---

## 👤 Visitor (not signed in)

**Static/informational pages** (About, Achievements, Attractions,
Council, Directory, Education, Emergency, Faith, Food Point, Gallery,
Health, History, Landmarks, Products, Sports, Weather) — full read
access, same as every other role.

| Page | What a visitor can do |
|---|---|
| `index.html` (Home) | View the homepage. Sees the recent-death banner if a memorial was published in the last 3 days. Sees the welcome popup (if an admin has an active slide) once every 24 hours. |
| `news.html` | Browse every **published** news item/announcement. Can open a photo modal on any item. No "submit" option visible. |
| `in-memoriam.html` | Browse every **published** memorial — recent ones prominently, older ones in the archive list below. |
| `login.html` | Sign in, or sign up for a new account. |
| `account.html` | Sees a "You're not signed in" banner with a Sign in / Sign up button. Nothing else on the page. |
| `contribute.html` | Sees a "not signed in" state with a link to sign in. The Add News / Update Page tabs and forms are not shown. |
| `announce-death.html` | Same — "not signed in" state, sign-in link, no form. |
| `contact.html` | Full access — can send a message via the anonymous "Send a note" form. This is the one form on the whole site that doesn't require an account. |
| `moderate.html` | Blocked — "Moderators only" banner with a Sign in link. |
| `admin.html` | Blocked — "Admins only" banner with a Sign in link. |

**Notification bell:** shows only the public "what's new" count (how
many news/memorial items have been published since this browser last
opened the bell) — tracked in the browser, not tied to any account.

---

## 🙋 Member

**Static/informational pages** — same full read access as everyone
else, no differences.

| Page | What a member can do |
|---|---|
| `index.html` | Same view as a visitor, plus the header shows they're signed in (name/role badge, notification bell with personal notifications). |
| `login.html` | Redirects straight to `account.html` — already signed in. |
| `account.html` | Sees their profile (name, email, role pill "Member", status, villager-confirmed badge if set), a stat pill showing published/total count of their own news, quick-link buttons **"Add News or Update Page"** and **"Announce Death"**, a list of their own news submissions (with status), and a list of their own memorial submissions (with status). If email isn't verified yet, sees a "resend verification" prompt instead of most of this. If restricted (see gating note above), sees a "resend re-confirmation link" prompt. |
| `news.html` | Same browsing as a visitor, plus a small "Signed in as [name] (Member)" badge in the corner. |
| `in-memoriam.html` | Same browsing as a visitor. |
| `contribute.html` | Once verified + approved + not restricted: **Add News tab** — submit a news item/announcement (title, category, body, up to 3 photos) — goes in as **"pending"**, needs a moderator or admin to approve it. **Update Page tab** — suggest photos/content for an existing page — also goes in "pending", reviewed only by admins. |
| `announce-death.html` | Once verified: submit a death announcement (name/relation, dates, locations, optional photo, notes) — goes in **"pending"**. The contact-number field is **not shown** to members at all (moderator/admin-only field, enforced server-side too). |
| `contact.html` | Same as a visitor — can send a note; being signed in doesn't add anything extra here. |
| `moderate.html` | Blocked — "Moderators only" banner, even though they're signed in. |
| `admin.html` | Blocked — "Admins only" banner. |

**Notification bell:** personal notifications (e.g. "your news was
approved") plus the same public "what's new" count as a visitor.

---

## 🛡️ Moderator

**Static/informational pages** — same full read access as everyone
else, no differences.

| Page | What a moderator can do |
|---|---|
| `index.html` | Same as a member, with the header reflecting "Moderator". |
| `login.html` | Redirects straight to `account.html`. |
| `account.html` | Profile shows role pill "Moderator". Quick links: **"Open Moderation queue"**, **"Add News or Update Page"**, **"Announce Death"** (no admin panel link). Stat pills: their own news published/total, plus two clickable badges — pending news count and pending death-announcement count — both linking straight into `moderate.html`. |
| `news.html` / `in-memoriam.html` | Same browsing as everyone, with the "(Moderator)" badge shown when signed in. |
| `contribute.html` | Same as a member — Add News / Update Page tabs. **Their own news submissions still go to "pending"** — moderators don't get to publish their own news instantly, only admins do. |
| `announce-death.html` | Same form as a member, **except**: the submission **publishes immediately** instead of going to "pending" (moderators, like admins, can publish memorials directly), and the **contact-number field is shown** and can be filled in. |
| `contact.html` | Same as everyone — can send a note. Reading the inbox happens on `admin.html`, which moderators can't access. |
| `moderate.html` | **Full access.** Live queue of every pending news item and pending death announcement. Approve or reject any pending item — **except their own** (the Approve/Reject buttons are hidden on their own pending submissions, with a note that a different moderator or an admin needs to handle it). Rejecting requires typing a reason. No access to the "previously rejected" section (admin-only). |
| `admin.html` | Blocked — "Admins only" banner. |

**Notification bell:** personal notifications, the review-queue size
(live count of pending news + memorials sitewide), and the public
"what's new" count.

---

## 👑 Admin

**Static/informational pages** — same full read access as everyone
else, no differences.

| Page | What an admin can do |
|---|---|
| `index.html` | Same as everyone, header reflects "Admin". |
| `login.html` | Redirects straight to `account.html`. |
| `account.html` | Profile shows role pill "Admin". Quick links: **"Open Admin panel"**, **"Open Moderation queue"**, **"Add News or Update Page"**, **"Announce Death"**. Five clickable live-count stat pills — pending news, pending death announcements, pending sign-ins, pending page suggestions, new contact messages — each deep-linking to the right spot on `moderate.html` or `admin.html`. Also the only role that sees the **"Site Popup"** section here: add a slide (photo and/or text), reorder slides, pause/reactivate one, or delete it for good — this controls the site-wide welcome popup everyone else sees. |
| `news.html` / `in-memoriam.html` | Same browsing as everyone, with the "(Admin)" badge shown. |
| `contribute.html` | **Add News tab** — their own submissions **publish immediately**, no pending wait. **Update Page tab** — works the same as for anyone else; an admin's own page-update suggestion still goes into the `pageSuggestions` queue like a member's would (there's nothing stopping an admin from using this tab, it just isn't a shortcut to auto-approval). |
| `announce-death.html` | Submission **publishes immediately**. Contact-number field is shown and can be filled in. |
| `contact.html` | Same "Send a note" form as everyone, **plus** full access to read/manage the inbox of everyone's messages via `admin.html`. |
| `moderate.html` | Full access, same as a moderator, **plus**: can approve/reject their **own** pending items too (not blocked the way a moderator is on their own submissions), and sees an extra **"Previously rejected"** section — every item any moderator/admin has rejected, with the reason, where they can either delete it for good or approve it anyway, overruling the original rejection. |
| `admin.html` | **Full access** — the only role that can open this page at all. Four sections: **"Waiting for approval"** (any account an admin has manually set back to pending), **"Everyone with an account"** (change anyone's role between member/moderator/admin, change their status, toggle the "villager confirmed" badge), **"Page update suggestions"** (approve or reject every pending suggestion from `contribute.html`'s Update Page tab, admins-only review), **"Notes from the Contact page"** (mark a message read, or delete it). |

**Notification bell:** personal notifications, the review-queue size
(same live count moderators see, plus admin-only queues like page
suggestions/contact messages/pending sign-ins factored into the
account-page pills), and the public "what's new" count.

---

## Quick cross-reference: gated pages at a glance

| Page | Visitor | Member | Moderator | Admin |
|---|---|---|---|---|
| 16 static/info pages | ✅ read | ✅ read | ✅ read | ✅ read |
| `index.html` | ✅ | ✅ | ✅ | ✅ |
| `news.html` (browse) | ✅ | ✅ | ✅ | ✅ |
| `in-memoriam.html` (browse) | ✅ | ✅ | ✅ | ✅ |
| `contact.html` (send a note) | ✅ | ✅ | ✅ | ✅ |
| `login.html` | sign in/up | redirects away | redirects away | redirects away |
| `account.html` | ❌ (prompt to sign in) | ✅ own profile | ✅ + queue links | ✅ + admin links + popup manager |
| `contribute.html` — Add News | ❌ | ✅ → pending | ✅ → pending | ✅ → **published instantly** |
| `contribute.html` — Update Page | ❌ | ✅ → pending | ✅ → pending | ✅ → pending (reviewed by other admins) |
| `announce-death.html` | ❌ | ✅ → pending, no contact field | ✅ → **published instantly**, contact field shown | ✅ → **published instantly**, contact field shown |
| `moderate.html` | ❌ | ❌ | ✅ (not own items) | ✅ (incl. own items + rejected archive) |
| `admin.html` | ❌ | ❌ | ❌ | ✅ only |
