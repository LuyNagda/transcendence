from django.http import HttpResponseRedirect, HttpResponseNotFound, Http404

def htmx_required(view_func):
    def _wrapped_view(request, *args, **kwargs):
        if not request.htmx:
            raise Http404
        return view_func(request, *args, **kwargs)
    return _wrapped_view
