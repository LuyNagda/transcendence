import os, pickle, sys
from game import SAVE_FILE, SAVE_FOLDER
from ai import saved_ai_to_json

def main():
    nb_args = len(sys.argv[1:])
    if (nb_args == 0):
        file_path = os.path.join(SAVE_FOLDER, SAVE_FILE)
    elif (nb_args == 1):
        file_path = sys.argv[1]
    else:
        print("Usage: provide a AI's file")

    if (os.path.exists(file_path)):
        neuron_json = saved_ai_to_json(file_path)
    else:
        return print("Save file doesn't exist!")
    
if __name__ == "__main__":
    main()
