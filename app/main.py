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