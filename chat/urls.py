from django.urls import path
from . import views

urlpatterns = [
    path('', views.chat_view, name='chat'),
    path('history/<int:recipient_id>/', views.message_history, name='message_history'),
]