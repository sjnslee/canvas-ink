const origin = window.location.origin;
const isDashboard = window.location.pathname === "/";
const plannerKey = `planner:${origin}`;
const taskTypes = ["assignment", "quiz", "discussion_topic"];
const day = 86400000;
// firefox sends content script requests as the extension; content.fetch sends them as the page
const pageFetch = globalThis.content?.fetch ? (...args) => globalThis.content.fetch(...args) : fetch;

const classSettings = {
    "ink-hide-logo": "hide_logo",
    "ink-hide-course-images": "hide_course_images",
    "ink-hide-footer": "hide_footer",
    "ink-hide-sequence-footer": "hide_sequence_footer",
    "ink-hide-native-todo": "hide_native_todo",
    "ink-hide-recent-feedback": "hide_recent_feedback",
    "ink-hide-card-icons": "hide_card_icons",
    "ink-hide-global-announcements": "hide_global_announcements",
};
const themeParts = Object.keys(DEFAULTS.theme_parts);

let settings = { ...DEFAULTS };
let tasks = [];

init();

async function init() {
    const [loaded, local] = await Promise.all([loadSettings(), chrome.storage.local.get("canvas_origins")]);
    settings = loaded;
    const origins = local.canvas_origins || [];
    // styling known canvas origins at document_start avoids a flash of unthemed page
    if (origins.includes(origin)) applyStyles();

    if (document.readyState === "loading") {
        await new Promise(resolve => document.addEventListener("DOMContentLoaded", resolve, { once: true }));
    }
    // canvas can live on any domain, but every install renders this root
    if (!document.querySelector("#application.ic-app")) {
        removeStyles();
        return;
    }
    if (!origins.includes(origin)) chrome.storage.local.set({ canvas_origins: [...origins, origin] });

    applyStyles();
    chrome.storage.onChanged.addListener(handleStorageChange);
    if (!isDashboard) return;
    watchDashboard();
    loadTasks();
}

function handleStorageChange(changes, area) {
    if (area !== "sync") return;
    for (const [key, change] of Object.entries(changes)) settings[key] = change.newValue ?? DEFAULTS[key];
    applyStyles();
    if (isDashboard) render();
}

function applyStyles() {
    const root = document.documentElement;
    for (const [className, key] of Object.entries(classSettings)) root.classList.toggle(className, settings[key] === true);
    for (const part of themeParts) root.classList.toggle(`ink-theme-${part}`, settings.theme && settings.theme_parts[part] === true);

    const colors = settings.theme_colors;
    for (const [name, value] of Object.entries(colors)) root.style.setProperty(`--ink-${name}`, value);
    // text on the nav and accent follows their own lightness, not the page text color
    root.style.setProperty("--ink-nav-text", isDarkColor(colors.nav) ? "#f2f2f2" : "#1f1f1f");
    root.style.setProperty("--ink-accent-text", isDarkColor(colors.accent) ? "#ffffff" : "#1f1f1f");
    const isBackgroundThemed = settings.theme && settings.theme_parts.background;
    root.style.colorScheme = isBackgroundThemed ? (isDarkColor(colors.background) ? "dark" : "light") : "";

    applyFont(settings.font.trim());
}

function removeStyles() {
    const root = document.documentElement;
    root.classList.remove(...Object.keys(classSettings), ...themeParts.map(part => `ink-theme-${part}`), "ink-font");
    root.style.colorScheme = "";
    document.getElementById("ink-font")?.remove();
}

function applyFont(font) {
    const root = document.documentElement;
    root.classList.toggle("ink-font", font !== "");
    document.getElementById("ink-font")?.remove();
    if (!font) return;
    root.style.setProperty("--ink-font", `"${font.replace(/"/g, "")}"`);
    const link = el("link", { id: "ink-font", rel: "stylesheet", href: `https://fonts.googleapis.com/css2?family=${encodeURIComponent(font).replace(/%20/g, "+")}&display=swap` });
    (document.head || root).append(link);
}

function isDarkColor(hex) {
    const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
    return 0.299 * r + 0.587 * g + 0.114 * b < 128;
}

async function loadTasks() {
    const cached = (await chrome.storage.local.get(plannerKey))[plannerKey];
    if (cached) {
        tasks = cached;
        render();
    }
    try {
        tasks = await fetchTasks();
    } catch (error) {
        console.warn("canvas ink: could not load planner items", error);
        return;
    }
    saveTasks();
    render();
}

async function fetchTasks() {
    // a short lookback is enough to show recent overdue work
    const start = new Date(Date.now() - 14 * day).toISOString();
    let url = `${origin}/api/v1/planner/items?start_date=${start}&per_page=100`;
    const items = [];
    for (let page = 0; url && page < 5; page++) {
        const response = await pageFetch(url, { headers: { Accept: "application/json" } });
        if (!response.ok) throw new Error(`planner request failed (${response.status})`);
        items.push(...await response.json());
        url = response.headers.get("Link")?.match(/<([^>]+)>;\s*rel="next"/)?.[1];
    }
    return items
        .filter(item => taskTypes.includes(item.plannable_type) && item.plannable_date)
        .map(item => ({
            id: item.plannable_id,
            type: item.plannable_type,
            title: item.plannable?.title ?? "",
            url: item.html_url,
            courseId: String(item.course_id),
            course: item.context_name ?? "",
            due: item.plannable_date,
            isSubmitted: item.submissions?.submitted === true,
            overrideId: item.planner_override?.id ?? null,
            isMarkedDone: item.planner_override?.marked_complete ?? null,
        }))
        .sort((a, b) => new Date(a.due) - new Date(b.due));
}

function saveTasks() {
    chrome.storage.local.set({ [plannerKey]: tasks });
}

function isDone(task) {
    return task.isMarkedDone ?? task.isSubmitted;
}

function isHiddenCourse(courseId) {
    return `${origin}/${courseId}` in settings.hidden_courses;
}

function hideCourse(courseId, name) {
    chrome.storage.sync.set({ hidden_courses: { ...settings.hidden_courses, [`${origin}/${courseId}`]: name } });
}

function isPast(task) {
    return new Date(task.due) < Date.now();
}

// marks are stored as canvas planner overrides, so they show up in canvas too
async function setDone(task, done) {
    const previous = { overrideId: task.overrideId, isMarkedDone: task.isMarkedDone };
    task.isMarkedDone = done;
    render();
    try {
        const response = await pageFetch(`${origin}/api/v1/planner/overrides${task.overrideId ? `/${task.overrideId}` : ""}`, {
            method: task.overrideId ? "PUT" : "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json", "X-CSRF-Token": csrfToken() },
            body: JSON.stringify({ plannable_type: task.type, plannable_id: task.id, marked_complete: done }),
        });
        if (!response.ok) throw new Error(`override request failed (${response.status})`);
        task.overrideId = (await response.json()).id ?? task.overrideId;
    } catch (error) {
        console.warn("canvas ink: could not save done state", error);
        Object.assign(task, previous);
    }
    saveTasks();
    render();
}

function csrfToken() {
    return decodeURIComponent(document.cookie.match(/(?:^|;\s*)_csrf_token=([^;]*)/)?.[1] ?? "");
}

function watchDashboard() {
    let timer = null;
    // canvas re-renders the dashboard after load, which wipes injected nodes
    new MutationObserver(() => {
        if (timer) return;
        timer = setTimeout(() => {
            timer = null;
            if (needsRender()) render();
        }, 100);
    }).observe(document.body, { childList: true, subtree: true });
}

function needsRender() {
    const isCardMissing = settings.card_assignments && [...document.querySelectorAll(".ic-DashboardCard")].some(card => {
        const courseId = cardCourseId(card);
        return courseId && !isHiddenCourse(courseId) && !card.querySelector(".ink-card");
    });
    const isTodoMissing = settings.todo && document.querySelector("#right-side") && !document.querySelector(".ink-todo");
    return isCardMissing || isTodoMissing;
}

function render() {
    renderCards();
    renderTodo();
}

function renderCards() {
    document.querySelectorAll(".ink-card").forEach(section => section.remove());
    if (!settings.card_assignments) return;

    for (const card of document.querySelectorAll(".ic-DashboardCard")) {
        const courseId = cardCourseId(card);
        if (!courseId || isHiddenCourse(courseId)) continue;
        const visible = tasks
            .filter(task => task.courseId === courseId && (isDone(task) ? !isPast(task) && !settings.card_hide_done : !isPast(task) || settings.card_show_overdue))
            .slice(0, settings.card_count);

        const name = card.querySelector(".ic-DashboardCard__header-title")?.textContent.trim() || `Course ${courseId}`;
        const hide = el("button", { type: "button", className: "ink-card-hide", textContent: "Hide", title: "Hide this course's work from Canvas Ink" });
        hide.addEventListener("click", () => hideCourse(courseId, name));
        const section = el("div", { className: "ink-card" }, [el("div", { className: "ink-card-header" }, [el("h3", { className: "ink-card-heading", textContent: "Due" }), hide])]);
        if (visible.length === 0) section.append(el("p", { className: "ink-empty", textContent: "Nothing due" }));
        for (const task of visible) section.append(taskRow(task, false));
        card.append(section);
    }
}

function cardCourseId(card) {
    return card.querySelector(".ic-DashboardCard__link")?.href.split("/courses/")[1];
}

function renderTodo() {
    document.querySelector(".ink-todo")?.remove();
    const sidebar = document.querySelector("#right-side");
    if (!settings.todo || !sidebar) return;

    const visible = tasks.filter(task => !isDone(task) && !isHiddenCourse(task.courseId)).slice(0, settings.todo_count);
    const section = el("section", { className: "ink-todo" }, [el("h2", { className: "ink-todo-heading", textContent: "To do" })]);
    if (visible.length === 0) section.append(el("p", { className: "ink-empty", textContent: "All caught up" }));
    for (const task of visible) section.append(taskRow(task, true));
    sidebar.prepend(section);
}

function taskRow(task, isDetailed) {
    const done = isDone(task);
    const row = el("div", { className: "ink-task" });
    row.classList.toggle("is-done", done);
    row.classList.toggle("is-overdue", !done && isPast(task));

    const check = el("input", { type: "checkbox", className: "ink-check", checked: done, title: done ? "Mark not done" : "Mark done" });
    check.addEventListener("change", () => setDone(task, check.checked));

    const title = el("a", { className: "ink-task-title", href: task.url, textContent: task.title });
    const meta = el("span", { className: "ink-task-meta", textContent: formatDue(task, isDetailed) });
    meta.title = (row.classList.contains("is-overdue") ? "Overdue, due " : "Due ") + new Date(task.due).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
    row.append(check, isDetailed ? el("div", { className: "ink-task-body" }, [title, meta]) : title);
    if (!isDetailed) row.append(meta);
    return row;
}

function formatDue(task, isDetailed) {
    const date = new Date(task.due);
    const [month, dayOfMonth] = [date.getMonth() + 1, date.getDate()];
    const parts = [settings.date_format === "dm" ? `${dayOfMonth}/${month}` : `${month}/${dayOfMonth}`];
    if (isDetailed) {
        parts[0] += " " + date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
        parts.unshift(task.course);
    }
    if (isDetailed && !isDone(task) && isPast(task)) parts.push("Overdue");
    const text = parts.filter(Boolean).join(" · ");
    return settings.relative_dates ? `${text} (${relativeTime(date)})` : text;
}

// kept short since it sits beside the date; past times are already marked overdue or done
function relativeTime(date) {
    const minutes = Math.round((date - Date.now()) / 60000);
    const size = Math.abs(minutes);
    const amount = size < 60 ? `${size}m` : size < 1440 ? `${Math.round(size / 60)}h` : `${Math.round(size / 1440)}d`;
    return minutes < 0 ? `-${amount}` : amount;
}

function el(tag, props = {}, children = []) {
    const element = Object.assign(document.createElement(tag), props);
    element.append(...children);
    return element;
}
