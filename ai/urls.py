from django.urls import path
from . import views

urlpatterns = [
    path('get-ai/', views.send_ai_to_front, name='send_ai'),
]