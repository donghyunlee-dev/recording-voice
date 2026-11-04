import unittest

from local_runtime.app.security import PairingManager


class PairingManagerTests(unittest.TestCase):
    def test_creates_a_random_session_without_exposing_a_pairing_code(self):
        manager = PairingManager("unused-code")

        session = manager.create_session()

        self.assertIsNotNone(session)
        self.assertTrue(manager.is_authorized(session.token))

    def test_pairing_code_is_one_time_and_session_expires(self):
        manager = PairingManager("one-time-code", session_ttl_seconds=0)
        session = manager.exchange("one-time-code")
        self.assertIsNotNone(session)
        self.assertFalse(manager.is_authorized(session.token))
        self.assertIsNone(manager.exchange("one-time-code"))

    def test_pairing_code_expires_and_limits_failed_attempts(self):
        expired = PairingManager("one-time-code", code_ttl_seconds=0)
        self.assertIsNone(expired.exchange("one-time-code"))

        limited = PairingManager("one-time-code")
        for _ in range(5):
            self.assertIsNone(limited.exchange("wrong-code"))
        self.assertIsNone(limited.exchange("one-time-code"))

    def test_successful_pairing_rotates_to_a_new_one_time_code(self):
        manager = PairingManager("first-code")
        self.assertIsNotNone(manager.exchange("first-code"))
        next_code = manager.rotate_code()
        self.assertIsNone(manager.exchange("first-code"))
        self.assertIsNotNone(manager.exchange(next_code))


if __name__ == "__main__":
    unittest.main()
