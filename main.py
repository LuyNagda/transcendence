import os, sys
from NNAI import train_Ai, load_Ai
from utils import SAVE_FILE
from pong import play_Ai

# Run the game
def main():
    print("\n\tThanks for tying my AI =)")

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
            
            train_Ai(save_file, base)
        
        case "play":
            if (len(sys.argv) > 2):
                save_file = sys.argv[2]
                if (os.path.exists(save_file)):
                    Ai = load_Ai(save_file)
                else:
                    return print("Save file doesn't exist!")

            else:
                if (os.path.exists(SAVE_FILE)):
                    Ai = load_Ai(SAVE_FILE)
                else:
                    return print("Save file doesn't exist!")

            play_Ai(Ai, "no")

        case "demo":
            if (len(sys.argv) > 2):
                save_file = sys.argv[2]
                if (os.path.exists(save_file)):
                    Ai = load_Ai(save_file)
                else:
                    return print("Save file doesn't exist!")
            else:
                if (os.path.exists(SAVE_FILE)):
                    Ai = load_Ai(SAVE_FILE)
                else:
                    return print("Save file doesn't exist!")
            play_Ai(Ai, "yes")

        case _:
            print("Usage:\n    train: \t\ttrain the AI\n    play [save_file]: \tplay against the best ai from the save")
            return
        
if __name__ == "__main__":
    main()