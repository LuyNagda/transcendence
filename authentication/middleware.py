from django.shortcuts import redirect
from django.conf import settings

class RedirectOn401Middleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        
        # Redirect to login page if status code is 401
        if response.status_code == 401:
            response = redirect(settings.LOGIN_URL)
            response.delete_cookie('access_token')
            response.delete_cookie('refresh_token')
            return response
        
        return response
