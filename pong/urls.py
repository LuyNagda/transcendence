from django.urls import path
from . import views

urlpatterns = [
    path('', views.pong_view, name='pong_view'),
    path('history/', views.game_history, name='game_history'),
    path('create-room/', views.create_pong_room, name='create_pong_room'),
    path('room/<str:room_id>/', views.pong_room_view, name='pong_room'),
    path('room/<str:room_id>/invite-friend/', views.invite_friend, name='invite_friend'),
    path('room/<str:room_id>/invite-friends/', views.invite_friends, name='invite_friends'),
    path('room/<str:room_id>/start-ai-game/', views.start_ai_game, name='start_ai_game'),
    path('game/<int:game_id>/update/', views.update_pong_game_state, name='update_pong_game_state'),
    path('game/<int:game_id>/', views.pong_game, name='pong_game'),
]