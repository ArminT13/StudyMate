from app.schemas import (
    UserRegister, UserLogin, TokenResponse, UserProfile,
    CourseCreate, CourseUpdate, CourseResponse,
    StudySessionCreate, StudySessionResponse, SessionCreationResult
)
from typing import List, Optional
import sqlite3
from fastapi import FastAPI, HTTPException, Depends, status
from app.database import init_db, get_connection
from app.schemas import UserRegister, UserLogin, TokenResponse, UserProfile
from app.auth import hash_password, verify_password, create_access_token, get_current_user

# راه‌اندازی دیتابیس در هنگام شروع برنامه
init_db()

app = FastAPI(
    title="StudyMate API",
    description="Gamified Collaborative Study Platform Backend",
    version="1.0.0"
)

@app.get("/")
def root():
    return {"message": "Welcome to StudyMate API! Visit /docs for interactive Swagger UI."}

# ۱. ثبت نام کاربر جدید
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
            conn.commit()
            new_user_id = cursor.lastrowid
        except sqlite3.IntegrityError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username or email already exists."
            )

    token = create_access_token(new_user_id, user_data.username)
    return {"access_token": token, "token_type": "bearer"}

# ۲. ورود و دریافت توکن
@app.post("/auth/login", response_model=TokenResponse)
def login(credentials: UserLogin):
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, username, password_hash FROM users WHERE username = ?",
            (credentials.username,)
        )
        user = cursor.fetchone()

    if not user or not verify_password(credentials.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password"
        )

    token = create_access_token(user["id"], user["username"])
    return {"access_token": token, "token_type": "bearer"}

# ۳. دریافت پروفایل کاربر فعلی (محافظت‌شده با توکن)
@app.get("/users/me", response_model=UserProfile)
def read_current_user(current_user: dict = Depends(get_current_user)):
    return current_user

# ----------------- COURSES ENDPOINTS -----------------

# ۱. ایجاد درس جدید برای کاربر لاگین‌شده
@app.post("/courses", response_model=CourseResponse, status_code=status.HTTP_201_CREATED)
def create_course(
    course_data: CourseCreate,
    current_user: dict = Depends(get_current_user)
):
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO courses (user_id, name, color, weekly_goal_hours)
            VALUES (?, ?, ?, ?)
            """,
            (current_user["id"], course_data.name, course_data.color, course_data.weekly_goal_hours)
        )
        conn.commit()
        course_id = cursor.lastrowid

        cursor.execute("SELECT * FROM courses WHERE id = ?", (course_id,))
        new_course = cursor.fetchone()

    return dict(new_course)


# ۲. دریافت لیست درس‌های کاربر فعلی
@app.get("/courses", response_model=List[CourseResponse])
def get_user_courses(current_user: dict = Depends(get_current_user)):
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT * FROM courses WHERE user_id = ? ORDER BY id DESC",
            (current_user["id"],)
        )
        courses = cursor.fetchall()

    return [dict(row) for row in courses]


# ۳. ویرایش جزئی درس (نام، رنگ یا هدف ساعتی)
@app.patch("/courses/{course_id}", response_model=CourseResponse)
def update_course(
    course_id: int,
    course_data: CourseUpdate,
    current_user: dict = Depends(get_current_user)
):
    # بررسی وجود درس و تعلق آن به کاربر فعلی
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT * FROM courses WHERE id = ? AND user_id = ?",
            (course_id, current_user["id"])
        )
        course = cursor.fetchone()

        if not course:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Course not found or you don't have access to it."
            )

        # ساخت داینامیک کوئری برای فیلدهایی که پر شده‌اند
        updates = []
        params = []
        if course_data.name is not None:
            updates.append("name = ?")
            params.append(course_data.name)
        if course_data.color is not None:
            updates.append("color = ?")
            params.append(course_data.color)
        if course_data.weekly_goal_hours is not None:
            updates.append("weekly_goal_hours = ?")
            params.append(course_data.weekly_goal_hours)

        if not updates:
            return dict(course)

        params.extend([course_id, current_user["id"]])
        query = f"UPDATE courses SET {', '.join(updates)} WHERE id = ? AND user_id = ?"
        cursor.execute(query, tuple(params))
        conn.commit()

        cursor.execute("SELECT * FROM courses WHERE id = ?", (course_id,))
        updated_course = cursor.fetchone()

    return dict(updated_course)


# ۴. حذف درس
@app.delete("/courses/{course_id}", status_code=status.HTTP_200_OK)
def delete_course(
    course_id: int,
    current_user: dict = Depends(get_current_user)
):
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "DELETE FROM courses WHERE id = ? AND user_id = ?",
            (course_id, current_user["id"])
        )
        conn.commit()

        if cursor.rowcount == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Course not found or you don't have access to it."
            )

    return {"message": f"Course {course_id} deleted successfully"}

# ----------------- STUDY SESSIONS & REWARDS -----------------

def calculate_coins(duration_minutes: int) -> int:
    """هر ۲۵ دقیقه = ۱۰ سکه مطالعه"""
    return (duration_minutes // 25) * 10


# ۱. ثبت جلسه جدید و اهدای سکه
@app.post("/sessions", response_model=SessionCreationResult, status_code=status.HTTP_201_CREATED)
def log_study_session(
    session_data: StudySessionCreate,
    current_user: dict = Depends(get_current_user)
):
    with get_connection() as conn:
        cursor = conn.cursor()

        # بررسی وجود درس و تعلق آن به کاربر
        cursor.execute(
            "SELECT id, name, color FROM courses WHERE id = ? AND user_id = ?",
            (session_data.course_id, current_user["id"])
        )
        course = cursor.fetchone()

        if not course:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Course not found or you don't have access to it."
            )

        # محاسبه سکه
        coins_earned = calculate_coins(session_data.duration_minutes)

        # ثبت جلسه مطالعه
        cursor.execute(
            """
            INSERT INTO study_sessions 
                (user_id, course_id, duration_minutes, session_date, notes, coins_earned)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                current_user["id"],
                session_data.course_id,
                session_data.duration_minutes,
                str(session_data.session_date),
                session_data.notes,
                coins_earned
            )
        )
        session_id = cursor.lastrowid

        # افزایش موجودی سکه کاربر
        cursor.execute(
            "UPDATE users SET coins = coins + ? WHERE id = ?",
            (coins_earned, current_user["id"])
        )

        # دریافت موجودی جدید سکه کاربر
        cursor.execute("SELECT coins FROM users WHERE id = ?", (current_user["id"],))
        updated_coins = cursor.fetchone()["coins"]

        conn.commit()

    session_dict = {
        "id": session_id,
        "user_id": current_user["id"],
        "course_id": course["id"],
        "course_name": course["name"],
        "course_color": course["color"],
        "duration_minutes": session_data.duration_minutes,
        "session_date": str(session_data.session_date),
        "notes": session_data.notes,
        "coins_earned": coins_earned,
        "created_at": "Just now"
    }

    reward_msg = (
        f"عالی بود! شما {coins_earned} سکه پاداش گرفتید." 
        if coins_earned > 0 
        else "جلسه ثبت شد. جلسات ۲۵ دقیقه به بالا سکه پاداش دارند!"
    )

    return {
        "session": session_dict,
        "total_user_coins": updated_coins,
        "message": reward_msg
    }


# ۲. تاریخچه جلسات مطالعه کاربر جاری (همراه با فیلتر اختیاری درس)
@app.get("/sessions", response_model=List[StudySessionResponse])
def get_study_sessions(
    course_id: Optional[int] = None,
    current_user: dict = Depends(get_current_user)
):
    with get_connection() as conn:
        cursor = conn.cursor()

        query = """
            SELECT 
                s.id, s.user_id, s.course_id, c.name AS course_name, 
                c.color AS course_color, s.duration_minutes, 
                s.session_date, s.notes, s.coins_earned, s.created_at
            FROM study_sessions s
            JOIN courses c ON s.course_id = c.id
            WHERE s.user_id = ?
        """
        params = [current_user["id"]]

        if course_id:
            query += " AND s.course_id = ?"
            params.append(course_id)

        query += " ORDER BY s.session_date DESC, s.id DESC"

        cursor.execute(query, tuple(params))
        sessions = cursor.fetchall()

    return [dict(row) for row in sessions]


# ۳. حذف یک جلسه مطالعه
@app.delete("/sessions/{session_id}", status_code=status.HTTP_200_OK)
def delete_study_session(
    session_id: int,
    current_user: dict = Depends(get_current_user)
):
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "DELETE FROM study_sessions WHERE id = ? AND user_id = ?",
            (session_id, current_user["id"])
        )
        conn.commit()

        if cursor.rowcount == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session not found or you don't have access to it."
            )

    return {"message": f"Session {session_id} deleted successfully"}