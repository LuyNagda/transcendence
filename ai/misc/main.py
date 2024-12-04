import os, sys
from ai import train_ai, load_Ai, send_ai_to_front
from .game import play_Ai, SAVE_FILE, SAVE_FOLDER

# Run the game
def main():
    print("\n\tThanks for trying my AI =)\n")

    # Retrieve arguments from sys.argv
    nb_args = len(sys.argv[1:])
    if (nb_args == 0):
        print("Usage:\n    train: \t\ttrain the AI\n    play [save_file]: \tplay against the best ai from the save")
        return

    match sys.argv[1]:
        case "train":
            save_file = SAVE_FILE
            base = "no"

            if (len(sys.argv) > 2):
                save_file = sys.argv[2]
            
            if (len(sys.argv) > 3):
                base = sys.argv[3]
            
            train_ai(save_file, base)
        
        case "play":
            if (len(sys.argv) > 2):
                save_file = sys.argv[2]
                if (os.path.exists(save_file)):
                    Ai = load_Ai(save_file)
                    play_Ai(Ai, "no")
                else:
                    return print("Save file doesn't exist!")

            else:
                print("Please provide a saved AI!")


        case "demo":
            if (len(sys.argv) > 2):
                save_file = sys.argv[2]
                if (os.path.exists(save_file)):
                    Ai = load_Ai(save_file)
                else:
                    return print("Save file doesn't exist!")
            else:
                return print("Please provide a saved AI!")
            play_Ai(Ai, "yes")

        # case "json":
        #     if (len(sys.argv[1:]) == 2):
        #         file_path = sys.argv[2]
        #         if (os.path.exists(file_path)):
        #             neuron_json = send_ai_to_front()
        #             print("\n\nNeuron_json:\n", neuron_json)
        #         else:
        #             return print("Save file doesn't exist!")
        #     else:
        #         print("Usage: provide a AI's file")

        case _:
            print("Usage:\n    train: \t\ttrain the AI\n    play [save_file]: \tplay against the best ai from the save\n    json [save_file]: convert ai's file to json")
            return
        
if __name__ == "__main__":
    main()