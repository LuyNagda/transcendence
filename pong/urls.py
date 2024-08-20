from django.urls import path
from . import views

urlpatterns = [
    path('', views.pong_view, name='pong_view'),
    path('create/', views.create_pong_game, name='create_pong_game'),
    path('update/<int:game_id>/', views.update_pong_game_state, name='update_pong_game_state'),
    path('state/<int:game_id>/', views.get_pong_game_state, name='get_pong_game_state'),
    path('history/', views.game_history, name='game_history'),
]