from django.urls import re_path
from pong.consumers import PongRoomConsumer, PongGameConsumer


websocket_urlpatterns = [
    re_path(r'ws/pong_room/(?P<room_id>\w+)/$', PongRoomConsumer.as_asgi()),
    re_path(r'ws/pong_game/(?P<game_id>\w+)/$', PongGameConsumer.as_asgi()),
]