const fields = document.querySelectorAll("[data-setting]");
const colorFields = document.querySelectorAll("[data-color]");
const status = document.getElementById("status");
// a file picker steals focus and closes the popup, so importing happens in a tab
const isPopup = chrome.extension.getViews({ type: "popup" }).includes(window);
let settings = { ...DEFAULTS };
let colorTimer = null;

document.body.classList.toggle("is-page", !isPopup);

loadSettings().then(loaded => {
    settings = loaded;
    fill();
});

function fill() {
    for (const field of fields) {
        const value = settings[field.dataset.setting];
        if (field.type === "checkbox") field.checked = value === true;
        else field.value = value;
    }
    for (const field of colorFields) field.value = settings.theme_colors[field.dataset.color];
}

function save(changes) {
    Object.assign(settings, changes);
    chrome.storage.sync.set(changes);
}

for (const field of fields) {
    field.addEventListener("change", () => {
        const key = field.dataset.setting;
        if (field.type === "checkbox") return save({ [key]: field.checked });
        if (field.type === "number") {
            const value = Math.round(Number(field.value));
            field.value = value > 0 ? value : DEFAULTS[key];
            return save({ [key]: Number(field.value) });
        }
        save({ [key]: field.value.trim() });
    });
}

// input fires on every drag step; batching keeps sync under its write quota
for (const field of colorFields) {
    field.addEventListener("input", () => {
        settings.theme_colors = { ...settings.theme_colors, [field.dataset.color]: field.value };
        clearTimeout(colorTimer);
        colorTimer = setTimeout(() => save({ theme_colors: settings.theme_colors }), 200);
    });
    field.addEventListener("change", () => {
        clearTimeout(colorTimer);
        save({ theme_colors: settings.theme_colors });
    });
}

for (const button of document.querySelectorAll("[data-preset]")) {
    button.addEventListener("click", () => {
        save({ theme: true, theme_colors: { ...THEME_PRESETS[button.dataset.preset] } });
        fill();
    });
}

document.getElementById("export").addEventListener("click", () => {
    const file = new Blob([JSON.stringify(settings, null, 2)], { type: "application/json" });
    const link = Object.assign(document.createElement("a"), { href: URL.createObjectURL(file), download: "canvas-ink-settings.json" });
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
});

document.getElementById("import").addEventListener("click", () => {
    if (isPopup) return chrome.runtime.openOptionsPage();
    document.getElementById("import-file").click();
});

document.getElementById("import-file").addEventListener("change", async event => {
    const [file] = event.target.files;
    if (!file) return;
    try {
        const imported = JSON.parse(await file.text());
        // only known keys with matching types make it into storage
        const changes = Object.fromEntries(Object.entries(imported).filter(([key, value]) => key in DEFAULTS && typeof value === typeof DEFAULTS[key]));
        if (changes.theme_colors) changes.theme_colors = { ...DEFAULTS.theme_colors, ...changes.theme_colors };
        save(changes);
        fill();
        status.textContent = `Imported ${Object.keys(changes).length} settings.`;
    } catch {
        status.textContent = "That file isn't a Canvas Ink settings export.";
    }
    event.target.value = "";
});

document.getElementById("reset").addEventListener("click", async () => {
    await chrome.storage.sync.clear();
    settings = { ...DEFAULTS };
    fill();
    status.textContent = "Settings reset.";
});
