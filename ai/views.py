from django.http import JsonResponse
from . import ai
import json, os, threading, multiprocessing
from django.conf import settings
from django.shortcuts import render
from rest_framework.decorators import api_view, permission_classes
from authentication.decorators import IsAuthenticatedWithCookie
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from pathlib import Path

# Constants for parameter validation
MIN_GENERATIONS = 1
MAX_GENERATIONS = 10
MIN_SPECIES = 50
MAX_SPECIES = 100
MIN_TIME_LIMIT = 5
MAX_TIME_LIMIT = 60
MIN_MAX_SCORE = 50
MAX_MAX_SCORE = 500

# Use a lock to ensure thread safety
training_lock = threading.Lock()
IN_TRAINING = False

@api_view(['GET'])
@permission_classes([IsAuthenticatedWithCookie])
def send_ai_to_front(request, ai_name):
    try:
        # Validate the ai_name
        if not ai_name or not isinstance(ai_name, str) or not ai_name.isalnum() or len(ai_name) > 100:
            raise ValueError("Invalid AI name. Only alphanumeric characters are allowed.")

        # Use Path or os.path to create a proper file path
        save_file = Path(settings.STATICFILES_DIRS[0]) / 'saved_ai' / ai_name
    
        # Open and load the JSON file
        with open(save_file, 'r') as load_file:
            ai_data_list = json.load(load_file)
        
        if not ai_data_list:
            raise FileNotFoundError
        
        # Return the first AI
        return JsonResponse(ai_data_list[0])
    
    except FileNotFoundError:
        # If file not found, load Marvin
        save_file = Path(settings.STATICFILES_DIRS[0]) / 'saved_ai/Marvin'
        with open(save_file, 'r') as load_file:
            default_Marvin = json.load(load_file)

        if not default_Marvin:
            return JsonResponse({"error": f"No AI found"}, status=404)
        else:
            # Return the Marvin's AI with custom headers
            response = JsonResponse(default_Marvin[0])
            response['X-Fallback-AI'] = 'Marvin'
            return response

    except json.JSONDecodeError as e:
        return JsonResponse({"error": f"Failed to decode AI data: {str(e)}"}, status=500)

    except ValueError as e:
        return JsonResponse({"error": str(e)}, status=400)

    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)

@api_view(['GET'])
@permission_classes([IsAuthenticatedWithCookie])
def ai_manager(request):
    if not request.COOKIES:
        return JsonResponse({"error": "Request cookies is empty"}, status=400)
    if not request.user:
        return JsonResponse({"error": "Request user is empty"}, status=400)
    
    access_token = request.COOKIES.get('access_token')
    refresh_token = request.COOKIES.get('refresh_token')
    user = request.user

    context = {'user': user, 'access_token': access_token, 'refresh_token': refresh_token}
    return render(request, 'ai-manager.html', context)

@api_view(['POST'])
@permission_classes([IsAuthenticatedWithCookie])
def training(request):
    global IN_TRAINING

    # Verify if the server is powerfull enough
    if multiprocessing.cpu_count() < 2:
        return JsonResponse({"error": "Server not powerfull enough, please upgrade cpu count"}, status=400)

    if not request.body:
        return JsonResponse({"error": "Request body is empty"}, status=400)

    try:
        # Parse JSON body
        data = json.loads(request.body)
        ai_name = data.get('ai_name')
        if ai_name == 'Marvin':
            raise PermissionError("Marvin: Access denied. Not that it matters... Nothing ever does.")
        if not ai_name or not isinstance(ai_name, str) or not ai_name.isalnum() or len(ai_name) > 100:
            raise ValueError("Invalid AI name. Only alphanumeric characters are allowed and a maximun of 100 characters")
        
        nb_generation = int(data.get('nb_generation', 1))
        nb_species = int(data.get('nb_species', 50))
        time_limit = int(data.get('time_limit', 5))
        max_score = int(data.get('max_score', 5))

        # Prepare the parameters as an object (dictionary)
        training_params = {
            'ai_name': ai_name,
            'nb_generation': nb_generation,
            'nb_species': nb_species,
            'time_limit': time_limit,
            'max_score': max_score
        }

        # Validate parameters
        if not (MIN_GENERATIONS <= nb_generation <= MAX_GENERATIONS):
            raise ValueError(f"Number of generations must be between {MIN_GENERATIONS} and {MAX_GENERATIONS}")
        if not (MIN_SPECIES <= nb_species <= MAX_SPECIES):
            raise ValueError(f"Number of species must be between {MIN_SPECIES} and {MAX_SPECIES}")
        if not (MIN_TIME_LIMIT <= time_limit <= MAX_TIME_LIMIT):
            raise ValueError(f"Time limit must be between {MIN_TIME_LIMIT} and {MAX_TIME_LIMIT} minutes")
        if not (MIN_MAX_SCORE <= max_score <= MAX_MAX_SCORE):
            raise ValueError(f"Max score must be between {MIN_MAX_SCORE} and {MAX_MAX_SCORE}")

        with training_lock:
            if (IN_TRAINING):
                return JsonResponse({"error": "Server not available: training in progress"}, status=400)
            IN_TRAINING = True
        
        # Send notification to user
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            'ai_group',
            {'type': 'ai_training_started'}
        )

        # Create the full path
        save_file = settings.STATICFILES_DIRS[0] / 'saved_ai' / ai_name

        def train_and_release():
            global IN_TRAINING
            try:
                ai.train_ai(ai_name, save_file, training_params)
            finally:
                with training_lock:
                    IN_TRAINING = False

                # Send notification via WebSocket
                channel_layer = get_channel_layer()
                async_to_sync(channel_layer.group_send)(
                    'ai_group',
                    {'type': 'ai_training_ended'}
                )
                async_to_sync(channel_layer.group_send)(
                    'ai_group',
                    {'type': 'ai_modified'}
                )

        # Train the ai in the background to avoid Django to timeout
        thread = threading.Thread(target=train_and_release, daemon=True)
        thread.start()

        return JsonResponse({"status": "success"}, status=200)

    except ValueError as e:
        return JsonResponse({"error": f"training request: {str(e)}"}, status=400)

    except PermissionError as e:
        return JsonResponse({"error": f"training request: {str(e)}"}, status=403)

    except Exception as e:
        import traceback
        traceback.print_exc()
        return JsonResponse({"error": f"training request: {str(e)}"}, status=500)

@api_view(['GET'])
@permission_classes([IsAuthenticatedWithCookie])
def list_saved_ai(request):
    """
    View to list all saved AI files in the './saved_ai' directory.
    """

    folder_path = settings.STATICFILES_DIRS[0] / 'saved_ai'
    try:
        # Check if the folder exists
        if not os.path.exists(folder_path):
            return JsonResponse({"error": "Folder does not exist."}, status=404)

        # List all files in the folder
        ai_files = [f for f in os.listdir(folder_path) if os.path.isfile(os.path.join(folder_path, f))]
        
        return JsonResponse({"saved_ai": ai_files}, status=200)

    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)

@api_view(['POST'])
@permission_classes([IsAuthenticatedWithCookie])
def delete_saved_ai(request):
    try:
        if not request.body:
            return JsonResponse({"error": "Request body is empty"}, status=400)

        # Parse JSON body
        data = json.loads(request.body)
        ai_name: str
        ai_name = data.get('ai_name')
        if not ai_name or not isinstance(ai_name, str) or not ai_name.isalnum() or len(ai_name) > 100:
            raise ValueError("Invalid AI name. Only alphanumeric characters are allowed and a maximun of 100 characters")

        invalid_ai = ["Marvin"]
        if ai_name in invalid_ai:
            raise PermissionError(f"The file '{ai_name}' cannot be removed")        

        save_file = settings.STATICFILES_DIRS[0] / 'saved_ai' / ai_name

        if os.path.exists(save_file):
            os.remove(save_file)

            # Send notification via WebSocket
            channel_layer = get_channel_layer()
            async_to_sync(channel_layer.group_send)(
                'ai_group',
                {'type': 'ai_modified'}
            )
            return JsonResponse({"message": f"The file '{ai_name}' has been removed"}, status=200)
        else:
            return JsonResponse({"error": f"The file '{ai_name}' does not exist"}, status=404)

    except json.JSONDecodeError as e:
            return JsonResponse({"error": f"Invalid JSON: {str(e)}"}, status=400)
    
    except ValueError as e:
        return JsonResponse({"error": str(e)}, status=400)

    except PermissionError as e:
        return JsonResponse({"error": str(e)}, status=403)

    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)

@api_view(['GET'])
@permission_classes([IsAuthenticatedWithCookie])
def get_training_status(request):
    global IN_TRAINING
    with training_lock:
        return JsonResponse({"in_training": IN_TRAINING})