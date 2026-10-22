class AmbientSynthEngine {
    constructor() {
        this.ctx = null;
        this.activeNodes = [];
        this.gainNode = null;
    }
    init() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            this.gainNode = this.ctx.createGain();
            this.gainNode.gain.value = 0.35;
            this.gainNode.connect(this.ctx.destination);
        }
        if (this.ctx.state === "suspended") {
            this.ctx.resume();
        }
    }
    stop() {
        this.activeNodes.forEach(n => {
            try { n.stop(); } catch (e) {}
            try { n.disconnect(); } catch (e) {}
        });
        this.activeNodes = [];
    }
    setVolume(vol) {
        if (this.gainNode) this.gainNode.gain.value = vol;
    }
    play(type) {
        this.init();
        this.stop();
        if (type === "none") return;

        if (type === "rain" || type === "whitenoise") {
            const bufferSize = this.ctx.sampleRate * 2;
            const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
            const data = buffer.getChannelData(0);
            let lastOut = 0.0;
            for (let i = 0; i < bufferSize; i++) {
                const white = Math.random() * 2 - 1;
                data[i] = type === "rain"
                    ? (lastOut = (lastOut + 0.02 * white) / 1.02) * 3.5
                    : white * 0.15;
            }
            const noise = this.ctx.createBufferSource();
            noise.buffer = buffer;
            noise.loop = true;
            noise.connect(this.gainNode);
            noise.start();
            this.activeNodes.push(noise);
        } else if (type === "lofidrone") {
            [130.81, 196.00, 246.94, 329.63].forEach(freq => {
                const osc = this.ctx.createOscillator();
                osc.type = "sine";
                osc.frequency.value = freq;
                const filter = this.ctx.createBiquadFilter();
                filter.type = "lowpass";
                filter.frequency.value = 400;
                osc.connect(filter);
                filter.connect(this.gainNode);
                osc.start();
                this.activeNodes.push(osc);
            });
        }
    }
}
const ambientEngine = new AmbientSynthEngine();

const { useState, useEffect, useRef } = React;

const EXTRA_I18N = {
    fa: {
        ambient_player_title: "سیستم صوتی محیطی (Lo-Fi & Synth)",
        sound_none: "خاموش 🔇",
        sound_rain: "باران 🌧️",
        sound_whitenoise: "وایت‌نویز 📻",
        sound_lofidrone: "سینت کیهانی 🌌",
        quiz_modal_title: "چالش اثبات مطالعه Gemini 🧠",
        quiz_modal_sub: "پاسخ صحیح به هر سوال = +۵ سکه طلایی و شارژ کریتیکال!",
        quiz_claim_btn: "ثبت پاسخ و دریافت پاداش ✨",
        quiz_skip_btn: "بستن",
        heatmap_title: "ماتریس حرارتی استمرار مطالعه (۱۲۰ روز اخیر)",
        heatmap_sub: "ردپای تمرکز روزانه شما در شبکه نئونی",
        hero_boss_badge: "⚔️ نبرد زنده با غول (LIVE BOSS ENCOUNTER)",
        hero_sim_boss_name: "آرش‌لیچ امتحانات پایان‌ترم و کنکور",
        hero_attack_cta: "⚔️ حمله با تایمر فوکوس (شروع پومودورو)",
        hero_test_strike: "💥 ضربه آزمایشی (-25 HP)",
        hero_boss_hint: "هر ۱ دقیقه فوکوس در پومودورو یا تکمیل مأموریت‌های روزانه از خون این غول کم می‌کند!",
        quest_board_title: "تخته مأموریت‌های روزانه (Quest Log)",
        quest_board_courses: "مأموریت‌های درسی فعال (Active Quests)",
        diff_easy: "EASY",
        diff_hard: "HARD",
        diff_legendary: "LEGENDARY",
        raid_title: "نبرد با غول گروهی (Guild Boss Raid)",
        raid_sub: "هر ۱ دقیقه پومودوروی اعضا = ۱ ضربه (Damage) به جان باس!",
        raid_step1_label: "۱. نام درس یا هدف (برای ساخت نام غول توسط Gemini):",
        raid_course_ph: "مثلاً: ساختمان داده، هوش مصنوعی، ریاضی ۱...",
        raid_ai_suggest_btn: "پیشنهاد نام غول با Gemini ✨",
        raid_ai_loading: "در حال خلق نام...",
        raid_boss_name_ph: "نام غول (یا با دکمه بالا توسط هوش مصنوعی بسازید)",
        raid_step2_label: "۲. تعیین مقدار جان غول (Boss HP - هر ۱ دقیقه پومودورو = ۱ اچ‌پی):",
        raid_hp_Convert_rule: "قانون ثابت پاداش: به ازای هر ۲۵ اچ‌پی، دقیقاً ۱۰ سکه به اعضا پاداش داده می‌شود.",
        raid_locked_bounty: "پاداش قفل‌شده این باس:",
        raid_create_btn: "احضار غول نبرد ⚔️",
        raid_defeated: "شکست خورد! پاداش به اعضا واریز شد 🏆",
        raid_top_dmg: "قهرمانان ضربه‌زننده (کلیک برای مشاهده کارت RPG):",
        squad_members: "اعضای کلن (کلیک روی هر نفر برای دیدن کارت کاراکتر)",
        click_profile_hint: "برای مشاهده کارت هولوگرافیک ۳ بعدی روی نام کاربران کلیک کنید 👤",
        profile_pomos: "پومودوروهای موفق",
        profile_raid_dmg: "کل دمیج به باس‌ها",
        profile_member_since: "تاریخ ورود به سیستم",
        close_btn: "بستن"
    },
    en: {
        ambient_player_title: "Focus Ambient Synth",
        sound_none: "Muted 🔇",
        sound_rain: "Rain 🌧️",
        sound_whitenoise: "White Noise 📻",
        sound_lofidrone: "Cosmic Lo-Fi 🌌",
        quiz_modal_title: "Gemini Proof-of-Study Trial 🧠",
        quiz_modal_sub: "Each correct answer grants +5 Bonus Gold & Critical XP!",
        quiz_claim_btn: "Submit & Claim Bounty ✨",
        quiz_skip_btn: "Close",
        heatmap_title: "120-Day Focus Continuum Matrix",
        heatmap_sub: "Your daily study intensity tracked on the cyber grid",
        hero_boss_badge: "⚔️ LIVE BOSS ENCOUNTER",
        hero_sim_boss_name: "Arch-Lich of Final Exams & Deadlines",
        hero_attack_cta: "⚔️ Attack: Engage Focus Timer",
        hero_test_strike: "💥 Test Strike (-25 HP)",
        hero_boss_hint: "Every 1 minute of Pomodoro focus or completed Quest deals direct damage to the Boss HP!",
        quest_board_title: "Daily Quest Board",
        quest_board_courses: "Active Course Quests",
        diff_easy: "EASY",
        diff_hard: "HARD",
        diff_legendary: "LEGENDARY",
        raid_title: "Guild Boss Raid",
        raid_sub: "Every 1 minute of completed Pomodoro deals 1 Damage to the Boss!",
        raid_step1_label: "1. Enter Course or Goal (for Gemini AI Boss Naming):",
        raid_course_ph: "e.g. Data Structures, Artificial Intelligence, Calculus...",
        raid_ai_suggest_btn: "Generate Boss Name with Gemini ✨",
        raid_ai_loading: "Summoning Names...",
        raid_boss_name_ph: "Boss Title (or click AI Generate above)",
        raid_step2_label: "2. Enter Boss HP (Every 1 min of Pomodoro = 1 HP Damage):",
        raid_hp_Convert_rule: "Fixed Bounty Formula: Every 25 HP automatically grants 10 Coins (Non-editable).",
        raid_locked_bounty: "Locked Boss Bounty:",
        raid_create_btn: "Summon Raid Boss ⚔️",
        raid_defeated: "Defeated! Bounty awarded to contributors 🏆",
        raid_top_dmg: "Top Damage Dealers (Click to inspect RPG Card):",
        squad_members: "Guild Operatives (Click any member to inspect RPG Card)",
        click_profile_hint: "Click on any operative's name to inspect their 3D Holographic Character Card 👤",
        profile_pomos: "Verified Pomodoros",
        profile_raid_dmg: "Total Boss Damage",
        profile_member_since: "Operative Since",
        close_btn: "Close"
    }
};

function playSynthChime() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = "triangle";
            osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.11);
            gain.gain.setValueAtTime(0.18, ctx.currentTime + i * 0.11);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.11 + 0.35);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(ctx.currentTime + i * 0.11);
            osc.stop(ctx.currentTime + i * 0.11 + 0.35);
        });
    } catch (e) {}
}

function playSwordSlashSound() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(280, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(55, ctx.currentTime + 0.22);
        gain.gain.setValueAtTime(0.25, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.24);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.24);
    } catch (e) {}
}

/* افکت انفجار ذرات هنگام تیک زدن کوئست یا ضربه به باس */
function spawnParticleBurst(clientX, clientY, colors = ["#facc15", "#a855f7", "#06b6d4", "#ef4444", "#10b981"]) {
    const x = clientX || window.innerWidth / 2;
    const y = clientY || window.innerHeight / 2;
    for (let i = 0; i < 20; i++) {
        const p = document.createElement("div");
        p.className = "quest-particle";
        const angle = Math.random() * Math.PI * 2;
        const dist = 35 + Math.random() * 85;
        p.style.left = `${x}px`;
        p.style.top = `${y}px`;
        p.style.backgroundColor = colors[i % colors.length];
        p.style.boxShadow = `0 0 10px ${colors[i % colors.length]}`;
        p.style.setProperty("--tx", `${Math.cos(angle) * dist}px`);
        p.style.setProperty("--ty", `${Math.sin(angle) * dist}px`);
        document.body.appendChild(p);
        setTimeout(() => p.remove(), 750);
    }
}

function getTomorrowISO() {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split("T")[0];
}

function getTodayISO() {
    return new Date().toISOString().split("T")[0];
}

/* ۱. کامپوننت ذرات نوری معلق پس‌زمینه (Ambient Floating Embers) */
function AmbientEmbers() {
    const embers = [
        { left: "8%", top: "85%", size: 4, color: "#8b5cf6", dur: "11s", delay: "0s" },
        { left: "22%", top: "90%", size: 3, color: "#06b6d4", dur: "14s", delay: "2s" },
        { left: "38%", top: "80%", size: 5, color: "#f59e0b", dur: "9s", delay: "1s" },
        { left: "55%", top: "92%", size: 3, color: "#ec4899", dur: "13s", delay: "3s" },
        { left: "72%", top: "88%", size: 4, color: "#10b981", dur: "12s", delay: "0.5s" },
        { left: "88%", top: "82%", size: 5, color: "#ef4444", dur: "10s", delay: "2.5s" }
    ];
    return (
        <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
            {embers.map((em, i) => (
                <span
                    key={i}
                    className="ambient-ember"
                    style={{
                        left: em.left,
                        top: em.top,
                        width: `${em.size}px`,
                        height: `${em.size}px`,
                        backgroundColor: em.color,
                        boxShadow: `0 0 12px ${em.color}`,
                        animationDuration: em.dur,
                        animationDelay: em.delay
                    }}
                ></span>
            ))}
        </div>
    );
}

/* ۲. کارت پروفایل هولوگرافیک ۳ بعدی با افکت Tilt on Hover و بج متالیک */
function HolographicRPGCard(props) {
    const { stats, activeThemeObj, lang, t, onClick } = props;
    const cardRef = useRef(null);
    const [tiltStyle, setTiltStyle] = useState({});

    const handleMouseMove = (e) => {
        if (!cardRef.current) return;
        const rect = cardRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const rotateY = ((x / rect.width) - 0.5) * 18;
        const rotateX = ((0.5 - (y / rect.height)) * 18);
        setTiltStyle({
            transform: `perspective(900px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.02)`,
            transition: "transform 0.08s ease-out"
        });
    };

    const handleMouseLeave = () => {
        setTiltStyle({
            transform: "perspective(900px) rotateX(0deg) rotateY(0deg) scale(1)",
            transition: "transform 0.4s ease-out"
        });
    };

    const xpPct = Math.min(100, Math.round(((stats.xp || 0) / (stats.next_level_xp || 150)) * 100));

    return (
        <div
            ref={cardRef}
            onClick={onClick}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            style={tiltStyle}
            title={t("click_profile_hint")}
            className={`p-4 rounded-2xl text-white space-y-3.5 cursor-pointer relative overflow-hidden aura-${stats.active_theme || 'default'}`}
        >
            {/* هایلایت هولوگرافیک */}
            <div className="flex items-start justify-between gap-2">
                <div>
                    <div className="flex flex-wrap items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded-md metallic-gold-badge text-[10px] tracking-wider">
                            LVL {stats.level || 1}
                        </span>
                        <span className="px-2 py-0.5 rounded-md metallic-platinum-badge text-[10px]">
                            {lang === "fa" ? (stats.title_fa || "نوآموز خواب‌آلود") : (stats.title || "Sleepy Novice")}
                        </span>
                    </div>
                    <h3 className="font-extrabold text-lg mt-2 flex items-center gap-1.5 tracking-tight">
                        <span>{stats.username}</span>
                        <span className="text-xs opacity-80">⚡</span>
                    </h3>
                    <span className="text-[10px] opacity-80 block">
                        {activeThemeObj ? (lang === "fa" ? activeThemeObj.name_fa : activeThemeObj.name) : "Cyber Slate"}
                    </span>
                </div>
                <span className="px-2.5 py-1 rounded-xl bg-black/50 border border-white/15 backdrop-blur-md text-xs font-black text-amber-300">
                    #{stats.leaderboard_rank}
                </span>
            </div>

            {/* HUD XP Bar */}
            <div className="space-y-1 bg-black/35 p-2.5 rounded-xl border border-white/10">
                <div className="flex justify-between text-[10px] font-bold">
                    <span className="text-cyan-300">HUD XP</span>
                    <span>{stats.xp || 0} / {stats.next_level_xp || 150} ({xpPct}%)</span>
                </div>
                <div className="w-full h-2 bg-black/60 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-gradient-to-r from-violet-500 via-cyan-400 to-amber-300 rounded-full transition-all duration-500"
                        style={{ width: `${xpPct}%` }}
                    ></div>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
                <div className="bg-black/40 border border-white/10 rounded-xl p-2 text-center">
                    <span className="block text-sm font-black text-amber-300">{stats.coins} 🪙</span>
                    <span className="text-[10px] opacity-75">{t("coins_unit")}</span>
                </div>
                <div className="bg-black/40 border border-white/10 rounded-xl p-2 text-center">
                    <span className="block text-sm font-black text-orange-400">{stats.current_streak} / 7 🔥</span>
                    <span className="text-[10px] opacity-75">{t("day_label")}</span>
                </div>
            </div>
        </div>
    );
}

/* ۳. سکشن Hero اینتراکتیو با ماک‌آپ زنده باس‌فایت و دکمه Attack */
function LiveBossEncounterHero(props) {
    const { activeRaid, lang, t, onEngagePomodoro } = props;
    const [simHp, setSimHp] = useState(2400);
    const maxSimHp = 3000;
    const [shaking, setShaking] = useState(false);
    const [dmgPops, setDmgPops] = useState([]);

    const bossTitle = activeRaid ? activeRaid.boss_name : t("hero_sim_boss_name");
    const currentHp = activeRaid ? activeRaid.current_hp : simHp;
    const maxHp = activeRaid ? activeRaid.max_hp : maxSimHp;
    const rewardCoins = activeRaid ? activeRaid.reward_coins : 1200;
    const hpPercent = Math.max(0, Math.min(100, Math.round((currentHp / maxHp) * 100)));

    const triggerTestStrike = (e) => {
        playSwordSlashSound();
        spawnParticleBurst(e.clientX, e.clientY, ["#ef4444", "#f97316", "#facc15"]);
        setShaking(true);
        setTimeout(() => setShaking(false), 500);

        if (!activeRaid) {
            setSimHp(prev => (prev <= 50 ? maxSimHp : prev - 25));
        }

        const id = Date.now() + Math.random();
        setDmgPops(prev => [...prev, { id, text: "-25 HP CRITICAL! ⚔️" }]);
        setTimeout(() => {
            setDmgPops(prev => prev.filter(p => p.id !== id));
        }, 950);
    };

    return (
        <div className={`bento-card rim-light-boss p-6 sm:p-7 relative overflow-hidden bg-gradient-to-br from-zinc-950 via-red-950/25 to-zinc-950 ${shaking ? "boss-shake" : ""}`}>
            {/* نمایش اعداد دمیج شناور */}
            <div className="absolute top-6 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center">
                {dmgPops.map(p => (
                    <span key={p.id} className="damage-pop text-lg sm:text-xl font-black text-amber-300 drop-shadow-[0_2px_10px_rgba(239,68,68,0.9)]">
                        {p.text}
                    </span>
                ))}
            </div>

            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
                <div className="space-y-3 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="px-3 py-1 rounded-full bg-red-500/20 border border-red-500/50 text-red-300 text-[11px] font-black tracking-wider">
                            {t("hero_boss_badge")}
                        </span>
                        <span className="px-3 py-1 rounded-full metallic-gold-badge text-[11px]">
                            BOUNTY: +{rewardCoins} 🪙
                        </span>
                    </div>

                    <div className="flex items-center gap-3">
                        <span className="text-3xl sm:text-4xl">🐉</span>
                        <div>
                            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">{bossTitle}</h2>
                            <p className="text-xs text-slate-400 mt-0.5">{t("hero_boss_hint")}</p>
                        </div>
                    </div>

                    {/* نوار سلامتی گدازه‌ای بزرگ (Molten Boss HP Bar) */}
                    <div className="space-y-1.5 pt-1">
                        <div className="flex justify-between text-xs font-black">
                            <span className="text-red-400">BOSS HEALTH (HP)</span>
                            <span className="text-amber-300 font-display">{currentHp} / {maxHp} HP ({hpPercent}%)</span>
                        </div>
                        <div className="w-full h-4 bg-black/80 rounded-full overflow-hidden border border-red-500/40 p-0.5">
                            <div
                                className="h-full bg-gradient-to-r from-red-600 via-orange-500 to-amber-400 rounded-full transition-all duration-300 shadow-[0_0_15px_rgba(239,68,68,0.8)]"
                                style={{ width: `${hpPercent}%` }}
                            ></div>
                        </div>
                    </div>
                </div>

                {/* دکمه‌های اکشن و حمله (Attack Controls) */}
                <div className="flex flex-col sm:flex-row lg:flex-col gap-2.5 shrink-0">
                    <button
                        type="button"
                        onClick={onEngagePomodoro}
                        className="attack-btn px-6 py-3.5 rounded-2xl text-xs sm:text-sm flex items-center justify-center gap-2"
                    >
                        <span>{t("hero_attack_cta")}</span>
                    </button>
                    <button
                        type="button"
                        onClick={triggerTestStrike}
                        className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-red-500/20 border border-red-500/30 text-red-200 text-xs font-bold transition"
                    >
                        {t("hero_test_strike")}
                    </button>
                </div>
            </div>
        </div>
    );
}

function StudyHeatmap(props) {
    const heatmapData = Array.isArray(props.heatmapData) ? props.heatmapData : [];
    const t = typeof props.t === "function" ? props.t : (k) => k;

    const days = [];
    const map = {};
    heatmapData.forEach(d => { map[d.date] = d.minutes; });

    for (let i = 119; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const iso = d.toISOString().split("T")[0];
        days.push({ date: iso, mins: map[iso] || 0 });
    }

    return (
        <div className="bento-card p-6 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <h3 className="font-black text-base flex items-center gap-2">
                    <span className="text-accent">💠</span>
                    <span>{t("heatmap_title")}</span>
                </h3>
                <span className="text-xs text-slate-400">{t("heatmap_sub")}</span>
            </div>
            <div className="flex flex-wrap gap-1.5 pt-2">
                {days.map(d => {
                    let bg = "bg-slate-800/40 border border-slate-700/30";
                    if (d.mins >= 100) bg = "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]";
                    else if (d.mins >= 50) bg = "bg-emerald-500";
                    else if (d.mins >= 25) bg = "bg-emerald-700";
                    else if (d.mins > 0) bg = "bg-emerald-900";

                    return (
                        <div
                            key={d.date}
                            title={`${d.date}: ${d.mins} mins`}
                            className={`w-3.5 h-3.5 rounded-sm transition hover:scale-125 cursor-pointer ${bg}`}
                        ></div>
                    );
                })}
            </div>
        </div>
    );
}

function RaidSummonForm(props) {
    const { groupId, lang, t, api, notify, onCreated } = props;
    const [courseInput, setCourseInput] = useState("");
    const [bossName, setBossName] = useState("");
    const [suggestions, setSuggestions] = useState([]);
    const [suggestLoading, setSuggestLoading] = useState(false);
    const [hp, setHp] = useState(250);

    const calculatedCoins = Math.floor((parseInt(hp, 10) || 0) / 25) * 10;

    const handleSuggestBossNames = async () => {
        if (!courseInput.trim()) {
            notify(lang === "fa" ? "ابتدا نام درس یا هدف را وارد کنید!" : "Enter a course or goal first!", "error");
            return;
        }
        setSuggestLoading(true);
        try {
            const res = await api("/ai/suggest-boss-name", {
                method: "POST",
                body: JSON.stringify({ course_or_goal: courseInput.trim(), lang })
            });
            const list = res.suggestions || [];
            setSuggestions(list);
            if (list.length > 0) setBossName(list[0]);
        } catch (err) {
            notify(err.message, "error");
        } finally {
            setSuggestLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!courseInput.trim() && !bossName.trim()) return;
        try {
            await api(`/groups/${groupId}/raids`, {
                method: "POST",
                body: JSON.stringify({
                    course_or_goal: courseInput.trim() || bossName.trim(),
                    boss_name: bossName.trim() || null,
                    max_hp: Math.max(25, parseInt(hp, 10) || 250),
                    lang
                })
            });
            setCourseInput("");
            setBossName("");
            setSuggestions([]);
            notify(lang === "fa" ? "غول جدید احضار شد! ⚔️" : "Raid Boss Summoned! ⚔️");
            if (typeof onCreated === "function") onCreated();
        } catch (err) {
            notify(err.message, "error");
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-3 pt-3 border-t border-red-500/25">
            <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-red-200">{t("raid_step1_label")}</label>
                <div className="flex gap-2">
                    <input
                        value={courseInput}
                        onChange={(e) => setCourseInput(e.target.value)}
                        required
                        placeholder={t("raid_course_ph")}
                        className="flex-1 px-3 py-2 rounded-lg bg-black/50 border border-red-500/30 text-xs text-white focus:outline-none focus:border-red-400"
                    />
                    <button
                        type="button"
                        onClick={handleSuggestBossNames}
                        disabled={suggestLoading}
                        className="px-3 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-[11px] shrink-0 transition"
                    >
                        {suggestLoading ? t("raid_ai_loading") : t("raid_ai_suggest_btn")}
                    </button>
                </div>

                {suggestions.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                        {suggestions.map((s, idx) => (
                            <button
                                key={idx}
                                type="button"
                                onClick={() => setBossName(s)}
                                className={`text-[10px] px-2.5 py-1 rounded-full border font-bold transition ${bossName === s ? "bg-amber-500 text-slate-950 border-amber-300" : "bg-black/40 text-slate-300 border-slate-700 hover:border-amber-400"}`}
                            >
                                🐉 {s}
                            </button>
                        ))}
                    </div>
                )}

                <input
                    value={bossName}
                    onChange={(e) => setBossName(e.target.value)}
                    placeholder={t("raid_boss_name_ph")}
                    className="w-full px-3 py-2 rounded-lg bg-black/35 border border-red-500/20 text-xs text-amber-300 font-bold focus:outline-none"
                />
            </div>

            <div className="p-3 rounded-xl bg-black/40 border border-red-500/20 space-y-2">
                <label className="block text-[11px] font-bold text-red-200">{t("raid_step2_label")}</label>
                <div className="grid grid-cols-4 gap-1.5">
                    {[100, 250, 500, 1000].map(presetHp => (
                        <button
                            key={presetHp}
                            type="button"
                            onClick={() => setHp(presetHp)}
                            className={`py-1 rounded text-[10px] font-black border transition ${parseInt(hp, 10) === presetHp ? "bg-red-600 text-white border-red-400" : "bg-black/40 text-slate-300 border-slate-700"}`}
                        >
                            {presetHp} HP
                        </button>
                    ))}
                </div>

                <div className="grid grid-cols-2 gap-2 items-center pt-1">
                    <div>
                        <span className="text-[10px] text-slate-400 block mb-0.5">HP (Min 25):</span>
                        <input
                            type="number"
                            min="25"
                            max="50000"
                            step="25"
                            value={hp}
                            onChange={(e) => setHp(e.target.value)}
                            required
                            className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-red-500/40 text-sm font-black text-white text-center"
                        />
                    </div>

                    <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-center">
                        <span className="text-[10px] text-amber-200 block">{t("raid_locked_bounty")}</span>
                        <span className="text-base font-black text-amber-400">🔒 {calculatedCoins} 🪙</span>
                    </div>
                </div>
                <p className="text-[10px] text-slate-400">{t("raid_hp_Convert_rule")}</p>
            </div>

            <button type="submit" className="w-full py-2.5 rounded-xl attack-btn text-xs">
                {t("raid_create_btn")}
            </button>
        </form>
    );
}

function App() {
    const [lang, setLang] = useState(localStorage.getItem("studymate_lang") || "fa");
    const [darkMode, setDarkMode] = useState((localStorage.getItem("studymate_color_mode") || "dark") === "dark");
    const [activeTab, setActiveTab] = useState(window.INITIAL_TAB || "dashboard");
    const [token, setToken] = useState(localStorage.getItem("studymate_token") || "");
    const [showAuthModal, setShowAuthModal] = useState(!localStorage.getItem("studymate_token"));
    const [authMode, setAuthMode] = useState("login");
    const [toast, setToast] = useState(null);

    const [stats, setStats] = useState(null);
    const [heatmap, setHeatmap] = useState([]);
    const [courses, setCourses] = useState([]);
    const [sessions, setSessions] = useState([]);
    const [themes, setThemes] = useState([]);
    const [leaderboard, setLeaderboard] = useState([]);
    const [lbTimeframe, setLbTimeframe] = useState("all_time");
    const [groups, setGroups] = useState([]);
    const [groupRaids, setGroupRaids] = useState({});
    const [plans, setPlans] = useState([]);
    const [selectedPlan, setSelectedPlan] = useState(null);
    const [aiLoading, setAiLoading] = useState(false);

    const [inspectedProfile, setInspectedProfile] = useState(null);

    const [ambientType, setAmbientType] = useState("none");
    const [ambientVol, setAmbientVol] = useState(0.35);

    const [pomoTargetMins, setPomoTargetMins] = useState(25);
    const [pomoTopic, setPomoTopic] = useState("");
    const [pomoRemainingSec, setPomoRemainingSec] = useState(25 * 60);
    const [pomoSessionId, setPomoSessionId] = useState(null);
    const [pomoPaused, setPomoPaused] = useState(false);

    const [quizModal, setQuizModal] = useState(null);

    const t = (key) =>
        (window.I18N_DICT && window.I18N_DICT[lang] && window.I18N_DICT[lang][key]) ||
        (EXTRA_I18N[lang] && EXTRA_I18N[lang][key]) ||
        key;

    const notify = (msg, type = "success") => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 4200);
    };

    useEffect(() => {
        localStorage.setItem("studymate_lang", lang);
        document.documentElement.lang = lang;
        document.documentElement.dir = lang === "fa" ? "rtl" : "ltr";
    }, [lang]);

    useEffect(() => {
        localStorage.setItem("studymate_color_mode", darkMode ? "dark" : "light");
        document.documentElement.classList.toggle("dark", darkMode);
    }, [darkMode]);

    const handleAmbientChange = (type) => {
        setAmbientType(type);
        ambientEngine.play(type);
    };

    const handleVolumeChange = (v) => {
        const val = parseFloat(v);
        setAmbientVol(val);
        ambientEngine.setVolume(val);
    };

    const api = async (endpoint, options = {}) => {
        const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
        if (token) headers["Authorization"] = `Bearer ${token}`;
        const res = await fetch(endpoint, { ...options, headers });
        const data = await res.json().catch(() => ({}));
        if (res.status === 401) {
            setShowAuthModal(true);
            throw new Error(data.detail || "Unauthorized");
        }
        if (!res.ok) {
            throw new Error(typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail));
        }
        return data;
    };

    const openUserProfile = async (userId) => {
        if (!userId) return;
        try {
            const prof = await api(`/users/${userId}/profile`);
            setInspectedProfile(prof);
        } catch (err) {
            notify(err.message, "error");
        }
    };

    const refreshAll = async () => {
        if (!token) return;
        try {
            const [st, crs, sss, thm, hmap] = await Promise.all([
                api("/dashboard/stats"),
                api("/courses"),
                api("/sessions"),
                api("/shop/themes"),
                api("/dashboard/heatmap").catch(() => [])
            ]);
            setStats(st);
            setCourses(crs);
            setSessions(sss);
            setThemes(thm);
            setHeatmap(hmap);
            document.documentElement.setAttribute("data-user-theme", st.active_theme || "default");
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => {
        if (token) {
            refreshAll();
            loadAIPlans();
            loadArenaData(lbTimeframe);
        }
    }, [token]);

    const loadAIPlans = async () => {
        if (!token) return;
        try {
            const list = await api("/ai/plans");
            setPlans(list);
            if (list.length > 0 && !selectedPlan) {
                const detail = await api(`/ai/plans/${list[0].id}`);
                setSelectedPlan(detail);
            }
        } catch (e) {}
    };

    const loadArenaData = async (tf = "all_time") => {
        const targetTf = typeof tf === "string" ? tf : lbTimeframe;
        setLbTimeframe(targetTf);
        try {
            const lb = await api(`/leaderboard?timeframe=${targetTf}`);
            setLeaderboard(lb);
            if (token) {
                const myG = await api("/groups/my");
                const fullG = await Promise.all(myG.map(g => api(`/groups/${g.id}`)));
                setGroups(fullG);

                const raidsMap = {};
                await Promise.all(
                    fullG.map(async (g) => {
                        const rList = await api(`/groups/${g.id}/raids`).catch(() => []);
                        raidsMap[g.id] = rList;
                    })
                );
                setGroupRaids(raidsMap);
            }
        } catch (e) {}
    };

    useEffect(() => {
        if (!pomoSessionId || pomoPaused) return;
        const timer = setInterval(() => {
            setPomoRemainingSec((prev) => {
                if (prev <= 1) {
                    clearInterval(timer);
                    handleCompletePomodoro(pomoSessionId);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, [pomoSessionId, pomoPaused]);

    const handleStartPomodoro = async () => {
        try {
            const res = await api("/pomodoro/start", {
                method: "POST",
                body: JSON.stringify({
                    topic: pomoTopic.trim() || (lang === "fa" ? "تمرکز عمیق" : "Deep Focus"),
                    target_minutes: pomoTargetMins
                })
            });
            setPomoRemainingSec(pomoTargetMins * 60);
            setPomoSessionId(res.id);
            setPomoPaused(false);
        } catch (err) {
            notify(err.message, "error");
        }
    };

    const handleCompletePomodoro = async (sid) => {
        try {
            const res = await api(`/pomodoro/${sid}/complete`, { method: "POST" });
            playSynthChime();
            spawnParticleBurst(window.innerWidth / 2, window.innerHeight / 2);
            const bonusText = res.streak_bonus_coins > 0
                ? ` + ${res.streak_bonus_coins} 🔥 Streak Bonus!`
                : "";
            notify(`+${res.coins_earned} 🪙 Coins Earned!${bonusText}`);
            setPomoSessionId(null);
            setPomoRemainingSec(pomoTargetMins * 60);
            refreshAll();
            loadArenaData(lbTimeframe);

            try {
                const qList = await api(`/pomodoro/${sid}/quiz?lang=${lang}`);
                if (Array.isArray(qList) && qList.length > 0) {
                    setQuizModal({ sessionId: sid, questions: qList, selected: {} });
                }
            } catch (qe) {}
        } catch (err) {
            notify(err.message, "error");
            setPomoSessionId(null);
            setPomoRemainingSec(pomoTargetMins * 60);
        }
    };

    const handleClaimQuizBonus = async () => {
        if (!quizModal) return;
        const correctIndices = [];
        quizModal.questions.forEach((q, idx) => {
            if (quizModal.selected[idx] === q.correct_index) {
                correctIndices.push(idx);
            }
        });

        if (correctIndices.length === 0) {
            notify(lang === "fa" ? "پاسخ صحیحی ثبت نشد!" : "No correct answers!", "error");
            setQuizModal(null);
            return;
        }

        try {
            const res = await api(`/pomodoro/${quizModal.sessionId}/quiz/claim`, {
                method: "POST",
                body: JSON.stringify({ answers: correctIndices })
            });
            playSynthChime();
            notify(res.message);
            setQuizModal(null);
            refreshAll();
        } catch (err) {
            notify(err.message, "error");
            setQuizModal(null);
        }
    };

    const handleAbandonPomodoro = async () => {
        if (!pomoSessionId) return;
        try {
            await api(`/pomodoro/${pomoSessionId}/abandon`, { method: "POST" });
            notify(lang === "fa" ? "جلسه لغو شد (۰ سکه)." : "Session abandoned (0 coins).", "error");
        } catch (e) {}
        setPomoSessionId(null);
        setPomoPaused(false);
        setPomoRemainingSec(pomoTargetMins * 60);
        refreshAll();
    };

    const handleAuth = async (e) => {
        e.preventDefault();
        const form = new FormData(e.target);
        const payload = Object.fromEntries(form.entries());
        try {
            const ep = authMode === "register" ? "/auth/register" : "/auth/login";
            const res = await api(ep, { method: "POST", body: JSON.stringify(payload) });
            localStorage.setItem("studymate_token", res.access_token);
            setToken(res.access_token);
            setShowAuthModal(false);
            notify(lang === "fa" ? "خوش آمدید!" : "Welcome aboard!");
        } catch (err) {
            notify(err.message, "error");
        }
    };

    const activeThemeObj = themes.find(th => th.id === (stats?.active_theme || "default"));

    // پیدا کردن اولین باس فعال کاربر در گروه‌ها برای نمایش در سکشن Hero
    let firstActiveRaid = null;
    Object.values(groupRaids).forEach(rList => {
        if (Array.isArray(rList)) {
            const found = rList.find(r => r.status === "active");
            if (found && !firstActiveRaid) firstActiveRaid = found;
        }
    });

    return (
        <div className="min-h-screen flex flex-col lg:flex-row relative z-10">
            <AmbientEmbers />

            {toast && (
                <div className={`fixed bottom-6 right-6 z-50 px-5 py-3.5 rounded-2xl shadow-2xl border font-bold text-sm flex items-center gap-3 ${toast.type === 'error' ? 'bg-red-950/95 border-red-500 text-red-200' : 'bg-zinc-900/95 border-accent text-white'}`}>
                    <span>{toast.type === "error" ? "⚠️" : "⚡"}</span>
                    <span>{toast.msg}</span>
                </div>
            )}

            {/* PUBLIC USER PROFILE POPUP MODAL (RPG CHARACTER SHEET) */}
            {inspectedProfile && (
                <div
                    onClick={() => setInspectedProfile(null)}
                    className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4"
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        className={`w-full max-w-md rounded-3xl p-6 sm:p-8 text-white shadow-2xl space-y-6 relative overflow-hidden aura-${inspectedProfile.active_theme || 'default'}`}
                    >
                        <div className="flex items-start justify-between">
                            <div>
                                <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full bg-black/50 border border-white/20">
                                    {inspectedProfile.rarity} • {lang === "fa" ? inspectedProfile.theme_name_fa : inspectedProfile.theme_name}
                                </span>
                                <h2 className="text-3xl font-black mt-3 flex items-center gap-2">
                                    <span>{inspectedProfile.username}</span>
                                </h2>
                                <div className="flex flex-wrap items-center gap-2 mt-2">
                                    <span className="px-2.5 py-0.5 rounded-lg metallic-gold-badge text-xs">
                                        LVL {inspectedProfile.level}
                                    </span>
                                    <span className="px-2.5 py-0.5 rounded-lg metallic-platinum-badge text-xs">
                                        {lang === "fa" ? inspectedProfile.title_fa : inspectedProfile.title}
                                    </span>
                                </div>
                            </div>
                            <button
                                onClick={() => setInspectedProfile(null)}
                                className="w-8 h-8 rounded-full bg-black/40 hover:bg-black/70 flex items-center justify-center text-sm font-bold"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="bg-black/40 p-3.5 rounded-2xl space-y-1.5 border border-white/10 backdrop-blur-sm">
                            <div className="flex justify-between text-xs font-bold">
                                <span className="text-cyan-300">HUD XP</span>
                                <span>{inspectedProfile.xp} / {inspectedProfile.next_level_xp} XP</span>
                            </div>
                            <div className="w-full h-2.5 bg-black/60 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-violet-500 via-cyan-400 to-amber-300 rounded-full"
                                    style={{ width: `${Math.min(100, (inspectedProfile.xp / (inspectedProfile.next_level_xp || 150)) * 100)}%` }}
                                ></div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-black/40 border border-white/10 p-3.5 rounded-2xl text-center">
                                <span className="text-xl font-black text-amber-300 block">{inspectedProfile.coins} 🪙</span>
                                <span className="text-[11px] opacity-80">{t("coins_unit")}</span>
                            </div>
                            <div className="bg-black/40 border border-white/10 p-3.5 rounded-2xl text-center">
                                <span className="text-xl font-black text-orange-400 block">{inspectedProfile.current_streak} 🔥</span>
                                <span className="text-[11px] opacity-80">{t("day_label")}</span>
                            </div>
                            <div className="bg-black/40 border border-white/10 p-3.5 rounded-2xl text-center">
                                <span className="text-xl font-black text-emerald-300 block">{inspectedProfile.total_study_hours} {t("hours_short")}</span>
                                <span className="text-[11px] opacity-80">{t("profile_pomos")}: {inspectedProfile.total_pomodoros} 🍅</span>
                            </div>
                            <div className="bg-black/40 border border-white/10 p-3.5 rounded-2xl text-center">
                                <span className="text-xl font-black text-red-400 block">{inspectedProfile.total_raid_damage} ⚔️</span>
                                <span className="text-[11px] opacity-80">{t("profile_raid_dmg")}</span>
                            </div>
                        </div>

                        <div className="flex items-center justify-between text-[11px] opacity-80 pt-2 border-t border-white/15">
                            <span>{t("profile_member_since")}: {inspectedProfile.created_at}</span>
                            <button
                                onClick={() => setInspectedProfile(null)}
                                className="px-4 py-1.5 rounded-xl bg-white/20 hover:bg-white/30 font-bold text-white transition"
                            >
                                {t("close_btn")}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Post-Pomodoro AI Quiz Modal */}
            {quizModal && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
                    <div className="bento-card rim-light-ai w-full max-w-lg p-6 sm:p-8 space-y-5">
                        <div>
                            <h2 className="text-xl font-black text-accent">{t("quiz_modal_title")}</h2>
                            <p className="text-xs text-slate-400 mt-1">{t("quiz_modal_sub")}</p>
                        </div>

                        <div className="space-y-4 max-h-96 overflow-y-auto pr-1">
                            {quizModal.questions.map((q, qIdx) => (
                                <div key={qIdx} className="p-4 rounded-xl bg-elevated border border-slate-700/50 space-y-2.5">
                                    <p className="text-xs font-bold">{qIdx + 1}. {q.question}</p>
                                    <div className="grid grid-cols-1 gap-2">
                                        {q.options.map((opt, oIdx) => {
                                            const isSelected = quizModal.selected[qIdx] === oIdx;
                                            return (
                                                <button
                                                    key={oIdx}
                                                    type="button"
                                                    onClick={() =>
                                                        setQuizModal(prev => ({
                                                            ...prev,
                                                            selected: { ...prev.selected, [qIdx]: oIdx }
                                                        }))
                                                    }
                                                    className={`text-start px-3.5 py-2.5 rounded-lg text-xs font-semibold border transition ${isSelected ? "border-accent bg-indigo-500/20 text-white" : "border-slate-700/50 hover:border-slate-500"}`}
                                                >
                                                    {opt}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="flex gap-3 pt-2">
                            <button onClick={handleClaimQuizBonus} className="flex-1 tactile-btn py-3 rounded-xl text-xs">
                                {t("quiz_claim_btn")}
                            </button>
                            <button onClick={() => setQuizModal(null)} className="px-4 py-3 rounded-xl bg-elevated text-slate-400 text-xs font-bold">
                                {t("quiz_skip_btn")}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Auth Modal */}
            {showAuthModal && (
                <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
                    <div className="bento-card rim-light-ai w-full max-w-md p-7 space-y-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-2xl font-black font-display">Study<span className="text-accent">Mate</span> Neo-RPG</h2>
                                <p className="text-xs text-slate-400 mt-0.5">{t("app_subtitle")}</p>
                            </div>
                            <button onClick={() => setLang(lang === "fa" ? "en" : "fa")} className="px-3 py-1.5 rounded-xl border border-slate-700 text-xs font-bold">
                                {lang === "fa" ? "EN" : "FA"}
                            </button>
                        </div>

                        <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-elevated">
                            <button onClick={() => setAuthMode("login")} className={`py-2.5 rounded-lg text-xs font-bold transition ${authMode === "login" ? "tactile-btn" : "text-slate-400"}`}>
                                {t("auth_login_tab")}
                            </button>
                            <button onClick={() => setAuthMode("register")} className={`py-2.5 rounded-lg text-xs font-bold transition ${authMode === "register" ? "tactile-btn" : "text-slate-400"}`}>
                                {t("auth_register_tab")}
                            </button>
                        </div>

                        <form onSubmit={handleAuth} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-400 mb-1">{t("username")}</label>
                                <input name="username" required minLength={3} className="w-full px-4 py-3 rounded-xl bg-elevated border border-slate-700/60 focus:outline-none focus:border-accent text-sm" />
                            </div>
                            {authMode === "register" && (
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 mb-1">{t("email")}</label>
                                    <input name="email" type="email" required className="w-full px-4 py-3 rounded-xl bg-elevated border border-slate-700/60 focus:outline-none focus:border-accent text-sm" />
                                </div>
                            )}
                            <div>
                                <label className="block text-xs font-bold text-slate-400 mb-1">{t("password")}</label>
                                <input name="password" type="password" required minLength={6} className="w-full px-4 py-3 rounded-xl bg-elevated border border-slate-700/60 focus:outline-none focus:border-accent text-sm" />
                            </div>
                            <button type="submit" className="w-full tactile-btn py-3.5 rounded-xl text-sm">
                                {authMode === "login" ? t("login_cta") : t("register_cta")}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Tactical Neo-RPG Sidebar */}
            <aside className="lg:w-76 shrink-0 border-b lg:border-b-0 lg:border-e border-white/10 bg-zinc-950/80 backdrop-blur-2xl p-5 flex flex-col justify-between gap-6">
                <div className="space-y-5">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl tactile-btn flex items-center justify-center font-display font-black text-xl">S</div>
                            <div>
                                <h1 className="font-display font-black text-lg leading-none">Study<span className="text-accent">Mate</span></h1>
                                <span className="text-[10px] text-cyan-400 font-bold tracking-wider uppercase">Cyber-SaaS RPG</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <button onClick={() => setLang(lang === "fa" ? "en" : "fa")} className="px-2.5 py-1.5 rounded-lg border border-white/10 text-xs font-bold hover:border-accent">
                                {lang === "fa" ? "EN" : "FA"}
                            </button>
                            <button onClick={() => setDarkMode(!darkMode)} className="px-2.5 py-1.5 rounded-lg border border-white/10 text-xs">
                                {darkMode ? "☀️" : "🌙"}
                            </button>
                        </div>
                    </div>

                    {/* 3D Tilt Gamer Profile Card */}
                    {stats && (
                        <HolographicRPGCard
                            stats={stats}
                            activeThemeObj={activeThemeObj}
                            lang={lang}
                            t={t}
                            onClick={() => openUserProfile(stats.user_id)}
                        ></HolographicRPGCard>
                    )}

                    <nav className="flex lg:flex-col gap-1.5 overflow-x-auto">
                        {[
                            { id: "dashboard", label: t("nav_dashboard"), icon: "⚡" },
                            { id: "pomodoro", label: t("nav_pomodoro"), icon: "⚔️" },
                            { id: "ai", label: t("nav_ai"), icon: "📜" },
                            { id: "shop", label: t("nav_shop"), icon: "🔮" },
                            { id: "arena", label: t("nav_arena"), icon: "🏆" }
                        ].map(item => (
                            <button
                                key={item.id}
                                onClick={() => setActiveTab(item.id)}
                                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold whitespace-nowrap transition ${activeTab === item.id ? "tactile-btn" : "text-slate-400 hover:bg-white/5"}`}
                            >
                                <span>{item.icon}</span>
                                <span>{item.label}</span>
                            </button>
                        ))}
                    </nav>

                    <div className="p-3.5 rounded-2xl bg-elevated border border-white/10 space-y-2.5">
                        <span className="text-[11px] font-black text-slate-300 block">🎧 {t("ambient_player_title")}</span>
                        <div className="grid grid-cols-2 gap-1.5">
                            {[
                                { id: "none", label: t("sound_none") },
                                { id: "rain", label: t("sound_rain") },
                                { id: "whitenoise", label: t("sound_whitenoise") },
                                { id: "lofidrone", label: t("sound_lofidrone") }
                            ].map(snd => (
                                <button
                                    key={snd.id}
                                    onClick={() => handleAmbientChange(snd.id)}
                                    className={`py-1.5 px-2 rounded-lg text-[10px] font-bold transition ${ambientType === snd.id ? "tactile-btn" : "bg-black/30 text-slate-400 hover:text-white"}`}
                                >
                                    {snd.label}
                                </button>
                            ))}
                        </div>
                        {ambientType !== "none" && (
                            <input
                                type="range"
                                min="0.05"
                                max="0.8"
                                step="0.05"
                                value={ambientVol}
                                onChange={(e) => handleVolumeChange(e.target.value)}
                                className="w-full accent-violet-500 h-1 cursor-pointer"
                            />
                        )}
                    </div>
                </div>

                {stats && (
                    <button
                        onClick={() => {
                            localStorage.removeItem("studymate_token");
                            window.location.reload();
                        }}
                        className="w-full py-2.5 rounded-xl border border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs font-bold transition"
                    >
                        {t("logout")}
                    </button>
                )}
            </aside>

            {/* Main Viewport */}
            <main className="flex-1 p-4 sm:p-8 max-w-6xl mx-auto w-full space-y-6">
                {activeTab === "dashboard" && stats && (
                    <div className="space-y-6">
                        {/* ۱. سکشن Hero با باس‌فایت زنده و دکمه Attack */}
                        <LiveBossEncounterHero
                            activeRaid={firstActiveRaid}
                            lang={lang}
                            t={t}
                            onEngagePomodoro={() => setActiveTab("pomodoro")}
                        ></LiveBossEncounterHero>

                        {/* ۲. چرخه پاداش استریک ۷ روزه */}
                        <div className="bento-card p-6 space-y-4">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <div>
                                    <h2 className="text-lg font-black">{t("streak_track_title")}</h2>
                                    <p className="text-xs text-slate-400">{t("streak_track_sub")}</p>
                                </div>
                                <span className="text-xs font-bold px-3 py-1.5 rounded-xl bg-orange-500/10 border border-orange-500/30 text-orange-400">
                                    {stats.streak_status === "active_today"
                                        ? t("streak_done_today")
                                        : `${t("streak_waiting")} +${stats.next_streak_reward} 🪙`}
                                </span>
                            </div>

                            <div className="grid grid-cols-7 gap-2 pt-2">
                                {[1, 2, 3, 4, 5, 6, 7].map(dayNum => {
                                    const reward = 10 + (dayNum - 1) * 5;
                                    const isUnlocked = stats.current_streak >= dayNum;
                                    const isCurrent = stats.current_streak === dayNum;
                                    return (
                                        <div
                                            key={dayNum}
                                            className={`p-3 rounded-xl border text-center transition ${isCurrent ? "border-orange-400 bg-orange-500/20 scale-105 shadow-lg" : isUnlocked ? "border-emerald-500/40 bg-emerald-500/10" : "border-white/5 bg-elevated opacity-60"}`}
                                        >
                                            <span className="text-[11px] font-bold block text-slate-400">{t("day_label")} {dayNum}</span>
                                            <span className="text-base sm:text-lg font-black block my-1 text-amber-400">+{reward}</span>
                                            <span className="text-[10px] block">{isUnlocked ? "🔥" : "🔒"}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* ۳. کارت‌های HUD آمار (Bento Grid) */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="bento-card p-5">
                                <span className="text-xs text-slate-400 font-bold">{t("stat_today_study")}</span>
                                <p className="text-2xl sm:text-3xl font-black text-accent mt-2 font-display">
                                    {stats.today_study_hours} {t("hours_short")} <span className="text-xs text-slate-400">({stats.today_study_minutes} {t("mins_short")})</span>
                                </p>
                            </div>
                            <div className="bento-card p-5">
                                <span className="text-xs text-slate-400 font-bold">{t("stat_verified_pomo")}</span>
                                <p className="text-2xl sm:text-3xl font-black text-emerald-400 mt-2 font-display">
                                    {stats.today_pomodoro_count} <span className="text-xs text-slate-400">({stats.today_pomodoro_minutes} {t("mins_short")})</span>
                                </p>
                            </div>
                            <div className="bento-card p-5">
                                <span className="text-xs text-slate-400 font-bold">{t("stat_total_hours")}</span>
                                <p className="text-2xl sm:text-3xl font-black text-amber-400 mt-2 font-display">
                                    {stats.total_study_hours} {t("hours_short")}
                                </p>
                            </div>
                            <div className="bento-card p-5">
                                <span className="text-xs text-slate-400 font-bold">{t("stat_global_rank")}</span>
                                <p className="text-2xl sm:text-3xl font-black text-cyan-400 mt-2 font-display">#{stats.leaderboard_rank}</p>
                            </div>
                        </div>

                        <StudyHeatmap heatmapData={heatmap} t={t}></StudyHeatmap>

                        {/* ۴. تخته مأموریت‌های درسی (Quest Board) و ثبت سریع */}
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                            <div className="lg:col-span-7 bento-card rim-light-ai p-6 space-y-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-lg font-black flex items-center gap-2">
                                        <span>📜</span>
                                        <span>{t("quest_board_courses")}</span>
                                    </h3>
                                </div>
                                <form
                                    onSubmit={async (e) => {
                                        e.preventDefault();
                                        const fd = new FormData(e.target);
                                        try {
                                            await api("/courses", {
                                                method: "POST",
                                                body: JSON.stringify({
                                                    name: fd.get("name"),
                                                    weekly_goal_hours: parseFloat(fd.get("hours")),
                                                    color: fd.get("color")
                                                })
                                            });
                                            e.target.reset();
                                            spawnParticleBurst(window.innerWidth / 2, window.innerHeight / 2);
                                            refreshAll();
                                        } catch (err) {
                                            notify(err.message, "error");
                                        }
                                    }}
                                    className="grid grid-cols-1 sm:grid-cols-4 gap-2.5"
                                >
                                    <input name="name" required placeholder={t("course_name_ph")} className="sm:col-span-2 px-3.5 py-2.5 rounded-xl bg-elevated border border-slate-700/50 text-xs" />
                                    <div className="flex gap-2">
                                        <input name="hours" type="number" step="0.5" min="1" max="60" defaultValue="5" required placeholder={t("weekly_hours_ph")} className="w-full px-3 py-2.5 rounded-xl bg-elevated border border-slate-700/50 text-xs" />
                                        <input name="color" type="color" defaultValue="#8b5cf6" className="w-10 h-10 rounded-lg bg-transparent cursor-pointer" />
                                    </div>
                                    <button type="submit" className="tactile-btn py-2.5 px-4 rounded-xl text-xs">{t("add_course")}</button>
                                </form>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                                    {courses.length === 0 ? (
                                        <p className="text-xs text-slate-400 col-span-2">{t("no_courses")}</p>
                                    ) : (
                                        courses.map(c => {
                                            const diffBadge = c.weekly_goal_hours >= 10
                                                ? { label: t("diff_legendary"), cls: "badge-legendary" }
                                                : c.weekly_goal_hours >= 5
                                                ? { label: t("diff_hard"), cls: "badge-hard" }
                                                : { label: t("diff_easy"), cls: "badge-easy" };
                                            const questXp = Math.round(c.weekly_goal_hours * 600);

                                            return (
                                                <div key={c.id} className="p-4 rounded-xl bg-elevated border border-white/10 hover:border-accent flex items-center justify-between transition">
                                                    <div className="flex items-center gap-3">
                                                        <span className="w-2.5 h-10 rounded-full" style={{ background: c.color, boxShadow: `0 0 10px ${c.color}` }}></span>
                                                        <div>
                                                            <div className="flex items-center gap-1.5">
                                                                <span className={`text-[9px] px-2 py-0.5 rounded font-black ${diffBadge.cls}`}>{diffBadge.label}</span>
                                                                <span className="text-[10px] font-black text-amber-300">+{questXp} XP</span>
                                                            </div>
                                                            <h4 className="font-bold text-sm mt-1">{c.name}</h4>
                                                            <span className="text-[11px] text-slate-400">Target: {c.weekly_goal_hours} {t("hours_short")}/wk</span>
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={async () => {
                                                            await api(`/courses/${c.id}`, { method: "DELETE" });
                                                            refreshAll();
                                                        }}
                                                        className="text-xs text-slate-500 hover:text-red-400 px-2"
                                                    >
                                                        ✕
                                                    </button>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>

                            <div className="lg:col-span-5 bento-card p-6 space-y-4">
                                <h3 className="text-lg font-black">{t("quick_log_header")}</h3>
                                <div className="p-3 rounded-xl bg-elevated space-y-1.5">
                                    <div className="flex justify-between text-xs font-bold">
                                        <span className="text-slate-400">{t("quick_log_cap_label")}</span>
                                        <span className="text-accent">{stats.today_quick_minutes} / 600 {t("mins_short")} ({stats.remaining_quick_minutes} {t("quick_log_remaining")})</span>
                                    </div>
                                    <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                                        <div className="h-full bg-violet-500 transition-all" style={{ width: `${Math.min(100, (stats.today_quick_minutes / 600) * 100)}%` }}></div>
                                    </div>
                                </div>

                                <form
                                    onSubmit={async (e) => {
                                        e.preventDefault();
                                        const fd = new FormData(e.target);
                                        try {
                                            await api("/sessions", {
                                                method: "POST",
                                                body: JSON.stringify({
                                                    course_id: parseInt(fd.get("course_id")),
                                                    duration_minutes: parseInt(fd.get("duration_minutes")),
                                                    notes: fd.get("notes")
                                                })
                                            });
                                            e.target.reset();
                                            spawnParticleBurst(window.innerWidth / 2, window.innerHeight / 2);
                                            notify(lang === "fa" ? "مأموریت ثبت شد و XP دریافت کردید!" : "Quest logged & XP gained!");
                                            refreshAll();
                                        } catch (err) {
                                            notify(err.message, "error");
                                        }
                                    }}
                                    className="space-y-3"
                                >
                                    <select name="course_id" required className="w-full px-3.5 py-2.5 rounded-xl bg-elevated border border-slate-700/50 text-xs">
                                        <option value="">{t("select_course")}</option>
                                        {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                    <input name="duration_minutes" type="number" min="1" max={Math.max(1, stats.remaining_quick_minutes)} required placeholder={t("duration_mins_ph")} className="w-full px-3.5 py-2.5 rounded-xl bg-elevated border border-slate-700/50 text-xs" />
                                    <input name="notes" placeholder={t("notes_ph")} className="w-full px-3.5 py-2.5 rounded-xl bg-elevated border border-slate-700/50 text-xs" />
                                    <button type="submit" disabled={stats.remaining_quick_minutes <= 0} className="w-full tactile-btn py-3 rounded-xl text-xs disabled:opacity-40">
                                        {t("log_btn")}
                                    </button>
                                </form>

                                <div className="pt-2 border-t border-slate-800/50 space-y-2">
                                    <span className="text-[11px] font-bold text-slate-400 uppercase">{t("recent_logs")}</span>
                                    {sessions.length === 0 ? (
                                        <p className="text-xs text-slate-500">{t("no_logs")}</p>
                                    ) : (
                                        sessions.slice(0, 4).map(s => (
                                            <div key={s.id} className="flex justify-between text-xs p-2.5 rounded-lg bg-elevated border border-white/5">
                                                <span className="font-bold">{s.course_name}</span>
                                                <span className="text-cyan-400 font-bold">+{s.duration_minutes * 10} XP ({s.duration_minutes}m)</span>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === "pomodoro" && (
                    <div className="bento-card rim-light-boss p-6 sm:p-10 max-w-2xl mx-auto text-center space-y-6">
                        <h2 className="text-2xl sm:text-3xl font-black">{t("pomo_header")}</h2>
                        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold">
                            🛡️ {t("pomo_rule_banner")}
                        </div>

                        <div className="flex flex-wrap justify-center gap-2.5">
                            {[25, 50, 75, 100].map(m => (
                                <button
                                    key={m}
                                    disabled={!!pomoSessionId}
                                    onClick={() => {
                                        setPomoTargetMins(m);
                                        setPomoRemainingSec(m * 60);
                                    }}
                                    className={`px-4 py-2 rounded-xl text-xs font-bold transition ${pomoTargetMins === m ? "tactile-btn" : "bg-elevated border border-slate-700/50"} disabled:opacity-50`}
                                >
                                    {m} {t("mins_short")} (+{(m / 25) * 10} 🪙 / -{m} Boss HP)
                                </button>
                            ))}
                        </div>

                        <input
                            value={pomoTopic}
                            disabled={!!pomoSessionId}
                            onChange={(e) => setPomoTopic(e.target.value)}
                            placeholder={t("pomo_topic_ph")}
                            className="w-full max-w-md mx-auto block px-4 py-3 rounded-xl bg-elevated border border-slate-700/60 text-xs text-center"
                        />

                        <div className="relative w-64 h-64 sm:w-72 sm:h-72 mx-auto flex items-center justify-center">
                            {(() => {
                                const totalSec = pomoTargetMins * 60;
                                const elapsed = totalSec - pomoRemainingSec;
                                const pct = totalSec > 0 ? Math.min(100, Math.round((elapsed / totalSec) * 100)) : 0;
                                const dash = 691;
                                const offset = dash - (pct / 100) * dash;
                                const mm = String(Math.floor(pomoRemainingSec / 60)).padStart(2, "0");
                                const ss = String(pomoRemainingSec % 60).padStart(2, "0");
                                return (
                                    <>
                                        <svg className="w-full h-full -rotate-90" viewBox="0 0 250 250">
                                            <circle cx="125" cy="125" r="110" stroke="currentColor" strokeWidth="10" className="text-slate-800" fill="transparent" />
                                            <circle
                                                cx="125"
                                                cy="125"
                                                r="110"
                                                stroke="var(--accent-primary)"
                                                strokeWidth="12"
                                                strokeLinecap="round"
                                                fill="transparent"
                                                strokeDasharray={dash}
                                                strokeDashoffset={offset}
                                                style={{ transition: "stroke-dashoffset 0.8s linear", filter: "drop-shadow(0 0 12px var(--accent-glow))" }}
                                            />
                                        </svg>
                                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                                            <span className="text-5xl font-black font-display tracking-wider">{mm}:{ss}</span>
                                            <span className="text-xs font-bold text-accent mt-2">{pct}% CHARGED</span>
                                        </div>
                                    </>
                                );
                            })()}
                        </div>

                        <p className="text-xs text-slate-400">
                            {pomoSessionId ? t("pomo_running_hint") : t("pomo_ready_hint")}
                        </p>

                        <div className="flex justify-center gap-3">
                            {!pomoSessionId ? (
                                <button onClick={handleStartPomodoro} className="attack-btn px-8 py-4 rounded-2xl text-sm">
                                    ⚔️ {t("pomo_start_btn")}
                                </button>
                            ) : (
                                <>
                                    <button onClick={() => setPomoPaused(!pomoPaused)} className="px-6 py-3.5 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs">
                                        {pomoPaused ? t("pomo_resume_btn") : t("pomo_pause_btn")}
                                    </button>
                                    <button onClick={handleAbandonPomodoro} className="px-6 py-3.5 rounded-xl bg-red-500/20 border border-red-500/40 text-red-300 font-bold text-xs">
                                        {t("pomo_abandon_btn")}
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                )}

                {/* TAB 3: GEMINI AI QUEST BOARD (با بج سختی و انفجار ذرات هنگام تکمیل کوئست) */}
                {activeTab === "ai" && (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                        <div className="lg:col-span-4 space-y-5">
                            <div className="bento-card rim-light-ai p-6 space-y-4">
                                <h2 className="text-xl font-black">{t("ai_header")}</h2>
                                <p className="text-xs text-slate-400">{t("ai_sub")}</p>

                                <form
                                    onSubmit={async (e) => {
                                        e.preventDefault();
                                        const fd = new FormData(e.target);
                                        setAiLoading(true);
                                        try {
                                            const created = await api("/ai/generate-plan", {
                                                method: "POST",
                                                body: JSON.stringify({
                                                    goal_title: fd.get("goal_title"),
                                                    target_date: fd.get("target_date"),
                                                    daily_hours: parseFloat(fd.get("daily_hours")),
                                                    topics: fd.get("topics").split(/[,،]/).map(s => s.trim()).filter(Boolean),
                                                    notes: fd.get("notes") || null,
                                                    lang
                                                })
                                            });
                                            const full = await api(`/ai/plans/${created.id}`);
                                            setSelectedPlan(full);
                                            loadAIPlans();
                                        } catch (err) {
                                            notify(err.message, "error");
                                        } finally {
                                            setAiLoading(false);
                                        }
                                    }}
                                    className="space-y-3"
                                >
                                    <input name="goal_title" required placeholder={t("ai_goal_ph")} className="w-full px-3.5 py-2.5 rounded-xl bg-elevated border border-slate-700/50 text-xs" />
                                    <div>
                                        <label className="block text-[11px] font-bold text-slate-400 mb-1">{t("ai_target_date")}</label>
                                        <input name="target_date" type="date" min={getTomorrowISO()} defaultValue={getTomorrowISO()} required className="w-full px-3.5 py-2.5 rounded-xl bg-elevated border border-slate-700/50 text-xs" />
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-bold text-slate-400 mb-1">{t("ai_daily_hours")}</label>
                                        <input name="daily_hours" type="number" step="0.5" min="1" max="14" defaultValue="3.5" required className="w-full px-3.5 py-2.5 rounded-xl bg-elevated border border-slate-700/50 text-xs" />
                                    </div>
                                    <input name="topics" required placeholder={t("ai_topics_ph")} className="w-full px-3.5 py-2.5 rounded-xl bg-elevated border border-slate-700/50 text-xs" />
                                    <textarea name="notes" rows="2" placeholder={t("ai_notes_ph")} className="w-full px-3.5 py-2.5 rounded-xl bg-elevated border border-slate-700/50 text-xs"></textarea>
                                    <button type="submit" disabled={aiLoading} className="w-full tactile-btn py-3 rounded-xl text-xs">
                                        {aiLoading ? t("ai_generating") : t("ai_generate_btn")}
                                    </button>
                                </form>
                            </div>

                            <div className="bento-card p-5 space-y-2.5">
                                <h3 className="text-sm font-black">{t("ai_saved_plans")}</h3>
                                {plans.length === 0 ? (
                                    <p className="text-xs text-slate-400">{t("ai_no_plans")}</p>
                                ) : (
                                    plans.map(p => (
                                        <div
                                            key={p.id}
                                            onClick={async () => {
                                                const d = await api(`/ai/plans/${p.id}`);
                                                setSelectedPlan(d);
                                            }}
                                            className={`p-3 rounded-xl border cursor-pointer flex justify-between items-center text-xs ${selectedPlan?.id === p.id ? "border-accent bg-indigo-500/10" : "border-slate-800 bg-elevated"}`}
                                        >
                                            <div>
                                                <p className="font-bold">{p.goal_title}</p>
                                                <span className="text-[10px] text-slate-400">{p.target_date}</span>
                                            </div>
                                            <button
                                                onClick={async (ev) => {
                                                    ev.stopPropagation();
                                                    await api(`/ai/plans/${p.id}`, { method: "DELETE" });
                                                    setSelectedPlan(null);
                                                    loadAIPlans();
                                                }}
                                                className="text-slate-400 hover:text-red-400 px-2"
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        <div className="lg:col-span-8">
                            {!selectedPlan ? (
                                <div className="bento-card p-12 text-center text-slate-400 text-sm">{t("ai_select_prompt")}</div>
                            ) : (
                                <div className="bento-card rim-light-ai p-6 space-y-5">
                                    <div className="flex flex-wrap justify-between items-center gap-3 border-b border-slate-800 pb-4">
                                        <div>
                                            <span className="text-[10px] font-black uppercase tracking-widest text-cyan-400 block">{t("quest_board_title")}</span>
                                            <h3 className="text-2xl font-black mt-0.5">{selectedPlan.goal_title}</h3>
                                            <span className="text-xs text-slate-400">🎯 {selectedPlan.target_date}</span>
                                        </div>
                                        <span className="px-3.5 py-1.5 rounded-xl metallic-gold-badge text-xs">
                                            {t("ai_progress")}: {selectedPlan.progress_percentage}%
                                        </span>
                                    </div>

                                    <div className="p-4 rounded-xl bg-elevated border-s-4 border-accent text-xs space-y-1">
                                        <p className="font-bold text-accent">{t("ai_strategy")}</p>
                                        <p>{selectedPlan.strategy_advice}</p>
                                        <p className="italic text-slate-400 pt-1">"{selectedPlan.motivational_quote}"</p>
                                    </div>

                                    {/* Quest Log Items */}
                                    <div className="space-y-3">
                                        {selectedPlan.schedule.map(day => {
                                            const todayStr = getTodayISO();
                                            const isFuture = day.date > todayStr;
                                            const isToday = day.date === todayStr;
                                            const isDone = (selectedPlan.completed_days || []).includes(day.day_number);

                                            const diff = day.pomodoro_blocks >= 6
                                                ? { label: t("diff_legendary"), cls: "badge-legendary" }
                                                : day.pomodoro_blocks >= 3
                                                ? { label: t("diff_hard"), cls: "badge-hard" }
                                                : { label: t("diff_easy"), cls: "badge-easy" };

                                            const questXp = day.pomodoro_blocks * 250;

                                            return (
                                                <div
                                                    key={day.day_number}
                                                    onClick={async (e) => {
                                                        if (isFuture) {
                                                            notify(`${t("ai_locked_day")} ${day.date} 🔒`, "error");
                                                            return;
                                                        }
                                                        try {
                                                            const res = await api(`/ai/plans/${selectedPlan.id}/days/${day.day_number}/toggle`, { method: "POST" });
                                                            if (res.is_completed) {
                                                                playSynthChime();
                                                                spawnParticleBurst(e.clientX, e.clientY);
                                                            }
                                                            const updated = await api(`/ai/plans/${selectedPlan.id}`);
                                                            setSelectedPlan(updated);
                                                        } catch (err) {
                                                            notify(err.message, "error");
                                                        }
                                                    }}
                                                    className={`p-4 rounded-2xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${isFuture ? "opacity-50 cursor-not-allowed bg-elevated border-slate-800" : isDone ? "bg-emerald-500/10 border-emerald-500/40 cursor-pointer" : "bg-elevated border-white/10 hover:border-accent cursor-pointer"}`}
                                                >
                                                    <div className="flex items-start sm:items-center gap-3.5">
                                                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-black shrink-0 ${isFuture ? "bg-slate-800 text-slate-400" : isDone ? "bg-emerald-500 text-white shadow-[0_0_12px_rgba(16,185,129,0.7)]" : "border-2 border-slate-500"}`}>
                                                            {isFuture ? "🔒" : isDone ? "✓" : "⚔️"}
                                                        </div>
                                                        <div>
                                                            <div className="flex flex-wrap items-center gap-2">
                                                                <span className={`text-[10px] px-2 py-0.5 rounded font-black ${diff.cls}`}>{diff.label}</span>
                                                                <span className="text-xs font-black">{t("day_label")} {day.day_number} ({day.date})</span>
                                                                {isToday && <span className="text-[10px] px-2 py-0.5 rounded bg-accent text-white font-bold">{t("ai_today_badge")}</span>}
                                                                {isFuture && <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400">{t("ai_locked_day")} {day.date}</span>}
                                                            </div>
                                                            <p className={`text-xs mt-1.5 leading-relaxed ${isDone ? "line-through text-slate-400" : ""}`}>
                                                                <strong className="text-accent">{day.focus_topic}:</strong> {day.action_item}
                                                            </p>
                                                        </div>
                                                    </div>

                                                    {/* پاداش درخشان مأموریت */}
                                                    <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                                                        <span className="px-2.5 py-1 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-[11px] font-black">
                                                            +{questXp} XP
                                                        </span>
                                                        <span className="px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[11px] font-black">
                                                            +{day.potential_coins} 🪙
                                                        </span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === "shop" && (
                    <div className="space-y-6">
                        <div className="bento-card p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div>
                                <h2 className="text-2xl font-black">{t("shop_header")}</h2>
                                <p className="text-xs text-slate-400 mt-1">{t("shop_sub")}</p>
                            </div>
                            <div className="px-5 py-3 rounded-2xl metallic-gold-badge text-lg">
                                {stats?.coins || 0} 🪙
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            {themes.map(th => (
                                <div key={th.id} className={`bento-card overflow-hidden flex flex-col justify-between border-2 ${th.is_active ? "border-accent" : "border-transparent"}`}>
                                    <div>
                                        <div className={`h-28 p-5 flex items-end justify-between text-white aura-${th.id}`}>
                                            <div>
                                                <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded bg-black/40">
                                                    {th.rarity} • {th.inspiration}
                                                </span>
                                                <h3 className="text-xl font-black mt-1">{lang === "fa" ? th.name_fa : th.name}</h3>
                                            </div>
                                            <span className="px-3 py-1 rounded-xl bg-black/55 backdrop-blur-md text-xs font-black text-amber-300">
                                                {th.price === 0 ? t("shop_free") : `${th.price} 🪙`}
                                            </span>
                                        </div>
                                        <div className="p-5">
                                            <p className="text-xs text-slate-400 leading-relaxed">
                                                {lang === "fa" ? th.description_fa : th.description_en}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="px-5 pb-5">
                                        {th.is_active ? (
                                            <button disabled className="w-full py-3 rounded-xl bg-emerald-500/20 text-emerald-300 text-xs font-bold">
                                                ✨ {t("shop_equipped")}
                                            </button>
                                        ) : th.is_owned ? (
                                            <button
                                                onClick={async () => {
                                                    await api("/shop/equip", { method: "POST", body: JSON.stringify({ theme_id: th.id }) });
                                                    refreshAll();
                                                }}
                                                className="w-full tactile-btn py-3 rounded-xl text-xs"
                                            >
                                                {t("shop_equip")}
                                            </button>
                                        ) : (
                                            <button
                                                onClick={async (e) => {
                                                    try {
                                                        await api("/shop/buy", { method: "POST", body: JSON.stringify({ theme_id: th.id }) });
                                                        await api("/shop/equip", { method: "POST", body: JSON.stringify({ theme_id: th.id }) });
                                                        playSynthChime();
                                                        spawnParticleBurst(e.clientX, e.clientY);
                                                        refreshAll();
                                                    } catch (err) {
                                                        notify(err.message, "error");
                                                    }
                                                }}
                                                className="w-full py-3 rounded-xl metallic-gold-badge text-xs transition hover:brightness-110"
                                            >
                                                {t("shop_buy")} {th.price} 🪙
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {activeTab === "arena" && (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                        <div className="lg:col-span-7 bento-card p-6 space-y-5">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div>
                                    <h2 className="text-lg font-black">{t("arena_leaderboard")}</h2>
                                    <p className="text-[11px] text-slate-400 mt-0.5">{t("click_profile_hint")}</p>
                                </div>
                                <div className="flex gap-1 bg-elevated p-1 rounded-xl">
                                    {[
                                        { id: "daily", label: t("tf_daily") },
                                        { id: "weekly", label: t("tf_weekly") },
                                        { id: "all_time", label: t("tf_all") }
                                    ].map(tf => (
                                        <button
                                            key={tf.id}
                                            onClick={() => loadArenaData(tf.id)}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-bold ${lbTimeframe === tf.id ? "tactile-btn" : "text-slate-400"}`}
                                        >
                                            {tf.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-3">
                                {leaderboard.length === 0 ? (
                                    <p className="text-xs text-slate-400">{t("no_leaderboard")}</p>
                                ) : (
                                    leaderboard.map(u => (
                                        <div
                                            key={u.user_id}
                                            onClick={() => openUserProfile(u.user_id)}
                                            className={`p-4 rounded-2xl text-white flex items-center justify-between cursor-pointer transform hover:scale-[1.01] transition aura-${u.active_theme || 'default'}`}
                                        >
                                            <div className="flex items-center gap-3.5">
                                                <span className="text-xl font-black font-display w-7">#{u.rank}</span>
                                                <div>
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <span className="font-extrabold text-sm underline decoration-white/40">{u.username}</span>
                                                        <span className="px-2 py-0.5 rounded metallic-gold-badge text-[10px]">
                                                            LVL {u.level || 1}
                                                        </span>
                                                        <span className="px-2 py-0.5 rounded metallic-platinum-badge text-[10px]">
                                                            {lang === "fa" ? u.title_fa : u.title}
                                                        </span>
                                                    </div>
                                                    <span className="text-[11px] opacity-85 block mt-1">
                                                        ⏱️ {u.total_study_hours} {t("hours_short")} ({u.total_study_minutes} {t("mins_short")})
                                                    </span>
                                                </div>
                                            </div>
                                            <span className="px-3 py-1 rounded-xl bg-black/50 border border-white/15 text-xs font-black text-amber-300">
                                                {u.total_coins_earned} 🪙
                                            </span>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        <div className="lg:col-span-5 space-y-5">
                            <div className="bento-card p-6 space-y-4">
                                <h3 className="text-lg font-black">{t("arena_groups")}</h3>
                                <form
                                    onSubmit={async (e) => {
                                        e.preventDefault();
                                        const fd = new FormData(e.target);
                                        try {
                                            await api("/groups", {
                                                method: "POST",
                                                body: JSON.stringify({ name: fd.get("name"), description: fd.get("description") })
                                            });
                                            e.target.reset();
                                            loadArenaData(lbTimeframe);
                                        } catch (err) {
                                            notify(err.message, "error");
                                        }
                                    }}
                                    className="space-y-2.5"
                                >
                                    <input name="name" required placeholder={t("group_name_ph")} className="w-full px-3.5 py-2.5 rounded-xl bg-elevated border border-slate-700/50 text-xs" />
                                    <input name="description" placeholder={t("group_desc_ph")} className="w-full px-3.5 py-2.5 rounded-xl bg-elevated border border-slate-700/50 text-xs" />
                                    <button type="submit" className="w-full tactile-btn py-2.5 rounded-xl text-xs">{t("group_create")}</button>
                                </form>

                                <form
                                    onSubmit={async (e) => {
                                        e.preventDefault();
                                        const fd = new FormData(e.target);
                                        try {
                                            await api("/groups/join", {
                                                method: "POST",
                                                body: JSON.stringify({ invite_code: fd.get("invite_code") })
                                            });
                                            e.target.reset();
                                            loadArenaData(lbTimeframe);
                                        } catch (err) {
                                            notify(err.message, "error");
                                        }
                                    }}
                                    className="flex gap-2 pt-2 border-t border-slate-800"
                                >
                                    <input name="invite_code" required placeholder={t("group_code_ph")} className="flex-1 px-3.5 py-2 rounded-xl bg-elevated border border-slate-700/50 text-xs uppercase" />
                                    <button type="submit" className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold">{t("group_join")}</button>
                                </form>
                            </div>

                            {groups.map(g => {
                                const raids = groupRaids[g.id] || [];
                                const latestRaid = raids[0];

                                return (
                                    <div key={g.id} className="bento-card p-5 space-y-4">
                                        <div className="flex justify-between items-center">
                                            <div>
                                                <h4 className="font-black text-base">{g.name}</h4>
                                                {g.description && <p className="text-xs text-slate-400">{g.description}</p>}
                                            </div>
                                            <button
                                                onClick={() => {
                                                    navigator.clipboard.writeText(g.invite_code);
                                                    notify(t("copied_code"));
                                                }}
                                                className="text-xs font-mono px-2.5 py-1 rounded bg-elevated text-accent border border-accent"
                                            >
                                                {g.invite_code}
                                            </button>
                                        </div>

                                        <div className="p-4 rounded-2xl rim-light-boss bg-gradient-to-br from-red-950/50 via-zinc-950 to-zinc-950 space-y-3">
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs font-black text-red-400 flex items-center gap-1.5">
                                                    <span>🐉</span>
                                                    <span>{t("raid_title")}</span>
                                                </span>
                                            </div>

                                            {latestRaid ? (
                                                <div className="space-y-2.5">
                                                    <div className="flex justify-between items-center">
                                                        <span className="font-extrabold text-sm text-white">{latestRaid.boss_name}</span>
                                                        <span className="text-xs px-2.5 py-0.5 rounded-lg metallic-gold-badge">
                                                            🔒 +{latestRaid.reward_coins} 🪙
                                                        </span>
                                                    </div>

                                                    {latestRaid.status === "defeated" ? (
                                                        <div className="p-2 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold text-center">
                                                            {t("raid_defeated")}
                                                        </div>
                                                    ) : (
                                                        <div className="space-y-1">
                                                            <div className="flex justify-between text-[11px] font-bold text-red-200">
                                                                <span>BOSS HP</span>
                                                                <span>{latestRaid.current_hp} / {latestRaid.max_hp} HP</span>
                                                            </div>
                                                            <div className="w-full h-3 bg-black/70 rounded-full overflow-hidden border border-red-500/40">
                                                                <div
                                                                    className="h-full bg-gradient-to-r from-red-600 via-orange-500 to-amber-400 transition-all duration-500"
                                                                    style={{ width: `${Math.max(0, Math.min(100, (latestRaid.current_hp / latestRaid.max_hp) * 100))}%` }}
                                                                ></div>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {latestRaid.top_damage_dealers && latestRaid.top_damage_dealers.length > 0 && (
                                                        <div className="pt-1 space-y-1">
                                                            <span className="text-[10px] text-slate-400 font-bold block">{t("raid_top_dmg")}</span>
                                                            <div className="flex flex-wrap gap-1.5">
                                                                {latestRaid.top_damage_dealers.map((d, idx) => (
                                                                    <button
                                                                        key={idx}
                                                                        type="button"
                                                                        onClick={() => openUserProfile(d.user_id)}
                                                                        className="text-[10px] px-2 py-0.5 rounded bg-red-500/20 hover:bg-red-500/40 text-red-200 font-bold transition"
                                                                    >
                                                                        ⚔️ {d.username}: {d.damage_dealt} DMG
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            ) : null}

                                            {(!latestRaid || latestRaid.status === "defeated") && (
                                                <RaidSummonForm
                                                    groupId={g.id}
                                                    lang={lang}
                                                    t={t}
                                                    api={api}
                                                    notify={notify}
                                                    onCreated={loadArenaData}
                                                ></RaidSummonForm>
                                            )}
                                        </div>

                                        <div className="space-y-1.5">
                                            <span className="text-[10px] font-bold text-slate-400 block">{t("squad_members")}</span>
                                            {g.members.map((m, i) => (
                                                <div
                                                    key={m.user_id}
                                                    onClick={() => openUserProfile(m.user_id)}
                                                    className={`p-2.5 rounded-xl text-white text-xs flex items-center justify-between cursor-pointer hover:scale-[1.01] transition aura-${m.active_theme || 'default'}`}
                                                >
                                                    <div className="flex flex-wrap items-center gap-1.5">
                                                        <span className="font-extrabold underline decoration-white/40">{i + 1}. {m.username} {m.is_owner ? "👑" : ""}</span>
                                                        <span className="px-1.5 py-0.5 rounded metallic-gold-badge text-[9px]">
                                                            LVL {m.level || 1}
                                                        </span>
                                                        <span className="text-[10px] opacity-90">
                                                            ({lang === "fa" ? m.title_fa : m.title})
                                                        </span>
                                                    </div>
                                                    <span className="font-bold shrink-0">{m.total_study_hours} {t("hours_short")}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);