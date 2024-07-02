from django.contrib.auth.decorators import login_required
from django.contrib.auth import authenticate, login, logout
from django.shortcuts import render, redirect
from .forms import CustomUserCreationForm, LoginForm
from django.http import HttpResponse
from django.contrib import messages

def register(request):
    if request.method == 'POST':
        form = CustomUserCreationForm(request.POST)
        if form.is_valid():
            form.save()
            return login(request)
    else:
        form = CustomUserCreationForm()

    context = {'form': form}
    return render(request, 'register.html', context)
def login_view(request):
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
                return redirect('index')
            else:
                messages.error(request, 'Invalid username or password.')
    else:
        form = LoginForm()

    context = {'form': form}
    return render(request, 'login.html', context)

@login_required
def index(request):
    return render(request, 'index.html')

@login_required
def logout_view(request):
    logout(request)
    return redirect('login')