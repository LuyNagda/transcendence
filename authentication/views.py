from django.contrib.auth.tokens import default_token_generator
from django.middleware.csrf import get_token, rotate_token
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
from django.contrib.auth import get_user_model
import requests
import logging
from rest_framework_simplejwt.authentication import JWTAuthentication
from django.contrib.auth import login
from django.http import JsonResponse

logger = logging.getLogger(__name__)
User = get_user_model()

def already_logged_in(request):
	try:
		access_token = request.COOKIES.get('access_token')
		refresh_token = request.COOKIES.get('refresh_token')
		jwt_auth = JWTAuthentication()
		validated_token = jwt_auth.get_validated_token(access_token)
		user = jwt_auth.get_user(validated_token)
	except:
		return None

	users = User.objects.all()  
	blocked_users = request.user.blocked_users.all() if hasattr(request.user, 'blocked_users') else []
	login(request, User.objects.get(username=user))
	context = {
	'user': User.objects.get(username=user),
	'access_token': access_token,
	'refresh_token': refresh_token,
	'users': users,
	'blocked_users': blocked_users,
	}
	response = JsonResponse({"message": "Already logged in."}, status=status.HTTP_200_OK)
	response['HX-Location'] = '/index'
	return response

@api_view(['GET', 'POST'])
@permission_classes([AllowAny])
def register(request):
	if already_logged_in(request):
		return already_logged_in(request)
	if request.method == 'POST':
		form = CustomUserCreationForm(request.POST)
		if form.is_valid():
			user = form.save()
			logger.info(f"New user registered: {user.username}", extra={'user_id': user.id})
			messages.success(request, 'Registration successful. You can now log in.')
			response = JsonResponse({"message": "Registration successful."}, status=status.HTTP_200_OK)
			response['HX-Location'] = '/login'
			return response
		else:
			logger.warning(f"Failed registration attempt: {form.errors}")
			return render(request, 'register.html', {'form': form})
	else:
		form = CustomUserCreationForm()
	response = render(request, 'register.html', {'form': form})
	return response

@api_view(['GET', 'POST'])
@permission_classes([AllowAny])
def login_view(request):
    if already_logged_in(request):
        return already_logged_in(request)
    if request.method == 'POST':
        form = LoginForm(request.POST)
        if form.is_valid():
            username = form.cleaned_data['username']
            password = form.cleaned_data['password']
            user = User.objects.filter(username=username).first()
            if user is not None and user.password is None:
                logger.warning(f"Login attempt with unset password for user: {username}", extra={'user_id': user.id})
                messages.error(request, 'Invalid username or password.')
                return render(request, 'login.html', {'form': form})
            user = authenticate(request, username=username, password=password)
            if user is not None and user.check_password(password):
                if user.twofa == True:
                    otp = generate_otp()
                    user.otp = otp
                    user.save()
                    subject = f'OTP from {get_current_site(request).name}'
                    message = render_to_string('user-2fa-email.html', {'user': user, 'otp': otp})
                    send_mail(subject, message, settings.DEFAULT_FROM_EMAIL, [user.email])
                    response = render(request, 'login-2fa.html', {'form': OTPForm()})
                    response['HX-Location'] = '/login-2fa'
                    return response
                # Issue JWT tokens
                refresh = RefreshToken.for_user(user)
                access_token = str(refresh.access_token)
                refresh_token = str(refresh)
                
                # Rotate the CSRF token
                rotate_token(request)
                
                response = JsonResponse({"message": "Login successful."}, status=status.HTTP_200_OK)
                response['HX-Location'] = '/index'
                response.set_cookie('access_token', access_token, httponly=True, samesite='Lax', max_age=int(settings.SIMPLE_JWT.get('ACCESS_TOKEN_LIFETIME').total_seconds()))
                response.set_cookie('refresh_token', refresh_token, httponly=True, samesite='Lax', max_age=int(settings.SIMPLE_JWT.get('REFRESH_TOKEN_LIFETIME').total_seconds()))
                logger.info(f"User {username} logged in successfully", extra={'user_id': user.id})
                return response
            else:
                logger.warning(f"Failed login attempt for user: {username}")
                messages.error(request, 'Invalid username or password.')
                return render(request, 'login.html', {'form': form})
        else:
            logger.warning("Invalid form submission during login", extra={'user_id': user.id})
            messages.error(request, 'Invalid form submission.')
    else:
        form = LoginForm()
    context = {
        'ft_client_id': settings.FT_CLIENT_ID,
        'ft_redirect_uri': settings.FT_REDIRECT_URI,
        'form': form,
    }
    return render(request, 'login.html', context)

@api_view(['GET'])
@permission_classes([IsAuthenticatedWithCookie])
def index(request):
    access_token = request.COOKIES.get('access_token')
    refresh_token = request.COOKIES.get('refresh_token')
    
    users = User.objects.all()  
    blocked_users = request.user.blocked_users.all() if hasattr(request.user, 'blocked_users') else []
    
    context = {
        'user': request.user,
        'access_token': access_token,
        'refresh_token': refresh_token,
        'users': users,
        'blocked_users': blocked_users,
    }
    return render(request, 'index.html', context)

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

        username = request.user.username
        user_id = request.user.id

        # Perform Django logout to clear session data
        try:
            django_logout(request)
            rotate_token(request)
            logger.info(f"User {username} logged out", extra={'user_id': user_id})
        except Exception as logout_error:
            logger.error(f"Error during Django logout for user {username} (ID: {user_id}): {str(logout_error)}")
        
        # Create a response and delete the tokens
        response = JsonResponse({"message": "Logout successful."}, status=status.HTTP_200_OK)
        response.delete_cookie('access_token')
        response.delete_cookie('refresh_token')
        response['HX-Location'] = '/login'
        return response

    except Exception as e:
        logger.error(f"Logout failed for user {request.user.username} (ID: {request.user.id}): {str(e)}")
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
                response = JsonResponse({"message": "Password has been reset."}, status=status.HTTP_200_OK)
                response['HX-Location'] = '/login'
                return response
        else:
            form = ResetPasswordForm(user)
        return render(request, 'password-reset-confirm.html', {'form': form, 'uid': uidb64, 'token': token})
    else:
        messages.error(request, 'Invalid password reset link.')
        return render(request, 'password-reset-confirm.html', {'form': form, 'uid': uidb64, 'token': token})

@api_view(['GET', 'POST'])
@permission_classes([AllowAny])
def otp(request):
	if request.method == 'POST':
		form = OTPForm(request.POST)
		if form.is_valid():
			otp = form.cleaned_data['otp']
			try:
				user = User.objects.get(otp=otp)
				user.otp = None
				user.save()
				login(request, user)
				refresh = RefreshToken.for_user(user)
				access_token = str(refresh.access_token)
				refresh_token = str(refresh)
				response = JsonResponse({"message": "Login successful."}, status=status.HTTP_200_OK)
				response.set_cookie('access_token', access_token, httponly=True, samesite='Lax', max_age=int(settings.SIMPLE_JWT.get('ACCESS_TOKEN_LIFETIME').total_seconds()))
				response.set_cookie('refresh_token', refresh_token, httponly=True, samesite='Lax', max_age=int(settings.SIMPLE_JWT.get('REFRESH_TOKEN_LIFETIME').total_seconds()))
				response['HX-Location'] = '/index'
				return response
			except User.DoesNotExist:
				messages.error(request, 'Invalid OTP.')
		return render(request, 'login-2fa.html', {'form': OTPForm()})
	return render(request, 'login-2fa.html', {'form': OTPForm()})

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
        response_42api = requests.post(token_url, data=payload)
        if response_42api.status_code == 200:
            data = response_42api.json()
            access_token = data['access_token']
            user = authenticate_api(request, access_token=access_token)
            if user is not None:
                # Issue JWT tokens
                refresh = RefreshToken.for_user(user)
                access_token = str(refresh.access_token)
                refresh_token = str(refresh)
                # Optionally set tokens in cookies
                response = redirect('/index')
                response.set_cookie('access_token', access_token, httponly=True, samesite='Lax', max_age=int(settings.SIMPLE_JWT.get('ACCESS_TOKEN_LIFETIME').total_seconds()))
                response.set_cookie('refresh_token', refresh_token, httponly=True, samesite='Lax', max_age=int(settings.SIMPLE_JWT.get('REFRESH_TOKEN_LIFETIME').total_seconds()))
                return response
            else:
                messages.error(request, 'Invalid access token.')
                response = JsonResponse({"message": "Invalid access token."}, status=status.HTTP_400_BAD_REQUEST)
                response['HX-Location'] = '/login'
                return response
        else:
            messages.error(request, 'Invalid code.')
            response = JsonResponse({"message": "Invalid code."}, status=status.HTTP_400_BAD_REQUEST)
            response['HX-Location'] = '/login'
            return response
    else:
        messages.error(request, 'Invalid code.')
        response = JsonResponse({"message": "Invalid code."}, status=status.HTTP_400_BAD_REQUEST)
        response['HX-Location'] = '/login'
        return response

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