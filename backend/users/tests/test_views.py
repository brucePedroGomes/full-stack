from django.contrib.auth import get_user_model
from django.test import override_settings
from django.urls import reverse
from rest_framework.test import APISimpleTestCase


@override_settings(ALLOWED_HOSTS=['testserver'], SECURE_SSL_REDIRECT=False)
class UserMeViewTests(APISimpleTestCase):
    def test_returns_logged_in_user(self):
        """Return the current user's details without exposing the password."""
        user = get_user_model()(
            id=7, username='ana', email='ana@example.com', password='test-only-value'
        )
        self.client.force_authenticate(user=user)

        response = self.client.get(reverse('users:me'))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {'id': 7, 'username': 'ana', 'email': 'ana@example.com'},
        )

    def test_rejects_logged_out_requests(self):
        """Require login before returning account details."""
        response = self.client.get(reverse('users:me'))
        self.assertEqual(response.status_code, 403)

    def test_rejects_profile_changes(self):
        """This endpoint reads account details; it does not edit them."""
        self.client.force_authenticate(user=get_user_model()(username='ana'))

        response = self.client.patch(
            reverse('users:me'), {'username': 'changed'}, format='json'
        )

        self.assertEqual(response.status_code, 405)
