from django.contrib.auth.tokens import default_token_generator
from django.contrib.sites.shortcuts import get_current_site
from django.template.loader import render_to_string
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils.encoding import force_bytes, force_str
from django.core.mail import send_mail
from django.conf import settings
from django.contrib.auth import authenticate, logout as django_logout
from django.shortcuts import render, redirect
from .forms import CustomUserCreationForm, LoginForm, ForgotPasswordForm, ResetPasswordForm, OTPForm, TWOFAForm
from django.contrib import messages
from .models import User
from .utils import generate_otp
from rest_framework.decorators import api_view, permission_classes
from .decorators import IsAuthenticatedWithCookie
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework import status
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
import requests

@api_view(['GET', 'POST'])
@permission_classes([AllowAny])
def register(request):
    if request.method == 'POST':
        form = CustomUserCreationForm(request.POST)
        if form.is_valid():
            form.save()
            messages.success(request, 'Registration successful. You can now log in.')
            return redirect('login')
        else:
            return render(request, 'register.html', {'form': form})
    else:
        form = CustomUserCreationForm()
    response = render(request, 'register.html', {'form': form})
    if 'access_token' in request.COOKIES:
        response.delete_cookie('access_token')
        response.delete_cookie('refresh_token')
    return response

@api_view(['GET', 'POST'])
@permission_classes([AllowAny])
def login_view(request):
    if request.method == 'POST':
        form = LoginForm(request.POST)
        if form.is_valid():
            username = form.cleaned_data['username']
            password = form.cleaned_data['password']
            user = User.objects.filter(username=username).first()
            if user is not None and user.password is None:
                messages.error(request, 'Invalid username or password.')
                return render(request, 'login.html', {'form': form})
            user = authenticate(request, username=username, password=password)
            if user is not None:
                # Issue JWT tokens
                refresh = RefreshToken.for_user(user)
                access_token = str(refresh.access_token)
                refresh_token = str(refresh)
                # Optionally set tokens in cookies
                response = redirect('index')
                response.set_cookie('access_token', access_token, httponly=True, samesite='Lax', max_age=int(settings.SIMPLE_JWT.get('ACCESS_TOKEN_LIFETIME').total_seconds()))
                response.set_cookie('refresh_token', refresh_token, httponly=True, samesite='Lax', max_age=int(settings.SIMPLE_JWT.get('REFRESH_TOKEN_LIFETIME').total_seconds()))
                return response
            else:
                messages.error(request, 'Invalid username or password.')
        else:
            messages.error(request, 'Invalid form submission.')

    form = LoginForm()
    FT_CLIENT_ID = settings.FT_CLIENT_ID
    FT_REDIRECT_URI = settings.FT_REDIRECT_URI
    context = {
        'form': form,
        'ft_client_id': FT_CLIENT_ID,
        'ft_redirect_uri': FT_REDIRECT_URI,
    }
    response = render(request, 'login.html', context)
    if 'access_token' in request.COOKIES:
        response.delete_cookie('access_token')
        response.delete_cookie('refresh_token')
    return response

@api_view(['GET'])
@permission_classes([IsAuthenticatedWithCookie])
def index(request):
    access_token = request.COOKIES.get('access_token')
    refresh_token = request.COOKIES.get('refresh_token')
    return render(request, 'index.html', {'user': request.user, 'access_token': access_token, 'refresh_token': refresh_token})

@api_view(['GET'])
@permission_classes([IsAuthenticatedWithCookie])
def logout_view(request):
    try:
        # Retrieve the refresh token from cookies
        refresh_token = request.COOKIES.get('refresh_token')
        
        if refresh_token:
            # Blacklist the refresh token
            token = RefreshToken(refresh_token)
            token.blacklist()

        # Perform Django logout to clear session data
        django_logout(request)

        # Create a response and delete the tokens
        response = redirect('login')
        response.delete_cookie('access_token')
        response.delete_cookie('refresh_token')
        
        return response

    except Exception as e:
        return Response({"error": "Logout failed. Please try again."}, status=status.HTTP_400_BAD_REQUEST)

@api_view(['GET', 'POST'])
@permission_classes([AllowAny])
def forgot_password(request):
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
                return render(request, 'password-reset-confirm.html', {'form': form, 'uid': uid, 'token': token})
            else:
                messages.error(request, 'Invalid token.')
                return render(request, 'password-reset-confirm.html', {'form': form, 'uid': uid, 'token': token, 'messages': messages})
        except (TypeError, ValueError, OverflowError, User.DoesNotExist):
            messages.error(request, 'Invalid password reset link')
            return render(request, 'password-reset-confirm.html', {'form': form, 'uid': uid, 'token': token, 'messages': messages})
    if request.method == 'POST':
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
                    subject = render_to_string('password-reset-subject.txt', {'site_name': site_name})
                    message = render_to_string('password-reset-email.html', {
                        'user': user,
                        'protocol': protocol,
                        'domain': domain,
                        'uid': uid,
                        'token': token,
                    })
                    send_mail(subject, message, settings.DEFAULT_FROM_EMAIL, [user.email])
            else:
                messages.error(request, 'No user with this email address.')

            return render(request, 'password-reset-done.html')
    else:
        form = ForgotPasswordForm()
    return render(request, 'forgot-password.html', {'form': form})

@api_view(['GET', 'POST'])
@permission_classes([AllowAny])
def reset_password(request, uidb64, token):
    try:
        uid = force_str(urlsafe_base64_decode(uidb64))
        user = User.objects.get(pk=uid)
    except (TypeError, ValueError, OverflowError, User.DoesNotExist):
        user = None

    if user is not None and default_token_generator.check_token(user, token):
        if request.method == 'POST':
            form = ResetPasswordForm(user, request.POST)
            if form.is_valid():
                form.save()
                messages.success(request, 'Password has been reset.')
                return redirect('login')
        else:
            form = ResetPasswordForm(user)
        return render(request, 'password-reset-confirm.html', {'form': form, 'uid': uidb64, 'token': token})
    else:
        messages.error(request, 'Invalid password reset link.')
        return render(request, 'password-reset-confirm.html', {'form': form, 'uid': uidb64, 'token': token})

@api_view(['GET', 'POST'])
@permission_classes([AllowAny])
def otp(request):
    access_token = request.COOKIES.get('access_token')
    refresh_token = request.COOKIES.get('refresh_token')
    if request.method == 'POST':
        if 'otp' in request.POST:
            form = OTPForm(request.POST)
            if form.is_valid():
                otp = form.cleaned_data['otp']
                try:
                    user = User.objects.get(otp=otp)
                    user.otp = None
                    user.save()
                    refresh = RefreshToken.for_user(user)
                    access_token = str(refresh.access_token)
                    refresh_token = str(refresh)
                    response = render(request, 'index.html', {'user': user, 'access_token': access_token, 'refresh_token': refresh_token})
                    response.set_cookie('access_token', access_token, httponly=True, samesite='Lax', max_age=int(settings.SIMPLE_JWT.get('ACCESS_TOKEN_LIFETIME').total_seconds()))
                    response.set_cookie('refresh_token', refresh_token, httponly=True, samesite='Lax', max_age=int(settings.SIMPLE_JWT.get('REFRESH_TOKEN_LIFETIME').total_seconds()))
                    return response
                except User.DoesNotExist:
                    messages.error(request, 'Invalid OTP.')
            return render(request, 'login-2fa.html', {'form': form})
        elif 'email' in request.POST:
            form = TWOFAForm(request.POST)
            if form.is_valid():
                email = form.cleaned_data['email']
                try:
                    user = User.objects.get(email=email)
                    otp = generate_otp()
                    user.otp = otp
                    user.save()
                    subject = f'OTP from {get_current_site(request).name}'
                    message = render_to_string('user-2fa-email.html', {'user': user, 'otp': otp})
                    send_mail(subject, message, settings.DEFAULT_FROM_EMAIL, [user.email])
                    return render(request, 'login-2fa.html', {'form': OTPForm()})
                except User.DoesNotExist:
                    messages.error(request, 'Invalid email.')
            return render(request, 'login-2fa.html', {'form': form})
    else:
        form = TWOFAForm()
    return render(request, 'login-2fa.html', {'form': form})

def authenticate_api(request, access_token):
    user_info_url = 'https://api.intra.42.fr/v2/me'
    headers = {
        'Authorization': f'Bearer {access_token}',
    }
    response = requests.get(user_info_url, headers=headers)

    if response.status_code == 200:
        user_data = response.json()
        user, created = User.objects.get_or_create(username=user_data['login'], email=user_data['email'])
        return user
    return None


@api_view(['GET', 'POST'])
@permission_classes([AllowAny])
def oauth_callback(request):
    code = request.GET.get('code')
    state = request.GET.get('state')
    if code:
        token_url = 'https://api.intra.42.fr/oauth/token'
        payload = {
        'grant_type': 'authorization_code',
        'client_id': settings.FT_CLIENT_ID,
        'client_secret': settings.FT_CLIENT_SECRET,
        'code': code,
        'redirect_uri': settings.FT_REDIRECT_URI,
        'state': state,
        }
        response = requests.post(token_url, data=payload)
        if response.status_code == 200:
            data = response.json()
            access_token = data['access_token']
            user = authenticate_api(request, access_token=access_token)
            if user is not None:
                # Issue JWT tokens
                refresh = RefreshToken.for_user(user)
                access_token = str(refresh.access_token)
                refresh_token = str(refresh)
                # Optionally set tokens in cookies
                response = redirect('index')
                response.set_cookie('access_token', access_token, httponly=True, samesite='Lax', max_age=int(settings.SIMPLE_JWT.get('ACCESS_TOKEN_LIFETIME').total_seconds()))
                response.set_cookie('refresh_token', refresh_token, httponly=True, samesite='Lax', max_age=int(settings.SIMPLE_JWT.get('REFRESH_TOKEN_LIFETIME').total_seconds()))
                return response
            else:
                messages.error(request, 'Invalid access token.')
                render(request, 'login.html', {'form': LoginForm()})
        else:
            messages.error(request, 'Invalid code.')
            render(request, 'login.html', {'form': LoginForm()})
    else:
        messages.error(request, 'Invalid code.')
    return render(request, 'login.html', {'form': LoginForm()})

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticatedWithCookie])
def set_password(request):
    access_token = request.COOKIES.get('access_token')
    refresh_token = request.COOKIES.get('refresh_token')
    if request.method == 'POST':
        form = ResetPasswordForm(request.user, request.POST)
        if form.is_valid():
            form.save()
            messages.success(request, 'Password has been set.')
            return render(request, 'set-password.html', {'form': form, 'access_token': access_token, 'refresh_token': refresh_token})
        else:
            messages.error(request, 'Invalid form submission.')
            return render(request, 'set-password.html', {'form': form, 'access_token': access_token, 'refresh_token': refresh_token})
    else:
        form = ResetPasswordForm(request.user)
    return render(request, 'set-password.html', {'form': form, 'access_token': access_token, 'refresh_token': refresh_token})