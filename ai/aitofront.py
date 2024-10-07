import os, pickle, json
from utils import SAVE_FILE, SAVE_FOLDER
from ai import Neuron_Network

def main():
    file_path = os.path.join(SAVE_FOLDER, SAVE_FILE)

    if (os.path.exists(file_path)):
        with open(file_path, 'rb') as imp:
            Ai : Neuron_Network
            Ai = pickle.load(imp)
    else:
        return print("Save file doesn't exist!")
    
    ai_weights = Ai.layer1.weights
    print("ai_weights:\n", ai_weights)
    
    neuron_json = Ai.to_json()
    print("\nneuron_json:\n", neuron_json)
    
if __name__ == "__main__":
    main()
