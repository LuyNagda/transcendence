import logging
from django.contrib.auth.models import AnonymousUser
from django.contrib.auth import get_user_model
from django.db import close_old_connections
from django.shortcuts import redirect
from django.conf import settings
from rest_framework_simplejwt.tokens import RefreshToken, AccessToken
from rest_framework_simplejwt.exceptions import TokenError, InvalidToken
from asgiref.sync import sync_to_async
from channels.middleware import BaseMiddleware
from channels.exceptions import StopConsumer

log = logging.getLogger(__name__)

User = get_user_model()

class JWTAuthMiddleware:
    """
    Custom middleware that takes a JWT token from the cookies and authenticates via DRF's Simple JWT
    """

    def __init__(self, inner):
        self.inner = inner

    async def __call__(self, scope, receive, send):
        return await JWTAuthMiddlewareInstance(scope, self)(receive, send)

class JWTAuthMiddlewareInstance:
    def __init__(self, scope, middleware):
        self.scope = scope
        self.inner = middleware.inner

    async def __call__(self, receive, send):
        # Close old database connections to prevent usage of timed out connections
        close_old_connections()

        log.debug("Starting JWTAuthMiddlewareInstance.__call__")

        # Get the cookies from the scope's headers
        headers = dict(self.scope['headers'])
        cookies = {}
        if b'cookie' in headers:
            cookie_header = headers[b'cookie'].decode()
            log.debug(f"Cookie header: {cookie_header}")
            for cookie in cookie_header.split('; '):
                if '=' in cookie:
                    key, value = cookie.split('=', 1)
                    cookies[key] = value
        else:
            log.debug("No cookie header found")

        log.debug(f"Parsed cookies: {cookies}")

        # Try to authenticate the user using the access token from cookies
        access_token = cookies.get('access_token')
        if access_token:
            log.debug("Access token found in cookies")
            try:
                validated_token = AccessToken(access_token)
                user_id = validated_token['user_id']
                log.debug(f"Attempting to authenticate user with ID: {user_id}")
                try:
                    user = await sync_to_async(User.objects.get)(id=user_id)
                    self.scope['user'] = user
                    log.info(f"User {user.username} (ID: {user_id}) authenticated successfully")
                except User.DoesNotExist:
                    log.warning(f"User with ID {user_id} not found in database")
                    self.scope['user'] = AnonymousUser()
            except InvalidToken:
                log.error("Invalid access token provided")
                self.scope['user'] = AnonymousUser()
        else:
            log.debug("No access token found in cookies")
            self.scope['user'] = AnonymousUser()

        log.debug(f"Final user authentication status: {self.scope['user'].is_authenticated}")

        # Change this line
        return await self.inner(self.scope, receive, send)

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

class WebSocketNotFoundMiddleware(BaseMiddleware):
    async def __call__(self, scope, receive, send):
        if scope["type"] == "websocket":
            try:
                return await super().__call__(scope, receive, send)
            except ValueError as e:
                if str(e).startswith("No route found for path"):
                    log.warning(f"WebSocket route not found: {scope['path']}")
                    await send({
                        "type": "websocket.close",
                        "code": 4404,  # Custom close code for "Not Found"
                    })
                    raise StopConsumer()
                else:
                    raise  # Re-raise if it's a different ValueError
        else:
            return await super().__call__(scope, receive, send)