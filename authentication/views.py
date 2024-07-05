from django.contrib.auth.tokens import default_token_generator
from django.contrib.sites.shortcuts import get_current_site
from django.template.loader import render_to_string
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils.encoding import force_bytes, force_str
from django.core.mail import send_mail
from django.conf import settings
from django.contrib.auth.decorators import login_required
from django.contrib.auth import authenticate, login, logout
from django.shortcuts import render, redirect
from .forms import CustomUserCreationForm, LoginForm, ForgotPasswordForm, ResetPasswordForm
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
    uid = request.GET.get('uid')
    token = request.GET.get('token')
    if uid and token:
        # Handle password reset logic
        try:
            pk_uid = force_str(urlsafe_base64_decode(uid))
            user = User.objects.get(pk=pk_uid)
            if default_token_generator.check_token(user, token):
                if request.method == 'POST':
                    form = ResetPasswordForm(user, request.POST)
                    if form.is_valid():
                        form.save()
                        return render(request, 'login.html', {'form': LoginForm()})
                else:
                    form = ResetPasswordForm(user)
                return render(request, 'password_reset_confirm.html', {'form': form, 'uid': uid, 'token': token})
            else:
                messages.error(request, 'Invalid token.')
                return render(request, 'password_reset_confirm.html', {'form': form, 'uid': uid, 'token': token, 'messages': messages})
        except (TypeError, ValueError, OverflowError, User.DoesNotExist):
            messages.error(request, 'Invalid password reset link')
            return render(request, 'password_reset_confirm.html', {'form': form, 'uid': uid, 'token': token, 'messages': messages})

    # Handle registration logic
    if request.user.is_authenticated:
        return render(request, 'index.html')
    if request.method == 'POST':
        form = CustomUserCreationForm(request.POST)
        if form.is_valid():
            form.save()
            messages.success(request, 'Registration successful. You can now log in.')
            return redirect('login')
    else:
        form = CustomUserCreationForm()

    return render(request, 'register.html', {'form': form})

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

@htmx_required 
def forgot_password(request):
    if request.method == 'POST':
        if 'email' in request.POST:
            # Handle email submission
            form = ForgotPasswordForm(request.POST)
            if form.is_valid():
                email = form.cleaned_data['email']
                users = User.objects.filter(email=email)
                if users.exists():
                    for user in users:
                        token = default_token_generator.make_token(user)
                        uid = urlsafe_base64_encode(force_bytes(user.pk))
                        site_name = get_current_site(request).name
                        domain = 'localhost:8000'
                        protocol = 'http'
                        reset_url = f"{protocol}://{domain}/?uid={uid}&token={token}"
                        subject = render_to_string('password_reset_subject.txt', {'site_name': site_name})
                        message = render_to_string('password_reset_email.html', {
                            'user': user,
                            'protocol': protocol,
                            'domain': domain,
                            'uid': uid,
                            'token': token,
                        })
                        send_mail(subject, message, settings.DEFAULT_FROM_EMAIL, [user.email])
                return render(request, 'password_reset_done.html')
        elif 'new_password1' in request.POST and 'new_password2' in request.POST:
            # Handle password reset form submission
            uidb64 = request.POST.get('uid')
            token = request.POST.get('token')
            uid = force_str(urlsafe_base64_decode(uidb64))
            user = User.objects.get(pk=uid)
            form = ResetPasswordForm(user, request.POST)
            if form.is_valid():
                form.save()
                return redirect('password_reset_complete')

    # Render initial form or confirmation message
    uid = request.GET.get('uid')
    token = request.GET.get('token')
    if uid and token:
        try:
            uid = force_str(urlsafe_base64_decode(uid))
            user = User.objects.get(pk=uid)
            if default_token_generator.check_token(user, token):
                form = ResetPasswordForm(user)
                return render(request, 'password_reset_confirm.html', {'form': form, 'uid': uid, 'token': token})
        except (TypeError, ValueError, OverflowError, User.DoesNotExist):
            messages.error(request, 'Invalid password reset link')
            return redirect('password_reset')
    else:
        form = ForgotPasswordForm()
    
    return render(request, 'forgot_password.html', {'form': form})
