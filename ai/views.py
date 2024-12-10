from django.http import JsonResponse
from . import ai
from .gameconfig import get_game_config, set_game_config, reset_game_config
import json, os
from django.conf import settings

def send_ai_to_front(request, ai_name="best_ai"):
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

def training(request, ai_name="default"):
    # Create the full path
    save_file = settings.STATICFILES_DIRS[0] / 'saved_ai' / ai_name

    config_copy = get_game_config()

    for param, (default, converter) in config_copy.items():
        try:
            value = request.GET.get(param)  # Fetch the query parameter value
            set_game_config(**{param: converter(value) if value is not None else default})
        except ValueError:
            set_game_config(**{param: default})  # Use default on conversion error

    log = ai.train_ai(save_file)

    reset_game_config()
    return JsonResponse({"log": log}, safe=False)

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
        
        return JsonResponse({"saved_ai": ai_files})

    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)
    
def delete_saved_ai(request, ai_name):
    if ai_name == "best_ai":
        return JsonResponse(f"The file '{ai_name}' cannot be removed", safe=False, status=403)        

    save_file = settings.STATICFILES_DIRS[0] / 'saved_ai' / ai_name

    if os.path.exists(save_file):
        os.remove(save_file)
        return JsonResponse(f"The file '{ai_name}' as been removed", safe=False)
    else:
        return JsonResponse(f"The file '{ai_name}' does not exist", safe=False, status=404)