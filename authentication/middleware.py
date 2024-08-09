from django.shortcuts import redirect
from django.conf import settings
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError

class RedirectOn401Middleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
    
        if response.status_code == 401:
            refresh_token = request.COOKIES.get('refresh_token')
            if refresh_token:
                try:
                    # Attempt to refresh the access token
                    refresh = RefreshToken(refresh_token)
                    new_refresh_token = str(refresh)
                    new_access_token = str(refresh.access_token)
                    
                    # Create a new response to update the access token cookie
                    response = redirect(request.get_full_path())
                    response.set_cookie(
                        'access_token',
                        new_access_token,
                        httponly=True,
                        samesite='Lax',
                        max_age=int(settings.SIMPLE_JWT.get('ACCESS_TOKEN_LIFETIME').total_seconds())
                    )
                    response.set_cookie(
                        'refresh_token',
                        new_refresh_token,
                        httponly=True,
                        samesite='Lax',
                        max_age=int(settings.SIMPLE_JWT.get('REFRESH_TOKEN_LIFETIME').total_seconds())
                    )

                except TokenError:
                    # If the refresh token is invalid, redirect to login
                    response = redirect(settings.LOGIN_URL)
                    response.delete_cookie('access_token')
                    response.delete_cookie('refresh_token')
            else:
                # If there's no refresh token, redirect to login
                response = redirect(settings.LOGIN_URL)
                response.delete_cookie('access_token')
                response.delete_cookie('refresh_token')
        
        return response
