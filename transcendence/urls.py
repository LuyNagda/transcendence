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
from django.urls import path, register_converter
from django.contrib.auth import views as auth_views
from authentication.views import register, login_view, index, logout_view, forgot_password
from home.views import profile, settings, change_password

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
    path('logout', logout_view, name='logout'),
    path('profile', profile, name='profile'),
    path('index', index, name='index'),
    path('forgot-password', forgot_password, name='forgot-password'),
    path('settings', settings, name='settings'),
    path('change-password', change_password, name='change-password'),
]
