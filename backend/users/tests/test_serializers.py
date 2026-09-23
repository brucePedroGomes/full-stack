from django.contrib.auth.models import User
from django.test import SimpleTestCase

from users.serializers import UserSerializer


class UserSerializerTests(SimpleTestCase):
    def test_returns_only_account_details(self):
        """Return basic account details without including the password."""
        user = User(
            username='ana', email='ana@example.com', password='test-only-value'
        )

        self.assertEqual(
            UserSerializer().to_representation(user),
            {'id': None, 'username': 'ana', 'email': 'ana@example.com'},
        )
