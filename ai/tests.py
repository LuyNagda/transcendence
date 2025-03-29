from django.test import TestCase, Client
from django.urls import reverse
from authentication.models import User
from django.contrib.auth.hashers import make_password
from unittest.mock import patch, mock_open, MagicMock
import json
from pathlib import Path


class SendAiToFrontTest(TestCase):
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

    @patch('builtins.open', mock_open(read_data=json.dumps([{"ai_name": "testAi"}])))
    @patch('django.conf.settings.STATICFILES_DIRS', ["/mock/static"])
    def test_send_ai_to_front_valid_ai(self):
        self.login(username='testuser', password='testpassword')
        # Mocking a valid AI file
        response = self.client.get(reverse('send_ai_with_name', kwargs={'ai_name': 'testAi'}))
        self.assertEqual(response.status_code, 200)
        self.assertJSONEqual(response.content, {"ai_name": "testAi"})


    def test_ai_manager_view_authenticated(self):
        """Test that authenticated users can access the AI manager view."""
        self.login(username='testuser', password='testpassword')
        response = self.client.get(reverse('ai-manager'))
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'ai-manager.html')

    def test_ai_manager_view_unauthenticated(self):
        """Test that unauthenticated users cannot access the AI manager view."""
        # Logout first
        self.client.logout()
        # Clear cookies
        self.client.cookies.clear()
        
        response = self.client.get(reverse('ai-manager'))
        self.assertNotEqual(response.status_code, 200)

    def test_ai_manager_view_no_cookies(self):
        """Test AI manager view with missing cookies."""
        # Login first
        self.login(username='testuser', password='testpassword')
        
        # Clear cookies after login
        self.client.cookies.clear()
        
        response = self.client.get(reverse('ai-manager'))
        self.assertEqual(response.status_code, 302)

    def test_ai_manager_context_data(self):
        """Test that the AI manager view contains the correct context data."""
        self.login(username='testuser', password='testpassword')
        response = self.client.get(reverse('ai-manager'))
        
        # Check that context contains necessary items
        self.assertEqual(response.context['user'], self.user)
        self.assertIsNotNone(response.context['access_token'])
        self.assertIsNotNone(response.context['refresh_token'])


    def test_training_view_insufficient_cpu(self):
        """Test training view with insufficient CPU."""
        self.login(username='testuser', password='testpassword')
        
        # Mocking the multiprocessing.cpu_count() to return an insufficient number
        with patch('multiprocessing.cpu_count', return_value=1):
            valid_data = {
                'ai_name': 'testAi',
                'nb_generation': 10,
                'nb_species': 50,
                'time_limit': 5,
                'max_score': 50
            }
            
            response = self.client.post(
                reverse('training_with_name'),
                data=json.dumps(valid_data),
                content_type='application/json'
            )
            self.assertEqual(response.status_code, 400)

    def test_training_view_empty_body(self):
        """Test training view with empty request body."""
        self.login(username='testuser', password='testpassword')
        
        response = self.client.post(
            reverse('training_with_name'),
            data='',
            content_type='application/json'
        )
        
        self.assertEqual(response.status_code, 400)

    def test_training_view_invalid_ai_name(self):
        """Test training view with invalid AI name."""
        self.login(username='testuser', password='testpassword')
        
        with patch('multiprocessing.cpu_count', return_value=4):
            # Test non-alphanumeric name
            invalid_data = {
                'ai_name': 'Test AI!',
                'nb_generation': 10,
                'nb_species': 50,
                'time_limit': 5,
                'max_score': 50
            }
            
            response = self.client.post(
                reverse('training_with_name'),
                data=json.dumps(invalid_data),
                content_type='application/json'
            )
            
            self.assertEqual(response.status_code, 400)

    def test_training_view_restricted_name(self):
        """Test training view with restricted name 'Marvin'."""
        self.login(username='testuser', password='testpassword')
        
        with patch('multiprocessing.cpu_count', return_value=4):
            restricted_data = {
                'ai_name': 'Marvin',
                'nb_generation': 10,
                'nb_species': 50,
                'time_limit': 5,
                'max_score': 50
            }
            
            response = self.client.post(
                reverse('training_with_name'),
                data=json.dumps(restricted_data),
                content_type='application/json'
            )
            
            self.assertEqual(response.status_code, 403)

    def test_training_view_invalid_parameters(self):
        """Test training view with invalid parameters."""
        self.login(username='testuser', password='testpassword')
        
        with patch('multiprocessing.cpu_count', return_value=4):
            # Test with out-of-range generation value
            with patch('ai.views.MIN_GENERATIONS', 1), \
                patch('ai.views.MAX_GENERATIONS', 100):
                
                invalid_data = {
                    'ai_name': 'testAi',
                    'nb_generation': 101,  # Beyond max
                    'nb_species': 50,
                    'time_limit': 5,
                    'max_score': 50
                }
                
                response = self.client.post(
                    reverse('training_with_name'),
                    data=json.dumps(invalid_data),
                    content_type='application/json'
                )
                
                self.assertEqual(response.status_code, 400)
            
            with patch('ai.views.MIN_GENERATIONS', 1), \
                patch('ai.views.MAX_GENERATIONS', 100):
                
                invalid_data = {
                    'ai_name': 'testAi',
                    'nb_generation': 0,  # Beyond min
                    'nb_species': 50,
                    'time_limit': 5,
                    'max_score': 50
                }
                
                response = self.client.post(
                    reverse('training_with_name'),
                    data=json.dumps(invalid_data),
                    content_type='application/json'
                )
                
                self.assertEqual(response.status_code, 400)

            with patch('ai.views.MIN_SPECIES', 50), \
                patch('ai.views.MAX_SPECIES', 100):
                
                invalid_data = {
                    'ai_name': 'testAi',
                    'nb_generation': 1,
                    'nb_species': 101,  # Beyond max
                    'time_limit': 5,
                    'max_score': 50
                }
                
                response = self.client.post(
                    reverse('training_with_name'),
                    data=json.dumps(invalid_data),
                    content_type='application/json'
                )
                
                self.assertEqual(response.status_code, 400)
            
            with patch('ai.views.MIN_SPECIES', 50), \
                patch('ai.views.MAX_SPECIES', 100):
                
                invalid_data = {
                    'ai_name': 'testAi',
                    'nb_generation': 1,
                    'nb_species': 49,  # Beyond min
                    'time_limit': 5,
                    'max_score': 50
                }
                
                response = self.client.post(
                    reverse('training_with_name'),
                    data=json.dumps(invalid_data),
                    content_type='application/json'
                )
                
                self.assertEqual(response.status_code, 400)

            with patch('ai.views.MIN_TIME_LIMIT', 5), \
                patch('ai.views.MAX_TIME_LIMIT', 60):
                
                invalid_data = {
                    'ai_name': 'testAi',
                    'nb_generation': 1,
                    'nb_species': 50,
                    'time_limit': 61,  # Beyond max
                    'max_score': 50
                }
                
                response = self.client.post(
                    reverse('training_with_name'),
                    data=json.dumps(invalid_data),
                    content_type='application/json'
                )
                
                self.assertEqual(response.status_code, 400)
            
            with patch('ai.views.MIN_TIME_LIMIT', 5), \
                patch('ai.views.MAX_TIME_LIMIT', 60):
                
                invalid_data = {
                    'ai_name': 'testAi',
                    'nb_generation': 1,
                    'nb_species': 50,
                    'time_limit': 4,  # Beyond min
                    'max_score': 50
                }
                
                response = self.client.post(
                    reverse('training_with_name'),
                    data=json.dumps(invalid_data),
                    content_type='application/json'
                )
                
                self.assertEqual(response.status_code, 400)

            with patch('ai.views.MIN_MAX_SCORE', 50), \
                patch('ai.views.MAX_MAX_SCORE', 500):
                
                invalid_data = {
                    'ai_name': 'testAi',
                    'nb_generation': 1,
                    'nb_species': 50,
                    'time_limit': 60,
                    'max_score': 501  # Beyond max
                }
                
                response = self.client.post(
                    reverse('training_with_name'),
                    data=json.dumps(invalid_data),
                    content_type='application/json'
                )
                
                self.assertEqual(response.status_code, 400)
            
            with patch('ai.views.MIN_MAX_SCORE', 50), \
                patch('ai.views.MAX_MAX_SCORE', 500):
                
                invalid_data = {
                    'ai_name': 'testAi',
                    'nb_generation': 1,
                    'nb_species': 50,
                    'time_limit': 5,
                    'max_score': 49  # Beyond min
                }
                
                response = self.client.post(
                    reverse('training_with_name'),
                    data=json.dumps(invalid_data),
                    content_type='application/json'
                )
                
                self.assertEqual(response.status_code, 400)

    def test_training_already_in_progress(self):
        """Test training view when another training is already in progress."""
        self.login(username='testuser', password='testpassword')
        
        with patch('multiprocessing.cpu_count', return_value=4), \
            patch('ai.views.IN_TRAINING', True):
            
            valid_data = {
                'ai_name': 'testAi',
                'nb_generation': 1,
                'nb_species': 50,
                'time_limit': 5,
                'max_score': 50
            }
            
            response = self.client.post(
                reverse('training_with_name'),
                data=json.dumps(valid_data),
                content_type='application/json'
            )
            
            self.assertEqual(response.status_code, 400)

class ListSavedAiTest(TestCase):
    def setUp(self):
        """Setup test user and API client."""
        self.client = Client()
        self.user = User.objects.create_user(username="testuser", password="testpassword")
        self.client.login(username="testuser", password="testpassword")
        self.url = reverse("list_saved_ai")

    def login(self, username, password):
        response = self.client.post('/login', {'username': username, 'password': password})
        self.assertEqual(response.status_code, 302)
        access_token = response.cookies.get('access_token')
        refresh_token = response.cookies.get('refresh_token')
        self.assertIsNotNone(access_token)
        self.assertIsNotNone(refresh_token)
        self.client.cookies['access_token'] = access_token.value
        self.client.cookies['refresh_token'] = refresh_token.value

    @patch("os.path.exists", return_value=False)
    def test_list_saved_ai_folder_not_exist(self, mock_exists):
        """Test when the saved_ai folder does not exist."""
        self.login(username='testuser', password='testpassword')

        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 404)

    @patch("os.path.exists", return_value=True)
    @patch("os.listdir", side_effect=Exception("Unexpected error"))
    def test_list_saved_ai_internal_error(self, mock_listdir, mock_exists):
        """Test when an internal error occurs."""
        self.login(username='testuser', password='testpassword')

        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 500)

    def test_list_saved_ai_unauthenticated(self):
        """Test accessing the endpoint without authentication."""
        self.login(username='testuser', password='testpassword')

        self.client.logout()
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 302)
