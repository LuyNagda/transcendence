from django import forms
from django.contrib.auth.forms import UserCreationForm, SetPasswordForm
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from authentication.models import User

CustomUser = get_user_model()

class CustomUserCreationForm(forms.ModelForm):
    username = forms.CharField(label='Username', max_length=30, widget=forms.TextInput(attrs={'placeholder': 'Username', 'class': 'form-control'}))
    email = forms.EmailField(label='Email', widget=forms.EmailInput(attrs={'placeholder': 'Email', 'class': 'form-control'}))
    nick_name = forms.CharField(label='Tournament Alias', max_length=10, widget=forms.TextInput(attrs={'placeholder': 'Tournament Alias', 'class': 'form-control'}))
    password1 = forms.CharField(label='Password', widget=forms.PasswordInput(attrs={'placeholder': 'Password', 'class': 'form-control'}))
    password2 = forms.CharField(label='Confirm Password', widget=forms.PasswordInput(attrs={'placeholder': 'Password', 'class': 'form-control'}))

    class Meta:
        model = CustomUser
        fields = ('username', 'email', 'nick_name', 'password1', 'password2')

    def clean_email(self):
        email = self.cleaned_data.get('email')
        if User.objects.filter(email=email).exists():
            raise forms.ValidationError('Email is already in use.')
        if "42lyon.fr" in email:
            raise forms.ValidationError("Please login using the API")
        return email

    def clean_password1(self):
        password1 = self.cleaned_data.get('password1')
        validate_password(password1, self.instance)
        return password1

    def clean(self):
        cleaned_data = super().clean()
        password1 = cleaned_data.get('password1')
        password2 = cleaned_data.get('password2')

        if password1 and password2 and password1 != password2:
            self.add_error('password2', "Passwords don't match")

        return cleaned_data

    def save(self, commit=True):
        user = super().save(commit=False)
        user.set_password(self.cleaned_data["password1"])
        if commit:
            user.save()
        return user

class LoginForm(forms.Form):
    username = forms.CharField(label='Username', max_length=30, widget=forms.TextInput(attrs={'placeholder': 'Username', 'class': 'form-control'}))
    password = forms.CharField(label='Password', widget=forms.PasswordInput(attrs={'placeholder': 'Password', 'class': 'form-control'}))
class ForgotPasswordForm(forms.Form):
    email = forms.EmailField(label='Email', widget=forms.EmailInput(attrs={'placeholder': 'Email', 'class': 'form-control'}))

class ResetPasswordForm(SetPasswordForm):
    def __init__(self, user, *args, **kwargs):
        super().__init__(user, *args, **kwargs)
        for field in self.fields.values():
            field.widget.attrs.update({'class': 'form-control', 'placeholder': field.label})

class TWOFAForm(forms.Form):
    email = forms.EmailField(label='Email', widget=forms.EmailInput(attrs={'placeholder': 'Email', 'class': 'form-control'}))

class OTPForm(forms.Form):
    otp = forms.CharField(label='OTP', max_length=8, widget=forms.TextInput(attrs={'placeholder': 'OTP', 'class': 'form-control'}))

    def __init__(self, *args, **kwargs):
        self.otp_length = 8
        super(OTPForm, self).__init__(*args, **kwargs)

    def clean_otp(self):
        otp = self.cleaned_data.get('otp')
        if len(otp) != self.otp_length:
            raise forms.ValidationError(f'OTP must be exactly {self.otp_length} characters long.')
        return otp