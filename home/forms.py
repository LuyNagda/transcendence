from django import forms
from authentication.models import User
from django.contrib.auth.forms import PasswordChangeForm
from django.core.exceptions import ValidationError
from django.utils import timezone

class ProfileForm(forms.Form):
    name = forms.CharField(max_length=30, widget=forms.TextInput(attrs={'class': 'form-control', 'readonly': 'readonly', 'placeholder': 'user', 'autocomplete': 'username'}))
    nick_name = forms.CharField(max_length=10, label='Tournament Alias', widget=forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'name', 'autocomplete': 'nickname'}))
    email = forms.EmailField(widget=forms.EmailInput(attrs={'class': 'form-control', 'placeholder': 'email', 'autocomplete': 'email'}))
    date_of_birth = forms.DateField(widget=forms.DateInput(attrs={'class': 'form-control', 'type': 'date', 'placeholder': 'YYYY-MM-DD'}), input_formats=['%Y-%m-%d'], required=False)
    profile_picture = forms.ImageField(widget=forms.FileInput(attrs={'class': 'form-control', 'placeholder': 'profile-picture'}), required=False)

    def __init__(self, *args, **kwargs):
        item_id = kwargs.pop('item_id')
        super(ProfileForm, self).__init__(*args, **kwargs)
        user = User.objects.get(username=item_id)
        self.instance = user
        self.fields['name'].initial = user.username
        self.fields['nick_name'].initial = user.nick_name 
        self.fields['email'].initial = user.email
        self.fields['date_of_birth'].initial = user.date_of_birth

    def clean_email(self):
        email = self.cleaned_data.get('email')
        if email and User.objects.filter(email=email).exclude(username=self.instance.username).exists():
            raise forms.ValidationError('Email is already in use.')
        return email

    def clean_date_of_birth(self):
        dob = self.cleaned_data.get('date_of_birth')
        if dob and dob > timezone.now().date():
            raise forms.ValidationError('Date of birth cannot be in the future.')
        if dob and dob > timezone.now().date() - timezone.timedelta(days=365 * 16):
            raise forms.ValidationError('Date of birth cannot be less than 16 years')
        return dob

    def clean_name(self):
        name = self.cleaned_data.get('name')
        if name and name != self.instance.username:
            raise forms.ValidationError("Cannot change username.")
        return name

    def clean_profile_picture(self):
        profile_picture = self.cleaned_data.get('profile_picture')
        if profile_picture and profile_picture.size > 512 * 1024:  # 512 KB limit
            raise ValidationError("Profile picture size cannot exceed 512 KB.")
        return profile_picture

    def clean(self):
        cleaned_data = super().clean()
        email = cleaned_data.get('email')
        name = cleaned_data.get('name')
        
        if email and name and User.objects.filter(email=email).exclude(username=name).exists():
            self.add_error('email', 'Email is already in use.')
        
        return cleaned_data

    def save(self, commit=True):
        if not self.instance:
            raise ValueError("Cannot save without a valid user instance.")

        self.instance.email = self.cleaned_data['email']
        self.instance.nick_name = self.cleaned_data['nick_name']
        self.instance.date_of_birth = self.cleaned_data['date_of_birth']

        if self.cleaned_data.get('profile_picture'):
            self.instance.profile_picture = self.cleaned_data['profile_picture']

        if commit:
            self.instance.save()
        return self.instance

class MyPasswordChangeForm(PasswordChangeForm):
    def __init__(self, *args, **kwargs):
        super(MyPasswordChangeForm, self).__init__(*args, **kwargs)
        for fieldname in ['old_password', 'new_password1', 'new_password2']:
            self.fields[fieldname].widget.attrs.update({'class': 'form-control', 'placeholder': 'password'})