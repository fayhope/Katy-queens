// Fill these in from Supabase: Project Settings -> API (or "Connect").
// The anon / publishable key is designed to be public, so it is fine to
// commit it. Leave them blank and the app still works, saving on this device
// only.
export const CONFIG = {
  supabaseUrl: '',      // e.g. 'https://abcdefghijkl.supabase.co'
  supabaseAnonKey: '',  // e.g. 'eyJhbGciOi...' or 'sb_publishable_...'

  // Who solves puzzles in this app.
  player: 'Katy',
  // Everyone on the leaderboard. Times for anyone other than `player` are
  // typed in on the Leaderboard tab.
  players: ['Katy', 'Fay'],
};
