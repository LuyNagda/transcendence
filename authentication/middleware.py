from django.http import HttpResponseForbidden

class HTMXMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Allow only htmx requests for specific paths
        restricted_paths = ['/login/', '/register/', '/manage_roles/', '/admin/', '/user/']
        if request.path in restricted_paths and not request.htmx:
            return HttpResponseForbidden("Direct access not allowed")
        return self.get_response(request)