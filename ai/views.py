import pickle, sys, traceback
from django.http import JsonResponse
from . import ai  # Current module
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
        raise FileNotFoundError()

    except Exception as e:
        print(f"Unexpected error loading pickle: {e}")
        traceback.print_exc()
        return None

def send_ai_to_front(request, ai_level="bestAI"):
    file_path = "./Saved_AI/" + ai_level
    
    try: 
        saved_ai : ai.Neuron_Network
        saved_ai = safe_pickle_load(file_path)
        
        if saved_ai is None:
            return JsonResponse({"error": "Failed to load AI"}, status=500)
    
    except FileNotFoundError:
        return JsonResponse({"error": "No such AI found: " + ai_level}, status=404)

    ai_dict = saved_ai.to_dict()

    return JsonResponse(ai_dict)
