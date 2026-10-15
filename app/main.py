from datetime import date, datetime, timedelta
import secrets
import string
import json
import os
import sqlite3
from typing import List, Literal, Optional
from fastapi import FastAPI, HTTPException, Depends, Query, status
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse

from app.database import init_db, get_connection
from app.auth import hash_password, verify_password, create_access_token, get_current_user
from app.ai_coach import generate_study_plan, generate_quick_quiz, generate_boss_names
from app.schemas import (
    UserRegister, UserLogin, TokenResponse, UserProfile, PublicUserProfile,
    CourseCreate, CourseUpdate, CourseResponse,
    StudySessionCreate, StudySessionResponse, SessionCreationResult,
    ThemeItem, ThemeActionRequest, LeaderboardUser,
    GroupCreate, GroupJoin, GroupSummary, GroupDetail, GroupMemberItem,
    AICoachRequest, AICoachPlan, SavedPlanSummary,
    PomodoroStartRequest, PomodoroSessionResponse,
    PlanDayToggleResponse, PlanDetailResponse, DashboardStatsResponse,
    BossNameSuggestRequest, RaidCreateRequest, RaidResponse, QuizSubmitRequest, HeatmapDay
)

init_db()

app = FastAPI(
    title="StudyMate API",
    description="Gamified Collaborative Study Platform Backend",
    version="2.1.0"
)

static_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "static")
if os.path.exists(static_dir):
    app.mount("/static", StaticFiles(directory=static_dir, html=True), name="static")

@app.get("/")
def root():
    return RedirectResponse(url="/static/index.html")


# ----------------- LEVEL & TITLE ENGINE -----------------

def calculate_user_level(total_minutes: int) -> dict:
    """محاسبه سطح از ۱ تا ۱۰۰ و لقب بازیکن بر اساس دقایق کل مطالعه"""
    xp = total_minutes * 10
    level = min(100, int((xp / 150) ** 0.5) + 1)
    next_level_xp = int((level ** 2) * 150)

    if level < 5:
        title_en, title_fa = "Sleepy Novice", "نوآموز خواب‌آلود"
    elif level < 10:
        title_en, title_fa = "Focus Apprentice", "کارآموز تمرکز"
    elif level < 20:
        title_en, title_fa = "Task Hunter", "شکارچی تسک‌ها"
    elif level < 35:
        title_en, title_fa = "Arcane Scholar", "دانشمند کارکشته"
    elif level < 50:
        title_en, title_fa = "Void Strategist", "استراتژیست خلاء"
    elif level < 75:
        title_en, title_fa = "Cyber Knight", "شوالیه سایبری"
    elif level < 95:
        title_en, title_fa = "Shadow Sovereign", "حاکم اعظم سایه‌ها"
    else:
        title_en, title_fa = "Grand Luminary", "خورشید تابان لومیر"

    return {
        "level": level,
        "xp": xp,
        "next_level_xp": next_level_xp,
        "title": title_en,
        "title_fa": title_fa
    }


# ----------------- 7-DAY ESCALATING STREAK ENGINE -----------------

def calculate_streak_reward(streak_day: int) -> int:
    return 10 + (streak_day - 1) * 5

def update_user_streak_with_reward(cursor, user_id: int) -> tuple[int, int]:
    today = date.today()
    cursor.execute("SELECT current_streak, last_study_date FROM users WHERE id = ?", (user_id,))
    user = cursor.fetchone()
    if not user:
        return 0, 0

    current_streak = user["current_streak"] or 0
    last_study_str = user["last_study_date"]

    if last_study_str:
        last_date = date.fromisoformat(last_study_str)
        if last_date == today:
            return current_streak, 0
        elif last_date == today - timedelta(days=1):
            if current_streak >= 7:
                current_streak = 1
            else:
                current_streak += 1
        else:
            current_streak = 1
    else:
        current_streak = 1

    bonus_coins = calculate_streak_reward(current_streak)
    cursor.execute(
        "UPDATE users SET current_streak = ?, last_study_date = ?, coins = coins + ? WHERE id = ?",
        (current_streak, str(today), bonus_coins, user_id)
    )
    return current_streak, bonus_coins


# ----------------- ICONIC ANIME / GAME / MOVIE THEMES CATALOG -----------------

AVAILABLE_THEMES = [
    {
        "id": "default",
        "name": "Classic Tactical Slate",
        "name_fa": "خاکستری تاکتیکال کلاسیک",
        "inspiration": "StudyMate Original",
        "rarity": "COMMON",
        "price": 0,
        "preview_color": "#6366f1",
        "secondary_color": "#334155",
        "description_fa": "پالت استاندارد و متمرکز خاکستری تیره با هایلایت نیلی",
        "description_en": "Standard high-contrast tactical slate with indigo accents."
    },
    {
        "id": "dracula",
        "name": "Castlevania Nocturne",
        "name_fa": "سمفونی شبانه کسلوانیا",
        "inspiration": "Anime / Gothic",
        "rarity": "RARE",
        "price": 400,
        "preview_color": "#a855f7",
        "secondary_color": "#ec4899",
        "description_fa": "الهام‌گرفته از فضای گوتیک و بنفش نئونی کسلوانیا",
        "description_en": "Gothic vampire violet & crimson night aura inspired by Castlevania."
    },
    {
        "id": "forest_emerald",
        "name": "The Matrix: Operator",
        "name_fa": "ماتریکس: کدهای نئون سبز",
        "inspiration": "Sci-Fi Cinema",
        "rarity": "RARE",
        "price": 800,
        "preview_color": "#10b981",
        "secondary_color": "#047857",
        "description_fa": "سبز فسفری ترمینال‌های ماتریکس روی پس‌زمینه ابسیدین تاریک",
        "description_en": "Digital rain phosphor emerald terminal inspired by The Matrix."
    },
    {
        "id": "miku_vocaloid",
        "name": "Vocaloid Cyber Stage",
        "name_fa": "استیج سایبری هاتسونه میکو",
        "inspiration": "Anime / Vocaloid",
        "rarity": "EPIC",
        "price": 1200,
        "preview_color": "#06b6d4",
        "secondary_color": "#ec4899",
        "description_fa": "ترکیب فیروزه‌ای الکتریک و سرخابی کنسرت‌های هولوگرافیک میکو",
        "description_en": "Holographic electric cyan and magenta pulse inspired by Hatsune Miku."
    },
    {
        "id": "hollow_void",
        "name": "Hallownest Soul & Void",
        "name_fa": "شوالیه توخالی: روح و خلاء",
        "inspiration": "Indie Game Masterpiece",
        "rarity": "EPIC",
        "price": 1800,
        "preview_color": "#38bdf8",
        "secondary_color": "#1e1b4b",
        "description_fa": "نور نقره‌ای-آبی روح در دل تاریکی عمیق سرزمین هالونست",
        "description_en": "Luminous Soul vessel blue piercing the deep Abyssal Void of Hallownest."
    },
    {
        "id": "cyberpunk_amber",
        "name": "Night City Edgerunner",
        "name_fa": "سایبرپانک: اج‌رانر نایت‌سیتی",
        "inspiration": "Anime & Game",
        "rarity": "LEGENDARY",
        "price": 2500,
        "preview_color": "#facc15",
        "secondary_color": "#06b6d4",
        "description_fa": "زرد ولتاژ بالا و آبی سایبرنتیک الهام‌گرفته از Cyberpunk Edgerunners",
        "description_en": "High-voltage cyberware yellow & optical cyan from Night City."
    },
    {
        "id": "akatsuki_crimson",
        "name": "Uchiha Mangekyō",
        "name_fa": "شارینگان و ابرهای سرخ آکاتسوکی",
        "inspiration": "Anime Legend",
        "rarity": "LEGENDARY",
        "price": 3500,
        "preview_color": "#ef4444",
        "secondary_color": "#7f1d1d",
        "description_fa": "سرخ آتشین آماتراسو و هاله تاریک خاندان اوچیها",
        "description_en": "Crimson Amaterasu flames and dark obsidian chakra aura."
    },
    {
        "id": "clair_obscur",
        "name": "Lumière Expedition 33",
        "name_fa": "اکسپدیشن ۳۳: طلای لومیر",
        "inspiration": "Artistic RPG",
        "rarity": "MYTHIC",
        "price": 5000,
        "preview_color": "#f59e0b",
        "secondary_color": "#78350f",
        "description_fa": "جلوه سلطنتی طلای عتیقه، مخمل شب و کنتراست روشن-تاریک (Clair Obscur)",
        "description_en": "Belle Époque gilded gold filigree and chiaroscuro royal contrast."
    }
]


# ----------------- AUTH & PUBLIC PROFILE ENDPOINTS -----------------

@app.post("/auth/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(user_data: UserRegister):
    hashed_pwd = hash_password(user_data.password)
    with get_connection() as conn:
        cursor = conn.cursor()
        try:
            cursor.execute(
                "INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)",
                (user_data.username, user_data.email, hashed_pwd)
            )
            new_user_id = cursor.lastrowid
            cursor.execute(
                "INSERT INTO user_themes (user_id, theme_id) VALUES (?, 'default')",
                (new_user_id,)
            )
            conn.commit()
        except sqlite3.IntegrityError:
            raise HTTPException(status_code=400, detail="Username or email already exists.")

    token = create_access_token(new_user_id, user_data.username)
    return {"access_token": token, "token_type": "bearer"}


@app.post("/auth/login", response_model=TokenResponse)
def login(credentials: UserLogin):
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, username, password_hash FROM users WHERE username = ?", (credentials.username,))
        user = cursor.fetchone()

    if not user or not verify_password(credentials.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid username or password")

    token = create_access_token(user["id"], user["username"])
    return {"access_token": token, "token_type": "bearer"}


@app.get("/users/me", response_model=UserProfile)
def read_current_user(current_user: dict = Depends(get_current_user)):
    return current_user


@app.get("/users/{user_id}/profile", response_model=PublicUserProfile)
def get_public_user_profile(user_id: int):
    """دریافت کارت پروفایل عمومی هر کاربر به همراه تم، لول، لقب، پومودوروها و دمیج باس"""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, username, coins, active_theme, current_streak, created_at FROM users WHERE id = ?",
            (user_id,)
        )
        u = cursor.fetchone()
        if not u:
            raise HTTPException(status_code=404, detail="User not found.")

        cursor.execute(
            """
            SELECT 
                COUNT(*) AS total_pomos,
                COALESCE(SUM(actual_minutes), 0) AS pomo_mins
            FROM pomodoro_sessions
            WHERE user_id = ? AND status = 'completed'
            """,
            (user_id,)
        )
        pomo_row = cursor.fetchone()

        cursor.execute(
            "SELECT COALESCE(SUM(duration_minutes), 0) AS quick_mins FROM study_sessions WHERE user_id = ?",
            (user_id,)
        )
        quick_mins = cursor.fetchone()["quick_mins"]

        cursor.execute(
            "SELECT COALESCE(SUM(damage_dealt), 0) AS total_dmg FROM raid_contributions WHERE user_id = ?",
            (user_id,)
        )
        total_dmg = cursor.fetchone()["total_dmg"]

    total_all_mins = pomo_row["pomo_mins"] + quick_mins
    lvl_info = calculate_user_level(total_all_mins)
    theme_obj = next((t for t in AVAILABLE_THEMES if t["id"] == u["active_theme"]), AVAILABLE_THEMES[0])

    return PublicUserProfile(
        user_id=u["id"],
        username=u["username"],
        active_theme=u["active_theme"],
        theme_name=theme_obj["name"],
        theme_name_fa=theme_obj["name_fa"],
        rarity=theme_obj["rarity"],
        inspiration=theme_obj["inspiration"],
        level=lvl_info["level"],
        xp=lvl_info["xp"],
        next_level_xp=lvl_info["next_level_xp"],
        title=lvl_info["title"],
        title_fa=lvl_info["title_fa"],
        coins=u["coins"],
        current_streak=u["current_streak"] or 0,
        total_pomodoros=pomo_row["total_pomos"],
        total_study_minutes=total_all_mins,
        total_study_hours=round(total_all_mins / 60, 1),
        total_raid_damage=total_dmg,
        created_at=str(u["created_at"])[:10]
    )


# ----------------- COURSES ENDPOINTS -----------------

@app.post("/courses", response_model=CourseResponse, status_code=status.HTTP_201_CREATED)
def create_course(course_data: CourseCreate, current_user: dict = Depends(get_current_user)):
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO courses (user_id, name, color, weekly_goal_hours) VALUES (?, ?, ?, ?)",
            (current_user["id"], course_data.name, course_data.color, course_data.weekly_goal_hours)
        )
        conn.commit()
        course_id = cursor.lastrowid
        cursor.execute("SELECT * FROM courses WHERE id = ?", (course_id,))
        new_course = cursor.fetchone()
    return dict(new_course)


@app.get("/courses", response_model=List[CourseResponse])
def get_user_courses(current_user: dict = Depends(get_current_user)):
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM courses WHERE user_id = ? ORDER BY id DESC", (current_user["id"],))
        courses = cursor.fetchall()
    return [dict(row) for row in courses]


@app.delete("/courses/{course_id}")
def delete_course(course_id: int, current_user: dict = Depends(get_current_user)):
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM courses WHERE id = ? AND user_id = ?", (course_id, current_user["id"]))
        conn.commit()
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Course not found.")
    return {"message": "Course deleted"}


# ----------------- QUICK STUDY SESSIONS (MAX 600 MIN/DAY, 0 COINS) -----------------

DAILY_QUICK_LOG_LIMIT = 600

@app.post("/sessions", response_model=SessionCreationResult, status_code=status.HTTP_201_CREATED)
def log_study_session(session_data: StudySessionCreate, current_user: dict = Depends(get_current_user)):
    today_str = str(date.today())
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, name, color FROM courses WHERE id = ? AND user_id = ?",
            (session_data.course_id, current_user["id"])
        )
        course = cursor.fetchone()
        if not course:
            raise HTTPException(status_code=404, detail="Course not found.")

        cursor.execute(
            "SELECT COALESCE(SUM(duration_minutes), 0) AS today_total FROM study_sessions WHERE user_id = ? AND session_date = ?",
            (current_user["id"], today_str)
        )
        already_logged = cursor.fetchone()["today_total"]

        if already_logged + session_data.duration_minutes > DAILY_QUICK_LOG_LIMIT:
            remaining = max(0, DAILY_QUICK_LOG_LIMIT - already_logged)
            raise HTTPException(
                status_code=400,
                detail=f"Daily quick-log limit (600 mins) exceeded! Remaining today: {remaining} mins."
            )

        cursor.execute(
            """
            INSERT INTO study_sessions (user_id, course_id, duration_minutes, session_date, notes, coins_earned)
            VALUES (?, ?, ?, ?, ?, 0)
            """,
            (current_user["id"], session_data.course_id, session_data.duration_minutes, today_str, session_data.notes)
        )
        session_id = cursor.lastrowid
        conn.commit()

        new_today_total = already_logged + session_data.duration_minutes
        remaining_after = max(0, DAILY_QUICK_LOG_LIMIT - new_today_total)
        cursor.execute("SELECT coins FROM users WHERE id = ?", (current_user["id"],))
        user_coins = cursor.fetchone()["coins"]

    session_dict = {
        "id": session_id,
        "user_id": current_user["id"],
        "course_id": course["id"],
        "course_name": course["name"],
        "course_color": course["color"],
        "duration_minutes": session_data.duration_minutes,
        "session_date": today_str,
        "notes": session_data.notes,
        "coins_earned": 0,
        "created_at": "Just now"
    }

    return {
        "session": session_dict,
        "total_user_coins": user_coins,
        "today_quick_minutes": new_today_total,
        "remaining_quick_minutes": remaining_after,
        "message": "Quick study session logged in daily hours."
    }


@app.get("/sessions", response_model=List[StudySessionResponse])
def get_study_sessions(current_user: dict = Depends(get_current_user)):
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT s.id, s.user_id, s.course_id, c.name AS course_name, c.color AS course_color,
                   s.duration_minutes, s.session_date, s.notes, s.coins_earned, s.created_at
            FROM study_sessions s
            JOIN courses c ON s.course_id = c.id
            WHERE s.user_id = ?
            ORDER BY s.session_date DESC, s.id DESC LIMIT 15
            """,
            (current_user["id"],)
        )
        sessions = cursor.fetchall()
    return [dict(row) for row in sessions]


# ----------------- SHOP ENDPOINTS -----------------

@app.get("/shop/themes", response_model=List[ThemeItem])
def get_shop_themes(current_user: dict = Depends(get_current_user)):
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT theme_id FROM user_themes WHERE user_id = ?", (current_user["id"],))
        owned_themes = {row["theme_id"] for row in cursor.fetchall()}

    return [
        ThemeItem(
            **theme,
            is_owned=(theme["id"] in owned_themes),
            is_active=(theme["id"] == current_user["active_theme"])
        )
        for theme in AVAILABLE_THEMES
    ]


@app.post("/shop/buy")
def buy_theme(request: ThemeActionRequest, current_user: dict = Depends(get_current_user)):
    theme = next((t for t in AVAILABLE_THEMES if t["id"] == request.theme_id), None)
    if not theme:
        raise HTTPException(status_code=404, detail="Theme does not exist.")

    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM user_themes WHERE user_id = ? AND theme_id = ?", (current_user["id"], request.theme_id))
        if cursor.fetchone():
            raise HTTPException(status_code=400, detail="You already own this theme.")

        cursor.execute("SELECT coins FROM users WHERE id = ?", (current_user["id"],))
        user_coins = cursor.fetchone()["coins"]

        if user_coins < theme["price"]:
            raise HTTPException(status_code=400, detail=f"Insufficient coins! Price: {theme['price']}, Balance: {user_coins}")

        cursor.execute("UPDATE users SET coins = coins - ? WHERE id = ?", (theme["price"], current_user["id"]))
        cursor.execute("INSERT INTO user_themes (user_id, theme_id) VALUES (?, ?)", (current_user["id"], request.theme_id))
        conn.commit()
        cursor.execute("SELECT coins FROM users WHERE id = ?", (current_user["id"],))
        remaining_coins = cursor.fetchone()["coins"]

    return {"message": f"Unlocked {theme['name']}!", "remaining_coins": remaining_coins, "theme_id": request.theme_id}


@app.post("/shop/equip")
def equip_theme(request: ThemeActionRequest, current_user: dict = Depends(get_current_user)):
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM user_themes WHERE user_id = ? AND theme_id = ?", (current_user["id"], request.theme_id))
        if not cursor.fetchone():
            raise HTTPException(status_code=400, detail="Purchase this theme first!")

        cursor.execute("UPDATE users SET active_theme = ? WHERE id = ?", (request.theme_id, current_user["id"]))
        conn.commit()
    return {"message": "Theme equipped!", "active_theme": request.theme_id}


# ----------------- LEADERBOARD (WITH LEVEL & TITLE) -----------------

@app.get("/leaderboard", response_model=List[LeaderboardUser])
def get_leaderboard(timeframe: Literal["daily", "weekly", "all_time"] = Query("all_time")):
    if timeframe == "daily":
        date_cond = "AND date(p.ended_at) = CURRENT_DATE"
    elif timeframe == "weekly":
        date_cond = "AND date(p.ended_at) >= date('now', '-7 days')"
    else:
        date_cond = ""

    query = f"""
        SELECT 
            u.id AS user_id,
            u.username,
            u.active_theme,
            COALESCE(SUM(p.actual_minutes), 0) AS total_study_minutes,
            COALESCE(SUM(p.coins_earned), 0) AS total_coins_earned,
            (
                SELECT COALESCE(SUM(duration_minutes), 0) FROM study_sessions s WHERE s.user_id = u.id
            ) + (
                SELECT COALESCE(SUM(actual_minutes), 0) FROM pomodoro_sessions pm WHERE pm.user_id = u.id
            ) AS all_time_minutes
        FROM users u
        LEFT JOIN pomodoro_sessions p 
            ON u.id = p.user_id AND p.status = 'completed' {date_cond}
        GROUP BY u.id
        ORDER BY total_study_minutes DESC, total_coins_earned DESC
        LIMIT 20;
    """

    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(query)
        rows = cursor.fetchall()

    results = []
    for rank, row in enumerate(rows, start=1):
        lvl = calculate_user_level(row["all_time_minutes"])
        results.append(
            LeaderboardUser(
                rank=rank,
                user_id=row["user_id"],
                username=row["username"],
                active_theme=row["active_theme"],
                level=lvl["level"],
                title=lvl["title"],
                title_fa=lvl["title_fa"],
                total_study_minutes=row["total_study_minutes"],
                total_study_hours=round(row["total_study_minutes"] / 60, 1),
                total_coins_earned=row["total_coins_earned"]
            )
        )
    return results


# ----------------- STUDY GROUPS (WITH MEMBER LEVEL & TITLE) -----------------

def generate_invite_code(length: int = 6) -> str:
    chars = (string.ascii_uppercase + string.digits).replace("O", "").replace("0", "").replace("I", "").replace("1", "")
    return f"SM-{''.join(secrets.choice(chars) for _ in range(length))}"


@app.post("/groups", response_model=GroupDetail, status_code=status.HTTP_201_CREATED)
def create_group(group_data: GroupCreate, current_user: dict = Depends(get_current_user)):
    invite_code = generate_invite_code()
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO study_groups (name, description, invite_code, owner_id) VALUES (?, ?, ?, ?)",
            (group_data.name, group_data.description, invite_code, current_user["id"])
        )
        group_id = cursor.lastrowid
        cursor.execute("INSERT INTO group_members (group_id, user_id) VALUES (?, ?)", (group_id, current_user["id"]))
        conn.commit()
    return get_group_details(group_id=group_id, current_user=current_user)


@app.post("/groups/join")
def join_group(join_data: GroupJoin, current_user: dict = Depends(get_current_user)):
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, name FROM study_groups WHERE invite_code = ?", (join_data.invite_code.strip().upper(),))
        group = cursor.fetchone()
        if not group:
            raise HTTPException(status_code=404, detail="Invalid invite code.")

        cursor.execute("SELECT id FROM group_members WHERE group_id = ? AND user_id = ?", (group["id"], current_user["id"]))
        if cursor.fetchone():
            raise HTTPException(status_code=400, detail="Already a member of this group.")

        cursor.execute("INSERT INTO group_members (group_id, user_id) VALUES (?, ?)", (group["id"], current_user["id"]))
        conn.commit()
    return {"message": f"Joined {group['name']}!", "group_id": group["id"]}


@app.get("/groups/my", response_model=List[GroupSummary])
def get_my_groups(current_user: dict = Depends(get_current_user)):
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT g.id, g.name, g.description, g.invite_code, g.created_at,
                   g.owner_id = ? AS is_owner, COUNT(gm.user_id) AS member_count
            FROM study_groups g
            JOIN group_members gm ON g.id = gm.group_id
            WHERE g.id IN (SELECT group_id FROM group_members WHERE user_id = ?)
            GROUP BY g.id ORDER BY g.id DESC
            """,
            (current_user["id"], current_user["id"])
        )
        rows = cursor.fetchall()
    return [
        GroupSummary(
            id=row["id"],
            name=row["name"],
            description=row["description"],
            invite_code=row["invite_code"],
            member_count=row["member_count"],
            is_owner=bool(row["is_owner"]),
            created_at=str(row["created_at"])
        )
        for row in rows
    ]


@app.get("/groups/{group_id}", response_model=GroupDetail)
def get_group_details(group_id: int, current_user: dict = Depends(get_current_user)):
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?", (group_id, current_user["id"]))
        if not cursor.fetchone():
            raise HTTPException(status_code=403, detail="Access denied.")

        cursor.execute("SELECT id, name, description, invite_code, owner_id FROM study_groups WHERE id = ?", (group_id,))
        group = cursor.fetchone()
        if not group:
            raise HTTPException(status_code=404, detail="Group not found.")

        cursor.execute(
            """
            SELECT 
                u.id AS user_id,
                u.username,
                u.active_theme,
                (u.id = ?) AS is_owner,
                COALESCE(SUM(p.actual_minutes), 0) AS total_study_minutes,
                (
                    SELECT COALESCE(SUM(duration_minutes), 0) FROM study_sessions s WHERE s.user_id = u.id
                ) + (
                    SELECT COALESCE(SUM(actual_minutes), 0) FROM pomodoro_sessions pm WHERE pm.user_id = u.id
                ) AS all_time_minutes
            FROM group_members gm
            JOIN users u ON gm.user_id = u.id
            LEFT JOIN pomodoro_sessions p ON u.id = p.user_id AND p.status = 'completed'
            WHERE gm.group_id = ?
            GROUP BY u.id
            ORDER BY total_study_minutes DESC, u.username ASC
            """,
            (group["owner_id"], group_id)
        )
        member_rows = cursor.fetchall()

    members = []
    for row in member_rows:
        lvl = calculate_user_level(row["all_time_minutes"])
        members.append(
            GroupMemberItem(
                user_id=row["user_id"],
                username=row["username"],
                active_theme=row["active_theme"],
                level=lvl["level"],
                title=lvl["title"],
                title_fa=lvl["title_fa"],
                is_owner=bool(row["is_owner"]),
                total_study_minutes=row["total_study_minutes"],
                total_study_hours=round(row["total_study_minutes"] / 60, 1)
            )
        )
    return GroupDetail(
        id=group["id"],
        name=group["name"],
        description=group["description"],
        invite_code=group["invite_code"],
        owner_id=group["owner_id"],
        member_count=len(members),
        members=members
    )


# ----------------- AI STUDY COACH ENDPOINTS -----------------

@app.post("/ai/generate-plan", response_model=AICoachPlan, status_code=status.HTTP_201_CREATED)
async def create_ai_study_plan(req: AICoachRequest, current_user: dict = Depends(get_current_user)):
    if req.target_date <= date.today():
        raise HTTPException(status_code=400, detail="Target date must be after today!")

    plan_data = await generate_study_plan(
        goal_title=req.goal_title,
        target_date=req.target_date,
        daily_hours=req.daily_hours,
        topics=req.topics,
        notes=req.notes,
        lang=req.lang
    )

    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO ai_plans (user_id, goal_title, target_date, daily_hours, plan_json) VALUES (?, ?, ?, ?, ?)",
            (current_user["id"], req.goal_title, str(req.target_date), req.daily_hours, json.dumps(plan_data, ensure_ascii=False))
        )
        conn.commit()
        plan_id = cursor.lastrowid

    plan_data["id"] = plan_id
    return plan_data


@app.get("/ai/plans", response_model=List[SavedPlanSummary])
def get_user_plans(current_user: dict = Depends(get_current_user)):
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, goal_title, target_date, daily_hours, created_at FROM ai_plans WHERE user_id = ? ORDER BY id DESC", (current_user["id"],))
        rows = cursor.fetchall()
    return [
        SavedPlanSummary(
            id=row["id"],
            goal_title=row["goal_title"],
            target_date=str(row["target_date"]),
            daily_hours=row["daily_hours"],
            created_at=str(row["created_at"])
        )
        for row in rows
    ]


@app.get("/ai/plans/{plan_id}", response_model=PlanDetailResponse)
def get_plan_by_id(plan_id: int, current_user: dict = Depends(get_current_user)):
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, plan_json FROM ai_plans WHERE id = ? AND user_id = ?", (plan_id, current_user["id"]))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Plan not found.")

        cursor.execute("SELECT day_number FROM plan_day_completions WHERE plan_id = ?", (plan_id,))
        completed_days = [r["day_number"] for r in cursor.fetchall()]

    plan_dict = json.loads(row["plan_json"])
    plan_dict["id"] = row["id"]
    plan_dict["completed_days"] = completed_days
    total_days = len(plan_dict.get("schedule", []))
    plan_dict["progress_percentage"] = round((len(completed_days) / total_days) * 100, 1) if total_days > 0 else 0.0
    return plan_dict


@app.post("/ai/plans/{plan_id}/days/{day_number}/toggle", response_model=PlanDayToggleResponse)
def toggle_plan_day_completion(plan_id: int, day_number: int, current_user: dict = Depends(get_current_user)):
    today = date.today()
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT plan_json FROM ai_plans WHERE id = ? AND user_id = ?", (plan_id, current_user["id"]))
        plan_row = cursor.fetchone()
        if not plan_row:
            raise HTTPException(status_code=404, detail="Plan not found.")

        plan_data = json.loads(plan_row["plan_json"])
        schedule = plan_data.get("schedule", [])
        total_days = len(schedule)

        target_day_obj = next((d for d in schedule if d["day_number"] == day_number), None)
        if not target_day_obj:
            raise HTTPException(status_code=400, detail="Invalid day number.")

        try:
            task_date = date.fromisoformat(target_day_obj["date"])
            if task_date > today:
                raise HTTPException(status_code=400, detail=f"Locked until {target_day_obj['date']}!")
        except ValueError:
            pass

        cursor.execute("SELECT id FROM plan_day_completions WHERE plan_id = ? AND day_number = ?", (plan_id, day_number))
        existing = cursor.fetchone()

        if existing:
            cursor.execute("DELETE FROM plan_day_completions WHERE plan_id = ? AND day_number = ?", (plan_id, day_number))
            is_completed = False
            msg = f"Day {day_number} unchecked."
        else:
            cursor.execute("INSERT INTO plan_day_completions (plan_id, user_id, day_number) VALUES (?, ?, ?)", (plan_id, current_user["id"], day_number))
            is_completed = True
            msg = f"Day {day_number} completed!"

        cursor.execute("SELECT day_number FROM plan_day_completions WHERE plan_id = ?", (plan_id,))
        completed_days = [r["day_number"] for r in cursor.fetchall()]
        progress_percentage = round((len(completed_days) / total_days) * 100, 1) if total_days > 0 else 0.0
        conn.commit()

    return {
        "plan_id": plan_id,
        "day_number": day_number,
        "is_completed": is_completed,
        "completed_days": completed_days,
        "progress_percentage": progress_percentage,
        "message": msg
    }


@app.delete("/ai/plans/{plan_id}")
def delete_plan(plan_id: int, current_user: dict = Depends(get_current_user)):
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM ai_plans WHERE id = ? AND user_id = ?", (plan_id, current_user["id"]))
        conn.commit()
    return {"message": "Plan deleted."}


# ----------------- STRICT POMODORO TIMER ENDPOINTS -----------------

@app.post("/pomodoro/start", response_model=PomodoroSessionResponse, status_code=status.HTTP_201_CREATED)
def start_pomodoro_session(payload: PomodoroStartRequest, current_user: dict = Depends(get_current_user)):
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO pomodoro_sessions (user_id, topic, target_minutes, status, started_at) VALUES (?, ?, ?, 'in_progress', datetime('now'))",
            (current_user["id"], payload.topic, payload.target_minutes)
        )
        conn.commit()
        session_id = cursor.lastrowid
        cursor.execute("SELECT * FROM pomodoro_sessions WHERE id = ?", (session_id,))
        new_session = dict(cursor.fetchone())
    return new_session


@app.post("/pomodoro/{session_id}/complete", response_model=PomodoroSessionResponse)
def complete_pomodoro_session(session_id: int, current_user: dict = Depends(get_current_user)):
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM pomodoro_sessions WHERE id = ? AND user_id = ?", (session_id, current_user["id"]))
        session = cursor.fetchone()
        if not session:
            raise HTTPException(status_code=404, detail="Pomodoro session not found.")

        session_dict = dict(session)
        if session_dict["status"] != "in_progress":
            raise HTTPException(status_code=400, detail="Session is no longer active.")

        target_min = session_dict["target_minutes"]
        started_dt = datetime.strptime(session_dict["started_at"], "%Y-%m-%d %H:%M:%S")
        now_dt = datetime.utcnow()
        elapsed_seconds = (now_dt - started_dt).total_seconds()
        required_seconds = (target_min * 60) - 12

        if elapsed_seconds < required_seconds:
            remaining_sec = int((target_min * 60) - elapsed_seconds)
            raise HTTPException(
                status_code=400,
                detail=f"Target duration ({target_min}m) not reached yet! {remaining_sec}s remaining."
            )

        actual_min = target_min
        coins_earned = (actual_min // 25) * 10

        cursor.execute(
            "UPDATE pomodoro_sessions SET actual_minutes = ?, coins_earned = ?, status = 'completed', ended_at = datetime('now') WHERE id = ?",
            (actual_min, coins_earned, session_id)
        )
        cursor.execute("UPDATE users SET coins = coins + ? WHERE id = ?", (coins_earned, current_user["id"]))
        new_streak, streak_bonus = update_user_streak_with_reward(cursor, current_user["id"])

        # ضربه به باس‌های فعال گروه‌های کاربر
        cursor.execute(
            """
            SELECT r.id, r.current_hp, r.reward_coins, r.group_id 
            FROM group_raids r
            JOIN group_members gm ON r.group_id = gm.group_id
            WHERE gm.user_id = ? AND r.status = 'active'
            """,
            (current_user["id"],)
        )
        active_raids = cursor.fetchall()

        for raid in active_raids:
            raid_id = raid["id"]
            damage = actual_min
            new_hp = max(0, raid["current_hp"] - damage)
            new_status = "defeated" if new_hp == 0 else "active"

            cursor.execute("UPDATE group_raids SET current_hp = ?, status = ? WHERE id = ?", (new_hp, new_status, raid_id))
            cursor.execute(
                """
                INSERT INTO raid_contributions (raid_id, user_id, damage_dealt)
                VALUES (?, ?, ?)
                ON CONFLICT(raid_id, user_id) DO UPDATE SET damage_dealt = damage_dealt + ?
                """,
                (raid_id, current_user["id"], damage, damage)
            )

            if new_status == "defeated":
                cursor.execute(
                    "UPDATE users SET coins = coins + ? WHERE id IN (SELECT user_id FROM raid_contributions WHERE raid_id = ?)",
                    (raid["reward_coins"], raid_id)
                )

        cursor.execute("SELECT coins FROM users WHERE id = ?", (current_user["id"],))
        updated_coins = cursor.fetchone()["coins"]
        conn.commit()

        cursor.execute("SELECT * FROM pomodoro_sessions WHERE id = ?", (session_id,))
        final_session = dict(cursor.fetchone())
        final_session["user_total_coins"] = updated_coins
        final_session["streak_bonus_coins"] = streak_bonus
        final_session["current_streak"] = new_streak

    return final_session


@app.post("/pomodoro/{session_id}/abandon")
def abandon_pomodoro_session(session_id: int, current_user: dict = Depends(get_current_user)):
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM pomodoro_sessions WHERE id = ? AND user_id = ?", (session_id, current_user["id"]))
        session = cursor.fetchone()
        if not session or session["status"] != "in_progress":
            return {"message": "Session closed."}

        started_dt = datetime.strptime(session["started_at"], "%Y-%m-%d %H:%M:%S")
        elapsed_minutes = max(0, min(session["target_minutes"] - 1, int((datetime.utcnow() - started_dt).total_seconds() // 60)))

        cursor.execute(
            "UPDATE pomodoro_sessions SET actual_minutes = ?, coins_earned = 0, status = 'abandoned', ended_at = datetime('now') WHERE id = ?",
            (elapsed_minutes, session_id)
        )
        conn.commit()
    return {"message": "Session abandoned. 0 coins awarded.", "elapsed_minutes": elapsed_minutes}


@app.get("/pomodoro/{session_id}/quiz")
async def get_pomodoro_quiz(session_id: int, lang: str = "fa", current_user: dict = Depends(get_current_user)):
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT topic FROM pomodoro_sessions WHERE id = ? AND user_id = ?", (session_id, current_user["id"]))
        session = cursor.fetchone()
        if not session:
            raise HTTPException(status_code=404, detail="Session not found.")
        topic = session["topic"] or "General Study"
    return await generate_quick_quiz(topic, lang)


@app.post("/pomodoro/{session_id}/quiz/claim")
def claim_quiz_bonus(session_id: int, req: QuizSubmitRequest, current_user: dict = Depends(get_current_user)):
    correct_count = min(len(req.answers), 2)
    bonus_coins = correct_count * 5
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("UPDATE users SET coins = coins + ? WHERE id = ?", (bonus_coins, current_user["id"]))
        cursor.execute("SELECT coins FROM users WHERE id = ?", (current_user["id"],))
        new_coins = cursor.fetchone()["coins"]
        conn.commit()
    return {"message": f"+{bonus_coins} Bonus Coins Claimed!", "new_coins": new_coins, "bonus": bonus_coins}


# ----------------- DASHBOARD & HEATMAP -----------------

@app.get("/dashboard/stats", response_model=DashboardStatsResponse)
def get_dashboard_stats(current_user: dict = Depends(get_current_user)):
    today = date.today()
    today_str = str(today)
    user_id = current_user["id"]

    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT current_streak, last_study_date, coins, active_theme FROM users WHERE id = ?", (user_id,))
        u = cursor.fetchone()
        raw_streak = u["current_streak"] or 0
        last_date = date.fromisoformat(u["last_study_date"]) if u["last_study_date"] else None

        if last_date == today:
            streak_status = "active_today"
            effective_streak = raw_streak
            next_day_in_cycle = 1 if effective_streak >= 7 else effective_streak + 1
            next_streak_reward = calculate_streak_reward(next_day_in_cycle)
        elif last_date == today - timedelta(days=1):
            streak_status = "pending_today"
            effective_streak = raw_streak
            today_cycle_day = 1 if effective_streak >= 7 else effective_streak + 1
            next_streak_reward = calculate_streak_reward(today_cycle_day)
        else:
            streak_status = "at_risk"
            effective_streak = 0
            next_streak_reward = 10

        cursor.execute(
            """
            SELECT 
                COALESCE(SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END), 0) AS today_pomo_count,
                COALESCE(SUM(actual_minutes), 0) AS today_pomo_mins
            FROM pomodoro_sessions 
            WHERE user_id = ? AND date(started_at) = CURRENT_DATE
            """,
            (user_id,)
        )
        pomo_stats = cursor.fetchone()
        today_pomo_mins = pomo_stats["today_pomo_mins"]

        cursor.execute(
            "SELECT COALESCE(SUM(duration_minutes), 0) AS today_quick_mins FROM study_sessions WHERE user_id = ? AND session_date = ?",
            (user_id, today_str)
        )
        today_quick_mins = cursor.fetchone()["today_quick_mins"]
        remaining_quick = max(0, DAILY_QUICK_LOG_LIMIT - today_quick_mins)
        today_total_minutes = today_quick_mins + today_pomo_mins

        cursor.execute(
            """
            SELECT 
                (SELECT COALESCE(SUM(duration_minutes), 0) FROM study_sessions WHERE user_id = ?) +
                (SELECT COALESCE(SUM(actual_minutes), 0) FROM pomodoro_sessions WHERE user_id = ?)
                AS total_all_minutes
            """,
            (user_id, user_id)
        )
        total_mins = cursor.fetchone()["total_all_minutes"]

        cursor.execute(
            "SELECT COALESCE(SUM(actual_minutes), 0) AS my_pomo_mins FROM pomodoro_sessions WHERE user_id = ? AND status = 'completed'",
            (user_id,)
        )
        my_pomo_mins = cursor.fetchone()["my_pomo_mins"]

        cursor.execute(
            """
            SELECT COUNT(*) + 1 AS rank
            FROM (
                SELECT u.id, COALESCE(SUM(p.actual_minutes), 0) AS pomo_mins
                FROM users u
                LEFT JOIN pomodoro_sessions p ON u.id = p.user_id AND p.status = 'completed'
                GROUP BY u.id
            ) ranked
            WHERE pomo_mins > ?
            """,
            (my_pomo_mins,)
        )
        leaderboard_rank = cursor.fetchone()["rank"]

        cursor.execute("SELECT COUNT(*) AS plan_count FROM ai_plans WHERE user_id = ?", (user_id,))
        plans_count = cursor.fetchone()["plan_count"]

    lvl_info = calculate_user_level(total_mins)

    return {
        "user_id": user_id,
        "username": current_user["username"],
        "coins": u["coins"],
        "current_streak": effective_streak,
        "streak_status": streak_status,
        "next_streak_reward": next_streak_reward,
        "active_theme": u["active_theme"],
        "leaderboard_rank": leaderboard_rank,
        "today_pomodoro_count": pomo_stats["today_pomo_count"],
        "today_pomodoro_minutes": today_pomo_mins,
        "today_quick_minutes": today_quick_mins,
        "remaining_quick_minutes": remaining_quick,
        "today_study_minutes": today_total_minutes,
        "today_study_hours": round(today_total_minutes / 60, 1),
        "total_study_hours": round(total_mins / 60, 1),
        "active_plans_count": plans_count,
        "level": lvl_info["level"],
        "xp": lvl_info["xp"],
        "next_level_xp": lvl_info["next_level_xp"],
        "title": lvl_info["title"],
        "title_fa": lvl_info["title_fa"]
    }


@app.get("/dashboard/heatmap", response_model=List[HeatmapDay])
def get_study_heatmap(current_user: dict = Depends(get_current_user)):
    with get_connection() as conn:
        cursor = conn.cursor()
        query = """
            SELECT day_date, SUM(mins) as total_minutes, COUNT(*) as session_count
            FROM (
                SELECT date(session_date) as day_date, duration_minutes as mins FROM study_sessions WHERE user_id = ?
                UNION ALL
                SELECT date(started_at) as day_date, actual_minutes as mins FROM pomodoro_sessions WHERE user_id = ?
            )
            WHERE day_date >= date('now', '-120 days')
            GROUP BY day_date
            ORDER BY day_date ASC;
        """
        cursor.execute(query, (current_user["id"], current_user["id"]))
        rows = cursor.fetchall()
    return [{"date": row["day_date"], "minutes": row["total_minutes"], "count": row["session_count"]} for row in rows]


# ----------------- GUILD BOSS RAIDS (AI BOSS NAME + STRICT 25 HP = 10 COINS) -----------------

@app.post("/ai/suggest-boss-name")
async def suggest_boss_name_endpoint(req: BossNameSuggestRequest, current_user: dict = Depends(get_current_user)):
    """پیشنهاد ۳ نام حماسی برای باس‌فایت بر اساس نام درس یا هدف با کمک Gemini"""
    suggestions = await generate_boss_names(req.course_or_goal, req.lang)
    return {"suggestions": suggestions}


@app.post("/groups/{group_id}/raids", response_model=RaidResponse)
async def create_group_raid(group_id: int, req: RaidCreateRequest, current_user: dict = Depends(get_current_user)):
    """ایجاد باس‌فایت با فرمول ثابت: هر ۲۵ اچ‌پی = ۱۰ سکه (غیرقابل تغییر دستی)"""
    # محاسبه قفل‌شده سکه بر اساس HP (هر 25 HP معادل 10 سکه)
    fixed_reward_coins = (req.max_hp // 25) * 10

    # اگر کاربر نام باس را خالی گذاشته بود، خودکار با جمینای بر اساس درس تولید شود
    final_boss_name = (req.boss_name or "").strip()
    if not final_boss_name:
        ai_names = await generate_boss_names(req.course_or_goal, req.lang)
        final_boss_name = ai_names[0]

    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?", (group_id, current_user["id"]))
        if not cursor.fetchone():
            raise HTTPException(status_code=403, detail="Not a group member.")

        cursor.execute(
            """
            INSERT INTO group_raids (group_id, boss_name, max_hp, current_hp, reward_coins)
            VALUES (?, ?, ?, ?, ?)
            """,
            (group_id, final_boss_name, req.max_hp, req.max_hp, fixed_reward_coins)
        )
        raid_id = cursor.lastrowid
        conn.commit()

        cursor.execute("SELECT * FROM group_raids WHERE id = ?", (raid_id,))
        new_raid = dict(cursor.fetchone())
        new_raid["top_damage_dealers"] = []
    return new_raid


@app.get("/groups/{group_id}/raids", response_model=List[RaidResponse])
def get_group_raids(group_id: int, current_user: dict = Depends(get_current_user)):
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM group_raids WHERE group_id = ? ORDER BY id DESC LIMIT 5", (group_id,))
        raids = [dict(r) for r in cursor.fetchall()]

        for r in raids:
            cursor.execute(
                """
                SELECT u.id AS user_id, u.username, rc.damage_dealt 
                FROM raid_contributions rc
                JOIN users u ON rc.user_id = u.id
                WHERE rc.raid_id = ?
                ORDER BY rc.damage_dealt DESC LIMIT 3
                """,
                (r["id"],)
            )
            r["top_damage_dealers"] = [dict(row) for row in cursor.fetchall()]
    return raids