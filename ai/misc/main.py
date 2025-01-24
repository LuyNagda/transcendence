import sys
import os

# Get the absolute path to the project root
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
sys.path.insert(0, project_root)

from ai.ai import train_ai

def main():
    print(f'Nb argv: {len(sys.argv)}')

    if (len(sys.argv) != 3):
        print(f'{sys.argv[2]} is not a save file')
        return print("Please provide a saved AI!")
    
    save_file = sys.argv[2]

    training_params = {
        'nb_generation': 1000000000000,
        'nb_species': 100,
        'time_limit': 200,
        'max_score': 500
    }

    train_ai(save_file, training_params)

if __name__ == "__main__":
    main()