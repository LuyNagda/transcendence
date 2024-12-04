from django.http import JsonResponse
from . import ai
from .gameconfig import get_game_config, set_game_config, reset_game_config
import pickle, sys, traceback, os
from typing import Any, Optional

# If pickel is called in a different folder that the pickel used to creat the save file,
# an error could occure. This function handle this error.
def safe_pickle_load(file_path: str, target_module_name: str = 'ai') -> Optional[Any]:
    # The function can return anything, including None
    try:
        # First, try standard pickle loading
        with open(file_path, 'rb') as imp:
            return pickle.load(imp)
    
    except ModuleNotFoundError:
        try:
            # Temporarily add the module to sys.modules
            sys.modules[target_module_name] = ai
            
            # Retry loading with the local imported module
            with open(file_path, 'rb') as imp:
                return pickle.load(imp)

        except Exception as e:
            print(f"Pickle loading error: {e}")
            traceback.print_exc()
            return None

    except FileNotFoundError:
        raise

    except Exception as e:
        print(f"Unexpected error loading pickle: {e}")
        traceback.print_exc()
        return None

def send_ai_to_front(request, ai_name="bestAI"):
    file_path = "./Saved_AI/" + ai_name
    
    try: 
        saved_ai : ai.Neuron_Network
        saved_ai = safe_pickle_load(file_path)
        
        if saved_ai is None:
            return JsonResponse({"error": "Failed to load AI"}, status=500)
    
    except FileNotFoundError:
        print(f"FileNotFoundError:")
        traceback.print_exc()
        return JsonResponse({"error": "No such AI found: " + ai_name}, status=404)

    ai_dict = saved_ai.to_dict()

    return JsonResponse(ai_dict)

def training(request, ai_name="default"):
    save_file = "./Saved_AI/" + ai_name

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
    View to list all saved AI files in the './Saved_AI' directory.
    """
    folder_path = "./Saved_AI"
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
    if ai_name == "bestAI":
        return JsonResponse(f"The file '{ai_name}' cannot be removed", safe=False, status=403)        

    save_file = "./Saved_AI/" + ai_name

    if os.path.exists(save_file):
        os.remove(save_file)
        return JsonResponse(f"The file '{ai_name}' as been removed", safe=False)
    else:
        return JsonResponse(f"The file '{ai_name}' does not exist", safe=False, status=404)