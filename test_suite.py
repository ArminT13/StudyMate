import unittest
import os
import sqlite3
from datetime import date, datetime, timedelta
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials

from app.database import get_connection, init_db
from app.auth import get_current_user
from app.main import (
    register, login, forgot_password, reset_password, read_current_user,
    get_public_user_profile, update_character_name,
    get_shop_themes, buy_theme, equip_theme,
    get_accessories_shop, buy_accessory, equip_accessory,
    get_user_friends, get_friend_requests, friend_action,
    get_weekly_challenge, start_pomodoro_session, complete_pomodoro_session,
    get_dashboard_stats, get_my_referrals, get_study_sessions,
    create_course, log_study_session, get_study_heatmap
)
from app.schemas import (
    UserRegister, UserLogin, PasswordForgotRequest, PasswordResetRequest,
    CharacterNameUpdate, ThemeActionRequest, AccessoryActionRequest,
    FriendActionRequest, PomodoroStartRequest, CourseCreate, StudySessionCreate
)

def make_user_creds(token: str) -> dict:
    creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
    return get_current_user(creds)

class TestStudyMateCore(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        init_db()

    def test_01_registration_validation(self):
        # 1. Future DOB rejected
        with self.assertRaises(HTTPException) as cm:
            register(UserRegister(
                username="future_dob_user",
                password="password123",
                confirm_password="password123",
                date_of_birth=date.today() + timedelta(days=2)
            ))
        self.assertEqual(cm.exception.status_code, 400)

        # 2. Mismatched passwords rejected
        with self.assertRaises(HTTPException) as cm:
            register(UserRegister(
                username="mismatch_user",
                password="password123",
                confirm_password="different123"
            ))
        self.assertEqual(cm.exception.status_code, 400)

        # 3. Valid registration
        ts = int(datetime.utcnow().timestamp())
        res = register(UserRegister(
            username=f"student_{ts}",
            password="securepassword123",
            confirm_password="securepassword123",
            date_of_birth=date(2003, 4, 12)
        ))
        self.assertIn("access_token", res)
        self.assertEqual(res["character_name"], "Minti")
        self.assertTrue(res["user_id"] > 0)

    def test_02_login_and_character_customization(self):
        ts = int(datetime.utcnow().timestamp())
        uname = f"minti_fan_{ts}"
        reg = register(UserRegister(username=uname, password="mypassword", confirm_password="mypassword"))
        u_creds = make_user_creds(reg["access_token"])

        # Character name update
        patch_res = update_character_name(CharacterNameUpdate(character_name="Fluffy <b>Sprout</b>"), u_creds)
        self.assertEqual(patch_res["character_name"], "Fluffy Sprout")

        # Refreshed profile
        prof = read_current_user(make_user_creds(reg["access_token"]))
        self.assertEqual(prof.character_name, "Fluffy Sprout")

        # Public profile: check that character name is shown and DOB is never leaked
        pub_prof = get_public_user_profile(reg["user_id"])
        self.assertEqual(pub_prof.character_name, "Fluffy Sprout")
        self.assertFalse(hasattr(pub_prof, "date_of_birth"))

    def test_03_password_recovery(self):
        ts = int(datetime.utcnow().timestamp())
        uname = f"recovery_{ts}"
        register(UserRegister(username=uname, password="oldpassword123"))

        # Request forgot password token
        forgot_res = forgot_password(PasswordForgotRequest(username_or_email=uname))
        token = forgot_res["reset_token"]
        self.assertTrue(token)

        # Reset password
        reset_res = reset_password(PasswordResetRequest(
            token=token,
            new_password="newpassword123",
            confirm_password="newpassword123"
        ))
        self.assertIn("successfully reset", reset_res["message"])

        # Login with new password
        login_res = login(UserLogin(username=uname, password="newpassword123"))
        self.assertTrue(login_res["access_token"])

    def test_04_themes_and_accessories_store(self):
        ts = int(datetime.utcnow().timestamp())
        uname = f"shopper_{ts}"
        reg = register(UserRegister(username=uname, password="password123"))
        u_creds = make_user_creds(reg["access_token"])

        # Check themes: default pink theme is free and owned
        themes = get_shop_themes(u_creds)
        pink_theme = next(t for t in themes if t.id == "default")
        self.assertTrue(pink_theme.is_owned)
        self.assertTrue(pink_theme.is_active)
        self.assertEqual(pink_theme.preview_color, "#F5AFAF")

        # Check accessories: classic and sprout owned by default
        accs = get_accessories_shop(u_creds)
        sprout = next(a for a in accs if a.id == "sprout")
        self.assertTrue(sprout.is_owned)
        self.assertTrue(sprout.is_equipped)

        # Grant coins to user
        with get_connection() as conn:
            conn.execute("UPDATE users SET coins = 3000 WHERE id = ?", (reg["user_id"],))
            conn.commit()

        # Buy jungle theme (500 coins)
        buy_res = buy_theme(ThemeActionRequest(theme_id="jungle"), u_creds)
        self.assertEqual(buy_res["remaining_coins"], 2500)

        # Equip jungle theme
        equip_theme(ThemeActionRequest(theme_id="jungle"), u_creds)

        # Buy golden crown (500 coins)
        buy_acc = buy_accessory(AccessoryActionRequest(item_id="crown", category="hat"), u_creds)
        self.assertEqual(buy_acc["remaining_coins"], 2000)

        # Equip crown
        equip_accessory(AccessoryActionRequest(item_id="crown", category="hat"), u_creds)

        # Verify equipped in stats
        stats = get_dashboard_stats(make_user_creds(reg["access_token"]))
        self.assertEqual(stats["active_theme"], "jungle")
        self.assertEqual(stats["equipped_hat"], "crown")

    def test_05_weekly_boss_and_pomodoro_session(self):
        ts = int(datetime.utcnow().timestamp())
        uname = f"slayer_{ts}"
        reg = register(UserRegister(username=uname, password="password123"))
        u_creds = make_user_creds(reg["access_token"])

        # Check weekly challenge
        w_boss = get_weekly_challenge(u_creds)
        self.assertEqual(w_boss.boss_name_fa, "باس سایبری")
        self.assertGreaterEqual(w_boss.max_hp, 5000)

        # Start pomodoro session
        p_sess = start_pomodoro_session(PomodoroStartRequest(topic="Algorithms", target_minutes=25), u_creds)
        sess_id = p_sess["id"]

        # Premature completion must fail anti-cheat
        with self.assertRaises(HTTPException) as cm:
            complete_pomodoro_session(sess_id, u_creds)
        self.assertEqual(cm.exception.status_code, 400)

        # Fast forward session start time in DB
        with get_connection() as conn:
            conn.execute("UPDATE pomodoro_sessions SET started_at = datetime('now', '-26 minutes') WHERE id = ?", (sess_id,))
            conn.commit()

        # Complete session
        comp = complete_pomodoro_session(sess_id, u_creds)
        self.assertEqual(comp["status"], "completed")
        self.assertEqual(comp["coins_earned"], 10)
        self.assertEqual(comp["xp_earned"], 50)
        self.assertEqual(comp["current_streak"], 1)

        # Check weekly challenge damage
        w_boss_after = get_weekly_challenge(u_creds)
        self.assertEqual(w_boss_after.user_damage, 25)

    def test_06_friends_and_referral_premium(self):
        ts = int(datetime.utcnow().timestamp())
        alice_reg = register(UserRegister(username=f"alice_{ts}", password="password123"))
        alice_creds = make_user_creds(alice_reg["access_token"])
        alice_ref = get_my_referrals(alice_creds)
        alice_code = alice_ref.referral_code

        # Bob registers with Alice's referral code
        bob_reg = register(UserRegister(username=f"bob_{ts}", password="password123", referral_code=alice_code))
        bob_creds = make_user_creds(bob_reg["access_token"])

        # Bob sends friend request to Alice
        friend_action(FriendActionRequest(action="send", target_username_or_id=f"alice_{ts}"), bob_creds)

        # Alice checks pending requests and accepts
        reqs = get_friend_requests(alice_creds)
        self.assertEqual(len(reqs), 1)
        friend_action(FriendActionRequest(action="accept", request_id=reqs[0].id), alice_creds)

        # Alice checks friends list
        friends = get_user_friends(alice_creds)
        self.assertTrue(any(f.username == f"bob_{ts}" for f in friends))

        # Bob completes his first study session
        p_sess = start_pomodoro_session(PomodoroStartRequest(topic="Chemistry", target_minutes=25), bob_creds)
        with get_connection() as conn:
            conn.execute("UPDATE pomodoro_sessions SET started_at = datetime('now', '-26 minutes') WHERE id = ?", (p_sess["id"],))
            conn.commit()
        complete_pomodoro_session(p_sess["id"], bob_creds)

        # Check that both Alice and Bob received 3 days of free Premium!
        alice_updated_ref = get_my_referrals(make_user_creds(alice_reg["access_token"]))
        self.assertEqual(alice_updated_ref.successful_referrals_count, 1)
        self.assertEqual(alice_updated_ref.reward_days_earned, 3)
        self.assertTrue(alice_updated_ref.is_premium)

        bob_stats = get_dashboard_stats(make_user_creds(bob_reg["access_token"]))
        self.assertTrue(bob_stats["is_premium"])

    def test_07_jewelry_customization_and_reports_data(self):
        ts = int(datetime.utcnow().timestamp())
        uname = f"fashion_{ts}"
        reg = register(UserRegister(username=uname, password="password123"))
        u_creds = make_user_creds(reg["access_token"])

        # 1. Default jewelry state is None (no jewelry equipped)
        prof = read_current_user(u_creds)
        self.assertIsNone(prof.equipped_jewelry)

        # 2. Check jewelry items in shop catalog
        accs = get_accessories_shop(u_creds)
        jewelry_items = [a for a in accs if a.category == "jewelry"]
        jewelry_ids = {a.id for a in jewelry_items}
        self.assertIn("silver_hoops", jewelry_ids)
        self.assertIn("star_studs", jewelry_ids)
        self.assertIn("ear_cuffs", jewelry_ids)
        self.assertIn("chain_necklace", jewelry_ids)

        # 3. Grant coins and purchase silver_hoops (140 coins)
        with get_connection() as conn:
            conn.execute("UPDATE users SET coins = 1000 WHERE id = ?", (reg["user_id"],))
            conn.commit()

        buy_res = buy_accessory(AccessoryActionRequest(item_id="silver_hoops", category="jewelry"), u_creds)
        self.assertEqual(buy_res["remaining_coins"], 860)

        # 4. Equip silver_hoops
        equip_res = equip_accessory(AccessoryActionRequest(item_id="silver_hoops", category="jewelry"), u_creds)
        self.assertIn("Equipped", equip_res["message"])

        # 5. Verify persisted equipped_jewelry in profile and dashboard stats
        updated_prof = read_current_user(make_user_creds(reg["access_token"]))
        self.assertEqual(updated_prof.equipped_jewelry, "silver_hoops")

        stats = get_dashboard_stats(make_user_creds(reg["access_token"]))
        self.assertEqual(stats["equipped_jewelry"], "silver_hoops")

        # 5b. Unequip jewelry by setting none_jewelry
        equip_none = equip_accessory(AccessoryActionRequest(item_id="none_jewelry", category="jewelry"), u_creds)
        self.assertIsNone(equip_none["item_id"])
        self.assertIsNone(read_current_user(make_user_creds(reg["access_token"])).equipped_jewelry)

        # 6. Verify study sessions & heatmap data feeds for Progress Reports
        course = create_course(CourseCreate(name="Physics", color="#F5AFAF", weekly_goal_hours=10.0), u_creds)
        course_id = course["id"]

        # 6a. Log a quick course study session
        log_res = log_study_session(
            StudySessionCreate(course_id=course_id, duration_minutes=45, notes="Wave Mechanics"),
            u_creds
        )
        self.assertEqual(log_res["session"]["course_name"], "Physics")
        self.assertEqual(log_res["session"]["duration_minutes"], 45)

        sessions = get_study_sessions(u_creds)
        self.assertGreaterEqual(len(sessions), 1)
        self.assertEqual(sessions[0]["course_name"], "Physics")
        self.assertEqual(sessions[0]["duration_minutes"], 45)

        # 6b. Complete a Pomodoro session
        p_sess = start_pomodoro_session(PomodoroStartRequest(topic="Quantum Mechanics", target_minutes=25), u_creds)
        sess_id = p_sess["id"]
        with get_connection() as conn:
            conn.execute("UPDATE pomodoro_sessions SET started_at = datetime('now', '-26 minutes') WHERE id = ?", (sess_id,))
            conn.commit()
        complete_pomodoro_session(sess_id, u_creds)

        # 6c. Verify heatmap aggregates both quick sessions and pomodoros
        heatmap_days = get_study_heatmap(u_creds)
        self.assertGreaterEqual(len(heatmap_days), 1)
        total_minutes = sum(d["minutes"] for d in heatmap_days)
        total_count = sum(d["count"] for d in heatmap_days)
        self.assertEqual(total_minutes, 70)  # 45m + 25m
        self.assertEqual(total_count, 2)     # 2 sessions total

if __name__ == "__main__":
    unittest.main()
