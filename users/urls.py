from django.urls import path
from . import views

urlpatterns = [
    path('', views.get_users, name='get_users'),
    path('<int:user_id>/', views.get_user, name='get_user'),
    path('update/', views.update_user, name='update_user'),
]