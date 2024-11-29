from django.urls import path
from . import views

urlpatterns = [
    path('get-ai/', views.send_ai_to_front, name='send_ai'),
    path('get-ai/<str:ai_level>/', views.send_ai_to_front, name='send_ai_with_level'),
]