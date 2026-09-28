# Katy Queens 👑

A LinkedIn-style **Queens** puzzle app for Katy's phone.

1. Screenshot the Queens board on LinkedIn (before you start playing it).
2. Upload the screenshot in Katy Queens. It reads the grid and colours and
   rebuilds the board — you get a chance to check it and fix any colours.
3. Play it here against the clock. Katy's time and daily streak are saved.
4. On the **Leaderboard** tab, type in Fay's time for the day. The app shows
   who won today, win counts, streaks, personal bests, averages and history.

It's a static web app (plain HTML/CSS/JS, no build step) that installs to the
iPhone home screen from Safari, and uses Supabase to store times so the
leaderboard is shared between phones.

## How to play

- Put one queen in every row, every column and every colour region.
- Queens can't touch each other, not even diagonally.
- Tap a cell once for **×**, twice for a **queen**, three times to clear it.
- Drag across cells to fill in lots of ×s (start a drag on an × to erase).
- **Auto ×** greys out every cell the placed queens already rule out.
- Clashes are shown with red stripes. The timer pauses when the app is closed.

## Setup

### 1. Supabase (free)

1. Create a project at [supabase.com](https://supabase.com).
2. Open **SQL Editor → New query**, paste in [`supabase/schema.sql`](supabase/schema.sql)
   and press **Run**.
3. Go to **Project Settings → API** (or the **Connect** button) and copy the
   **Project URL** and the **anon / publishable** key.
4. Put them in [`js/config.js`](js/config.js):

   ```js
   supabaseUrl: 'https://abcdefghijkl.supabase.co',
   supabaseAnonKey: 'eyJhbGciOi...',
   ```

The anon key is meant to be public, so it's fine to commit. There's no login:
anyone who has the site's link can see and add times, but nobody can delete
anything through the app. Without keys the app still works, saving on that
one device only.

To change the names, edit `player` (who plays in the app) and `players`
(everyone on the leaderboard) in `js/config.js`.

### 2. Put it online

It must be served over HTTPS for "Add to Home Screen" to work properly. Any
static host works, for example:

- **Netlify:** drag the project folder onto
  [app.netlify.com/drop](https://app.netlify.com/drop), or connect this repo.
- **Vercel:** "Add New Project", pick this repo, no settings needed.
- **GitHub Pages:** Settings → Pages → deploy from the `main` branch
  (needs a public repo on a free GitHub plan).

### 3. Install on the iPhone

1. Open the site in **Safari**.
2. Tap the **Share** button → **Add to Home Screen** → **Add**.
3. Open **Katy Queens** from the home screen. It runs full screen like an app
   and keeps working offline (times sync when you're back online).

## Development

```sh
npm start        # serves on http://localhost:8080
npm test         # rules, streak maths and screenshot-reader tests
```

| File | What it does |
| --- | --- |
| `js/parser.js` | Screenshot → board: finds the board, the grid size and the colour regions |
| `js/queens.js` | Rules, clash detection and a solver (used to check an imported board) |
| `js/stats.js` | Streaks, wins and the leaderboard |
| `js/store.js` | Supabase REST calls with a local cache and offline retry queue |
| `js/app.js` | The screens: play, check-the-board, win, leaderboard |
| `sw.js` | Offline support |

The screenshot tests in `tests/parser.test.mjs` draw fake phone screenshots
(light mode, dark mode, cropped, with pieces already placed) and check the
board is read back exactly.
