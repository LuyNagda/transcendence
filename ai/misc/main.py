import sys
import os

# Get the absolute path to the project root
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
sys.path.insert(0, project_root)

from ai.ai import train_ai

def main():
    print("sys.argv[0]:", sys.argv[0])
    print("sys.argv[1]:", sys.argv[1])
    print("sys.argv[2]:", sys.argv[2])
    if (len(sys.argv) != 3):
        return print("Please provide a saved AI!")
    
    save_file = sys.argv[2]
    train_ai(save_file)

if __name__ == "__main__":
    main()