const THEME_NAMES = {
    default: "Classic Slate",
    dracula: "Dracula Violet",
    forest_emerald: "Emerald Focus",
    cyberpunk_amber: "Cyberpunk 2077"
};

function initThemeEngine() {
    // 1. حالت تاریک یا روشن (پیش‌فرض: Dark)
    const savedMode = localStorage.getItem("studymate_color_mode") || "dark";
    if (savedMode === "dark") {
        document.documentElement.classList.add("dark");
    } else {
        document.documentElement.classList.remove("dark");
    }

    // 2. تم خریداری شده فعال کاربر
    const savedUserTheme = localStorage.getItem("studymate_user_theme") || "default";
    applyUserEquippedTheme(savedUserTheme);
}

function toggleDarkLightMode() {
    const isDark = document.documentElement.classList.toggle("dark");
    localStorage.setItem("studymate_color_mode", isDark ? "dark" : "light");
    const modeBtn = document.getElementById("mode-toggle-btn");
    if (modeBtn) {
        modeBtn.textContent = isDark ? "☀️" : "🌙";
    }
}

function applyUserEquippedTheme(themeId) {
    const validTheme = THEME_NAMES[themeId] ? themeId : "default";
    localStorage.setItem("studymate_user_theme", validTheme);
    document.documentElement.setAttribute("data-user-theme", validTheme);

    // به‌روزرسانی بج تم در هدر در صورت وجود
    const headerBadge = document.getElementById("header-theme-badge");
    if (headerBadge) {
        headerBadge.textContent = THEME_NAMES[validTheme];
        headerBadge.className = `text-xs px-2.5 py-0.5 rounded-full text-white font-semibold profile-theme-${validTheme}`;
    }
}

function getProfileThemeClass(themeId) {
    return `profile-theme-${THEME_NAMES[themeId] ? themeId : "default"}`;
}

// اجرای اولیه بلافاصله پس از لود اسکریپت
initThemeEngine();