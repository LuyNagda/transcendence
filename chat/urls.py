from django.urls import path
from . import views

urlpatterns = [
    # path('', views.chat_view, name='chat'),
    path('history/<int:recipient_id>/', views.message_history, name='message_history'),
    path('block/<int:user_id>/', views.block_user, name='block_user'),
    path('unblock/<int:user_id>/', views.unblock_user, name='unblock_user'),
    path('users/', views.get_users, name='get_users'),
    path('blacklist/', views.get_blocked_users, name='get_blocked_users'),
]