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

from typing import List, Optional

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

# ----------------- STUDY GROUP SCHEMAS -----------------

class GroupCreate(BaseModel):
    name: str = Field(min_length=2, max_length=50, example="تیم هوش مصنوعی")
    description: Optional[str] = Field(default=None, max_length=200, example="مطالعه گروهی برای پروژه درس هوش")

class GroupJoin(BaseModel):
    invite_code: str = Field(min_length=6, max_length=12, example="SM-7X8K2")

class GroupMemberItem(BaseModel):
    user_id: int
    username: str
    active_theme: str
    is_owner: bool
    total_study_minutes: int
    total_study_hours: float

class GroupSummary(BaseModel):
    id: int
    name: str
    description: Optional[str]
    invite_code: str
    member_count: int
    is_owner: bool
    created_at: str

class GroupDetail(BaseModel):
    id: int
    name: str
    description: Optional[str]
    invite_code: str
    owner_id: int
    member_count: int
    members: List[GroupMemberItem]

# ----------------- AI STUDY COACH SCHEMAS -----------------

class AICoachRequest(BaseModel):
    goal_title: str = Field(min_length=2, max_length=100, example="امتحان پایان‌ترم هوش مصنوعی")
    target_date: date = Field(example="2026-11-20", description="تاریخ هدف یا موعد امتحان")
    daily_hours: float = Field(gt=0.5, le=14.0, example=3.5, description="ساعت مطالعه مفید در هر روز")
    topics: List[str] = Field(min_length=1, max_length=15, example=["جستجوی آگاهانه و A*", "الگوریتم‌های ژنتیک", "شبکه‌های عصبی"])
    notes: Optional[str] = Field(default=None, max_length=300, example="روی فصل شبکه‌های عصبی ضعف دارم")

class PlanDaySchedule(BaseModel):
    day_number: int
    date: str
    focus_topic: str
    pomodoro_blocks: int
    daily_study_hours: float
    potential_coins: int
    action_item: str

class AICoachPlan(BaseModel):
    id: Optional[int] = None
    goal_title: str
    target_date: str
    days_remaining: int
    daily_hours: float
    total_planned_hours: float
    total_potential_coins: int
    motivational_quote: str
    schedule: List[PlanDaySchedule]
    strategy_advice: str

class SavedPlanSummary(BaseModel):
    id: int
    goal_title: str
    target_date: str
    daily_hours: float
    created_at: str