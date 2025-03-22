from django import forms
from authentication.models import User
from django.contrib.auth.forms import PasswordChangeForm
from django.core.exceptions import ValidationError
from PIL import Image
import io

class ProfileForm(forms.Form):
    name = forms.CharField(max_length=30, widget=forms.TextInput(attrs={'class': 'form-control', 'readonly': 'readonly', 'placeholder': 'user', 'autocomplete': 'username'}))
    nick_name = forms.CharField(max_length=10, label='Tournament Alias', widget=forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'name', 'autocomplete': 'nickname'}))
    email = forms.EmailField(widget=forms.EmailInput(attrs={'class': 'form-control', 'placeholder': 'email', 'autocomplete': 'email'}))
    date_of_birth = forms.DateField(widget=forms.DateInput(attrs={'class': 'form-control', 'type': 'date', 'placeholder': 'YYYY-MM-DD'}), input_formats=['%Y-%m-%d'], required=False)
    bio = forms.CharField(max_length=500, widget=forms.Textarea(attrs={'class': 'form-control', 'placeholder': 'bio'}), required=False)
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
        self.fields['bio'].initial = user.bio

    def clean_profile_picture(self):
        profile_picture = self.cleaned_data.get('profile_picture')
        if profile_picture:
            if profile_picture.size > 1024 * 1024:  # 1024 KB limit
                raise ValidationError("Image is too large (1024kB Max)")
            
            # Crop image to square
            img = Image.open(profile_picture)
            width, height = img.size
            
            # Get the smaller dimension
            min_dim = min(width, height)
            
            # Calculate cropping coordinates
            left = (width - min_dim) / 2
            top = (height - min_dim) / 2
            right = (width + min_dim) / 2
            bottom = (height + min_dim) / 2
            
            # Crop and resize
            img = img.crop((left, top, right, bottom))
            img = img.resize((300, 300))
            
            # Save cropped image to memory
            output = io.BytesIO()
            img.save(output, format='PNG')
            output.seek(0)
            
            # Replace original file with cropped version
            profile_picture.file = output
            profile_picture.size = output.getbuffer().nbytes
            
        return profile_picture

    def save(self, commit=True):
        if not self.instance:
            raise ValueError("Cannot save without a valid user instance.")

        self.instance.email = self.cleaned_data['email']
        self.instance.nick_name = self.cleaned_data['nick_name']
        self.instance.date_of_birth = self.cleaned_data['date_of_birth']
        self.instance.bio = self.cleaned_data['bio']

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