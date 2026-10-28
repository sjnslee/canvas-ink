const DEFAULTS = {
    card_assignments: true,
    card_count: 4,
    card_show_overdue: false,
    card_hide_done: false,
    todo: true,
    todo_count: 8,
    date_format: "md",
    relative_dates: false,
    theme: false,
    theme_colors: { background: "#1c1c1e", surface: "#26262a", text: "#e4e4e7", accent: "#7aa2f7", nav: "#151517" },
    font: "",
    hide_logo: false,
    hide_course_images: false,
    hide_footer: false,
    hide_sequence_footer: false,
};

const THEME_PRESETS = {
    dark: { background: "#1c1c1e", surface: "#26262a", text: "#e4e4e7", accent: "#7aa2f7", nav: "#151517" },
    light: { background: "#ffffff", surface: "#f5f5f5", text: "#1f1f1f", accent: "#2f6fdb", nav: "#ededed" },
    paper: { background: "#f4f0e6", surface: "#faf7f0", text: "#2b2a27", accent: "#8a5a2b", nav: "#e9e3d5" },
};

function loadSettings() {
    return chrome.storage.sync.get(null).then(stored => ({ ...DEFAULTS, ...stored }));
}
