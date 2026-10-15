import secrets
import string

from app.schemas import (
    UserRegister, UserLogin, TokenResponse, UserProfile,
    CourseCreate, CourseUpdate, CourseResponse,
    StudySessionCreate, StudySessionResponse, SessionCreationResult,
    ThemeItem, ThemeActionRequest, LeaderboardUser,
    GroupCreate, GroupJoin, GroupSummary, GroupDetail, GroupMemberItem
)
from fastapi import FastAPI, HTTPException, Depends, Query, status
from typing import List, Literal, Optional
import sqlite3
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
            cursor.execute("INSERT INTO user_themes (user_id, theme_id) VALUES (?, 'default')", (new_user_id,))
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

# ----------------- THEMES CATALOG -----------------

AVAILABLE_THEMES = [
    {
        "id": "default",
        "name": "Classic Slate",
        "price": 0,
        "preview_color": "#334155",
        "description": "تم مینیمال و کلاسیک خاکستری تیره"
    },
    {
        "id": "dracula",
        "name": "Dracula Violet",
        "price": 40,
        "preview_color": "#7c3aed",
        "description": "تم بنفش نئونی مناسب شب‌زنده‌داران"
    },
    {
        "id": "forest_emerald",
        "name": "Emerald Focus",
        "price": 80,
        "preview_color": "#059669",
        "description": "تم سبز متمرکز الهام‌گرفته از طبیعت"
    },
    {
        "id": "cyberpunk_amber",
        "name": "Cyberpunk 2077",
        "price": 150,
        "preview_color": "#f59e0b",
        "description": "تم زرد كهربایی طلایی مخصوص کاربران حرفه‌ای"
    },
]


# ----------------- SHOP ENDPOINTS -----------------

# ۱. دریافت لیست تمام تم‌های فروشگاه به همراه وضعیت مالکیت کاربر
@app.get("/shop/themes", response_model=List[ThemeItem])
def get_shop_themes(current_user: dict = Depends(get_current_user)):
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT theme_id FROM user_themes WHERE user_id = ?",
            (current_user["id"],)
        )
        owned_themes = {row["theme_id"] for row in cursor.fetchall()}

    results = []
    for theme in AVAILABLE_THEMES:
        results.append(
            ThemeItem(
                id=theme["id"],
                name=theme["name"],
                price=theme["price"],
                preview_color=theme["preview_color"],
                description=theme["description"],
                is_owned=(theme["id"] in owned_themes),
                is_active=(theme["id"] == current_user["active_theme"])
            )
        )
    return results


# ۲. خرید تم با سکه
@app.post("/shop/buy")
def buy_theme(
    request: ThemeActionRequest,
    current_user: dict = Depends(get_current_user)
):
    theme = next((t for t in AVAILABLE_THEMES if t["id"] == request.theme_id), None)
    if not theme:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Theme does not exist.")

    with get_connection() as conn:
        cursor = conn.cursor()

        # بررسی اینکه آیا تم قبلاً خریداری شده یا خیر
        cursor.execute(
            "SELECT id FROM user_themes WHERE user_id = ? AND theme_id = ?",
            (current_user["id"], request.theme_id)
        )
        if cursor.fetchone():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You already own this theme.")

        # بررسی موجودی سکه کاربر
        cursor.execute("SELECT coins FROM users WHERE id = ?", (current_user["id"],))
        user_coins = cursor.fetchone()["coins"]

        if user_coins < theme["price"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Not enough coins. Required: {theme['price']}, Available: {user_coins}"
            )

        # کسر سکه و افزودن به دارایی‌ها
        cursor.execute("UPDATE users SET coins = coins - ? WHERE id = ?", (theme["price"], current_user["id"]))
        cursor.execute("INSERT INTO user_themes (user_id, theme_id) VALUES (?, ?)", (current_user["id"], request.theme_id))
        conn.commit()

        cursor.execute("SELECT coins FROM users WHERE id = ?", (current_user["id"],))
        remaining_coins = cursor.fetchone()["coins"]

    return {
        "message": f"Theme '{theme['name']}' purchased successfully!",
        "remaining_coins": remaining_coins,
        "theme_id": request.theme_id
    }


# ۳. تجهیز و فعال‌سازی تم روی پروفایل
@app.post("/shop/equip")
def equip_theme(
    request: ThemeActionRequest,
    current_user: dict = Depends(get_current_user)
):
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id FROM user_themes WHERE user_id = ? AND theme_id = ?",
            (current_user["id"], request.theme_id)
        )
        if not cursor.fetchone():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You do not own this theme. Purchase it first!"
            )

        cursor.execute("UPDATE users SET active_theme = ? WHERE id = ?", (request.theme_id, current_user["id"]))
        conn.commit()

    return {"message": f"Theme '{request.theme_id}' equipped successfully!", "active_theme": request.theme_id}


# ----------------- LEADERBOARD ENDPOINT -----------------

@app.get("/leaderboard", response_model=List[LeaderboardUser])
def get_leaderboard(
    timeframe: Literal["daily", "weekly", "all_time"] = Query("daily", description="بازه زمانی رتبه‌بندی")
):
    # اعمال فیلتر بر اساس تاریخ در SQLite
    if timeframe == "daily":
        date_filter = "WHERE s.session_date = CURRENT_DATE"
    elif timeframe == "weekly":
        date_filter = "WHERE s.session_date >= date('now', '-7 days')"
    else:
        date_filter = ""

    query = f"""
        SELECT 
            u.id AS user_id,
            u.username,
            u.active_theme,
            COALESCE(SUM(s.duration_minutes), 0) AS total_study_minutes,
            COALESCE(SUM(s.coins_earned), 0) AS total_coins_earned
        FROM users u
        LEFT JOIN study_sessions s ON u.id = s.user_id
        {date_filter}
        GROUP BY u.id
        ORDER BY total_study_minutes DESC, total_coins_earned DESC
        LIMIT 20;
    """

    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(query)
        rows = cursor.fetchall()

    leaderboard = []
    for rank, row in enumerate(rows, start=1):
        leaderboard.append(
            LeaderboardUser(
                rank=rank,
                user_id=row["user_id"],
                username=row["username"],
                active_theme=row["active_theme"],
                total_study_minutes=row["total_study_minutes"],
                total_study_hours=round(row["total_study_minutes"] / 60, 1),
                total_coins_earned=row["total_coins_earned"]
            )
        )

    return leaderboard

# ----------------- STUDY GROUPS LOGIC -----------------

def generate_invite_code(length: int = 6) -> str:
    """ایجاد کد دعوت تصادفی و خوانا مانند SM-4K9W"""
    chars = string.ascii_uppercase + string.digits
    # حذف کاراکترهای گمراه‌کننده شبیه به هم
    chars = chars.replace('O', '').replace('0', '').replace('I', '').replace('1', '')
    random_str = ''.join(secrets.choice(chars) for _ in range(length))
    return f"SM-{random_str}"


# ۱. ایجاد گروه مطالعه جدید
@app.post("/groups", response_model=GroupDetail, status_code=status.HTTP_201_CREATED)
def create_group(
    group_data: GroupCreate,
    current_user: dict = Depends(get_current_user)
):
    invite_code = generate_invite_code()
    
    with get_connection() as conn:
        cursor = conn.cursor()
        
        # ثبت گروه
        cursor.execute(
            """
            INSERT INTO study_groups (name, description, invite_code, owner_id)
            VALUES (?, ?, ?, ?)
            """,
            (group_data.name, group_data.description, invite_code, current_user["id"])
        )
        group_id = cursor.lastrowid

        # سازنده گروه به عنوان عضو اول به جدول اعضا اضافه می‌شود
        cursor.execute(
            "INSERT INTO group_members (group_id, user_id) VALUES (?, ?)",
            (group_id, current_user["id"])
        )
        conn.commit()

    return get_group_details(group_id=group_id, current_user=current_user)


# ۲. عضویت در گروه با کد دعوت
@app.post("/groups/join")
def join_group(
    join_data: GroupJoin,
    current_user: dict = Depends(get_current_user)
):
    with get_connection() as conn:
        cursor = conn.cursor()
        
        # بررسی وجود گروه با این کد دعوت
        cursor.execute(
            "SELECT id, name FROM study_groups WHERE invite_code = ?",
            (join_data.invite_code.strip().upper(),)
        )
        group = cursor.fetchone()
        if not group:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invalid invite code.")

        # بررسی عضویت قبلی
        cursor.execute(
            "SELECT id FROM group_members WHERE group_id = ? AND user_id = ?",
            (group["id"], current_user["id"])
        )
        if cursor.fetchone():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You are already a member of this group.")

        # افزودن کاربر به اعضا
        cursor.execute(
            "INSERT INTO group_members (group_id, user_id) VALUES (?, ?)",
            (group["id"], current_user["id"])
        )
        conn.commit()

    return {
        "message": f"Successfully joined group '{group['name']}'!",
        "group_id": group["id"]
    }


# ۳. دریافت لیست گروه‌های من
@app.get("/groups/my", response_model=List[GroupSummary])
def get_my_groups(current_user: dict = Depends(get_current_user)):
    with get_connection() as conn:
        cursor = conn.cursor()
        query = """
            SELECT 
                g.id, g.name, g.description, g.invite_code, g.created_at,
                g.owner_id = ? AS is_owner,
                COUNT(gm.user_id) AS member_count
            FROM study_groups g
            JOIN group_members gm ON g.id = gm.group_id
            WHERE g.id IN (SELECT group_id FROM group_members WHERE user_id = ?)
            GROUP BY g.id
            ORDER BY g.id DESC
        """
        cursor.execute(query, (current_user["id"], current_user["id"]))
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


# ۴. دریافت جزئیات و لیدربورد اختصاصی اعضای یک گروه
@app.get("/groups/{group_id}", response_model=GroupDetail)
def get_group_details(
    group_id: int,
    current_user: dict = Depends(get_current_user)
):
    with get_connection() as conn:
        cursor = conn.cursor()

        # بررسی دسترسی: آیا کاربر در این گروه عضو است؟
        cursor.execute(
            "SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?",
            (group_id, current_user["id"])
        )
        if not cursor.fetchone():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied. You are not a member of this group."
            )

        # اطلاعات پایه گروه
        cursor.execute(
            "SELECT id, name, description, invite_code, owner_id FROM study_groups WHERE id = ?",
            (group_id,)
        )
        group = cursor.fetchone()
        if not group:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Group not found.")

        # رتبه‌بندی اعضای گروه بر اساس مجموع دقایق مطالعه
        members_query = """
            SELECT 
                u.id AS user_id,
                u.username,
                u.active_theme,
                (u.id = ?) AS is_owner,
                COALESCE(SUM(s.duration_minutes), 0) AS total_study_minutes
            FROM group_members gm
            JOIN users u ON gm.user_id = u.id
            LEFT JOIN study_sessions s ON u.id = s.user_id
            WHERE gm.group_id = ?
            GROUP BY u.id
            ORDER BY total_study_minutes DESC, u.username ASC
        """
        cursor.execute(members_query, (group["owner_id"], group_id))
        member_rows = cursor.fetchall()

    members = [
        GroupMemberItem(
            user_id=row["user_id"],
            username=row["username"],
            active_theme=row["active_theme"],
            is_owner=bool(row["is_owner"]),
            total_study_minutes=row["total_study_minutes"],
            total_study_hours=round(row["total_study_minutes"] / 60, 1)
        )
        for row in member_rows
    ]

    return GroupDetail(
        id=group["id"],
        name=group["name"],
        description=group["description"],
        invite_code=group["invite_code"],
        owner_id=group["owner_id"],
        member_count=len(members),
        members=members
    )


# ۵. خروج از گروه
@app.post("/groups/{group_id}/leave")
def leave_group(
    group_id: int,
    current_user: dict = Depends(get_current_user)
):
    with get_connection() as conn:
        cursor = conn.cursor()

        cursor.execute("SELECT owner_id FROM study_groups WHERE id = ?", (group_id,))
        group = cursor.fetchone()
        if not group:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Group not found.")

        if group["owner_id"] == current_user["id"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Group owners cannot leave their own group. Delete the group instead."
            )

        cursor.execute(
            "DELETE FROM group_members WHERE group_id = ? AND user_id = ?",
            (group_id, current_user["id"])
        )
        conn.commit()

        if cursor.rowcount == 0:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You are not a member of this group.")

    return {"message": "Successfully left the group."}