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
        self.assertEqual(response.data['count'], 2)
        self.assertIsNone(response.data['next'])
        self.assertEqual(response.data['results'], [
            {'id': ana.pk, 'username': 'ana', 'first_name': '', 'last_name': ''},
            {'id': bruno.pk, 'username': 'bruno', 'first_name': 'Bruno', 'last_name': 'Costa'},
        ])

    def test_paginates_the_directory(self) -> None:
        """Fetch separate pages without skipping or repeating users."""
        users = get_user_model().objects.bulk_create([
            get_user_model()(username=f'user{index:03d}') for index in range(13)
        ])
        self.client.force_authenticate(user=users[0])
        first = self.client.get(reverse('users:list'))
        second = self.client.get(reverse('users:list'), {'page': 2})
        self.assertEqual(first.data['count'], 13)
        self.assertEqual(len(first.data['results']), 10)
        self.assertEqual(len(second.data['results']), 3)
        self.assertIsNotNone(first.data['next'])
        self.assertIsNone(second.data['next'])
        self.assertEqual(
            [user['id'] for user in first.data['results'] + second.data['results']],
            [user.pk for user in users],
        )

    def test_searches_names_and_usernames_before_pagination(self) -> None:
        """Match full names across fields and keep search on later pages."""
        user = get_user_model().objects.create(username='analyst', first_name='Ana', last_name='Silva')
        other = get_user_model().objects.create(username='writer', first_name='Bruno', last_name='Silva')
        self.client.force_authenticate(user=user)
        for search in ('aNA', 'ANA silVA', 'analyst'):
            with self.subTest(search=search):
                response = self.client.get(reverse('users:list'), {'search': search})
                self.assertEqual([item['id'] for item in response.data['results']], [user.pk])
        response = self.client.get(reverse('users:list'), {'search': 'silva', 'page_size': 1})
        self.assertEqual(response.data['count'], 2)
        self.assertIn('search=silva', response.data['next'])
        second = self.client.get(reverse('users:list'), {'search': 'silva', 'page_size': 1, 'page': 2})
        self.assertEqual(second.data['results'][0]['id'], other.pk)
        empty = self.client.get(reverse('users:list'), {'search': 'missing'})
        self.assertEqual(empty.data['count'], 0)

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
