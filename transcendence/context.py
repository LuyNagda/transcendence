from django.conf import settings
import logging

logger = logging.getLogger(__name__)

def global_context(request):
    return {
        # Core settings
        'config': {
            'debug': getattr(settings, 'DEBUG', False),
            'logLevel': getattr(settings, 'LOG_LEVEL', 'DEBUG'),
            
            # Add other global configs here
            'api': {
                'baseUrl': getattr(settings, 'API_BASE_URL', ''),
                'timeout': getattr(settings, 'API_TIMEOUT', 5000),
            },
            
            'game': {
                'physicsWebSocketTransport': getattr(settings, 'PONG_TRANSPORT_WS', False),
            },
        }
    }