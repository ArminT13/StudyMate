import sqlite3
import os
from datetime import datetime, timedelta

DB_PATH = os.path.join(os.path.dirname(__file__), "studymate.db")

def get_connection():
    """Create and return a SQLite connection with WAL mode and foreign keys enabled."""
    conn = sqlite3.connect(DB_PATH, timeout=10.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    conn.execute("PRAGMA journal_mode = WAL;")
    return conn

def init_db():
    """Initialize relational schema for users, courses, study sessions, and gamification."""
    with get_connection() as conn:
        cursor = conn.cursor()

        # 1. Users Table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                coins INTEGER DEFAULT 0,
                active_theme TEXT DEFAULT 'default',
                current_streak INTEGER DEFAULT 0,
                last_study_date DATE,
                character_name TEXT DEFAULT 'Minti',
                date_of_birth DATE,
                referral_code TEXT UNIQUE,
                referred_by INTEGER,
                premium_until TIMESTAMP,
                reset_token TEXT,
                reset_token_expires TIMESTAMP,
                equipped_hat TEXT DEFAULT NULL,
                equipped_glasses TEXT DEFAULT NULL,
                equipped_outfit TEXT DEFAULT 'classic',
                equipped_accessory TEXT DEFAULT 'sprout',
                equipped_jewelry TEXT DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (referred_by) REFERENCES users(id) ON DELETE SET NULL
            );
        """)

        # اضافه کردن ستون‌های ارتقا یافته به دیتابیس موجود بدون کرش کردن
        migration_columns = [
            ("current_streak", "INTEGER DEFAULT 0"),
            ("last_study_date", "DATE"),
            ("character_name", "TEXT DEFAULT 'Minti'"),
            ("date_of_birth", "DATE"),
            ("referral_code", "TEXT"),
            ("referred_by", "INTEGER"),
            ("premium_until", "TIMESTAMP"),
            ("reset_token", "TEXT"),
            ("reset_token_expires", "TIMESTAMP"),
            ("equipped_hat", "TEXT DEFAULT NULL"),
            ("equipped_glasses", "TEXT DEFAULT NULL"),
            ("equipped_outfit", "TEXT DEFAULT 'classic'"),
            ("equipped_accessory", "TEXT DEFAULT 'sprout'"),
            ("equipped_jewelry", "TEXT DEFAULT NULL")
        ]

        for col_name, col_def in migration_columns:
            try:
                cursor.execute(f"ALTER TABLE users ADD COLUMN {col_name} {col_def};")
            except sqlite3.OperationalError:
                pass

        # اطمینان از مقداردهی کد معرف و نام کاراکتر برای کاربران موجود
        cursor.execute("SELECT id, username, referral_code, character_name FROM users;")
        existing_users = cursor.fetchall()
        for u in existing_users:
            needs_update = False
            ref_code = u["referral_code"]
            c_name = u["character_name"] or "Minti"
            if not ref_code:
                clean_name = "".join(c for c in u["username"] if c.isalnum()).upper()[:4] or "USER"
                ref_code = f"SM-{clean_name}-{u['id']:04d}"
                needs_update = True
            if needs_update:
                cursor.execute(
                    "UPDATE users SET referral_code = ?, character_name = ? WHERE id = ?",
                    (ref_code, c_name, u["id"])
                )

        # 2. Courses Table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS courses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                color TEXT DEFAULT '#F5AFAF',
                weekly_goal_hours REAL DEFAULT 5.0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );
        """)

        # 3. Study Sessions Table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS study_sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                course_id INTEGER NOT NULL,
                duration_minutes INTEGER NOT NULL,
                session_date DATE NOT NULL,
                notes TEXT,
                coins_earned INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
            );
        """)

        # 4. User Themes Inventory
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS user_themes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                theme_id TEXT NOT NULL,
                purchased_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, theme_id),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );
        """)

        cursor.execute("""
            INSERT OR IGNORE INTO user_themes (user_id, theme_id)
            SELECT id, 'default' FROM users;
        """)

        # 4.1. User Accessories Inventory (کمد لباس و اکسسوری Minti)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS user_accessories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                item_id TEXT NOT NULL,
                purchased_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, item_id),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );
        """)

        cursor.execute("""
            INSERT OR IGNORE INTO user_accessories (user_id, item_id)
            SELECT id, 'classic' FROM users;
        """)
        cursor.execute("""
            INSERT OR IGNORE INTO user_accessories (user_id, item_id)
            SELECT id, 'sprout' FROM users;
        """)

        # 5. Study Groups Table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS study_groups (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                description TEXT,
                invite_code TEXT UNIQUE NOT NULL,
                owner_id INTEGER NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
            );
        """)

        # 6. Group Members Table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS group_members (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                group_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(group_id, user_id),
                FOREIGN KEY (group_id) REFERENCES study_groups(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );
        """)

        # 7. AI Study Plans Table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS ai_plans (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                goal_title TEXT NOT NULL,
                target_date DATE NOT NULL,
                daily_hours REAL NOT NULL,
                plan_json TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );
        """)

        # 8. Pomodoro Sessions Table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS pomodoro_sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                topic TEXT,
                target_minutes INTEGER DEFAULT 25,
                actual_minutes INTEGER DEFAULT 0,
                coins_earned INTEGER DEFAULT 0,
                status TEXT DEFAULT 'in_progress',
                started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                ended_at TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );
        """)

        # 9. AI Plan Day Completions Table (ثبت تیک زدن روزهای برنامه درسی)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS plan_day_completions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                plan_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                day_number INTEGER NOT NULL,
                completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(plan_id, day_number),
                FOREIGN KEY (plan_id) REFERENCES ai_plans(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );
        """)

        # 10. Group Boss Raids Table (باس‌فایت‌های تیمی)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS group_raids (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                group_id INTEGER NOT NULL,
                boss_name TEXT NOT NULL,
                max_hp INTEGER NOT NULL,
                current_hp INTEGER NOT NULL,
                reward_coins INTEGER DEFAULT 100,
                status TEXT DEFAULT 'active', -- 'active', 'defeated'
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (group_id) REFERENCES study_groups(id) ON DELETE CASCADE
            );
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS raid_contributions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                raid_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                damage_dealt INTEGER DEFAULT 0,
                UNIQUE(raid_id, user_id),
                FOREIGN KEY (raid_id) REFERENCES group_raids(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );
        """)

        # 11. Friend Requests & Friendships Table (سیستم دوستان)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS friend_requests (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                sender_id INTEGER NOT NULL,
                receiver_id INTEGER NOT NULL,
                status TEXT DEFAULT 'pending', -- 'pending', 'accepted', 'rejected'
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(sender_id, receiver_id),
                FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE
            );
        """)

        # 12. Global Weekly Boss Challenge Table (چالش هفتگی: شکست باس سایبری)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS weekly_challenges (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                week_identifier TEXT UNIQUE NOT NULL,
                boss_name TEXT NOT NULL,
                boss_name_fa TEXT NOT NULL,
                description_fa TEXT,
                max_hp INTEGER NOT NULL,
                current_hp INTEGER NOT NULL,
                reward_coins INTEGER DEFAULT 300,
                reward_xp INTEGER DEFAULT 1000,
                status TEXT DEFAULT 'active', -- 'active', 'defeated'
                ends_at TIMESTAMP NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS weekly_challenge_contributions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                challenge_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                damage_dealt INTEGER DEFAULT 0,
                UNIQUE(challenge_id, user_id),
                FOREIGN KEY (challenge_id) REFERENCES weekly_challenges(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );
        """)

        # ایجاد خودکار چالش هفتگی باس سایبری در صورت عدم وجود
        now = datetime.utcnow()
        current_iso_year, current_iso_week, _ = now.isocalendar()
        current_week_key = f"{current_iso_year}-W{current_iso_week:02d}"

        # پایان هفته جاری (یکشنبه ۲۳:۵۹:۵۹)
        days_until_sunday = 6 - now.weekday()
        if days_until_sunday < 0:
            days_until_sunday += 7
        week_end = (now + timedelta(days=days_until_sunday)).replace(hour=23, minute=59, second=59, microsecond=0)

        cursor.execute("SELECT id FROM weekly_challenges WHERE week_identifier = ?", (current_week_key,))
        existing_challenge = cursor.fetchone()
        if not existing_challenge:
            cursor.execute("""
                INSERT INTO weekly_challenges 
                (week_identifier, boss_name, boss_name_fa, description_fa, max_hp, current_hp, reward_coins, reward_xp, status, ends_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)
            """, (
                current_week_key,
                "Cyber Boss",
                "باس سایبری",
                "با ۲۰ ساعت مطالعه تیمی در طول هفته، باس سایبری را شکست دهید و ۳۰۰ سکه + ۱۰۰۰ اکس‌پی جایزه بگیرید!",
                5000,
                2750, # 55% باقی‌مانده (مشابه تصویر ارجاع که ۴۵٪ دمیج داده شده)
                300,
                1000,
                week_end.isoformat()
            ))

        conn.commit()
