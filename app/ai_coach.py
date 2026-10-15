import os
import json
import re
from pathlib import Path
from datetime import date, timedelta
from typing import List, Dict, Any
import httpx
from fastapi import HTTPException, status
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(dotenv_path=BASE_DIR / ".env")

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite")


def build_algorithmic_plan(
    goal_title: str,
    target_date: date,
    daily_hours: float,
    topics: List[str],
    notes: str | None = None,
    lang: str = "fa"
) -> Dict[str, Any]:
    today = date.today()
    days_remaining = max((target_date - today).days, 1)
    days_to_plan = min(days_remaining, 30)

    pomodoro_blocks = max(int((daily_hours * 60) // 25), 1)
    daily_coins = pomodoro_blocks * 10

    schedule = []
    for i in range(days_to_plan):
        current_day = today + timedelta(days=i)
        topic = topics[i % len(topics)]
        if i == days_to_plan - 1 and days_to_plan > 1:
            focus = "مرور جامع و جمع‌بندی" if lang == "fa" else "Comprehensive Review & Practice Exam"
            action = (
                f"مرور کل مباحث {goal_title} و حل نمونه سوالات امتحانی"
                if lang == "fa"
                else f"Review all {goal_title} notes and solve full mock questions"
            )
        else:
            focus = topic
            action = (
                f"مطالعه عمیق مبحث «{topic}» به همراه خلاصه‌نویسی و حل تمرین"
                if lang == "fa"
                else f"Deep study of '{topic}' with active recall and problem-solving"
            )

        schedule.append({
            "day_number": i + 1,
            "date": str(current_day),
            "focus_topic": focus,
            "pomodoro_blocks": pomodoro_blocks,
            "daily_study_hours": daily_hours,
            "potential_coins": daily_coins,
            "action_item": action
        })

    return {
        "goal_title": goal_title,
        "target_date": str(target_date),
        "days_remaining": days_remaining,
        "daily_hours": daily_hours,
        "total_planned_hours": round(days_to_plan * daily_hours, 1),
        "total_potential_coins": days_to_plan * daily_coins,
        "motivational_quote": (
            "استمرار کوچک روزانه، نتایج خارق‌العاده می‌سازد."
            if lang == "fa"
            else "Small daily discipline builds legendary mastery."
        ),
        "strategy_advice": (
            f"هر روز {pomodoro_blocks} بلاک پومودورو روی مباحث تعیین‌شده تمرکز کنید."
            if lang == "fa"
            else f"Complete {pomodoro_blocks} Pomodoro blocks daily focusing on one core concept at a time."
        ),
        "schedule": schedule
    }


async def generate_study_plan(
    goal_title: str,
    target_date: date,
    daily_hours: float,
    topics: List[str],
    notes: str | None = None,
    lang: str = "fa"
) -> Dict[str, Any]:
    if not GEMINI_API_KEY:
        err_msg = (
            "متغیر GEMINI_API_KEY در محیط سیستم ست نشده یا خالی است!"
            if lang == "fa"
            else "GEMINI_API_KEY environment variable is missing!"
        )
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=err_msg)

    today = date.today()
    days_left = max((target_date - today).days, 1)
    days_to_generate = min(days_left, 21)
    target_language = "Persian (فارسی)" if lang == "fa" else "English"

    prompt = f"""
    You are an elite academic strategist. Generate a structured study plan JSON strictly in {target_language}.
    Goal: {goal_title}
    Today's Date (Start Date - Day 1): {today}
    Target Date: {target_date}
    Days to Schedule: {days_to_generate} (starting from {today} sequentially day by day)
    Available Daily Hours: {daily_hours}
    Topics: {', '.join(topics)}
    Student Notes: {notes or 'None'}

    Rules:
    - 1 Pomodoro block = 25 minutes.
    - Each Pomodoro block = 10 coins.
    - Day 1 date MUST be "{today}", Day 2 MUST be "{today + timedelta(days=1)}", and so on sequentially.
    - Write motivational_quote, strategy_advice, focus_topic, and action_item strictly in {target_language}.

    Output ONLY a valid JSON object matching this schema:
    {{
      "goal_title": "{goal_title}",
      "target_date": "{target_date}",
      "days_remaining": {days_left},
      "daily_hours": {daily_hours},
      "total_planned_hours": <float>,
      "total_potential_coins": <int>,
      "motivational_quote": "<in {target_language}>",
      "strategy_advice": "<in {target_language}>",
      "schedule": [
        {{
          "day_number": 1,
          "date": "{today}",
          "focus_topic": "<in {target_language}>",
          "pomodoro_blocks": <int>,
          "daily_study_hours": {daily_hours},
          "potential_coins": <int>,
          "action_item": "<in {target_language}>"
        }}
      ]
    }}
    """

    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"response_mime_type": "application/json"}
    }

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
            try:
                response = await client.post(api_url, json=payload)
                if response.status_code == 200:
                    raw_text = response.json()["candidates"][0]["content"]["parts"][0]["text"].strip()
                    if raw_text.startswith("```"):
                        raw_text = re.sub(r"^```(?:json)?\n?", "", raw_text)
                        raw_text = re.sub(r"\n?```$", "", raw_text)
                    parsed = json.loads(raw_text)
                    for idx, item in enumerate(parsed.get("schedule", [])):
                        item["day_number"] = idx + 1
                        item["date"] = str(today + timedelta(days=idx))
                    return parsed

                if response.status_code == 503:
                    continue
            except Exception as e:
                print(f"[Gemini Error on {model_name}]: {repr(e)}")

    return build_algorithmic_plan(goal_title, target_date, daily_hours, topics, notes, lang)


async def generate_quick_quiz(topic: str, lang: str = "fa") -> List[Dict[str, Any]]:
    """تولید دو سوال تستی سریع اثبات مطالعه با جمینای"""
    fallback_quiz = [
        {
            "question": f"مفهوم کلیدی در مبحث «{topic}» چیست؟" if lang == "fa" else f"What is the primary concept in '{topic}'?",
            "options": ["تحلیل و درک عمیق ساختار", "حفظ طوطی‌وار فرمول‌ها", "نادیده گرفتن پیش‌نیازها", "عدم حل تمرین"] if lang == "fa" else ["Deep conceptual understanding", "Rote memorization", "Ignoring prerequisites", "Skipping practice"],
            "correct_index": 0
        },
        {
            "question": "بهترین راه تثبیت این مبحث کدام است؟" if lang == "fa" else "What is the best way to solidify this topic?",
            "options": ["حل تست و پیاده‌سازی عملی", "فقط روخوانی سریع", "به تعویق انداختن تمرین", "تغییر مداوم منبع"] if lang == "fa" else ["Active problem solving & implementation", "Passive reading", "Procrastination", "Switching sources constantly"],
            "correct_index": 0
        }
    ]
    if not GEMINI_API_KEY:
        return fallback_quiz

    target_lang = "Persian" if lang == "fa" else "English"
    prompt = f"""
    Create exactly 2 multiple-choice questions testing understanding of the topic: '{topic}'.
    Language MUST be {target_lang}.
    Output ONLY a JSON array with this exact structure:
    [
      {{
        "question": "<question in {target_lang}>",
        "options": ["<opt0>", "<opt1>", "<opt2>", "<opt3>"],
        "correct_index": <int 0-3>
      }}
    ]
    """
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"response_mime_type": "application/json"}
    }

    async with httpx.AsyncClient(timeout=20.0) as client:
        for model in [GEMINI_MODEL, "gemini-3.5-flash-lite", "gemini-3.8-flash"]:
            try:
                url = f"[https://generativelanguage.googleapis.com/v1beta/models/](https://generativelanguage.googleapis.com/v1beta/models/){model}:generateContent?key={GEMINI_API_KEY}"
                res = await client.post(url, json=payload)
                if res.status_code == 200:
                    raw = res.json()["candidates"][0]["content"]["parts"][0]["text"].strip()
                    if raw.startswith("```"):
                        raw = re.sub(r"^```(?:json)?\n?", "", raw)
                        raw = re.sub(r"\n?```$", "", raw)
                    return json.loads(raw)
            except Exception:
                continue

    return fallback_quiz


async def generate_boss_names(course_or_goal: str, lang: str = "fa") -> List[str]:
    """تولید ۳ نام حماسی و گیمینگ برای باس‌فایت بر اساس نام درس یا هدف با کمک جمینای"""
    fallback_names = (
        [
            f"تایتان هزارتوی {course_or_goal}",
            f"اژدهای کابوس {course_or_goal}",
            f"شوالیه تاریک {course_or_goal}"
        ]
        if lang == "fa"
        else [
            f"The Abyssal Warden of {course_or_goal}",
            f"Arch-Dragon of {course_or_goal}",
            f"overeign Titan: {course_or_goal}"
        ]
    )

    if not GEMINI_API_KEY:
        return fallback_names

    target_lang = "Persian (فارسی)" if lang == "fa" else "English"
    prompt = f"""
    You are a creative video game director (like Elden Ring / Hollow Knight / Persona).
    The student's study course or exam goal is: "{course_or_goal}".
    Generate 3 epic, creative, and slightly intimidating RPG Boss names inspired by "{course_or_goal}" strictly in {target_lang}.
    Keep each name concise (3 to 6 words max).
    Output ONLY a JSON array of 3 strings, like:
    ["<Boss Name 1>", "<Boss Name 2>", "<Boss Name 3>"]
    """

    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"response_mime_type": "application/json"}
    }

    async with httpx.AsyncClient(timeout=15.0) as client:
        for model in [GEMINI_MODEL, "gemini-3.5-flash-lite", "gemini-3.5-flash", "gemini-3.8-flash"]:
            try:
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={GEMINI_API_KEY}"
                res = await client.post(url, json=payload)
                if res.status_code == 200:
                    raw = res.json()["candidates"][0]["content"]["parts"][0]["text"].strip()
                    if raw.startswith("```"):
                        raw = re.sub(r"^```(?:json)?\n?", "", raw)
                        raw = re.sub(r"\n?```$", "", raw)
                    names = json.loads(raw)
                    if isinstance(names, list) and len(names) > 0:
                        return [str(n) for n in names[:3]]
            except Exception:
                continue

    return fallback_names