# Privacy

Canvas Ink does not collect, send, or sell data.

- Settings: saved with the browser `storage` API, synced if browser sync on
- Canvas data: planner items are read from Canvas API with existing login and cached locally. Mark done writes a planner override
- Fonts: custom fonts load from Google Fonts
- Permissions: `storage` holds settings and the planner cache. The content
  script matches `https://*/*` since Canvas can run on any domain, and does
  nothing on non-Canvas pages

Uninstalling deletes everything stored.
