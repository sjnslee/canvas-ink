# Canvas Ink

A small browser extension that makes Canvas a little more useful and a lot
less noisy.

## Features

- **Card assignments.** Upcoming work on each dashboard card, with a checkbox
  to mark it done. Choose how many to show, whether to include overdue work,
  and whether to hide finished items.
- **To do list.** A plain list of what's left, in the dashboard sidebar.
- **Hidden courses.** Leave a course's work out of cards and the to do list.
- **Dates.** Month/day or day/month, with optional relative time next to it.
- **Theme.** Pick your own background, panel, text, accent, and sidebar
  colors, or start from a preset. Each part can be turned off to keep
  Canvas's color for it.
- **Font.** Use any Google Fonts family across Canvas.
- **Hide.** Sidebar logo, course card images, course card icons, page
  footer, the previous/next bar, global announcements, recent feedback, and
  Canvas's own to do and coming up lists.
- **Settings.** Export, import, and reset.

Marking something done uses Canvas's own planner, so it stays in sync with
the Canvas to do list and mobile app.

## Install from source

1. Clone this repo.
2. Chrome: open `chrome://extensions`, turn on developer mode, click **Load
   unpacked**, and pick the repo folder.
3. Firefox: open `about:debugging#/runtime/this-firefox`, click **Load
   Temporary Add-on**, and pick `manifest.json`.

Open any Canvas page once and the extension picks it up from then on.

## Layout

```
manifest.json
js/defaults.js   settings and theme presets, shared by popup and page
js/content.js    runs on canvas pages
js/popup.js      settings popup
css/content.css  injected elements and hide rules
css/theme.css    custom colors
css/popup.css
html/popup.html
```

## Credits

Inspired by [BetterCanvas](https://github.com/ksucpea/bettercanvas) and
Canvas Refined.

## License

MIT
