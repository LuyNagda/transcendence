from django.http import JsonResponse
from . import ai
import json, os
from django.conf import settings
from django.shortcuts import render
from rest_framework.decorators import api_view, permission_classes
from authentication.decorators import IsAuthenticatedWithCookie

def send_ai_to_front(request, ai_name):
    # Use Path or os.path to create a proper file path
    save_file = settings.STATICFILES_DIRS[0] / 'saved_ai' / ai_name
    
    try: 
        # Open and load the JSON file
        with open(save_file, 'r') as load_file:
            ai_data_list = json.load(load_file)
        
        if not ai_data_list:
            return JsonResponse({"error": "No AI data found"}, status=404)
        
        # Return the first AI
        return JsonResponse(ai_data_list[0])
    
    except FileNotFoundError:
        return JsonResponse({"error": f"No such AI found: {ai_name}"}, status=404)
    
    except json.JSONDecodeError:
        return JsonResponse({"error": "Failed to decode AI data"}, status=500)

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticatedWithCookie])
def ai_manager(request):
    access_token = request.COOKIES.get('access_token')
    refresh_token = request.COOKIES.get('refresh_token')
    user = request.user

    context = {'user': user, 'access_token': access_token, 'refresh_token': refresh_token}
    return render(request, 'ai-manager.html', context)

@api_view(['POST'])
@permission_classes([IsAuthenticatedWithCookie])
def training(request):
    if request.method != 'POST':
        return JsonResponse({"error": "Only POST method is allowed"}, status=405)

    try:
        # Parse JSON body
        data = json.loads(request.body)
        ai_name = data.get('ai_name', 'default')
        nb_generation = int(data.get('nb_generation', 10))
        nb_species = int(data.get('nb_species', 50))
        time_limit = int(data.get('time_limit', 60))
        max_score = int(data.get('max_score', 100))

        # Prepare the parameters as an object (dictionary)
        training_params = {
            'ai_name': ai_name,
            'nb_generation': nb_generation,
            'nb_species': nb_species,
            'time_limit': time_limit,
            'max_score': max_score
        }

        # Validate parameters
        if not (1 <= nb_generation <= 100):
            return JsonResponse({"error": "Number of generations must be between 1 and 100"}, status=400)
        if not (50 <= nb_species <= 100):
            return JsonResponse({"error": "Number of species must be between 50 and 100"}, status=400)
        if not (10 <= time_limit <= 120):
            return JsonResponse({"error": "Time limit must be between 10 and 120 minutes"}, status=400)
        if not (100 <= max_score <= 1000):
            return JsonResponse({"error": "Max score must be between 100 and 1000"}, status=400)

        # Create the full path
        save_file = settings.STATICFILES_DIRS[0] / 'saved_ai' / ai_name
        log = ai.train_ai(save_file, training_params)

        return JsonResponse({
            "status": "success",
            "log": log,
        })

    except ValueError as e:
        return JsonResponse({"error": "Invalid parameter values"}, status=400)
    except Exception as e:
        import traceback
        traceback.print_exc()
        return JsonResponse({"error": str(e)}, status=500)

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
    if request.method != 'POST':
        return JsonResponse({"error": "Only POST method is allowed"}, status=405)

    try:
        # Parse JSON body
        data = json.loads(request.body)
        ai_name = data.get('ai_name', 'default')

        invalid_ai = ["best_ai", "Hard", "Medium", "Easy"]
        if ai_name in invalid_ai:
            return JsonResponse({"error": f"The file '{ai_name}' cannot be removed"}, safe=False, status=403)        

        save_file = settings.STATICFILES_DIRS[0] / 'saved_ai' / ai_name

        if os.path.exists(save_file):
            os.remove(save_file)
            return JsonResponse({"message": f"The file '{ai_name}' has been removed"}, status=200)
        else:
            return JsonResponse({"error": f"The file '{ai_name}' does not exist"}, status=404)
    
    except ValueError as e:
        return JsonResponse({"error": "Invalid parameter values"}, status=400)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)
