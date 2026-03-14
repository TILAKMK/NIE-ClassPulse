# NIE ClassPulse — Full Setup Guide
## From zero to deployed in 6 steps

---

## 📁 Folder Structure

```
classpulse/
├── index.html               ← Main dashboard (your existing UI, now dynamic)
├── vercel.json              ← Vercel routing config
├── supabase-schema.sql      ← Paste this into Supabase SQL Editor
├── js/
│   ├── supabase.js          ← Supabase client (add YOUR keys here)
│   ├── auth.js              ← Login / logout / role helpers
│   ├── rooms.js             ← All database queries
│   └── dashboard.js         ← Powers index.html
└── pages/
    ├── login.html           ← Login page for teachers & CRs
    └── room-detail.html     ← Individual room view + status update
```

---

## STEP 1 — Set up Supabase (5 min)

1. Go to https://supabase.com → **New Project**
2. Give it a name (e.g. `nie-classpulse`) and choose a region
3. Wait for the project to start (~1 minute)
4. In the left sidebar → **SQL Editor** → **New Query**
5. **Copy the entire contents of `supabase-schema.sql`** and paste it in
6. Click **Run** → you'll see all tables created with sample data

---

## STEP 2 — Get your API keys

1. In Supabase → **Project Settings** (gear icon) → **API**
2. Copy:
   - **Project URL** (looks like `https://abcxyz.supabase.co`)
   - **anon public** key (long string)
3. Open `js/supabase.js` and replace:

```js
const SUPABASE_URL  = 'https://YOUR_PROJECT_ID.supabase.co';  // ← paste here
const SUPABASE_ANON = 'YOUR_ANON_PUBLIC_KEY';                 // ← paste here
```

---

## STEP 3 — Create teacher/CR accounts

1. Supabase → **Authentication** → **Users** → **Add User**
2. Enter the teacher's email and a temporary password
3. Click **Create**
4. Now go to **Table Editor** → `profiles` table
5. Find that user's row and change `role` from `student` → `teacher` (or `cr`)

> Students don't need accounts — they can view the dashboard without logging in.

---

## STEP 4 — Enable Realtime

1. Supabase → **Database** → **Replication**
2. Under **Tables** toggle ON the `classrooms` table
3. This makes status changes appear instantly without page refresh

---

## STEP 5 — Deploy on Vercel (3 min)

1. Upload your project folder to GitHub:
   ```
   git init
   git add .
   git commit -m "NIE ClassPulse initial"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/nie-classpulse.git
   git push -u origin main
   ```

2. Go to https://vercel.com → **New Project**
3. Import your GitHub repo
4. Framework: **Other** (plain HTML)
5. Click **Deploy**

That's it! Vercel gives you a URL like `nie-classpulse.vercel.app`

---

## STEP 6 — Add environment variables (optional but secure)

Instead of putting API keys in `supabase.js`, use Vercel env vars:

1. Vercel Dashboard → Your Project → **Settings** → **Environment Variables**
2. Add:
   - `SUPABASE_URL` = your URL
   - `SUPABASE_ANON_KEY` = your anon key

Then in `supabase.js` you can use them via a build step — for now, direct values in the JS file are fine for a college project (the anon key is safe to expose).

---

## How it works

```
Student opens website
        ↓
index.html loads → dashboard.js runs
        ↓
dashboard.js calls getAllRooms() → supabase.from('classrooms').select()
        ↓
Supabase returns live data → cards rendered on screen
        ↓
subscribeToRoomChanges() listens for any UPDATE on classrooms table
        ↓
When a teacher updates a room → card flips instantly for ALL users
```

---

## Role-based access

| Action                    | Student | CR  | Teacher |
|---------------------------|---------|-----|---------|
| View dashboard            | ✅      | ✅  | ✅      |
| View room schedule        | ✅      | ✅  | ✅      |
| Mark room as occupied     | ❌      | ✅  | ✅      |
| Mark room as vacant       | ❌      | ✅  | ✅      |

This is enforced in TWO places:
1. **Frontend** — `getUserRole()` hides the editor panel from students
2. **Supabase RLS** — even if someone bypasses the UI, the database
   rejects UPDATE queries from non-teacher/CR accounts

---

## GitHub Copilot tips for VS Code

Open any JS file and try these prompts:

- `// fetch all vacant rooms and show a toast notification`
- `// add pagination to the room grid (10 rooms per page)`
- `// send email notification when a room is freed`
- `// add a dark mode toggle button`

Copilot will autocomplete directly inside your existing code.

---

## Common issues

| Problem | Fix |
|---------|-----|
| "Failed to fetch" error | Check your SUPABASE_URL and ANON key in supabase.js |
| No rooms showing | Make sure you ran supabase-schema.sql and it inserted sample data |
| Login not working | Check Authentication is enabled in Supabase → Settings |
| RLS blocking reads | Make sure the "Anyone can view classrooms" policy was created |
| Vercel 404 on page refresh | Make sure vercel.json exists with the rewrite rule |
