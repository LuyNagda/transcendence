from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status
import logging

logger = logging.getLogger(__name__)

def custom_exception_handler(exc, context):
    response = exception_handler(exc, context)

    if response is None:
        logger.error(f"Unhandled exception: {exc}", exc_info=True)
        return Response(
            {"error": "The request could not be processed. Probably because of malformed data."},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

    return response