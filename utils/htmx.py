import json
from django.http import HttpResponse

def with_state_update(response, domain, state):
    """
    Add state update to an HTTP response using HX-Trigger.
    
    Args:
        response: HttpResponse object
        domain: String identifying the state domain (e.g., 'user', 'room', 'chat')
        state: Dict containing the state update
        
    Returns:
        HttpResponse with HX-Trigger header containing state update
    """
    if not isinstance(response, HttpResponse):
        raise TypeError("Response must be an HttpResponse object")
        
    new_trigger = {
        'stateUpdate': {
            'domain': domain,
            'state': state
        }
    }
    
    existing_trigger = response.get('HX-Trigger')
    if existing_trigger:
        try:
            existing_trigger_dict = json.loads(existing_trigger)
            existing_trigger_dict.update(new_trigger)
            response['HX-Trigger'] = json.dumps(existing_trigger_dict)
        except json.JSONDecodeError:
            response['HX-Trigger'] = json.dumps(new_trigger)
    else:
        response['HX-Trigger'] = json.dumps(new_trigger)
        
    return response

def state_update_response(domain, state, status=200):
    """
    Create an HTTP response with only a state update.
    Useful for endpoints that only need to update state without returning HTML.
    
    Args:
        domain: String identifying the state domain
        state: Dict containing the state update
        status: HTTP status code (default: 200)
        
    Returns:
        HttpResponse with HX-Trigger header containing state update
    """
    response = HttpResponse(status=status)
    return with_state_update(response, domain, state) 