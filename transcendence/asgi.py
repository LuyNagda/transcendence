"""
ASGI config for transcendence project.

It exposes the ASGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/5.0/howto/deployment/asgi/
"""

import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'transcendence.settings')
django.setup()

from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter
from authentication.middleware import JWTAuthMiddleware, WebSocketNotFoundMiddleware
import chat.routing
import pong.routing
import ai.routing

application = ProtocolTypeRouter({
    "http": get_asgi_application(),
    "websocket": WebSocketNotFoundMiddleware(JWTAuthMiddleware(
        URLRouter(
            chat.routing.websocket_urlpatterns +  
            pong.routing.websocket_urlpatterns +
			ai.routing.websocket_urlpatterns
        )
    )),
})
