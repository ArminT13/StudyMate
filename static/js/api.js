const API_BASE = "";

function getToken() {
    return localStorage.getItem("studymate_token");
}

function setToken(token) {
    localStorage.setItem("studymate_token", token);
}

function logoutUser() {
    localStorage.removeItem("studymate_token");
    localStorage.setItem("studymate_user_theme", "default");
    window.location.reload();
}

async function apiRequest(endpoint, options = {}) {
    const token = getToken();
    const headers = {
        "Content-Type": "application/json",
        ...(options.headers || {})
    };
    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers
    });

    const data = await response.json().catch(() => ({}));

    if (response.status === 401) {
        openAuthModal();
        throw new Error(data.detail || "لطفاً ابتدا وارد حساب کاربری خود شوید.");
    }

    if (!response.ok) {
        const errMsg = typeof data.detail === "string"
            ? data.detail
            : JSON.stringify(data.detail || "خطا در ارتباط با سرور");
        throw new Error(errMsg);
    }

    return data;
}

/* ================= TOAST NOTIFICATION ================= */
function showToast(message, type = "success") {
    let container = document.getElementById("toast-container");
    if (!container) {
        container = document.createElement("div");
        container.id = "toast-container";
        container.className = "fixed bottom-6 left-6 z-50 flex flex-col gap-3 max-w-sm";
        document.body.appendChild(container);
    }

    const toast = document.createElement("div");
    const bgClass = type === "error"
        ? "bg-red-600/95 border-red-400"
        : "bg-slate-900/95 dark:bg-slate-800/95 border-accent";

    toast.className = `${bgClass} text-white px-4 py-3 rounded-xl border shadow-2xl flex items-center gap-3 transform transition-all duration-300 translate-y-2 opacity-0`;
    toast.innerHTML = `
        <span class="text-xl">${type === "error" ? "⚠️" : "✨"}</span>
        <p class="text-sm font-medium leading-relaxed">${message}</p>
    `;

    container.appendChild(toast);
    requestAnimationFrame(() => {
        toast.classList.remove("translate-y-2", "opacity-0");
    });

    setTimeout(() => {
        toast.classList.add("opacity-0", "translate-y-2");
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

/* ================= SOUND & CONFETTI EFFECTS ================= */
function playVictorySound() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
        notes.forEach((freq, idx) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = "triangle";
            osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.12);
            gain.gain.setValueAtTime(0.2, ctx.currentTime + idx * 0.12);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.12 + 0.35);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(ctx.currentTime + idx * 0.12);
            osc.stop(ctx.currentTime + idx * 0.12 + 0.35);
        });
    } catch (e) {
        console.log("Audio not supported");
    }
}

function triggerCoinCelebration(coins = 10) {
    playVictorySound();
    for (let i = 0; i < 18; i++) {
        const el = document.createElement("div");
        el.textContent = i % 2 === 0 ? "🪙" : "✨";
        el.className = "fixed z-50 text-2xl pointer-events-none coin-float";
        el.style.left = `${30 + Math.random() * 40}%`;
        el.style.top = `${45 + Math.random() * 20}%`;
        el.style.animationDelay = `${Math.random() * 0.35}s`;
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 1800);
    }
}

/* ================= SHARED NAVBAR & AUTH MODAL INJECTION ================= */
function injectSharedLayout(activePage) {
    // 1. پس‌زمینه نوری
    const ambient = document.createElement("div");
    ambient.className = "ambient-bg";
    document.body.prepend(ambient);

    const isDark = document.documentElement.classList.contains("dark");
    const currentLang = getCurrentLang();

    // 2. هدر ناوبری
    const nav = document.createElement("header");
    nav.className = "sticky top-0 z-40 backdrop-blur-xl bg-white/75 dark:bg-slate-900/80 border-b border-slate-200/60 dark:border-slate-800/80 transition-colors";
    nav.innerHTML = `
        <div class="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-4">
            <!-- Brand -->
            <div class="flex items-center gap-3">
                <a href="/static/index.html" class="flex items-center gap-2.5 group">
                    <div class="w-10 h-10 rounded-xl btn-accent flex items-center justify-center text-xl font-black shadow-lg">
                        S
                    </div>
                    <div>
                        <span class="text-xl font-extrabold tracking-tight">Study<span class="text-accent">Mate</span></span>
                        <span id="header-theme-badge" class="block text-[10px] px-2 py-0.2 rounded-full text-white font-semibold profile-theme-default">Classic Slate</span>
                    </div>
                </a>
            </div>

            <!-- Navigation Links -->
            <nav class="flex items-center gap-1 sm:gap-2 overflow-x-auto py-1">
                <a href="/static/index.html" data-i18n="nav_dashboard" class="px-3.5 py-2 rounded-xl text-sm font-semibold transition ${activePage === 'dashboard' ? 'btn-accent' : 'hover:bg-slate-200/60 dark:hover:bg-slate-800'}">داشبورد</a>
                <a href="/static/pomodoro.html" data-i18n="nav_pomodoro" class="px-3.5 py-2 rounded-xl text-sm font-semibold transition ${activePage === 'pomodoro' ? 'btn-accent' : 'hover:bg-slate-200/60 dark:hover:bg-slate-800'}">تایمر پومودورو</a>
                <a href="/static/ai-coach.html" data-i18n="nav_ai_coach" class="px-3.5 py-2 rounded-xl text-sm font-semibold transition ${activePage === 'ai-coach' ? 'btn-accent' : 'hover:bg-slate-200/60 dark:hover:bg-slate-800'}">مربی هوشمند AI</a>
                <a href="/static/shop.html" data-i18n="nav_shop" class="px-3.5 py-2 rounded-xl text-sm font-semibold transition ${activePage === 'shop' ? 'btn-accent' : 'hover:bg-slate-200/60 dark:hover:bg-slate-800'}">فروشگاه تم</a>
                <a href="/static/leaderboard.html" data-i18n="nav_leaderboard" class="px-3.5 py-2 rounded-xl text-sm font-semibold transition ${activePage === 'leaderboard' ? 'btn-accent' : 'hover:bg-slate-200/60 dark:hover:bg-slate-800'}">رقابت و گروه‌ها</a>
            </nav>

            <!-- Stats & Controls -->
            <div class="flex items-center gap-2.5">
                <!-- Streak Pill -->
                <div class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-orange-500/10 border border-orange-500/30 text-orange-500 font-bold text-sm" title="Daily Streak">
                    <span class="streak-flame">🔥</span>
                    <span id="nav-streak">0</span>
                </div>

                <!-- Coins Pill -->
                <div class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-500 font-bold text-sm" title="Study Coins">
                    <span>🪙</span>
                    <span id="nav-coins">0</span>
                </div>

                <!-- Language Switch -->
                <button id="lang-toggle-btn" onclick="toggleLanguage()" class="px-2.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold hover:border-accent transition">
                    ${currentLang === 'fa' ? 'EN 🌐' : 'FA 🌐'}
                </button>

                <!-- Dark/Light Switch -->
                <button id="mode-toggle-btn" onclick="toggleDarkLightMode()" class="w-9 h-9 rounded-xl border border-slate-300 dark:border-slate-700 flex items-center justify-center hover:border-accent transition">
                    ${isDark ? '☀️' : '🌙'}
                </button>

                <!-- User / Auth Button -->
                <div id="nav-user-area" class="flex items-center gap-2">
                    <button onclick="openAuthModal()" data-i18n="login_btn" class="btn-accent px-4 py-2 rounded-xl text-sm">ورود / ثبت‌نام</button>
                </div>
            </div>
        </div>
    `;
    document.body.prepend(nav);

    // 3. مودال احراز هویت (Auth Popup Modal)
    const modal = document.createElement("div");
    modal.id = "auth-modal";
    modal.className = "fixed inset-0 z-50 hidden items-center justify-center bg-black/70 backdrop-blur-md p-4";
    modal.innerHTML = `
        <div class="glass-card w-full max-w-md p-6 sm:p-8 relative border border-slate-700 shadow-2xl">
            <div class="flex justify-between items-center mb-6">
                <h2 id="auth-modal-title" data-i18n="auth_title_login" class="text-2xl font-extrabold">ورود به StudyMate</h2>
                <button onclick="closeAuthModal()" class="text-slate-400 hover:text-white text-xl">✕</button>
            </div>

            <!-- Tabs -->
            <div class="grid grid-cols-2 gap-2 p-1 bg-slate-200/70 dark:bg-slate-800/90 rounded-xl mb-6">
                <button id="tab-login-btn" onclick="switchAuthTab('login')" data-i18n="auth_tab_login" class="py-2 rounded-lg font-bold text-sm btn-accent">ورود</button>
                <button id="tab-register-btn" onclick="switchAuthTab('register')" data-i18n="auth_tab_register" class="py-2 rounded-lg font-bold text-sm text-slate-500 dark:text-slate-400">ثبت‌نام</button>
            </div>

            <form id="auth-form" onsubmit="handleAuthSubmit(event)" class="space-y-4">
                <div>
                    <label data-i18n="username_label" class="block text-xs font-bold uppercase tracking-wider mb-1.5 opacity-80">نام کاربری</label>
                    <input type="text" id="auth-username" required minlength="3" class="w-full px-4 py-3 rounded-xl bg-slate-100 dark:bg-slate-800/90 border border-slate-300 dark:border-slate-700 focus:outline-none focus:border-accent" placeholder="armin_cs">
                </div>

                <div id="auth-email-group" class="hidden">
                    <label data-i18n="email_label" class="block text-xs font-bold uppercase tracking-wider mb-1.5 opacity-80">ایمیل</label>
                    <input type="email" id="auth-email" class="w-full px-4 py-3 rounded-xl bg-slate-100 dark:bg-slate-800/90 border border-slate-300 dark:border-slate-700 focus:outline-none focus:border-accent" placeholder="armin@example.com">
                </div>

                <div>
                    <label data-i18n="password_label" class="block text-xs font-bold uppercase tracking-wider mb-1.5 opacity-80">رمز عبور</label>
                    <input type="password" id="auth-password" required minlength="6" class="w-full px-4 py-3 rounded-xl bg-slate-100 dark:bg-slate-800/90 border border-slate-300 dark:border-slate-700 focus:outline-none focus:border-accent" placeholder="••••••">
                </div>

                <button type="submit" id="auth-submit-btn" data-i18n="submit_login" class="w-full btn-accent py-3.5 rounded-xl font-bold text-base mt-2">
                    ورود به حساب
                </button>
            </form>
        </div>
    `;
    document.body.appendChild(modal);

    applyLanguage(currentLang);
    syncHeaderUserStats();
}

let currentAuthMode = "login";

function openAuthModal() {
    const modal = document.getElementById("auth-modal");
    if (modal) {
        modal.classList.remove("hidden");
        modal.classList.add("flex");
    }
}

function closeAuthModal() {
    const modal = document.getElementById("auth-modal");
    if (modal) {
        modal.classList.add("hidden");
        modal.classList.remove("flex");
    }
}

function switchAuthTab(mode) {
    currentAuthMode = mode;
    const emailGroup = document.getElementById("auth-email-group");
    const emailInput = document.getElementById("auth-email");
    const loginTab = document.getElementById("tab-login-btn");
    const regTab = document.getElementById("tab-register-btn");
    const title = document.getElementById("auth-modal-title");
    const submitBtn = document.getElementById("auth-submit-btn");

    if (mode === "register") {
        emailGroup.classList.remove("hidden");
        emailInput.required = true;
        regTab.className = "py-2 rounded-lg font-bold text-sm btn-accent";
        loginTab.className = "py-2 rounded-lg font-bold text-sm text-slate-500 dark:text-slate-400";
        title.textContent = t("auth_title_register");
        submitBtn.textContent = t("submit_register");
    } else {
        emailGroup.classList.add("hidden");
        emailInput.required = false;
        loginTab.className = "py-2 rounded-lg font-bold text-sm btn-accent";
        regTab.className = "py-2 rounded-lg font-bold text-sm text-slate-500 dark:text-slate-400";
        title.textContent = t("auth_title_login");
        submitBtn.textContent = t("submit_login");
    }
}

async function handleAuthSubmit(e) {
    e.preventDefault();
    const username = document.getElementById("auth-username").value.trim();
    const password = document.getElementById("auth-password").value;
    const email = document.getElementById("auth-email").value.trim();

    try {
        const endpoint = currentAuthMode === "register" ? "/auth/register" : "/auth/login";
        const body = currentAuthMode === "register" ? { username, email, password } : { username, password };

        const res = await apiRequest(endpoint, {
            method: "POST",
            body: JSON.stringify(body)
        });

        setToken(res.access_token);
        closeAuthModal();
        showToast(`خوش آمدید ${username}! 🎉`);
        await syncHeaderUserStats();
        window.dispatchEvent(new CustomEvent("authSuccess"));
    } catch (err) {
        showToast(err.message, "error");
    }
}

async function syncHeaderUserStats() {
    const token = getToken();
    if (!token) {
        openAuthModal();
        return null;
    }

    try {
        const stats = await apiRequest("/dashboard/stats");
        document.getElementById("nav-coins").textContent = stats.coins;
        document.getElementById("nav-streak").textContent = stats.current_streak;

        applyUserEquippedTheme(stats.active_theme);

        const userArea = document.getElementById("nav-user-area");
        if (userArea) {
            userArea.innerHTML = `
                <div class="flex items-center gap-2 pl-1">
                    <div class="px-3 py-1.5 rounded-xl text-white text-xs font-bold flex items-center gap-1.5 ${getProfileThemeClass(stats.active_theme)}">
                        <span>👤</span>
                        <span>${stats.username}</span>
                    </div>
                    <button onclick="logoutUser()" class="text-xs px-2.5 py-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 font-semibold transition">
                        ${t("logout_btn")}
                    </button>
                </div>
            `;
        }
        return stats;
    } catch (err) {
        console.warn("Could not sync stats:", err.message);
        return null;
    }
}