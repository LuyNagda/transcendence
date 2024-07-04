from django.contrib.auth.decorators import login_required
from django.contrib.auth import authenticate, login, logout
from django.shortcuts import render, redirect
from .forms import CustomUserCreationForm, LoginForm
from django.http import HttpResponse, HttpResponseRedirect, JsonResponse, Http404
from .decorators import htmx_required
from django.contrib import messages
from .models import User
from django.urls import reverse

def check_username(request):
    username = request.GET.get('username', None)
    data = {
        'is_taken': User.objects.filter(username=username).exists()
    }
    if (data['is_taken']):
        return JsonResponse(data)
    else:
        raise Http404

def register(request):
    if request.user.is_authenticated:
        return render(request, 'index.html')
    if request.method == 'POST':
        form = CustomUserCreationForm(request.POST)
        if form.is_valid():
            form.save()
            return render(request, 'login.html', {'form': LoginForm()})
    else:
        form = CustomUserCreationForm()

    context = {'form': form}
    return render(request, 'register.html', context)

@htmx_required
def login_view(request):
    if request.user.is_authenticated:
        return render(request, 'index.html')
    if request.method == 'POST':
        form = LoginForm(request.POST)
        if form.is_valid():
            username = form.cleaned_data['username']
            password = form.cleaned_data['password']
            user = authenticate(request, username=username, password=password)
            if user is not None:
                login(request, user)
                if not request.session.get('has_displayed_message'):
                    request.session['has_displayed_message'] = True
                return render(request, 'index.html')
            else:
                messages.error(request, 'Invalid username or password.')
    else:
        form = LoginForm()

    context = {'form': form}
    return render(request, 'login.html', context)

@login_required
@htmx_required
def index(request):
    return render(request, 'index.html')

@login_required
@htmx_required
def logout_view(request):
    logout(request)
    return HttpResponseRedirect(reverse('login'))