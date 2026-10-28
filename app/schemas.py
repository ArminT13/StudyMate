from pydantic import BaseModel, EmailStr, Field
from datetime import date
from typing import List, Optional, Literal, Dict, Any

# ----------------- AUTH & USER SCHEMAS -----------------

class UserRegister(BaseModel):
    username: str = Field(min_length=3, max_length=30, pattern=r"^[a-zA-Z0-9_\-\u0600-\u06FF]+$")
    password: str = Field(min_length=6, max_length=100)
    confirm_password: Optional[str] = None
    date_of_birth: Optional[date] = None
    email: Optional[EmailStr] = None
    referral_code: Optional[str] = None

class UserLogin(BaseModel):
    username: str
    password: str

class PasswordForgotRequest(BaseModel):
    username_or_email: str

class PasswordResetRequest(BaseModel):
    token: str
    new_password: str = Field(min_length=6, max_length=100)
    confirm_password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: int
    username: str
    character_name: str = "Minti"

class UserProfile(BaseModel):
    id: int
    username: str
    email: Optional[str] = None
    coins: int
    active_theme: str
    character_name: str = "Minti"
    date_of_birth: Optional[str] = None
    referral_code: str
    is_premium: bool = False
    premium_until: Optional[str] = None
    equipped_hat: Optional[str] = None
    equipped_glasses: Optional[str] = None
    equipped_outfit: Optional[str] = "classic"
    equipped_accessory: Optional[str] = "sprout"
    equipped_jewelry: Optional[str] = None

class PublicUserProfile(BaseModel):
    user_id: int
    username: str
    character_name: str = "Minti"
    equipped_hat: Optional[str] = None
    equipped_glasses: Optional[str] = None
    equipped_outfit: Optional[str] = "classic"
    equipped_accessory: Optional[str] = "sprout"
    equipped_jewelry: Optional[str] = None
    active_theme: str
    theme_name: str
    theme_name_fa: str
    rarity: str
    inspiration: str
    level: int
    xp: int
    next_level_xp: int
    title: str
    title_fa: str
    coins: int
    current_streak: int
    total_pomodoros: int
    total_study_minutes: int
    total_study_hours: float
    total_raid_damage: int
    created_at: str

# ----------------- CHARACTER & ACCESSORIES SCHEMAS -----------------

class CharacterNameUpdate(BaseModel):
    character_name: str = Field(min_length=2, max_length=25)

class AccessoryItem(BaseModel):
    id: str
    name: str
    name_fa: str
    category: Literal["hat", "glasses", "outfit", "accessory", "jewelry"]
    price: int
    icon: str
    description_fa: str
    description_en: str
    is_owned: bool
    is_equipped: bool

class AccessoryActionRequest(BaseModel):
    item_id: str
    category: Literal["hat", "glasses", "outfit", "accessory", "jewelry"]

# ----------------- COURSE SCHEMAS -----------------

class CourseCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    color: str = Field(default="#F5AFAF", pattern=r"^#([A-Fa-f0-9]{6})$")
    weekly_goal_hours: float = Field(default=5.0, gt=0, le=100.0)

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

# ----------------- QUICK STUDY SESSION SCHEMAS -----------------

class StudySessionCreate(BaseModel):
    course_id: int
    duration_minutes: int = Field(gt=0, le=600)
    session_date: Optional[date] = Field(default_factory=date.today)
    notes: Optional[str] = Field(default=None, max_length=500)

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
    today_quick_minutes: int
    remaining_quick_minutes: int
    message: str

# ----------------- SHOP & THEMES -----------------

class ThemeItem(BaseModel):
    id: str
    name: str
    name_fa: str
    inspiration: str
    rarity: str
    price: int
    preview_color: str
    secondary_color: str
    description_fa: str
    description_en: str
    is_owned: bool
    is_active: bool

class ThemeActionRequest(BaseModel):
    theme_id: str = Field(min_length=2, max_length=40)

class LeaderboardUser(BaseModel):
    rank: int
    user_id: int
    username: str
    character_name: str = "Minti"
    active_theme: str
    level: int = 1
    title: str = "Sleepy Novice"
    title_fa: str = "نوآموز خواب‌آلود"
    total_study_minutes: int
    total_study_hours: float
    total_coins_earned: int

# ----------------- STUDY GROUP SCHEMAS -----------------

class GroupCreate(BaseModel):
    name: str = Field(min_length=2, max_length=50)
    description: Optional[str] = Field(default=None, max_length=200)

class GroupJoin(BaseModel):
    invite_code: str = Field(min_length=6, max_length=12)

class GroupMemberItem(BaseModel):
    user_id: int
    username: str
    character_name: str = "Minti"
    active_theme: str
    level: int = 1
    title: str = "Sleepy Novice"
    title_fa: str = "نوآموز خواب‌آلود"
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

# ----------------- FRIENDS SCHEMAS -----------------

class FriendUserItem(BaseModel):
    id: int
    username: str
    character_name: str = "Minti"
    level: int = 1
    active_theme: str = "default"
    is_online: bool = True
    bio_fa: Optional[str] = None
    study_hours: float = 0.0

class FriendRequestItem(BaseModel):
    id: int
    sender_id: int
    sender_username: str
    character_name: str = "Minti"
    created_at: str

class FriendActionRequest(BaseModel):
    target_username_or_id: Optional[str] = None
    request_id: Optional[int] = None
    action: Literal["send", "accept", "reject", "remove"]

# ----------------- AI STUDY COACH SCHEMAS -----------------

class AICoachRequest(BaseModel):
    goal_title: str = Field(min_length=2, max_length=100)
    target_date: date
    daily_hours: float = Field(gt=0.5, le=14.0)
    topics: List[str] = Field(min_length=1, max_length=15)
    notes: Optional[str] = Field(default=None, max_length=300)
    lang: Literal["fa", "en"] = "fa"

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

# ----------------- POMODORO TIMER SCHEMAS -----------------

class PomodoroStartRequest(BaseModel):
    topic: Optional[str] = Field(None, max_length=100)
    target_minutes: int = Field(25, ge=5, le=180)

class PomodoroSessionResponse(BaseModel):
    id: int
    topic: Optional[str]
    target_minutes: int
    actual_minutes: int
    coins_earned: int
    xp_earned: Optional[int] = 50
    streak_bonus_coins: Optional[int] = 0
    current_streak: Optional[int] = 0
    status: str
    started_at: str
    ended_at: Optional[str]
    user_total_coins: Optional[int] = None
    user_level: Optional[int] = 1
    user_xp: Optional[int] = 0

# ----------------- PLAN TRACKING & DASHBOARD SCHEMAS -----------------

class PlanDayToggleResponse(BaseModel):
    plan_id: int
    day_number: int
    is_completed: bool
    completed_days: List[int]
    progress_percentage: float
    message: str

class PlanDetailResponse(BaseModel):
    id: int
    goal_title: str
    target_date: str
    days_remaining: int
    daily_hours: float
    total_planned_hours: float
    total_potential_coins: int
    motivational_quote: str
    strategy_advice: str
    schedule: List[PlanDaySchedule]
    completed_days: List[int]
    progress_percentage: float

class DashboardStatsResponse(BaseModel):
    user_id: int
    username: str
    character_name: str = "Minti"
    equipped_hat: Optional[str] = None
    equipped_glasses: Optional[str] = None
    equipped_outfit: Optional[str] = "classic"
    equipped_accessory: Optional[str] = "sprout"
    equipped_jewelry: Optional[str] = None
    coins: int
    current_streak: int
    streak_status: str
    next_streak_reward: int
    active_theme: str
    leaderboard_rank: int
    today_pomodoro_count: int
    today_pomodoro_minutes: int
    today_quick_minutes: int
    remaining_quick_minutes: int
    today_study_minutes: int
    today_study_hours: float
    today_goal_hours: float = 2.0
    today_goal_percentage: float = 0.0
    weekly_study_minutes: int = 0
    weekly_study_hours: float = 0.0
    weekly_goal_hours: float = 20.0
    weekly_goal_percentage: float = 0.0
    total_study_hours: float
    active_plans_count: int
    level: int = 1
    xp: int = 0
    next_level_xp: int = 150
    title: str = "Sleepy Novice"
    title_fa: str = "نوآموز خواب‌آلود"
    is_premium: bool = False
    referral_code: str = ""

# ----------------- BOSS RAIDS & CHALLENGES SCHEMAS -----------------

class BossNameSuggestRequest(BaseModel):
    course_or_goal: str = Field(min_length=2, max_length=80)
    lang: Literal["fa", "en"] = "fa"

class RaidCreateRequest(BaseModel):
    course_or_goal: str = Field(min_length=2, max_length=80)
    boss_name: Optional[str] = Field(default=None, max_length=80)
    max_hp: int = Field(ge=25, le=50000)
    lang: Literal["fa", "en"] = "fa"

class RaidResponse(BaseModel):
    id: int
    group_id: int
    boss_name: str
    max_hp: int
    current_hp: int
    reward_coins: int
    status: str
    created_at: str
    top_damage_dealers: List[dict] = []

class WeeklyBossChallengeResponse(BaseModel):
    id: int
    week_identifier: str
    boss_name: str
    boss_name_fa: str
    description_fa: str
    max_hp: int
    current_hp: int
    hp_percentage: float
    reward_coins: int
    reward_xp: int
    days_remaining: int
    user_damage: int
    user_contribution_percentage: float
    status: str
    top_contributors: List[dict] = []

class QuizQuestion(BaseModel):
    question: str
    options: List[str]
    correct_index: int

class QuizSubmitRequest(BaseModel):
    answers: List[int]

class HeatmapDay(BaseModel):
    date: str
    minutes: int
    count: int

# ----------------- REFERRAL & PREMIUM SCHEMAS -----------------

class ReferralInfoResponse(BaseModel):
    referral_code: str
    referral_link: str
    successful_referrals_count: int
    reward_days_earned: int
    is_premium: bool
    premium_until: Optional[str]
