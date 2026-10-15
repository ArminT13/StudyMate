import os
import json
import re
from datetime import date, timedelta
from typing import List, Dict, Any
import httpx
from fastapi import HTTPException, status
from pathlib import Path
from dotenv import load_dotenv

# بارگذاری خودکار فایل .env از ریشه پروژه
BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(dotenv_path=BASE_DIR / ".env")

# خواندن کلید و مدل فقط از محیط (بدون مقدار هاردکد شده)
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite")


def build_algorithmic_plan(
    goal_title: str,
    target_date: date,
    daily_hours: float,
    topics: List[str],
    notes: str | None
) -> Dict[str, Any]:
    """موتور استنتاج الگوریتمی داخلی (پشتیبان)"""
    today = date.today()
    days_left = max((target_date - today).days, 1)

    pomodoro_blocks_per_day = int((daily_hours * 60) // 25)
    daily_coins = pomodoro_blocks_per_day * 10
    total_potential_coins = daily_coins * days_left
    total_hours = round(daily_hours * days_left, 1)

    schedule = []
    num_topics = len(topics)

    for i in range(days_left):
        current_day_date = today + timedelta(days=i)
        assigned_topic = topics[i % num_topics]
        
        if i >= days_left - 2 and days_left > 3:
            action = f"مرور فشرده، حل نمونه سوالات امتحانی و رفع اشکال مبحث {assigned_topic}"
        else:
            action = f"مطالعه عمیق مبحث {assigned_topic} همراه با حل تمرین‌های تثبیتی"

        schedule.append({
            "day_number": i + 1,
            "date": str(current_day_date),
            "focus_topic": assigned_topic,
            "pomodoro_blocks": pomodoro_blocks_per_day,
            "daily_study_hours": daily_hours,
            "potential_coins": daily_coins,
            "action_item": action
        })

    advice = (
        f"با تمرکز روی {daily_hours} ساعت مطالعه روزانه، کل حجم در قالب {days_left} روز پوشش داده می‌شود. "
        "استفاده از تکنیک پومودورو (۲۵ دقیقه تمرکز + ۵ دقیقه استراحت) از فرسودگی ذهنی جلوگیری می‌کند."
    )
    if notes:
        advice += f" به اولویت شما یعنی '{notes}' در توزیع پومودوروها توجه ویژه شده است."

    return {
        "goal_title": goal_title,
        "target_date": str(target_date),
        "days_remaining": days_left,
        "daily_hours": daily_hours,
        "total_planned_hours": total_hours,
        "total_potential_coins": total_potential_coins,
        "motivational_quote": "تداوم کوچک روزانه، دستاوردهای شگفت‌انگیز می‌آفریند.",
        "strategy_advice": advice,
        "schedule": schedule
    }


async def generate_study_plan(
    goal_title: str,
    target_date: date,
    daily_hours: float,
    topics: List[str],
    notes: str | None = None
) -> Dict[str, Any]:
    """تولید برنامه مطالعه با اولویت هوش مصنوعی، سوئیچ خودکار بین مدل‌ها و فال‌بک الگوریتمی"""
    
    # ۱. بررسی مقداردهی بودن کلید API
    if not GEMINI_API_KEY:
        err_msg = "متغیر GEMINI_API_KEY در محیط سیستم ست نشده یا خالی است!"
        print(f"\n[AI Coach Error]: {err_msg}\n")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=err_msg
        )

    today = date.today()
    days_left = max((target_date - today).days, 1)

    prompt = f"""
    You are an expert academic coach for students. Generate a structured study plan JSON in Persian.
    Goal: {goal_title}
    Today's Date: {today}
    Target Date: {target_date}
    Days Remaining: {days_left}
    Available Daily Hours: {daily_hours}
    Topics: {', '.join(topics)}
    Student Notes: {notes or 'None'}

    Gamification rules:
    - 1 Pomodoro block = 25 minutes of focus.
    - Each Pomodoro block awards exactly 10 coins.
    - Calculate daily potential_coins = pomodoro_blocks * 10.

    Output ONLY a valid JSON object matching this schema:
    {{
      "goal_title": "{goal_title}",
      "target_date": "{target_date}",
      "days_remaining": {days_left},
      "daily_hours": {daily_hours},
      "total_planned_hours": <float>,
      "total_potential_coins": <int>,
      "motivational_quote": "<in Persian>",
      "strategy_advice": "<in Persian>",
      "schedule": [
        {{
          "day_number": 1,
          "date": "YYYY-MM-DD",
          "focus_topic": "<string>",
          "pomodoro_blocks": <int>,
          "daily_study_hours": {daily_hours},
          "potential_coins": <int>,
          "action_item": "<in Persian>"
        }}
      ]
    }}
    """

    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"response_mime_type": "application/json"}
    }

    # لیست مدل‌های معتبر به ترتیب اولویت و سرعت
    candidate_models = [
        GEMINI_MODEL,
        "gemini-3.5-flash-lite",
        "gemini-3.5-flash",
        "gemini-3.8-flash",
        "gemini-3.1-flash-lite"
    ]
    models_to_try = list(dict.fromkeys(candidate_models))

    async with httpx.AsyncClient(timeout=35.0) as client:
        for model_name in models_to_try:
            api_url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={GEMINI_API_KEY}"
            print(f"[AI Coach] Sending request to model: '{model_name}'...")
            
            try:
                response = await client.post(api_url, json=payload)
                print(f"[AI Coach] Model '{model_name}' status: {response.status_code}")

                if response.status_code == 200:
                    raw_text = response.json()["candidates"][0]["content"]["parts"][0]["text"].strip()
                    if raw_text.startswith("```"):
                        raw_text = re.sub(r"^```(?:json)?\n?", "", raw_text)
                        raw_text = re.sub(r"\n?```$", "", raw_text)
                    print(f"[AI Coach SUCCESS] Successfully generated with '{model_name}'!\n")
                    return json.loads(raw_text)

                err_text = f"HTTP {response.status_code} on {model_name}: {response.text}"
                print(f"[Gemini Error]: {err_text}")

                if response.status_code == 503:
                    print(f"[AI Coach] Model '{model_name}' busy. Trying next model...")
                    continue

            except Exception as e:
                print(f"[Gemini Connection Error on {model_name}]: {repr(e)}")

    # اگر سرورهای گوگل پاسخ ندادند، بدون کرش کردن موتور الگوریتمی اجرا می‌شود
    print("[AI Coach] All LLM models busy/unavailable. Falling back to algorithmic engine.")
    return build_algorithmic_plan(goal_title, target_date, daily_hours, topics, notes)