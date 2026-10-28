# Privacy

Canvas Ink does not collect, send, or sell your data.

- **Settings** are saved with the browser's `storage` API and synced by your
  browser if you have sync on.
- **Canvas data.** On Canvas pages, the extension reads your planner items
  from your school's Canvas API using your existing login, and caches them in
  local extension storage. Marking an item done writes a planner override back
  to Canvas. Nothing goes anywhere else.
- **Fonts.** If you set a custom font, it loads from Google Fonts.
- **Permissions.** `storage` and `unlimitedStorage` hold settings and the
  planner cache. The content script matches `https://*/*` because Canvas can
  run on any domain; it does nothing on pages that aren't Canvas.

Uninstalling the extension deletes everything it stored.
