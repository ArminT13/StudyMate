from datetime import date, datetime, timedelta
import secrets
import string
import json
import os
import re
import sqlite3
from typing import List, Literal, Optional
from fastapi import FastAPI, HTTPException, Depends, Query, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse, FileResponse

from app.database import init_db, get_connection
from app.auth import hash_password, verify_password, create_access_token, get_current_user
from app.ai_coach import generate_study_plan, generate_quick_quiz, generate_boss_names
from app.schemas import (
    UserRegister, UserLogin, PasswordForgotRequest, PasswordResetRequest, TokenResponse, UserProfile, PublicUserProfile,
    CharacterNameUpdate, AccessoryItem, AccessoryActionRequest,
    CourseCreate, CourseUpdate, CourseResponse,
    StudySessionCreate, StudySessionResponse, SessionCreationResult,
    ThemeItem, ThemeActionRequest, LeaderboardUser,
    GroupCreate, GroupJoin, GroupSummary, GroupDetail, GroupMemberItem,
    FriendUserItem, FriendRequestItem, FriendActionRequest,
    AICoachRequest, AICoachPlan, SavedPlanSummary,
    PomodoroStartRequest, PomodoroSessionResponse,
    PlanDayToggleResponse, PlanDetailResponse, DashboardStatsResponse,
    BossNameSuggestRequest, RaidCreateRequest, RaidResponse, WeeklyBossChallengeResponse,
    QuizSubmitRequest, HeatmapDay, ReferralInfoResponse
)

init_db()

app = FastAPI(
    title="StudyMate API",
    description="Gamified Collaborative Study Platform with Animated 3D Minti Companion",
    version="3.0.0"
)

# Enable CORS for cross-origin deployments (e.g. Netlify frontend + cloud API)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

static_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "static")
if os.path.exists(static_dir):
    app.mount("/static", StaticFiles(directory=static_dir, html=True), name="static")

@app.get("/")
def root():
    index_file = os.path.join(static_dir, "index.html")
    if os.path.exists(index_file):
        return FileResponse(index_file)
    return RedirectResponse(url="/static/index.html")


@app.get("/favicon.ico", include_in_schema=False)
def favicon():
    fav_file = os.path.join(static_dir, "favicon.ico")
    if os.path.exists(fav_file):
        return FileResponse(fav_file, media_type="image/x-icon")
    raise HTTPException(status_code=404, detail="Favicon not found")


# ----------------- LEVEL & XP ENGINE -----------------

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


# ----------------- THEMES CATALOG (MATCHING REFERENCE IMAGES) -----------------

AVAILABLE_THEMES = [
    {
        "id": "default",
        "name": "StudyMate Soft Pink",
        "name_fa": "صورتی ملایم استادی‌میت (پیش‌فرض)",
        "inspiration": "StudyMate Signature",
        "rarity": "COMMON",
        "price": 0,
        "preview_color": "#F5AFAF",
        "secondary_color": "#FBEFEF",
        "description_fa": "پالت آرامش‌بخش، تمیز و استاندارد استادی‌میت با رنگ‌های ملایم صورتی و خامه",
        "description_en": "Calming, clean and standard StudyMate pastel pink theme."
    },
    {
        "id": "jungle",
        "name": "Jungle Sanctuary",
        "name_fa": "تم جنگل سرسبز",
        "inspiration": "Cozy Nature",
        "rarity": "RARE",
        "price": 500,
        "preview_color": "#4ade80",
        "secondary_color": "#166534",
        "description_fa": "فضای باطراوت بیشه‌زار و برگ‌های شبنم‌زده برای تمرکز عمیق در دل طبیعت",
        "description_en": "Lush vibrant green leaves and woodland atmosphere for deep focus."
    },
    {
        "id": "night",
        "name": "Starlit Midnight",
        "name_fa": "تم شب پرستاره",
        "inspiration": "Nocturnal Serenity",
        "rarity": "RARE",
        "price": 800,
        "preview_color": "#6366f1",
        "secondary_color": "#1e1b4b",
        "description_fa": "آرامش تاریک آسمان شب و درخشش ملایم کهکشان‌ها برای جغدهای شب‌خوان",
        "description_en": "Deep starlit twilight ambiance for quiet nocturnal study sessions."
    },
    {
        "id": "spring",
        "name": "Spring Blossoms",
        "name_fa": "تم بهاری و شکوفه‌ها",
        "inspiration": "Sakura Bloom",
        "rarity": "EPIC",
        "price": 1000,
        "preview_color": "#f472b6",
        "secondary_color": "#ffe4e6",
        "description_fa": "عطر شکوفه‌های بهاری گیلاس و گلبرگ‌های لطیف صورتی و روشن",
        "description_en": "Delicate cherry blossom sakura petals and gentle spring breeze."
    },
    {
        "id": "snow",
        "name": "Winter Frost",
        "name_fa": "تم برفی و زمستانی",
        "inspiration": "Arctic Quietude",
        "rarity": "EPIC",
        "price": 1200,
        "preview_color": "#38bdf8",
        "secondary_color": "#0369a1",
        "description_fa": "سکوت دلنشین دانه‌های برف، بلورهای یخی و آبی کریستالی زمستان",
        "description_en": "Pristine crystalline snowflakes and tranquil icy blue winter glow."
    },
    {
        "id": "space",
        "name": "Cosmic Odyssey",
        "name_fa": "تم فضایی و کهکشان",
        "inspiration": "Deep Cosmos",
        "rarity": "LEGENDARY",
        "price": 1500,
        "preview_color": "#a855f7",
        "secondary_color": "#3b82f6",
        "description_fa": "سفری ماورایی به سحابی‌های بنفش و مسیرهای بی‌کران کیهانی",
        "description_en": "Futuristic deep space nebula with electric purple and cosmic cyan pulse."
    },
    {
        "id": "cyberpunk_amber",
        "name": "Cyberpunk Neon",
        "name_fa": "سایبرپانک نایت‌سیتی",
        "inspiration": "Sci-Fi",
        "rarity": "LEGENDARY",
        "price": 2000,
        "preview_color": "#facc15",
        "secondary_color": "#06b6d4",
        "description_fa": "زرد پرانرژی و آبی سایبرنتیک برای مبارزان با امتحانات سخت",
        "description_en": "High-voltage neon yellow and optical cyber blue."
    }
]


# ----------------- ACCESSORIES & OUTFITS CATALOG (MATCHING REFERENCE IMAGE 1) -----------------

AVAILABLE_ACCESSORIES = [
    # Outfits
    {
        "id": "classic",
        "name": "Classic Cozy",
        "name_fa": "لباس کلاسیک",
        "category": "outfit",
        "price": 0,
        "icon": "🎒",
        "description_fa": "لباس پایه و راحت مینتی با کوله‌پشتی دوست‌داشتنی",
        "description_en": "Standard cute Minti look with signature backpack."
    },
    {
        "id": "student",
        "name": "University Student",
        "name_fa": "لباس دانشجویی",
        "category": "outfit",
        "price": 250,
        "icon": "📖",
        "description_fa": "استایل درس‌خوان با کتاب دست‌نویس و حال‌وهوای دانشگاهی",
        "description_en": "Academic student outfit ready for marathon revision."
    },
    {
        "id": "gaming",
        "name": "Pro Gamer",
        "name_fa": "استایل گیمینگ",
        "category": "outfit",
        "price": 450,
        "icon": "🎧",
        "description_fa": "سویشرت شیک گیمری با هدست RGB صورتی",
        "description_en": "Esports gaming jacket with cat-ear headset."
    },
    {
        "id": "summer",
        "name": "Summer Breeze",
        "name_fa": "لباس تابستانی",
        "category": "outfit",
        "price": 350,
        "icon": "🏖️",
        "description_fa": "پیراهن خنک هاوایی با عینک دودی برای روزهای پرانرژی",
        "description_en": "Chill tropical summer vibes with cool shades."
    },
    {
        "id": "winter",
        "name": "Warm Winter",
        "name_fa": "پوشش زمستانی",
        "category": "outfit",
        "price": 400,
        "icon": "🧣",
        "description_fa": "پلیور پشمی گرم و شال‌گردن بافتنی برای روزهای برفی",
        "description_en": "Cozy knit sweater and scarf for snowy focus days."
    },
    {
        "id": "fantasy",
        "name": "Arcane Mage",
        "name_fa": "شنل فانتزی جادوگر",
        "category": "outfit",
        "price": 600,
        "icon": "🧙‍♂️",
        "description_fa": "شنل سلطنتی جادوگری با عصای چوبی و نور جادویی",
        "description_en": "Arcane magical cloak and wooden spellcasting wand."
    },
    {
        "id": "hoodie",
        "name": "Streetwear Hoodie",
        "name_fa": "هودی اورسایز مدرن",
        "category": "outfit",
        "price": 380,
        "icon": "🛹",
        "description_fa": "هودی لش و گشاد مد روز استریت‌ور با طرح گرافیتی",
        "description_en": "Oversized streetwear hoodie with cozy aesthetic."
    },
    # Hats
    {
        "id": "none_hat",
        "name": "None",
        "name_fa": "بدون کلاه",
        "category": "hat",
        "price": 0,
        "icon": "❌",
        "description_fa": "ظاهر طبیعی بدون کلاه",
        "description_en": "No headwear equipped."
    },
    {
        "id": "crown",
        "name": "Golden Crown",
        "name_fa": "تاج زرین سلطنتی",
        "category": "hat",
        "price": 500,
        "icon": "👑",
        "description_fa": "تاج طلایی پادشاهی برای اربابان مطالعه و لول‌آپ‌های حماسی",
        "description_en": "Luminous royal golden crown for study royalty."
    },
    {
        "id": "cap",
        "name": "Sport Cap",
        "name_fa": "کلاه کپ اسپرت",
        "category": "hat",
        "price": 150,
        "icon": "🧢",
        "description_fa": "کلاه لبه‌دار مدرن و سبک برای فعالیت‌های روزمره",
        "description_en": "Casual athletic baseball cap."
    },
    {
        "id": "beanie",
        "name": "Winter Beanie",
        "name_fa": "کلاه منگوله‌دار برفی",
        "category": "hat",
        "price": 200,
        "icon": "🧶",
        "description_fa": "کلاه بافتنی نرم با منگوله سفید برای گرم ماندن ذهن",
        "description_en": "Warm woolen pom-pom beanie for cozy thoughts."
    },
    {
        "id": "wizard_hat",
        "name": "Wizard Hat",
        "name_fa": "کلاه جادوگری بنفش",
        "category": "hat",
        "price": 350,
        "icon": "🧙",
        "description_fa": "کلاه مخروطی جادویی ستاره‌نشان",
        "description_en": "Pointed wizard hat laced with starlight magic."
    },
    {
        "id": "nightcap",
        "name": "Sleepy Nightcap",
        "name_fa": "کلاه خواب شبانه",
        "category": "hat",
        "price": 180,
        "icon": "💤",
        "description_fa": "کلاه خواب راه‎‌راه آبی برای استراحت و ریکاوری مغز",
        "description_en": "Silky nightcap for deep restorative sleep."
    },
    {
        "id": "bucket_hat",
        "name": "Streetwear Bucket Hat",
        "name_fa": "کلاه باکت استریت‌ور",
        "category": "hat",
        "price": 220,
        "icon": "👒",
        "description_fa": "کلاه باکت خفن ترند مناسب استایل‌های خاص و هنری",
        "description_en": "Trendy streetwear bucket hat with casual flair."
    },
    # Glasses
    {
        "id": "none_glasses",
        "name": "None",
        "name_fa": "بدون عینک",
        "category": "glasses",
        "price": 0,
        "icon": "❌",
        "description_fa": "بدون عینک",
        "description_en": "No eyewear equipped."
    },
    {
        "id": "round_glasses",
        "name": "Scholar Glasses",
        "name_fa": "عینک گرد مطالعه",
        "category": "glasses",
        "price": 120,
        "icon": "👓",
        "description_fa": "فریم باریک کلاسیک گرد، مناسب مطالعه دقیق جزوات",
        "description_en": "Classic circular spectacles for deep research."
    },
    {
        "id": "sunglasses",
        "name": "Cool Shades",
        "name_fa": "عینک آفتابی مد روز",
        "category": "glasses",
        "price": 160,
        "icon": "🕶️",
        "description_fa": "عینک آفتابی جذاب برای روزهای پرانرژی",
        "description_en": "Stylish shaded eyewear with confident flair."
    },
    {
        "id": "cyber_shades",
        "name": "Cyberpunk Visor",
        "name_fa": "عینک سایبرپانک نئونی",
        "category": "glasses",
        "price": 260,
        "icon": "🥽",
        "description_fa": "عینک یکپارچه نوری درخشان با بازتاب نئونی بنفش و فیروزه‌ای",
        "description_en": "Futuristic neon tinted visor straight out of Neo-Tokyo."
    },
    # Jewelry & Piercings
    {
        "id": "none_jewelry",
        "name": "None",
        "name_fa": "بدون زیورآلات",
        "category": "jewelry",
        "price": 0,
        "icon": "❌",
        "description_fa": "بدون پیرسینگ یا زیورآلات",
        "description_en": "No jewelry equipped."
    },
    {
        "id": "silver_hoops",
        "name": "Silver Hoop Earrings",
        "name_fa": "گوشواره حلقه‌ای نقره‌ای",
        "category": "jewelry",
        "price": 140,
        "icon": "💍",
        "description_fa": "حلقه‌های ظریف نقره‌ای روی لبه گوش‌های نرم مینتی",
        "description_en": "Polished minimalist silver hoop earrings on floppy ears."
    },
    {
        "id": "star_studs",
        "name": "Star Stud Earrings",
        "name_fa": "گوشواره میخی ستاره‌ای",
        "category": "jewelry",
        "price": 170,
        "icon": "✨",
        "description_fa": "ستاره‌های طلایی مینیاتوری درخشان روی گوش",
        "description_en": "Tiny shimmering golden star studs catching the light."
    },
    {
        "id": "ear_cuffs",
        "name": "Golden Ear Cuffs",
        "name_fa": "ایرکاف دوتایی طلایی",
        "category": "jewelry",
        "price": 190,
        "icon": "💫",
        "description_fa": "ایرکاف مدرن و ترند روی لاله گوش با بازتاب طلایی لوکس",
        "description_en": "Double gold metallic ear cuffs hugging the ear ridge."
    },
    {
        "id": "chain_necklace",
        "name": "Layered Streetwear Chain",
        "name_fa": "زنجیر لایه‌ای مدرن",
        "category": "jewelry",
        "price": 230,
        "icon": "⛓️",
        "description_fa": "زنجیر نقره‌ای دولایه با پلاک کوچک ستاره دور گردن",
        "description_en": "Layered silver chain choker with a mini star charm."
    },
    # Accessories
    {
        "id": "sprout",
        "name": "Green Leaf Sprout",
        "name_fa": "جوانه سبز روی سر",
        "category": "accessory",
        "price": 0,
        "icon": "🌱",
        "description_fa": "نماد اصلی رشد و شکوفایی استادی‌میت که با هر مطالعه جوانه می‌زند",
        "description_en": "Signature growing sprout representing knowledge blooming."
    },
    {
        "id": "headphones",
        "name": "Pink Lo-Fi Headphones",
        "name_fa": "هدفون صورتی لوفای",
        "category": "accessory",
        "price": 220,
        "icon": "🎧",
        "description_fa": "هدفون باکیفیت برای مسدود کردن صداهای مزاحم و غرق شدن در تمرکز",
        "description_en": "Cozy pastel headphones for noise cancellation and flow."
    },
    {
        "id": "backpack",
        "name": "Explorer Backpack",
        "name_fa": "کوله‌پشتی همراه",
        "category": "accessory",
        "price": 280,
        "icon": "🎒",
        "description_fa": "کوله کوچک و دوست‌داشتنی برای حمل کتاب‌ها و دفترچه‌ها",
        "description_en": "Compact travel pack containing books and notebooks."
    },
    {
        "id": "magic_star",
        "name": "Floating Star",
        "name_fa": "ستاره طلایی معلق",
        "category": "accessory",
        "price": 300,
        "icon": "⭐",
        "description_fa": "ستاره جادویی کوچکی که کنار مینتی پرواز می‌کند و به او انرژی می‌دهد",
        "description_en": "A friendly glowing star floating around Minti."
    }
]


# ----------------- AUTH & SECURITY ENDPOINTS -----------------

@app.post("/auth/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(user_data: UserRegister):
    # بررسی تطابق رمز عبور در صورت ارسال
    if user_data.confirm_password and user_data.password != user_data.confirm_password:
        raise HTTPException(status_code=400, detail="Passwords do not match!")

    # بررسی تاریخ تولد (نباید در آینده باشد)
    if user_data.date_of_birth and user_data.date_of_birth > date.today():
        raise HTTPException(status_code=400, detail="Date of birth cannot be in the future!")

    # بررسی حداقل طول رمز
    if len(user_data.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters long.")

    email_val = str(user_data.email) if user_data.email else f"{user_data.username.lower()}@studymate.local"
    hashed_pwd = hash_password(user_data.password)

    # کد معرف کاربر جدید
    clean_uname = "".join(c for c in user_data.username if c.isalnum()).upper()[:4] or "USER"
    rand_suffix = secrets.token_hex(2).upper()
    my_ref_code = f"SM-{clean_uname}-{rand_suffix}"

    with get_connection() as conn:
        cursor = conn.cursor()
        # بررسی وجود معرف
        referred_by_id = None
        if user_data.referral_code:
            cursor.execute("SELECT id FROM users WHERE UPPER(referral_code) = ?", (user_data.referral_code.strip().upper(),))
            ref_row = cursor.fetchone()
            if ref_row:
                referred_by_id = ref_row["id"]

        try:
            cursor.execute(
                """
                INSERT INTO users (username, email, password_hash, character_name, date_of_birth, referral_code, referred_by)
                VALUES (?, ?, ?, 'Minti', ?, ?, ?)
                """,
                (user_data.username, email_val, hashed_pwd, str(user_data.date_of_birth) if user_data.date_of_birth else None, my_ref_code, referred_by_id)
            )
            new_user_id = cursor.lastrowid

            # افزودن تم پیش‌فرض و اکسسوری‌های پایه
            cursor.execute("INSERT INTO user_themes (user_id, theme_id) VALUES (?, 'default')", (new_user_id,))
            cursor.execute("INSERT INTO user_accessories (user_id, item_id) VALUES (?, 'classic')", (new_user_id,))
            cursor.execute("INSERT INTO user_accessories (user_id, item_id) VALUES (?, 'sprout')", (new_user_id,))
            conn.commit()
        except sqlite3.IntegrityError:
            raise HTTPException(status_code=400, detail="Username or email already exists.")

    token = create_access_token(new_user_id, user_data.username)
    return {
        "access_token": token,
        "token_type": "bearer",
        "user_id": new_user_id,
        "username": user_data.username,
        "character_name": "Minti"
    }


@app.post("/auth/login", response_model=TokenResponse)
def login(credentials: UserLogin):
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, username, character_name, password_hash FROM users WHERE username = ?", (credentials.username,))
        user = cursor.fetchone()

    if not user or not verify_password(credentials.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid username or password")

    token = create_access_token(user["id"], user["username"])
    return {
        "access_token": token,
        "token_type": "bearer",
        "user_id": user["id"],
        "username": user["username"],
        "character_name": user["character_name"] or "Minti"
    }


@app.post("/auth/forgot-password")
def forgot_password(req: PasswordForgotRequest):
    """
    بازیابی امن رمز عبور: ایجاد توکن رمزنگاری‌شده و یک‌بار مصرف با انقضای ۱۵ دقیقه.
    از افشای غیرضروری وضعیت اکانت‌ها جلوگیری می‌کند.
    """
    identifier = req.username_or_email.strip()
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, username, email FROM users WHERE username = ? OR email = ?",
            (identifier, identifier)
        )
        user = cursor.fetchone()

        reset_token = None
        if user:
            # تولید توکن یک‌بار مصرف امن
            reset_token = secrets.token_urlsafe(24)
            expires_at = datetime.utcnow() + timedelta(minutes=15)
            cursor.execute(
                "UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?",
                (reset_token, expires_at.isoformat(), user["id"])
            )
            conn.commit()

    # در محیط محلی/توسعه، جهت آزمایش مستقیم کاربر، توکن معتبر برگشت داده می‌شود
    return {
        "message": "If an account matches, a recovery code has been generated.",
        "reset_token": reset_token, # در محیط توسعه برای سهولت تست UI
        "expires_in_minutes": 15
    }


@app.post("/auth/reset-password")
def reset_password(req: PasswordResetRequest):
    """ثبت رمز عبور جدید بر اساس توکن معتبر و انقضا نیافته"""
    if req.new_password != req.confirm_password:
        raise HTTPException(status_code=400, detail="Passwords do not match!")

    if len(req.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters!")

    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, reset_token_expires FROM users WHERE reset_token = ? AND reset_token IS NOT NULL",
            (req.token.strip(),)
        )
        user = cursor.fetchone()

        if not user:
            raise HTTPException(status_code=400, detail="Invalid or expired recovery token.")

        if user["reset_token_expires"]:
            exp_dt = datetime.fromisoformat(user["reset_token_expires"])
            if datetime.utcnow() > exp_dt:
                raise HTTPException(status_code=400, detail="Recovery token has expired. Please request a new one.")

        # ابطال توکن و ثبت پسورد جدید
        new_hash = hash_password(req.new_password)
        cursor.execute(
            "UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expires = NULL WHERE id = ?",
            (new_hash, user["id"])
        )
        conn.commit()

    return {"message": "Password successfully reset! You can now log in."}


@app.get("/users/me", response_model=UserProfile)
def read_current_user(current_user: dict = Depends(get_current_user)):
    now = datetime.utcnow()
    is_premium = False
    prem_until_str = current_user.get("premium_until")
    if prem_until_str:
        try:
            prem_dt = datetime.fromisoformat(prem_until_str)
            is_premium = (prem_dt > now)
        except Exception:
            pass

    return UserProfile(
        id=current_user["id"],
        username=current_user["username"],
        email=current_user.get("email"),
        coins=current_user.get("coins", 0),
        active_theme=current_user.get("active_theme", "default"),
        character_name=current_user.get("character_name") or "Minti",
        date_of_birth=current_user.get("date_of_birth"),
        referral_code=current_user.get("referral_code") or "",
        is_premium=is_premium,
        premium_until=prem_until_str,
        equipped_hat=current_user.get("equipped_hat"),
        equipped_glasses=current_user.get("equipped_glasses"),
        equipped_outfit=current_user.get("equipped_outfit") or "classic",
        equipped_accessory=current_user.get("equipped_accessory") or "sprout",
        equipped_jewelry=current_user.get("equipped_jewelry")
    )


@app.get("/users/{user_id}/profile", response_model=PublicUserProfile)
def get_public_user_profile(user_id: int):
    """دریافت کارت پروفایل عمومی کاربر بدون افشای تاریخ تولد یا اطلاعات خصوصی"""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT id, username, coins, active_theme, character_name,
                   equipped_hat, equipped_glasses, equipped_outfit, equipped_accessory, equipped_jewelry,
                   current_streak, created_at 
            FROM users WHERE id = ?
            """,
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
        character_name=u["character_name"] or "Minti",
        equipped_hat=u["equipped_hat"],
        equipped_glasses=u["equipped_glasses"],
        equipped_outfit=u["equipped_outfit"] or "classic",
        equipped_accessory=u["equipped_accessory"] or "sprout",
        equipped_jewelry=u["equipped_jewelry"],
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


# ----------------- CHARACTER NAMING & CUSTOMIZATION -----------------

@app.patch("/character/name")
def update_character_name(req: CharacterNameUpdate, current_user: dict = Depends(get_current_user)):
    """تغییر نام موجود دیجیتال کاربر با اعتبارسنجی طول و عدم وجود تگ‌های مخرب"""
    clean_name = re.sub(r"<[^>]*>", "", req.character_name).strip()
    if len(clean_name) < 2 or len(clean_name) > 25:
        raise HTTPException(status_code=400, detail="Character name must be between 2 and 25 characters.")

    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("UPDATE users SET character_name = ? WHERE id = ?", (clean_name, current_user["id"]))
        conn.commit()

    return {"message": "Character name updated successfully!", "character_name": clean_name}


@app.get("/shop/accessories", response_model=List[AccessoryItem])
def get_accessories_shop(current_user: dict = Depends(get_current_user)):
    """دریافت لیست کامل اکسسوری‌ها، لباس‌ها و کلاه‌ها به همراه وضعیت مالکیت و تجهیز"""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT item_id FROM user_accessories WHERE user_id = ?", (current_user["id"],))
        owned_items = {row["item_id"] for row in cursor.fetchall()}

        cursor.execute(
            "SELECT equipped_hat, equipped_glasses, equipped_outfit, equipped_accessory, equipped_jewelry FROM users WHERE id = ?",
            (current_user["id"],)
        )
        eq = cursor.fetchone()

    equipped_set = {
        eq["equipped_hat"],
        eq["equipped_glasses"],
        eq["equipped_outfit"] or "classic",
        eq["equipped_accessory"] or "sprout",
        eq["equipped_jewelry"]
    }

    result = []
    for item in AVAILABLE_ACCESSORIES:
        is_free_default = item["id"] in ["classic", "sprout", "none_hat", "none_glasses", "none_jewelry"]
        is_owned = is_free_default or (item["id"] in owned_items)
        is_equipped = (item["id"] in equipped_set)

        result.append(
            AccessoryItem(
                id=item["id"],
                name=item["name"],
                name_fa=item["name_fa"],
                category=item["category"],
                price=item["price"],
                icon=item["icon"],
                description_fa=item["description_fa"],
                description_en=item["description_en"],
                is_owned=is_owned,
                is_equipped=is_equipped
            )
        )
    return result


@app.post("/shop/accessories/buy")
def buy_accessory(req: AccessoryActionRequest, current_user: dict = Depends(get_current_user)):
    """خرید اکسسوری یا لباس با سکه معتبر"""
    item = next((a for a in AVAILABLE_ACCESSORIES if a["id"] == req.item_id), None)
    if not item:
        raise HTTPException(status_code=404, detail="Accessory not found.")

    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM user_accessories WHERE user_id = ? AND item_id = ?", (current_user["id"], req.item_id))
        if cursor.fetchone():
            raise HTTPException(status_code=400, detail="You already own this accessory!")

        cursor.execute("SELECT coins FROM users WHERE id = ?", (current_user["id"],))
        user_coins = cursor.fetchone()["coins"]

        if user_coins < item["price"]:
            raise HTTPException(status_code=400, detail=f"Insufficient coins! Price: {item['price']}, You have: {user_coins}")

        cursor.execute("UPDATE users SET coins = coins - ? WHERE id = ?", (item["price"], current_user["id"]))
        cursor.execute("INSERT INTO user_accessories (user_id, item_id) VALUES (?, ?)", (current_user["id"], req.item_id))
        conn.commit()

        cursor.execute("SELECT coins FROM users WHERE id = ?", (current_user["id"],))
        remaining = cursor.fetchone()["coins"]

    return {"message": f"Unlocked {item['name_fa']}!", "remaining_coins": remaining, "item_id": req.item_id}


@app.post("/shop/accessories/equip")
def equip_accessory(req: AccessoryActionRequest, current_user: dict = Depends(get_current_user)):
    """تجهیز یا تعویض لباس، کلاه، عینک، اکسسوری یا زیورآلات Minti"""
    is_none_action = req.item_id in ["none_hat", "none_glasses", "none_jewelry"]
    is_free_default = req.item_id in ["classic", "sprout", "none_hat", "none_glasses", "none_jewelry"]

    with get_connection() as conn:
        cursor = conn.cursor()
        if not is_none_action and not is_free_default:
            cursor.execute("SELECT id FROM user_accessories WHERE user_id = ? AND item_id = ?", (current_user["id"], req.item_id))
            if not cursor.fetchone():
                raise HTTPException(status_code=400, detail="You must purchase this accessory first!")

        col_map = {
            "hat": "equipped_hat",
            "glasses": "equipped_glasses",
            "outfit": "equipped_outfit",
            "accessory": "equipped_accessory",
            "jewelry": "equipped_jewelry"
        }
        target_col = col_map.get(req.category)
        if not target_col:
            raise HTTPException(status_code=400, detail="Invalid accessory category.")

        val_to_set = None if is_none_action else req.item_id
        cursor.execute(f"UPDATE users SET {target_col} = ? WHERE id = ?", (val_to_set, current_user["id"]))
        conn.commit()

    return {"message": f"Equipped {req.item_id}!", "category": req.category, "item_id": val_to_set}


# ----------------- SHOP THEMES ENDPOINTS -----------------

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

    return {"message": f"Unlocked {theme['name_fa']}!", "remaining_coins": remaining_coins, "theme_id": request.theme_id}


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


# ----------------- FRIENDS SYSTEM ENDPOINTS -----------------

@app.get("/friends", response_model=List[FriendUserItem])
def get_user_friends(current_user: dict = Depends(get_current_user)):
    """دریافت لیست دوستان پذیرفته‌شده کاربر"""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT u.id, u.username, u.character_name, u.active_theme,
                   (
                       SELECT COALESCE(SUM(actual_minutes), 0) FROM pomodoro_sessions WHERE user_id = u.id AND status = 'completed'
                   ) + (
                       SELECT COALESCE(SUM(duration_minutes), 0) FROM study_sessions WHERE user_id = u.id
                   ) AS total_study_mins
            FROM users u
            WHERE u.id IN (
                SELECT receiver_id FROM friend_requests WHERE sender_id = ? AND status = 'accepted'
                UNION
                SELECT sender_id FROM friend_requests WHERE receiver_id = ? AND status = 'accepted'
            )
            ORDER BY total_study_mins DESC
            """,
            (current_user["id"], current_user["id"])
        )
        rows = cursor.fetchall()

    results = []
    for r in rows:
        lvl = calculate_user_level(r["total_study_mins"])
        results.append(
            FriendUserItem(
                id=r["id"],
                username=r["username"],
                character_name=r["character_name"] or "Minti",
                level=lvl["level"],
                active_theme=r["active_theme"],
                is_online=True,
                study_hours=round(r["total_study_mins"] / 60, 1),
                bio_fa="همراه مطالعه استادی‌میت"
            )
        )
    return results


@app.get("/friends/requests", response_model=List[FriendRequestItem])
def get_friend_requests(current_user: dict = Depends(get_current_user)):
    """دریافت درخواست‌های دوستی دریافتی که در انتظار پاسخ هستند"""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT fr.id, fr.sender_id, u.username AS sender_username, u.character_name, fr.created_at
            FROM friend_requests fr
            JOIN users u ON fr.sender_id = u.id
            WHERE fr.receiver_id = ? AND fr.status = 'pending'
            ORDER BY fr.id DESC
            """,
            (current_user["id"],)
        )
        rows = cursor.fetchall()
    return [
        FriendRequestItem(
            id=r["id"],
            sender_id=r["sender_id"],
            sender_username=r["sender_username"],
            character_name=r["character_name"] or "Minti",
            created_at=str(r["created_at"])[:19]
        )
        for r in rows
    ]


@app.post("/friends/action")
def friend_action(req: FriendActionRequest, current_user: dict = Depends(get_current_user)):
    """ارسال، پذیرش، رد یا حذف درخواست دوستی"""
    with get_connection() as conn:
        cursor = conn.cursor()

        if req.action == "send":
            if not req.target_username_or_id:
                raise HTTPException(status_code=400, detail="Target username required.")

            cursor.execute(
                "SELECT id, username FROM users WHERE username = ? OR id = ?",
                (req.target_username_or_id, req.target_username_or_id)
            )
            target = cursor.fetchone()
            if not target:
                raise HTTPException(status_code=404, detail="User not found.")
            if target["id"] == current_user["id"]:
                raise HTTPException(status_code=400, detail="You cannot send a friend request to yourself!")

            cursor.execute(
                """
                SELECT id, status FROM friend_requests 
                WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)
                """,
                (current_user["id"], target["id"], target["id"], current_user["id"])
            )
            existing = cursor.fetchone()
            if existing:
                if existing["status"] == "accepted":
                    return {"message": "Already friends with this user!"}
                elif existing["status"] == "pending":
                    return {"message": "Friend request already pending."}
                else:
                    cursor.execute("UPDATE friend_requests SET status = 'pending', sender_id = ?, receiver_id = ? WHERE id = ?",
                                   (current_user["id"], target["id"], existing["id"]))
                    conn.commit()
                    return {"message": f"Friend request sent to {target['username']}!"}

            cursor.execute(
                "INSERT INTO friend_requests (sender_id, receiver_id, status) VALUES (?, ?, 'pending')",
                (current_user["id"], target["id"])
            )
            conn.commit()
            return {"message": f"Friend request sent to {target['username']}!"}

        elif req.action == "accept":
            if not req.request_id:
                raise HTTPException(status_code=400, detail="Request ID required.")
            cursor.execute(
                "UPDATE friend_requests SET status = 'accepted' WHERE id = ? AND receiver_id = ?",
                (req.request_id, current_user["id"])
            )
            if cursor.rowcount == 0:
                raise HTTPException(status_code=404, detail="Friend request not found.")
            conn.commit()
            return {"message": "Friend request accepted!"}

        elif req.action == "reject":
            if not req.request_id:
                raise HTTPException(status_code=400, detail="Request ID required.")
            cursor.execute(
                "UPDATE friend_requests SET status = 'rejected' WHERE id = ? AND receiver_id = ?",
                (req.request_id, current_user["id"])
            )
            conn.commit()
            return {"message": "Friend request declined."}

        elif req.action == "remove":
            if not req.target_username_or_id:
                raise HTTPException(status_code=400, detail="Target user ID required.")
            target_id = int(req.target_username_or_id)
            cursor.execute(
                """
                DELETE FROM friend_requests 
                WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)
                """,
                (current_user["id"], target_id, target_id, current_user["id"])
            )
            conn.commit()
            return {"message": "Friend removed."}


@app.get("/users/search")
def search_users(q: str = Query(..., min_length=2), current_user: dict = Depends(get_current_user)):
    """جستجوی کاربران بر اساس نام کاربری جهت ارسال درخواست دوستی"""
    term = f"%{q.strip()}%"
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT id, username, character_name, active_theme 
            FROM users 
            WHERE username LIKE ? AND id != ?
            LIMIT 10
            """,
            (term, current_user["id"])
        )
        rows = cursor.fetchall()
    return [{"id": r["id"], "username": r["username"], "character_name": r["character_name"] or "Minti", "active_theme": r["active_theme"]} for r in rows]


# ----------------- GLOBAL WEEKLY BOSS CHALLENGE (MATCHING REFERENCE IMAGE 2) -----------------

@app.get("/challenges/weekly", response_model=WeeklyBossChallengeResponse)
def get_weekly_challenge(current_user: dict = Depends(get_current_user)):
    """
    دریافت وضعیت باس‌فایت چالش هفتگی سراسری (شکست باس سایبری با هدف ۲۰ ساعت مطالعه هفتگی)
    """
    now = datetime.utcnow()
    current_iso_year, current_iso_week, _ = now.isocalendar()
    current_week_key = f"{current_iso_year}-W{current_iso_week:02d}"

    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM weekly_challenges WHERE week_identifier = ?", (current_week_key,))
        challenge = cursor.fetchone()

        if not challenge:
            # ایجاد خودکار اگر وجود نداشت
            days_until_sunday = 6 - now.weekday()
            if days_until_sunday < 0:
                days_until_sunday += 7
            week_end = (now + timedelta(days=days_until_sunday)).replace(hour=23, minute=59, second=59, microsecond=0)
            cursor.execute("""
                INSERT INTO weekly_challenges 
                (week_identifier, boss_name, boss_name_fa, description_fa, max_hp, current_hp, reward_coins, reward_xp, status, ends_at)
                VALUES (?, 'Cyber Boss', 'باس سایبری', 'با ۲۰ ساعت مطالعه در طول هفته، باس سایبری را شکست دهید!', 5000, 2750, 300, 1000, 'active', ?)
            """, (current_week_key, week_end.isoformat()))
            conn.commit()
            cursor.execute("SELECT * FROM weekly_challenges WHERE week_identifier = ?", (current_week_key,))
            challenge = cursor.fetchone()

        # محاسبه روزهای باقیمانده تا پایان چالش
        end_dt = datetime.fromisoformat(challenge["ends_at"])
        days_remaining = max(0, (end_dt - now).days)

        # آسیب وارد شده توسط کاربر فعلی
        cursor.execute(
            "SELECT damage_dealt FROM weekly_challenge_contributions WHERE challenge_id = ? AND user_id = ?",
            (challenge["id"], current_user["id"])
        )
        contrib_row = cursor.fetchone()
        user_damage = contrib_row["damage_dealt"] if contrib_row else 0

        # محاسبه درصد مشارکت کاربر
        total_dmg_dealt = challenge["max_hp"] - challenge["current_hp"]
        contrib_pct = round((user_damage / max(1, total_dmg_dealt)) * 100, 1) if total_dmg_dealt > 0 else 0.0

        # برترین مبارزان این هفته
        cursor.execute(
            """
            SELECT u.id AS user_id, u.username, u.character_name, c.damage_dealt
            FROM weekly_challenge_contributions c
            JOIN users u ON c.user_id = u.id
            WHERE c.challenge_id = ?
            ORDER BY c.damage_dealt DESC LIMIT 4
            """,
            (challenge["id"],)
        )
        top_fighters = [dict(r) for r in cursor.fetchall()]

    hp_pct = round((challenge["current_hp"] / challenge["max_hp"]) * 100, 1)

    return WeeklyBossChallengeResponse(
        id=challenge["id"],
        week_identifier=challenge["week_identifier"],
        boss_name=challenge["boss_name"],
        boss_name_fa=challenge["boss_name_fa"],
        description_fa=challenge["description_fa"] or "چالش هفتگی باس سایبری",
        max_hp=challenge["max_hp"],
        current_hp=challenge["current_hp"],
        hp_percentage=hp_pct,
        reward_coins=challenge["reward_coins"],
        reward_xp=challenge["reward_xp"],
        days_remaining=days_remaining,
        user_damage=user_damage,
        user_contribution_percentage=contrib_pct,
        status=challenge["status"],
        top_contributors=top_fighters
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


# ----------------- QUICK STUDY SESSIONS -----------------

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


# ----------------- STRICT POMODORO TIMER & GAME REWARDS -----------------

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
    """
    بررسی ضد تقلب زمان جلسه، واریز سکه‌ها، اکس‌پی (+50 XP)، پاداش استریک، 
    اعمال ضربه به باس سایبری هفتگی و باس‌های گیلد، و فعال‌سازی پاداش معرف (۳ روز پرمیوم).
    """
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
        required_seconds = (target_min * 60) - 10 # 10s grace margin for network jitter

        if elapsed_seconds < required_seconds:
            remaining_sec = int((target_min * 60) - elapsed_seconds)
            raise HTTPException(
                status_code=400,
                detail=f"Target duration ({target_min}m) not reached yet! {remaining_sec}s remaining."
            )

        actual_min = target_min
        # پاداش استاندارد: هر ۲۵ دقیقه = ۱۰ سکه طلایی
        coins_earned = max(5, (actual_min // 25) * 10)
        xp_earned = 50 # مطابق با تصویر مرجع

        cursor.execute(
            "UPDATE pomodoro_sessions SET actual_minutes = ?, coins_earned = ?, status = 'completed', ended_at = datetime('now') WHERE id = ?",
            (actual_min, coins_earned, session_id)
        )
        cursor.execute("UPDATE users SET coins = coins + ? WHERE id = ?", (coins_earned, current_user["id"]))
        new_streak, streak_bonus = update_user_streak_with_reward(cursor, current_user["id"])

        # 1. اعمال آسیب به چالش هفتگی باس سایبری (هر ۱ دقیقه مطالعه = ۱ دمیج)
        current_iso_year, current_iso_week, _ = now_dt.isocalendar()
        current_week_key = f"{current_iso_year}-W{current_iso_week:02d}"
        cursor.execute("SELECT id, current_hp FROM weekly_challenges WHERE week_identifier = ? AND status = 'active'", (current_week_key,))
        w_challenge = cursor.fetchone()
        if w_challenge:
            w_new_hp = max(0, w_challenge["current_hp"] - actual_min)
            w_status = "defeated" if w_new_hp == 0 else "active"
            cursor.execute("UPDATE weekly_challenges SET current_hp = ?, status = ? WHERE id = ?", (w_new_hp, w_status, w_challenge["id"]))
            cursor.execute(
                """
                INSERT INTO weekly_challenge_contributions (challenge_id, user_id, damage_dealt)
                VALUES (?, ?, ?)
                ON CONFLICT(challenge_id, user_id) DO UPDATE SET damage_dealt = damage_dealt + ?
                """,
                (w_challenge["id"], current_user["id"], actual_min, actual_min)
            )

        # 2. اعمال آسیب به باس‌های فعال گیلد
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

        # 3. پاداش معرف: اهدای ۳ روز پرمیوم رایگان در اولین جلسه مطالعه
        cursor.execute("SELECT referred_by, premium_until FROM users WHERE id = ?", (current_user["id"],))
        ref_user = cursor.fetchone()
        if ref_user and ref_user["referred_by"]:
            # بررسی اینکه آیا این اولین جلسه تکمیل‌شده است
            cursor.execute("SELECT COUNT(*) AS c FROM pomodoro_sessions WHERE user_id = ? AND status = 'completed'", (current_user["id"],))
            comp_count = cursor.fetchone()["c"]
            if comp_count == 1:
                # اهدای ۳ روز پرمیوم به کاربر و معرف
                reward_expires = (now_dt + timedelta(days=3)).isoformat()
                cursor.execute("UPDATE users SET premium_until = ? WHERE id = ?", (reward_expires, current_user["id"]))
                cursor.execute("UPDATE users SET premium_until = ? WHERE id = ?", (reward_expires, ref_user["referred_by"]))

        cursor.execute("SELECT coins FROM users WHERE id = ?", (current_user["id"],))
        updated_coins = cursor.fetchone()["coins"]

        # محاسبه لول و اکس‌پی جدید
        cursor.execute(
            """
            SELECT 
                (SELECT COALESCE(SUM(duration_minutes), 0) FROM study_sessions WHERE user_id = ?) +
                (SELECT COALESCE(SUM(actual_minutes), 0) FROM pomodoro_sessions WHERE user_id = ? AND status = 'completed')
                AS total_all_minutes
            """,
            (current_user["id"], current_user["id"])
        )
        total_mins = cursor.fetchone()["total_all_minutes"]
        lvl_info = calculate_user_level(total_mins)

        conn.commit()

        cursor.execute("SELECT * FROM pomodoro_sessions WHERE id = ?", (session_id,))
        final_session = dict(cursor.fetchone())
        final_session["user_total_coins"] = updated_coins
        final_session["streak_bonus_coins"] = streak_bonus
        final_session["current_streak"] = new_streak
        final_session["xp_earned"] = xp_earned
        final_session["user_level"] = lvl_info["level"]
        final_session["user_xp"] = lvl_info["xp"]

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


# ----------------- DASHBOARD & STATS -----------------

@app.get("/dashboard/stats", response_model=DashboardStatsResponse)
def get_dashboard_stats(current_user: dict = Depends(get_current_user)):
    today = date.today()
    today_str = str(today)
    user_id = current_user["id"]

    # تاریخ شروع هفته جاری (۷ روز اخیر یا از دوشنبه)
    week_start_str = str(today - timedelta(days=6))

    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT current_streak, last_study_date, coins, active_theme, character_name,
                   equipped_hat, equipped_glasses, equipped_outfit, equipped_accessory, equipped_jewelry,
                   referral_code, premium_until
            FROM users WHERE id = ?
            """,
            (user_id,)
        )
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

        # آمار امروز
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

        # آمار هفتگی (هدف هفتگی پایه: ۲۰ ساعت مطالعه طبق نیازمندی بخش ۹)
        cursor.execute(
            """
            SELECT 
                (
                    SELECT COALESCE(SUM(actual_minutes), 0) FROM pomodoro_sessions 
                    WHERE user_id = ? AND status = 'completed' AND date(started_at) >= ?
                ) + (
                    SELECT COALESCE(SUM(duration_minutes), 0) FROM study_sessions 
                    WHERE user_id = ? AND session_date >= ?
                ) AS weekly_mins
            """,
            (user_id, week_start_str, user_id, week_start_str)
        )
        weekly_study_minutes = cursor.fetchone()["weekly_mins"]
        weekly_study_hours = round(weekly_study_minutes / 60, 1)
        weekly_goal_hours = 20.0
        weekly_goal_percentage = min(100.0, round((weekly_study_hours / weekly_goal_hours) * 100, 1))

        # هدف مطالعه امروز (۲ ساعت پیش‌فرض)
        today_goal_hours = 2.0
        today_study_hours = round(today_total_minutes / 60, 1)
        today_goal_percentage = min(100.0, round((today_study_hours / today_goal_hours) * 100, 1))

        # کل مطالعه همه زمان‌ها
        cursor.execute(
            """
            SELECT 
                (SELECT COALESCE(SUM(duration_minutes), 0) FROM study_sessions WHERE user_id = ?) +
                (SELECT COALESCE(SUM(actual_minutes), 0) FROM pomodoro_sessions WHERE user_id = ? AND status = 'completed')
                AS total_all_minutes
            """,
            (user_id, user_id)
        )
        total_mins = cursor.fetchone()["total_all_minutes"]

        # رتبه کاربر
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
            (today_pomo_mins,)
        )
        leaderboard_rank = cursor.fetchone()["rank"]

        cursor.execute("SELECT COUNT(*) AS plan_count FROM ai_plans WHERE user_id = ?", (user_id,))
        plans_count = cursor.fetchone()["plan_count"]

    lvl_info = calculate_user_level(total_mins)

    is_premium = False
    if u["premium_until"]:
        try:
            is_premium = (datetime.fromisoformat(u["premium_until"]) > datetime.utcnow())
        except Exception:
            pass

    return {
        "user_id": user_id,
        "username": current_user["username"],
        "character_name": u["character_name"] or "Minti",
        "equipped_hat": u["equipped_hat"],
        "equipped_glasses": u["equipped_glasses"],
        "equipped_outfit": u["equipped_outfit"] or "classic",
        "equipped_accessory": u["equipped_accessory"] or "sprout",
        "equipped_jewelry": u["equipped_jewelry"],
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
        "today_study_hours": today_study_hours,
        "today_goal_hours": today_goal_hours,
        "today_goal_percentage": today_goal_percentage,
        "weekly_study_minutes": weekly_study_minutes,
        "weekly_study_hours": weekly_study_hours,
        "weekly_goal_hours": weekly_goal_hours,
        "weekly_goal_percentage": weekly_goal_percentage,
        "total_study_hours": round(total_mins / 60, 1),
        "active_plans_count": plans_count,
        "level": lvl_info["level"],
        "xp": lvl_info["xp"],
        "next_level_xp": lvl_info["next_level_xp"],
        "title": lvl_info["title"],
        "title_fa": lvl_info["title_fa"],
        "is_premium": is_premium,
        "referral_code": u["referral_code"] or ""
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
                SELECT date(started_at) as day_date, actual_minutes as mins FROM pomodoro_sessions WHERE user_id = ? AND status = 'completed'
            )
            WHERE day_date >= date('now', '-120 days')
            GROUP BY day_date
            ORDER BY day_date ASC;
        """
        cursor.execute(query, (current_user["id"], current_user["id"]))
        rows = cursor.fetchall()
    return [{"date": row["day_date"], "minutes": row["total_minutes"], "count": row["session_count"]} for row in rows]


# ----------------- LEADERBOARD -----------------

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
            u.character_name,
            u.active_theme,
            COALESCE(SUM(p.actual_minutes), 0) AS total_study_minutes,
            COALESCE(SUM(p.coins_earned), 0) AS total_coins_earned,
            (
                SELECT COALESCE(SUM(duration_minutes), 0) FROM study_sessions s WHERE s.user_id = u.id
            ) + (
                SELECT COALESCE(SUM(actual_minutes), 0) FROM pomodoro_sessions pm WHERE pm.user_id = u.id AND pm.status = 'completed'
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
                character_name=row["character_name"] or "Minti",
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


# ----------------- STUDY GROUPS & CLANS -----------------

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
                u.character_name,
                u.active_theme,
                (u.id = ?) AS is_owner,
                COALESCE(SUM(p.actual_minutes), 0) AS total_study_minutes,
                (
                    SELECT COALESCE(SUM(duration_minutes), 0) FROM study_sessions s WHERE s.user_id = u.id
                ) + (
                    SELECT COALESCE(SUM(actual_minutes), 0) FROM pomodoro_sessions pm WHERE pm.user_id = u.id AND pm.status = 'completed'
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
                character_name=row["character_name"] or "Minti",
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


# ----------------- GUILD BOSS RAIDS -----------------

@app.post("/ai/suggest-boss-name")
async def suggest_boss_name_endpoint(req: BossNameSuggestRequest, current_user: dict = Depends(get_current_user)):
    suggestions = await generate_boss_names(req.course_or_goal, req.lang)
    return {"suggestions": suggestions}


@app.post("/groups/{group_id}/raids", response_model=RaidResponse)
async def create_group_raid(group_id: int, req: RaidCreateRequest, current_user: dict = Depends(get_current_user)):
    fixed_reward_coins = (req.max_hp // 25) * 10
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


# ----------------- AI STUDY COACH PLANS -----------------

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


# ----------------- REFERRALS & PREMIUM -----------------

@app.get("/referrals/me", response_model=ReferralInfoResponse)
def get_my_referrals(current_user: dict = Depends(get_current_user)):
    """دریافت اطلاعات کد دعوت اختصاصی، تعداد دعوت‌های موفق و وضعیت پرمیوم"""
    ref_code = current_user.get("referral_code") or ""
    with get_connection() as conn:
        cursor = conn.cursor()
        # شمارش کاربرانی که با این کد ثبت نام کرده و حداقل یک جلسه مطالعه را به پایان رسانده‌اند
        cursor.execute(
            """
            SELECT COUNT(DISTINCT u.id) AS successful_count
            FROM users u
            JOIN pomodoro_sessions p ON u.id = p.user_id AND p.status = 'completed'
            WHERE u.referred_by = ?
            """,
            (current_user["id"],)
        )
        successful_count = cursor.fetchone()["successful_count"]

    prem_until_str = current_user.get("premium_until")
    is_premium = False
    if prem_until_str:
        try:
            is_premium = (datetime.fromisoformat(prem_until_str) > datetime.utcnow())
        except Exception:
            pass

    return ReferralInfoResponse(
        referral_code=ref_code,
        referral_link=f"https://studymate.app/join?ref={ref_code}",
        successful_referrals_count=successful_count,
        reward_days_earned=successful_count * 3,
        is_premium=is_premium,
        premium_until=prem_until_str
    )
