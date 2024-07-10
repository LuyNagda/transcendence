from django.conf import settings
from django.shortcuts import redirect

def custom_login_required(view_func):
    def _wrapped_view_func(request, *args, **kwargs):
        if not request.user.is_authenticated:
            login_url = settings.LOGIN_URL
            return redirect(login_url)
        return view_func(request, *args, **kwargs)
    return _wrapped_view_func