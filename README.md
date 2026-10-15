# ⚡ StudyMate OS — پلتفرم گیمینگ و هوشمند مطالعه

<div align="center">

![FastAPI](https://img.shields.io/badge/FastAPI-005571?style=for-the-badge&logo=fastapi)
![React 18](https://img.shields.io/badge/React_18-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![SQLite](https://img.shields.io/badge/SQLite-07405E?style=for-the-badge&logo=sqlite&logoColor=white)
![Google Gemini AI](https://img.shields.io/badge/Gemini_AI-4285F4?style=for-the-badge&logo=google&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)

**یک سیستم‌عامل تعاملی و گیمیفای‌شده برای غلبه بر اهمال‌کاری و هدایت برنامه‌های درسی با دستیار هوش مصنوعی Gemini**

[ویژگی‌ها](#-قابلیت‌های-کلیدی) • [معماری](#-معماری-پروژه) • [راه‌اندازی سریع](#-راهنمای-راه‌اندازی-سریع) • [اندپوینت‌های API](#-مستندات-api)

</div>

---

## 🌟 قابلیت‌های کلیدی

### ⏱️ راکتور پومودورو با پروتکل ضد تقلب (Anti-Cheat Pomodoro)
- حلقه پیشرفت SVG با انیمیشن روان و زمان‌سنج دیجیتال معکوس.
- واریز سکه **تنها و تنها در صورت اتمام واقعی زمان هدف** (به ازای هر ۲۵ دقیقه تمرکز = ۱۰ سکه طلایی)[cite: 4].
- کوئیز ۲ سوالی اختیاری هوش مصنوعی بلافاصله پس از اتمام تایمر برای سنجش یادگیری فعال و دریافت تا +۱۰ سکه امتیازی[cite: 4].
- مولد صدای محیطی درون‌برنامه‌ای (Web Audio API) بدون نیاز به فایل‌های خارجی: باران پاییزی، وایت‌نویز و سینت لو-فای کیهانی.

### 🐉 نبردهای تیمی با غول امتحانات (Guild Boss Raids)
- امکان تاسیس و پیوستن به گروه‌های مطالعه با کدهای دعوت اختصاصی[cite: 4].
- **احضار غول با هوش مصنوعی:** تولید نام‌های حماسی برای باس بر اساس نام درس یا موعد امتحان توسط Gemini[cite: 4].
- **فرمول قفل‌شده پاداش:** به ازای هر ۲۵ اچ‌پی، ۱۰ سکه پاداش تیمی به اعضا تعلق می‌گیرد[cite: 4].
- تبدیل هر ۱ دقیقه مطالعه پومودورو به ۱ واحد ضربه (Damage) به جان باس به همراه جدول لیدربورد آسیب‌زنندگان[cite: 4].

### 👤 کارت پروفایل عمومی و تم‌های سفارشی (Themed Auras)
- پاپ‌آپ شیشه‌ای کارت پروفایل با کلیک روی نام هر کاربر در لیدربورد یا گروه‌ها.
- هاله بصری و رنگ‌بندی کارت پروفایل بر اساس تم فعال کاربر (`Castlevania`، `Matrix`، `Cyberpunk`، `Hollow Knight` و...)[cite: 4].
- سیستم سطوح پلکانی (LVL 1 تا 100) و القاب حماسی (*Sleepy Novice* تا *Grand Luminary*) بر اساس مجموع دقایق مطالعه[cite: 4].

### 🔥 چرخه استریک ۷ روزه پلکانی (7-Day Streak Cycle)
- پاداش افزایشی پیوستگی: روز اول ۱۰ سکه، روز دوم ۱۵ سکه، ... تا روز هفتم ۴۰ سکه[cite: 4].
- ریست خودکار چرخه به روز اول پس از اتمام هفته با حفظ زنجیره مطالعه[cite: 4].

### 📅 تقویم حرارتی استمرار مطالعه (Study Heatmap)
- گرید ۱۲۰ روزه مشابه نمودار کانتریبیوشن گیت‌هاب در داشبورد[cite: 4].
- نمایش شدت مطالعه با رنگ‌های سبز تیره تا فسفری درخشان.

### 🤖 مربی برنامه‌ریزی دانشگاهی Gemini
- تولید برنامه روزبه‌روز بر اساس اهداف پایان‌ترم و تاریخ امتحان[cite: 4].
- **سیستم قفل تسک‌های آینده:** کاربر تا فرا رسیدن تاریخ روز مشخص نمی‌تواند تسک‌های آینده را تیک بزند[cite: 4].
- محاسبه درصد پیشرفت کل پروژه مطالعه به صورت زنده[cite: 4].

---

## 🛠 معماری پروژه

```text
StudyMate/
├── app/
│   ├── auth.py          # مدیریت هش رمز و صدور توکن‌های امن JWT
│   ├── database.py      # مدیریت اتصال SQLite با فعال‌سازی WAL و Foreign Keys[cite: 1]
│   ├── schemas.py       # مدل‌ها و اعتبارسنج‌های Pydantic
│   ├── ai_coach.py      # ارتباط ناهمگام با مدل‌های Google Gemini Flash[cite: 2]
│   └── main.py          # اندپوینت‌های FastAPI، منطق XP، لول‌ها و استریک[cite: 4]
├── static/
│   ├── index.html       # صفحه اصلی با ایمپورت React 18 و Babel
│   ├── css/
│   │   └── styles.css   # استایل‌های تم، پالت رنگ‌ها و اوراها
│   └── js/
│       ├── i18n.js      # دیکشنری دوزبانه (FA/EN)
│       └── app.jsx      # کلاینت یکپارچه React 18 با سنتز صدای لوکال
├── requirements.txt
└── .env
```

---

## 🚀 راهنمای راه‌اندازی سریع

### ۱. کلون و ایجاد محیط مجازی
```bash
git clone [https://github.com/your-username/StudyMate.git](https://github.com/your-username/StudyMate.git)
cd StudyMate
python -m venv venv
```

در ویندوز (PowerShell):
```powershell
.\venv\Scripts\Activate.ps1
```

### ۲. نصب وابستگی‌ها
```bash
pip install -r requirements.txt
```

### ۳. تنظیم متغیرهای محیطی (`.env`)
یک فایل به نام `.env` در ریشه پروژه بسازید:
```env
GEMINI_API_KEY=your_google_gemini_api_key_here
GEMINI_MODEL=gemini-3.5-flash-lite
JWT_SECRET=your_super_secret_key
```

### ۴. اجرای سرور
```bash
uvicorn app.main:app --reload
```
اکنون وارد مرورگر خود شوید و به آدرس `http://127.0.0.1:8000` بروید.

---

## 📡 مستندات API

| متد | اندپوینت | توضیحات |
| :--- | :--- | :--- |
| `POST` | `/auth/register` | ثبت‌نام کاربر جدید و اهدای تم پیش‌فرض[cite: 2, 4] |
| `POST` | `/auth/login` | ورود به سیستم و دریافت توکن JWT[cite: 2, 4] |
| `GET` | `/users/{id}/profile` | دریافت اطلاعات کارت پروفایل عمومی کاربر[cite: 4] |
| `GET` | `/dashboard/stats` | آمار جامع کاربر شامل سطح، استریک و ساعات مطالعه[cite: 4] |
| `GET` | `/dashboard/heatmap` | داده‌های نمودار ۱۲۰ روزه گیت‌هابی[cite: 4] |
| `POST` | `/pomodoro/start` | ثبت شروع پومودوروی تحت نظارت[cite: 4] |
| `POST` | `/pomodoro/{id}/complete` | بررسی ضد تقلب، واریز سکه‌ها و اعمال ضربه به باس[cite: 4] |
| `GET` | `/pomodoro/{id}/quiz` | تولید ۲ سوال تستی هوش مصنوعی از موضوع پومودورو[cite: 4] |
| `POST` | `/ai/generate-plan` | تولید نقشه راه درسی چندروزه با Gemini[cite: 2, 4] |
| `POST` | `/groups/{id}/raids` | احضار غول باس‌فایت جدید با فرمول قفل‌شده HP به سکه[cite: 4] |
| `POST` | `/ai/suggest-boss-name` | پیشنهاد ۳ نام حماسی برای غول با هوش مصنوعی[cite: 4] |