import pickle, os, json
from game import train_basic, AI_ball, WIDTH, HEIGHT, DISPLAY_GAME, NB_GENERATION, NB_SPECIES, SAVE_FILE, SAVE_FOLDER
from gamesimulation import train_basic_no_display
import numpy as np

np.random.seed()

class Layer_Dense:
    def __init__(self, n_inputs, n_neurons):
        # Weights are set with random numbers
        self.weights = np.random.randn(n_inputs, n_neurons)
        # self.biases = np.random.randn(1, n_neurons) * 0.1
        
        # Biases are set to 0
        self.biases = np.zeros((1, n_neurons))
    
    def forward(self, inputs):
        # Output are calculate by multiplying each input with theirs weight and then adding the biaises
        self.output = np.dot(inputs, self.weights) + self.biases
        return self.output

# Activation Rectified Linear Unit is use to only use positives outputs
class Activation_ReLU:
    def forward(self, inputs):
        self.output = np.maximum(0, inputs)
        return self.output

# Transform the inputs into probabilities
class Activation_SoftMax:
    def forward(self, inputs):
        # Protect from overflow. In case of batch inputs, keeps it in the rigth format
        exp_values = np.exp(inputs - np.max(inputs, axis=1, keepdims=True))

        probabilities = exp_values / np.sum(exp_values, axis=1, keepdims=True)
        self.output = probabilities
        return self.output

class Neuron_Network:
    def __init__(self, nb_inputs, nb_layer1_neurons, nb_layer2_neurons):
        self.layer1 = Layer_Dense(nb_inputs, nb_layer1_neurons)
        self.activation1 = Activation_ReLU()
        self.layer2 = Layer_Dense(nb_layer1_neurons, nb_layer2_neurons)
        self.activation2 = Activation_SoftMax()
        self.ai_score = 0

    def forward(self, inputs):
        self.output = self.layer1.forward(inputs)
        self.output = self.activation1.forward(self.output)
        self.output = self.layer2.forward(self.output)
        self.output = self.activation2.forward(self.output)
        return self.output
    
    def decision(self, paddle_y, ball, height):
        ball_relative_x = ball.x / height
        ball_relative_y = ball.y / height
        paddle_relative_y = paddle_y / height

        X = [ball_relative_x, ball_relative_y, ball.dx, ball.dy, paddle_relative_y]
        response = self.forward(X)

        return np.argmax(response)

    def decision_left(self, paddle_y, ball, height):
        ball_relative_x = 1 - ball.x / height
        ball_relative_y = ball.y / height
        paddle_relative_y = ball.dy, paddle_y / height

        X = [ball_relative_x, ball_relative_y, ball.dx * -1, paddle_relative_y]
        response = np.argmax(self.forward(X))

        return response
    
    def __lt__(self, other):
        return ((self.ai_score) < (other.ai_score))
    
    def __repr__(self):
        return str(self.ai_score)
    
    def to_dict(self):
        return {
            "layer1": {
                "weights" : self.layer1.weights.tolist(),
                "biases": self.layer1.biases.tolist()
            },
            "layer2": {
                "weights" : self.layer2.weights.tolist(),
                "biases": self.layer2.biases.tolist()
            }
        }
    
    def to_json(self):
        return json.dumps(self.to_dict())

    def load_from_dict(self, data):
        layer1_weights = np.array(data["layer1"]["weights"])
        layer1_biases = np.array(data["layer1"]["biases"])
        layer2_weights = np.array(data["layer2"]["weights"])
        layer2_biases = np.array(data["layer2"]["biases"])

        # Validate the weights shapes
        if layer1_weights.shape != (5, 3):
            raise ValueError("Unexpected shape for layer1 weights")
        if layer1_biases.shape != (1, 3):
            raise ValueError("Unexpected shape for layer1 biases")
        if layer2_weights.shape != (3, 3):
            raise ValueError("Unexpected shape for layer2 weights")
        if layer2_biases.shape != (1, 3):
            raise ValueError("Unexpected shape for layer2 biases")
        
        self.layer1.weights = layer1_weights
        self.layer1.biases = layer1_biases
        self.layer2.weights = layer2_weights
        self.layer2.biases = layer2_biases


def Init_Ai(base):
    Ai_Sample = []
    Ai_Sample.clear()
    file_path = os.path.join(SAVE_FOLDER, SAVE_FILE)

    if (os.path.exists(file_path) and base != "yes"):
        # Load all AI from the save file
        with open(file_path, 'rb') as imp:
            while (len(Ai_Sample) < NB_SPECIES):
                try:
                    Saved_Ai = pickle.load(imp)
                    Ai_Sample.append(Saved_Ai)
                except EOFError:
                    break

        # Mix weights of the 5 best performing AIs
        Crossover_mutation(Ai_Sample)
        
        # Add random AIs to reach NB_SPECIES
        remaining = NB_SPECIES - len(Ai_Sample)
        for i in range(remaining):
            random_ai = Neuron_Network(5, 3, 3)
            Ai_Sample.append(random_ai)

    else:
        # Create NB_SPECIES random AIs
        for i in range(NB_SPECIES):
            random_ai = Neuron_Network(5, 3, 3)
            Ai_Sample.append(random_ai)
    
    # Reset scores
    for i in range(NB_SPECIES):
        Ai_Sample[i].ai_score = 0

    return Ai_Sample
    
def Crossover_mutation(Ai_Sample):
    # Crossover and then mutation
    while (len(Ai_Sample) < NB_SPECIES - 5):
        # Choose 2 parent randomly from the 5 best performing AI and instance a child
        parent1, parent2 = np.random.choice(Ai_Sample[:5], 2, replace=False)
        child = Neuron_Network(5, 3, 3)

        # Crossover
        child.layer1.weights = (parent1.layer1.weights + parent2.layer1.weights) / 2
        child.layer2.weights = (parent1.layer2.weights + parent2.layer2.weights) / 2

        # Set the probability of the occurrence of a mutation
        mutation_rate = 0.1

        # Create a matrix of random weight, shape like the neuron network's weight
        weight_shape1 = child.layer1.weights.shape
        random_values1 = np.random.random(weight_shape1)

        weight_shape2 = child.layer2.weights.shape
        random_values2 = np.random.random(weight_shape2)

        # For each random weight if they are smaller than the mutation rate, mutate the weight of the child in this position
        mutation_mask = random_values1 < mutation_rate
        nb_mutations = np.sum(mutation_mask)
        mutation_value = np.random.randn(nb_mutations)
        child.layer1.weights[mutation_mask] += mutation_value

        mutation_mask = random_values2 < mutation_rate
        nb_mutations = np.sum(mutation_mask)
        mutation_value = np.random.randn(nb_mutations)
        child.layer2.weights[mutation_mask] += mutation_value

        # Add this mutated child to the AI's list
        Ai_Sample.append(child)

def Save_Best_Ai(Ai_Sample, save_file):
    # Sort AI from the best performer to the least one
    Ai_Sample.sort(reverse=True)

    # If a save file's name is provided, set it as the save file for this run
    if (len(save_file) > 0) and save_file.find("Saved_AI") == -1:
        SAVE_FILE = os.path.join("Saved_AI", save_file)
    else :
        SAVE_FILE = save_file

    # Create the directory if it doesn't exist
    os.makedirs(os.path.dirname(SAVE_FILE), exist_ok=True)

    # Overwrites any existing file.
    with open(SAVE_FILE, 'wb') as save:
        # Save the 5 best performing AI
        for i in range(5):
            pickle.dump(Ai_Sample[i], save, pickle.HIGHEST_PROTOCOL)

        # Save AI having similar performance as the best one
        for i in range(5, len(Ai_Sample)):
            if( Ai_Sample[i].ai_score > Ai_Sample[0].ai_score * 0.95 ):
                pickle.dump(Ai_Sample[i], save, pickle.HIGHEST_PROTOCOL)
            else:
                break

    # Clean the list
    Ai_Sample.clear()

class Frame:
    ball : AI_ball
    leftPaddle : float
    playerDecision : int

    def __init__(self, ball, leftPaddle, playerDecision):
        self.ball = ball
        self.leftPaddle_y = leftPaddle
        self.playerDecision = playerDecision

def create_frame(frame_data):
    return Frame(AI_ball(frame_data["ball"]["x"],
                        frame_data["ball"]["y"],
                        frame_data["ball"]["dx"],
                        frame_data["ball"]["dy"]),
                frame_data["leftPaddle"], frame_data["playerDecision"])

def get_human_inputs():
    # Read the file
    try:
        with open("./data.json", 'r') as file:
            json_string = file.read()

            try:
                # First, try to parse the JSON
                parsed_data = json.loads(json_string)
                
                # If it's still a string, parse again
                if isinstance(parsed_data, str):
                    parsed_data = json.loads(parsed_data)
                
                # Get first element if it's nested
                if isinstance(parsed_data, list) and len(parsed_data) > 0:
                    match_stats = parsed_data[0]

                frames = [create_frame(frame) for frame in match_stats]

                return frames

            except json.JSONDecodeError as e:
                print(f"JSON parsing error: {e}")
                return
    except Exception as e:
        return None

def train_ai(save_file, base):
    Ai_Sample = []
    frames = get_human_inputs()

    for j in range(NB_GENERATION):
        print(f"\n\n========== Generation #{j}===========\n")
        Ai_Sample = Init_Ai(base)

        for i in range(NB_SPECIES):
            if DISPLAY_GAME == 'yes':
                if train_basic(Ai_Sample[i]) == "STOP":
                    return
            else:
                train_basic_no_display(Ai_Sample[i])
            
            # Train against human's inputs
            if frames == None:
                print(f"AI {i}\tscore is {Ai_Sample[i].ai_score:.1f}")
                continue
            
            ai_ball = AI_ball(frames[0].ball, 0, 0, 0)
            tick = 0
            for frame in frames:
                # Update the ball's position every second
                if tick % 60 == 0:
                    # Mirror ball position for the Ai right's position
                    frame.ball.x = WIDTH - frame.ball.x
                    ai_ball.update(frame.ball, frame.ball.dx * -1, frame.ball.dy)

                # Compare the AI's decision with the player's decision
                if (Ai_Sample[i].decision(frame.leftPaddle_y, ai_ball, HEIGHT) == frame.playerDecision):
                    Ai_Sample[i].ai_score += 0.5
                
                tick += 1
            print(f"The AI {i} score is {Ai_Sample[i].ai_score:.1f}")
        Save_Best_Ai(Ai_Sample, save_file)

def load_Ai(save_file):
    with open(save_file, 'rb') as imp:
        Ai = pickle.load(imp)

        # Create a new Neuron_Network instance
        network = Neuron_Network(5, 3, 3)
        
        # Load the network data from the saved Ai instance
        network.load_from_dict(Ai.to_dict())
        return (network)
