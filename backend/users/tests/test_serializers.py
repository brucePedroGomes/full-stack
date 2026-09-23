from django.contrib.auth import get_user_model
from django.test import SimpleTestCase

from users.serializers import UserSerializer


class UserSerializerTests(SimpleTestCase):
    def test_returns_only_account_details(self):
        """Return basic account details without including the password."""
        user = get_user_model()(
            username='ana', email='ana@example.com', password='test-only-value'
        )

        self.assertEqual(
            UserSerializer(user).data,
            {'id': None, 'username': 'ana', 'email': 'ana@example.com'},
        )
