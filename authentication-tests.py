from django.test import TestCase, Client
from django.urls import reverse
from authentication.models import User

class AuthViewsTest(TestCase):
    def setUp(self):
        self.client = Client()
        self.user = User.objects.create_user(username='testuser', password='testpassword')

    def login(self, username, password):
        """Helper function to log in a user and set authentication cookies."""
        response = self.client.post('/login', {'username': username, 'password': password})
        self.assertEqual(response.status_code, 302)

        # Extract JWT tokens from cookies
        access_token = response.cookies.get('access_token')
        refresh_token = response.cookies.get('refresh_token')

        self.assertIsNotNone(access_token, "Access token should be set in cookies")
        self.assertIsNotNone(refresh_token, "Refresh token should be set in cookies")

        # Set authentication cookies for subsequent requests
        self.client.cookies['access_token'] = access_token.value
        self.client.cookies['refresh_token'] = refresh_token.value

    def test_register_view_valid(self):
        response = self.client.post(reverse('register'), {'username': 'newuser', 'password1': 'u3rVi[t6s1.=', 'password2': 'u3rVi[t6s1.=',
                                                          'email': 'newuser@test.com', 'nick_name': 'newnick'})
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Registration successful.", status_code=200)
        self.assertTrue(User.objects.filter(username='newuser').exists(), "User should be created in the database")

    def test_register_view_invalid_username(self):
        response = self.client.post(reverse('register'), {'username': 'newuser_42', 'password1': 'u3rVi[t6s1.=', 'password2': 'u3rVi[t6s1.=',
                                                          'email': 'newuser@test.com', 'nick_name': 'newnick'})
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Username cannot have any symbols.", status_code=200)

    def test_register_view_invalid_email(self):
        response = self.client.post(reverse('register'), {'username': 'newuser', 'password1': 'u3rVi[t6s1.=', 'password2': 'u3rVi[t6s1.=',
                                                          'email': 'newuser@student.42lyon.fr', 'nick_name': 'newnick'})
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Please login using the API", status_code=200)

    def test_register_view_mismatch_pass(self):
        response = self.client.post(reverse('register'), {'username': 'newuser', 'password1': 'u3rVi[t6s1.=', 'password2': 'test123123',
                                                          'email': 'newuser@test.com', 'nick_name': 'newnick'})
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Passwords don&#x27;t match", status_code=200)

    def test_register_view_easy_pass(self):
        response = self.client.post(reverse('register'), {'username': 'newuser', 'password1': 'newpassword', 'password2': 'newpassword',
                                                          'email': 'newuser@test.com', 'nick_name': 'newnick'})
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "password is too common", status_code=200)

    def test_register_view_half_filled(self):
        response = self.client.post(reverse('register'), {'username': 'newuser', 'password1': 'newpassword'})
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "field is required", status_code=200)

    def test_login_view_valid(self):
        response = self.client.post(reverse('login'), {'username': 'testuser', 'password': 'testpassword'})
        self.assertEqual(response.status_code, 302)
        self.assertRedirects(response, reverse('index'))

    def test_login_view_invalid(self):
        response = self.client.post(reverse('login'), {'username': 'testuser', 'password': 'wrongpassword'})
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Invalid username or password", status_code=200)

    def test_logout_view(self):
        self.login(username='testuser', password='testpassword')
        response = self.client.get(reverse('logout'))
        self.assertEqual(response.status_code, 302)  # Redirect expected

    def test_profile_view(self):
        self.login(username='testuser', password='testpassword')
        response = self.client.get(reverse('profile'))
        self.assertEqual(response.status_code, 200)

    def test_forgot_password_view(self):
        response = self.client.post(reverse('forgot-password'), {'email': 'testuser@example.com'})
        self.assertEqual(response.status_code, 200)

    def test_set_password_view(self):
        self.login(username='testuser', password='testpassword')
        response = self.client.post(reverse('set-password'), {'new_password': 'newpassword'})
        self.assertEqual(response.status_code, 200)

    def test_change_password_view(self):
        self.login(username='testuser', password='testpassword')
        response = self.client.post(reverse('change-password'), {'old_password': 'testpassword', 'new_password': 'newpassword'})
        self.assertEqual(response.status_code, 200)

    def test_enable_2fa_view(self):
        self.login(username='testuser', password='testpassword')
        response = self.client.post(reverse('enable-2fa'))
        self.assertEqual(response.status_code, 200)

    def test_otp_verification_view(self):
        response = self.client.post(reverse('login-2fa'), {'otp': '123456'})
        self.assertEqual(response.status_code, 200)

    def test_games_history_view(self):
        self.login(username='testuser', password='testpassword')
        response = self.client.get(reverse('games-history'))
        self.assertEqual(response.status_code, 200)

    def test_check_user_view(self):
        response = self.client.get(reverse('check-user'), {'username': 'testuser'})
        self.assertEqual(response.status_code, 200)
        json_response = response.json()
        self.assertEqual(json_response['id'], None)
        self.assertEqual(json_response['isAuthenticated'], False)

    def test_check_user_view_logged_in(self):
        self.login(username='testuser', password='testpassword')
        response = self.client.get(reverse('check-user'), {'username': 'testuser'})
        self.assertEqual(response.status_code, 200)
        json_response = response.json()
        self.assertEqual(json_response['id'], self.user.id)
        self.assertEqual(json_response['isAuthenticated'], True)