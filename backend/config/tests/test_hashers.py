from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.contrib.auth.hashers import (
    Argon2PasswordHasher,
    PBKDF2PasswordHasher,
    check_password,
    get_hasher,
    make_password,
)
from django.db.models import CharField
from django.test import SimpleTestCase, override_settings

from config.hashers import ConfigurableArgon2PasswordHasher

PASSWORD = 'test-only-password'


@override_settings(PASSWORD_PEPPER='ab' * 32)
class PasswordHasherTests(SimpleTestCase):
    @override_settings(
        ARGON2_TIME_COST=3,
        ARGON2_MEMORY_COST=8192,
        ARGON2_PARALLELISM=1,
        PASSWORD_HASHERS=['config.hashers.ConfigurableArgon2PasswordHasher'],
    )
    def test_hash_uses_configured_argon2_costs(self) -> None:
        """Use the configured memory, passes, and threads."""
        encoded = make_password(PASSWORD)

        self.assertIn('$m=8192,t=3,p=1$', encoded)
        self.assertTrue(check_password(PASSWORD, encoded))

    def test_new_password_uses_argon2id(self) -> None:
        """Create a valid hash that fits the password field."""
        encoded = make_password(PASSWORD)
        password_field = get_user_model()._meta.get_field('password')
        assert isinstance(password_field, CharField), 'The password field must store text.'
        max_length = password_field.max_length
        assert max_length is not None, 'The password field must have a length limit.'

        self.assertTrue(encoded.startswith('argon2_pepper_v1$argon2id$'))
        self.assertLessEqual(len(encoded), max_length)
        self.assertTrue(check_password(PASSWORD, encoded))
        self.assertFalse(check_password('wrong-password', encoded))

    def test_wrong_pepper_rejects_the_correct_password(self) -> None:
        """Require the same pepper for verification."""
        encoded = make_password(PASSWORD)

        with override_settings(PASSWORD_PEPPER='cd' * 32):
            self.assertFalse(check_password(PASSWORD, encoded))
        self.assertTrue(check_password(PASSWORD, encoded))

    def test_pepper_changes_hash_even_with_the_same_salt(self) -> None:
        """Changing only the pepper changes the hash."""
        salt = get_hasher().salt()
        encoded = make_password(PASSWORD, salt=salt)
        with override_settings(PASSWORD_PEPPER='cd' * 32):
            changed = make_password(PASSWORD, salt=salt)

        self.assertNotEqual(encoded, changed)

    def test_plain_argon2_hash_is_rejected(self) -> None:
        """Reject Argon2 hashes made without a pepper."""
        hasher = Argon2PasswordHasher()
        encoded = hasher.encode(PASSWORD, hasher.salt())

        self.assertFalse(check_password(PASSWORD, encoded))

    def test_peppered_hash_does_not_verify_as_a_plain_password(self) -> None:
        """Renaming the hash cannot bypass the pepper."""
        encoded = make_password(PASSWORD)
        plain_format = 'argon2$' + encoded.split('$', 1)[1]
        hasher = Argon2PasswordHasher()

        self.assertFalse(hasher.verify(PASSWORD, plain_format))

    def test_unicode_password_and_bytes_are_handled_consistently(self) -> None:
        """Accept Unicode text and matching UTF-8 bytes."""
        password = 'test-only-password-é-🔑'
        encoded = make_password(password)
        hasher = ConfigurableArgon2PasswordHasher()

        self.assertTrue(check_password(password, encoded))
        self.assertTrue(hasher.verify(password.encode('utf-8'), encoded))

    def test_old_pbkdf2_passwords_are_rejected(self) -> None:
        """Reject old hashes without saving an upgrade."""
        hasher = PBKDF2PasswordHasher()
        for iterations in (1_500_000, 2_000_000):
            with self.subTest(iterations=iterations):
                encoded = hasher.encode(PASSWORD, hasher.salt(), iterations=iterations)
                user = get_user_model()(password=encoded)

                with patch.object(user, 'save') as save:
                    self.assertFalse(user.check_password(PASSWORD))

                self.assertTrue(user.password.startswith('pbkdf2_sha256$'))
                save.assert_not_called()

    def test_reset_password_uses_argon2id(self) -> None:
        """Use peppered Argon2id when setting a password."""
        password = 'new-test-only-password'
        user = get_user_model()()
        user.set_password(password)

        self.assertTrue(user.password.startswith('argon2_pepper_v1$argon2id$'))
        with patch.object(user, 'save') as save:
            self.assertTrue(user.check_password(password))
            self.assertFalse(user.check_password('wrong-password'))

        save.assert_not_called()
