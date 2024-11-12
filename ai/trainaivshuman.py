import sys, json
from game import WIDTH, HEIGHT, NB_GENERATION, NB_SPECIES, SAVE_FILE
from ai import create_frame, train_ai

def main():
    # Retrieve arguments from sys.argv
    nb_args = len(sys.argv[1:])
    if (nb_args == 0):
        print("Usage: give the path to a json's file")
        return

    frames = []
    
    # Read the file
    with open(sys.argv[1], 'r') as file:
        json_string = file.read()

        try:
            # First, try to parse the JSON
            parsed_data = json.loads(json_string)
            # print("After first parse:", type(parsed_data))
            
            # If it's still a string, parse again
            if isinstance(parsed_data, str):
                parsed_data = json.loads(parsed_data)
                # print("After second parse:", type(parsed_data))
            
            # Get first element if it's nested
            if isinstance(parsed_data, list) and len(parsed_data) > 0:
                match_stats = parsed_data[0]
                # print("Final match_stats type:", type(match_stats))
                # print("Sample frame:", match_stats[0] if match_stats else "Empty")

            frames = [create_frame(frame) for frame in match_stats]

            if train_ai(frames) != "STOP":
                print("Training against human done")
            else:
                print("Training as been interrupted")

        except json.JSONDecodeError as e:
            print(f"JSON parsing error: {e}")
            return
        except Exception as e:
            print(f"Other error: {e}")
            return

if __name__ == "__main__":
    main()
