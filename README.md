# Katy Queens 👑

A LinkedIn-style **Queens** puzzle app for Katy's phone.

**Each day:**

1. **Fay** screenshots the Queens board on LinkedIn and sends it to Claude
   (set up with [`CLAUDE_INSTRUCTIONS.md`](CLAUDE_INSTRUCTIONS.md)).
2. Claude replies with a link. Fay taps it, checks the board matches, and
   taps **Send to Katy's app**. The puzzle is saved to Supabase.
3. **Katy** opens Katy Queens and today's board is waiting. She plays it
   against the clock; her time and daily streak are saved.
4. On the **Leaderboard** tab, Fay's time goes in. The app shows who won
   today, win counts, streaks, personal bests, averages and history.

Katy can also upload a screenshot herself ("Can't wait?" link): the app
reads the board straight from the image, and lets you check and fix
colours before playing.

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

### 2. Put it online with Vercel (free)

1. Sign in at [vercel.com](https://vercel.com) with GitHub.
2. **Add New… → Project**, pick the `katy-queens` repository, **Import**.
3. Leave every setting as it is (Framework preset: *Other*, no build
   command) and press **Deploy**.
4. You get an address like `https://katy-queens.vercel.app`. Put it into
   the Claude instructions in place of `https://YOUR-SITE`.

Every push to the repository redeploys automatically. `vercel.json` stops
browsers holding on to old versions of the app.

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
| `js/code.js` | Board codes (`POOOOOO.POOOBBO…`) used in Claude's links |
| `js/app.js` | The screens: play, check-the-board, win, leaderboard |
| `sw.js` | Offline support |

The screenshot tests in `tests/parser.test.mjs` draw fake phone screenshots
(light mode, dark mode, cropped, with pieces already placed) and check the
board is read back exactly.
