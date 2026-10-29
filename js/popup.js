const fields = document.querySelectorAll("[data-setting]");
const swatches = document.querySelectorAll("[data-color]");
const partFields = document.querySelectorAll("[data-part]");
const status = document.getElementById("status");
const hiddenCourses = document.getElementById("hidden-courses");
// a file picker steals focus and closes the popup, so importing happens in a tab
const isPopup = chrome.extension.getViews({ type: "popup" }).includes(window);
// firefox's native color picker closes the popup too, so colors use a built-in one
const picker = document.getElementById("picker");
const pickerArea = document.getElementById("picker-area");
const pickerThumb = document.getElementById("picker-thumb");
const pickerHue = document.getElementById("picker-hue");
const pickerHex = document.getElementById("picker-hex");
let pickerSwatch = null;
let hsv = { h: 0, s: 0, v: 0 };
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
    for (const swatch of swatches) swatch.style.backgroundColor = settings.theme_colors[swatch.dataset.color];
    for (const field of partFields) field.checked = settings.theme_parts[field.dataset.part] === true;
    if (pickerSwatch) syncPicker();
    fillHiddenCourses();
}

function fillHiddenCourses() {
    const entries = Object.entries(settings.hidden_courses);
    document.getElementById("hidden-courses-empty").hidden = entries.length > 0;
    hiddenCourses.replaceChildren(...entries.map(([key, name]) => {
        const show = Object.assign(document.createElement("button"), { type: "button", textContent: "Show" });
        show.addEventListener("click", () => {
            const { [key]: _, ...rest } = settings.hidden_courses;
            save({ hidden_courses: rest });
            fillHiddenCourses();
        });
        const label = Object.assign(document.createElement("span"), { textContent: name, title: key });
        const item = document.createElement("li");
        item.append(label, show);
        return item;
    }));
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

for (const swatch of swatches) swatch.addEventListener("click", () => togglePicker(swatch));

function togglePicker(swatch) {
    picker.hidden = pickerSwatch === swatch;
    pickerSwatch = picker.hidden ? null : swatch;
    if (!pickerSwatch) return;
    swatch.closest(".color").after(picker);
    syncPicker();
}

// presets and imports change colors under an open picker
function syncPicker() {
    hsv = hexToHsv(settings.theme_colors[pickerSwatch.dataset.color]);
    drawPicker();
}

function drawPicker() {
    pickerArea.style.setProperty("--hue", hsv.h);
    pickerThumb.style.left = `${hsv.s * 100}%`;
    pickerThumb.style.top = `${(1 - hsv.v) * 100}%`;
    pickerHue.value = hsv.h;
    pickerHex.value = settings.theme_colors[pickerSwatch.dataset.color];
}

// drags update many times a second; batching keeps sync under its write quota
function setColor(hex) {
    settings.theme_colors = { ...settings.theme_colors, [pickerSwatch.dataset.color]: hex };
    pickerSwatch.style.backgroundColor = hex;
    drawPicker();
    clearTimeout(colorTimer);
    colorTimer = setTimeout(saveColors, 200);
}

function saveColors() {
    clearTimeout(colorTimer);
    save({ theme_colors: settings.theme_colors });
}

function pickAt(event) {
    const box = pickerArea.getBoundingClientRect();
    const clamp = n => Math.min(1, Math.max(0, n));
    hsv.s = clamp((event.clientX - box.left) / box.width);
    hsv.v = 1 - clamp((event.clientY - box.top) / box.height);
    setColor(hsvToHex(hsv));
}

pickerArea.addEventListener("pointerdown", event => {
    pickerArea.setPointerCapture(event.pointerId);
    pickAt(event);
});
pickerArea.addEventListener("pointermove", event => {
    if (pickerArea.hasPointerCapture(event.pointerId)) pickAt(event);
});
pickerArea.addEventListener("pointerup", saveColors);

pickerHue.addEventListener("input", () => {
    hsv.h = Number(pickerHue.value);
    setColor(hsvToHex(hsv));
});
pickerHue.addEventListener("change", saveColors);

pickerHex.addEventListener("change", () => {
    const hex = pickerHex.value.trim().replace(/^#?/, "#").toLowerCase();
    if (!/^#[0-9a-f]{6}$/.test(hex)) return drawPicker();
    hsv = hexToHsv(hex);
    setColor(hex);
    saveColors();
});

function hsvToHex({ h, s, v }) {
    const channel = n => {
        const k = (n + h / 60) % 6;
        return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
    };
    return `#${[5, 3, 1].map(n => Math.round(channel(n) * 255).toString(16).padStart(2, "0")).join("")}`;
}

function hexToHsv(hex) {
    const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
    const max = Math.max(r, g, b);
    const range = max - Math.min(r, g, b);
    let h = 0;
    if (range && max === r) h = ((g - b) / range + 6) % 6;
    else if (range && max === g) h = (b - r) / range + 2;
    else if (range) h = (r - g) / range + 4;
    return { h: h * 60, s: max ? range / max : 0, v: max };
}

for (const field of partFields) {
    field.addEventListener("change", () => save({ theme_parts: { ...settings.theme_parts, [field.dataset.part]: field.checked } }));
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
        if (changes.theme_parts) changes.theme_parts = { ...DEFAULTS.theme_parts, ...changes.theme_parts };
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
