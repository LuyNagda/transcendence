import os, sys
from ai import train_ai, load_Ai
from game import play_Ai, SAVE_FILE, SAVE_FOLDER

# Run the game
def main():
    print("\n\tThanks for trying my AI =)")

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
                else:
                    return print("Save file doesn't exist!")

            else:
                print("Please provide a saved AI!")

            play_Ai(Ai, "no")

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

        case _:
            print("Usage:\n    train: \t\ttrain the AI\n    play [save_file]: \tplay against the best ai from the save")
            return
        
if __name__ == "__main__":
    main()