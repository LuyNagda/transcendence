"""
URL configuration for transcendence project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.0/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, register_converter, include
from django.contrib.auth import views as auth_views
from authentication.views import register, login_view, index, logout_view, forgot_password, otp, oauth_callback, set_password
from home.views import profile, settings_view, change_password
from django.conf.urls.static import static
from django.conf import settings
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)
from django.views.static import serve
"""
Place holder before consultation with mates
"""
from ai.ai import send_ai_to_front

class UIDTokenConverter:
    regex = '[^/]+'

    def to_python(self, value):
        return value

    def to_url(self, value):
        return value
    
register_converter(UIDTokenConverter, 'uid_token')

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', register, name='register'),
    path('login', login_view, name='login'),
    path('login-2fa', otp, name='login-2fa'),
    path('logout', logout_view, name='logout'),
    path('profile', profile, name='profile'),
    path('index', index, name='index'),
    path('forgot-password', forgot_password, name='forgot-password'),
    path('settings', settings_view, name='settings'),
    path('change-password', change_password, name='change-password'),
    path('chat/', include('chat.urls')),
    path('users/', include('users.urls')),
    path('pong/', include('pong.urls')),
    path('set-password', set_password, name='set-password'),
    path('callback', oauth_callback, name='callback'),
    path('api/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('ai/', include('ai.urls')),
    path('static/<path:path>', serve, {'document_root': settings.STATIC_ROOT, 'show_indexes': settings.DEBUG}),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT) \
  + static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)