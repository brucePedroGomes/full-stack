"""Apply a secret pepper before Django's configurable Argon2id hasher."""

import hmac

from django.conf import settings
from django.contrib.auth.hashers import Argon2PasswordHasher
from django.utils.encoding import force_bytes
from django.views.decorators.debug import sensitive_variables


class ConfigurableArgon2PasswordHasher(Argon2PasswordHasher):
    """Use HMAC-SHA256 with a separate pepper, then salted Argon2id."""

    algorithm = 'argon2_pepper_v1'

    def __init__(self) -> None:
        self.time_cost = settings.ARGON2_TIME_COST
        self.memory_cost = settings.ARGON2_MEMORY_COST
        self.parallelism = settings.ARGON2_PARALLELISM

    @sensitive_variables('password')
    def _pepper(self, password: str | bytes) -> str:
        return hmac.new(
            bytes.fromhex(settings.PASSWORD_PEPPER),
            force_bytes(password),
            digestmod='sha256',
        ).hexdigest()

    @sensitive_variables('password')
    def encode(self, password: str | bytes, salt: str) -> str:
        return super().encode(self._pepper(password), salt)

    @sensitive_variables('password')
    def verify(self, password: str | bytes, encoded: str) -> bool:
        return super().verify(self._pepper(password), encoded)
