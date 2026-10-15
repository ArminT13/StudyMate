import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "studymate.db")

def get_connection():
    """Create and return a SQLite connection with foreign keys enabled."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn

def init_db():
    """Initialize relational schema for users, courses, and study sessions."""
    with get_connection() as conn:
        cursor = conn.cursor()

        # 1. Users Table (با سکه اولیه و تم پروفایل)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                coins INTEGER DEFAULT 0,
                active_theme TEXT DEFAULT 'default',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)

        # 2. Courses Table (وابسته به هر کاربر)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS courses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                color TEXT DEFAULT '#6366f1',
                weekly_goal_hours REAL DEFAULT 5.0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );
        """)

        # 3. Study Sessions Table (ثبت بازه‌های مطالعه)
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

        # 4. User Themes Inventory (تم‌های خریداری شده توسط هر کاربر)
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

        # اطمینان از داشتن تم پیش‌فرض برای همه کاربران
        cursor.execute("""
            INSERT OR IGNORE INTO user_themes (user_id, theme_id)
            SELECT id, 'default' FROM users;
        """)

        conn.commit()