from django.urls import path
from . import views

urlpatterns = [
    path('get-ai/', views.send_ai_to_front, name='send_ai'),
    path('get-ai/<str:ai_name>/', views.send_ai_to_front, name='send_ai_with_name'),
    path('train/<str:ai_name>', views.training, name='training'),
    path('list-saved-ai', views.list_saved_ai, name='list_saved_ai'),
    path('delete-saved-ai/<str:ai_name>', views.delete_saved_ai, name='delete_saved_ai'),
]