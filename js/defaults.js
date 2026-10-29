const THEME_PRESETS = {
    dark: { background: "#1c1c1e", surface: "#26262a", text: "#e4e4e7", accent: "#7aa2f7", nav: "#151517" },
    light: { background: "#ffffff", surface: "#f5f5f5", text: "#1f1f1f", accent: "#2f6fdb", nav: "#ededed" },
    paper: { background: "#f4f0e6", surface: "#faf7f0", text: "#2b2a27", accent: "#8a5a2b", nav: "#e9e3d5" },
};

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
    theme_colors: { ...THEME_PRESETS.dark },
    theme_parts: { background: true, surface: true, text: true, accent: true, nav: true },
    font: "",
    hide_logo: false,
    hide_course_images: false,
    hide_footer: false,
    hide_sequence_footer: false,
    hide_native_todo: true,
    hide_recent_feedback: false,
    hide_card_icons: false,
    hide_global_announcements: false,
    // keyed by origin and course id, since ids repeat across schools
    hidden_courses: {},
};

function loadSettings() {
    // nested objects merge too, so parts added later get their defaults
    return chrome.storage.sync.get(null).then(stored => ({
        ...DEFAULTS,
        ...stored,
        theme_colors: { ...DEFAULTS.theme_colors, ...stored.theme_colors },
        theme_parts: { ...DEFAULTS.theme_parts, ...stored.theme_parts },
    }));
}
