from django.test import TestCase, Client
from django.urls import reverse
from authentication.models import User
from django.contrib.auth.hashers import make_password
from pong.models import PongGame
from django.contrib.messages import get_messages

class HomeViewsTest(TestCase):
    def setUp(self):
        self.client = Client()
        self.user = User.objects.create(
            username='testuser',
            password=make_password('testpassword'),
            twofa=False,
            nick_name='testnick'
        )
        self.client.login(username='testuser', password='testpassword')

    def login(self, username, password):
        response = self.client.post('/login', {'username': username, 'password': password})
        self.assertEqual(response.status_code, 302)
        access_token = response.cookies.get('access_token')
        refresh_token = response.cookies.get('refresh_token')
        self.assertIsNotNone(access_token)
        self.assertIsNotNone(refresh_token)
        self.client.cookies['access_token'] = access_token.value
        self.client.cookies['refresh_token'] = refresh_token.value

    def test_profile_view_get(self):
        self.login(username='testuser', password='testpassword')
        response = self.client.get(reverse('profile'))
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'profile.html')
        self.assertContains(response, 'testnick')

    def test_profile_view_post_nickname_update(self):
        self.login(username='testuser', password='testpassword')
        response = self.client.post(reverse('profile'), {'field': 'nick_name', 'value': 'newnick'})
        self.assertEqual(response.status_code, 200)
        self.user.refresh_from_db()
        self.assertEqual(self.user.nick_name, 'newnick')

    def test_profile_view_post_nickname_update_more_than_10_chars(self):
        self.login(username='testuser', password='testpassword')
        response = self.client.post(reverse('profile'), {'field': 'nick_name', 'value': 'updatednick'})
        self.assertEqual(response.status_code, 400)
        self.user.refresh_from_db()
        json_response = response.json()
        self.assertEqual(json_response['success'], False)
        self.assertEqual(json_response['error'], 'Ensure this value has at most 10 characters (it has 11).')

    def test_profile_view_post_invalid_nickname(self):
        self.login(username='testuser', password='testpassword')
        response = self.client.post(reverse('profile'), {'field': 'nick_name', 'value': ''})
        self.assertEqual(response.status_code, 400)
        self.user.refresh_from_db()
        json_response = response.json()
        self.assertEqual(json_response['success'], False)
        self.assertEqual(json_response['error'], 'Nickname cannot be empty.')

    def test_profile_view_post_email_update(self):
        self.login(username='testuser', password='testpassword')
        response = self.client.post(
            reverse('profile'),
            {'email' : 'testing@test.com',
             'name' : 'testuser',
             'nick_name' : 'testnick'}
        )
        self.assertEqual(response.status_code, 200)
        self.user.refresh_from_db()
        self.assertEqual(self.user.username, 'testuser')
        self.assertEqual(self.user.email, 'testing@test.com')

    def test_enable_2fa_view(self):
        self.login(username='testuser', password='testpassword')
        response = self.client.post(reverse('enable-2fa'))
        self.user.refresh_from_db()
        self.assertEqual(response.status_code, 200)
        self.assertJSONEqual(response.content, {'message': 'Two-factor authentication enabled.', 'twofa': True})

    def test_change_password_view_post(self):
        self.login(username='testuser', password='testpassword')
        response = self.client.post(reverse('change-password'), {
            'old_password': 'testpassword',
            'new_password1': 'newsecurepassword',
            'new_password2': 'newsecurepassword'
        })
        self.assertEqual(response.status_code, 200)
        messages = [m.message for m in get_messages(response.wsgi_request)]
        self.assertIn('Password changed successfully.', messages)

    def test_games_history_view(self):
        self.login(username='testuser', password='testpassword')
        PongGame.objects.create(player1=self.user, player2=None)
        response = self.client.get(reverse('games-history'))
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'games-history.html')
