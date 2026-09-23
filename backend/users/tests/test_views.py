from django.contrib.auth import get_user_model
from django.test import override_settings
from django.urls import reverse
from rest_framework.test import APISimpleTestCase, APITestCase


@override_settings(ALLOWED_HOSTS=['testserver'], SECURE_SSL_REDIRECT=False)
class UserListViewTests(APITestCase):
    def test_lists_user_choices_without_private_fields(self) -> None:
        """Return an ordered directory for the assignee controls."""
        bruno = get_user_model().objects.create(username='bruno', email='private@example.com', first_name='Bruno', last_name='Costa')
        ana = get_user_model().objects.create(username='ana')
        self.client.force_authenticate(user=ana)
        response = self.client.get(reverse('users:list'))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), [
            {'id': ana.pk, 'username': 'ana', 'first_name': '', 'last_name': ''},
            {'id': bruno.pk, 'username': 'bruno', 'first_name': 'Bruno', 'last_name': 'Costa'},
        ])

    def test_requires_login_and_does_not_create_users(self) -> None:
        """Keep the directory authenticated and read-only."""
        self.assertEqual(self.client.get(reverse('users:list')).status_code, 401)
        self.client.force_authenticate(user=get_user_model().objects.create(username='ana'))
        self.assertEqual(self.client.post(reverse('users:list'), {}).status_code, 405)


@override_settings(ALLOWED_HOSTS=['testserver'], SECURE_SSL_REDIRECT=False)
class UserMeViewTests(APISimpleTestCase):
    def test_returns_logged_in_user(self):
        """Return the current user's details without exposing the password."""
        user = get_user_model()(
            id=7, username='ana', email='ana@example.com', password='test-only-value',
            first_name='Ana', last_name='Silva'
        )
        self.client.force_authenticate(user=user)

        response = self.client.get(reverse('users:me'))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {'id': 7, 'username': 'ana', 'email': 'ana@example.com',
             'first_name': 'Ana', 'last_name': 'Silva'},
        )

    def test_rejects_logged_out_requests(self):
        """Require login before returning account details."""
        response = self.client.get(reverse('users:me'))
        self.assertEqual(response.status_code, 401)

    def test_rejects_profile_changes(self):
        """This endpoint reads account details; it does not edit them."""
        self.client.force_authenticate(user=get_user_model()(username='ana'))

        response = self.client.patch(
            reverse('users:me'), {'username': 'changed'}, format='json'
        )

        self.assertEqual(response.status_code, 405)
