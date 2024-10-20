from django.urls import re_path
from pong.consumers import PongRoomConsumer

websocket_urlpatterns = [
    re_path(r'ws/pong_room/(?P<room_id>\w+)/$', PongRoomConsumer.as_asgi()),
]