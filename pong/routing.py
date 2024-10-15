from django.urls import path
from pong.consumers import PongRoomConsumer

websocket_urlpatterns = [
    path('ws/pong_room/<str:room_id>/', PongRoomConsumer.as_asgi()),
]