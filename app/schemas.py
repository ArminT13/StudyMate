from pydantic import BaseModel, EmailStr, Field
from datetime import date

class UserRegister(BaseModel):
    username: str = Field(min_length=3, max_length=30)
    email: EmailStr
    password: str = Field(min_length=6, max_length=100)

class UserLogin(BaseModel):
    username: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"

class UserProfile(BaseModel):
    id: int
    username: str
    email: str
    coins: int
    active_theme: str

from typing import Optional

# ----------------- COURSE SCHEMAS -----------------

class CourseCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100, example="ساختمان داده")
    color: str = Field(default="#6366f1", pattern=r"^#([A-Fa-f0-9]{6})$", example="#6366f1")
    weekly_goal_hours: float = Field(default=5.0, gt=0, le=100.0, example=6.0)

class CourseUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    color: Optional[str] = Field(default=None, pattern=r"^#([A-Fa-f0-9]{6})$")
    weekly_goal_hours: Optional[float] = Field(default=None, gt=0, le=100.0)

class CourseResponse(BaseModel):
    id: int
    user_id: int
    name: str
    color: str
    weekly_goal_hours: float
    created_at: str

# ----------------- STUDY SESSION SCHEMAS -----------------

class StudySessionCreate(BaseModel):
    course_id: int
    duration_minutes: int = Field(gt=0, le=720, example=50, description="مدت زمان به دقیقه (حداکثر ۱۲ ساعت)")
    session_date: Optional[date] = Field(default_factory=date.today, example="2026-10-15")
    notes: Optional[str] = Field(default=None, max_length=500, example="حل تست‌های درخت دودویی")

class StudySessionResponse(BaseModel):
    id: int
    user_id: int
    course_id: int
    course_name: str
    course_color: str
    duration_minutes: int
    session_date: str
    notes: Optional[str]
    coins_earned: int
    created_at: str

class SessionCreationResult(BaseModel):
    session: StudySessionResponse
    total_user_coins: int
    message: str

from typing import Literal

# ----------------- SHOP & LEADERBOARD SCHEMAS -----------------

class ThemeItem(BaseModel):
    id: str
    name: str
    price: int
    preview_color: str
    description: str
    is_owned: bool
    is_active: bool

class ThemeActionRequest(BaseModel):
    theme_id: str = Field(min_length=2, max_length=30)

class LeaderboardUser(BaseModel):
    rank: int
    user_id: int
    username: str
    active_theme: str
    total_study_minutes: int
    total_study_hours: float
    total_coins_earned: int