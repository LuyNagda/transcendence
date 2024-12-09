import pickle, os, json, multiprocessing
import numpy as np
from .gamesimulation import train_predefined, train_normal, train_human
from .gameconfig import get_game_config

NB_INPUTS = 5
NB_NEURONS_LAYER1 = 6
NB_NEURONS_LAYER2 = 6
NB_NEURONS_LAYER3 = 3

np.random.seed()

class Layer_Dense:
    def __init__(self, n_inputs, n_neurons):
        # Weights and biases are set with random numbers
        self.weights = np.random.randn(n_inputs, n_neurons)
        self.biases = np.random.randn(1, n_neurons) * 0.1
        
        # # Biases are set to 0
        # self.biases = np.zeros((1, n_neurons))
    
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
    def __init__(self, nb_inputs, nb_layer1_neurons, nb_layer2_neurons, nb_layer3_neurons):
        self.layer1 = Layer_Dense(nb_inputs, nb_layer1_neurons)
        self.activation1 = Activation_ReLU()
        self.layer2 = Layer_Dense(nb_layer1_neurons, nb_layer2_neurons)
        self.activation2 = Activation_ReLU()
        self.layer3 = Layer_Dense(nb_layer2_neurons, nb_layer3_neurons)
        self.activation3 = Activation_SoftMax()
        self.ai_score = 0

    def forward(self, inputs):
        self.output = self.layer1.forward(inputs)
        self.output = self.activation1.forward(self.output)
        self.output = self.layer2.forward(self.output)
        self.output = self.activation2.forward(self.output)
        self.output = self.layer3.forward(self.output)
        self.output = self.activation3.forward(self.output)
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
            },
            "layer3": {
                "weights" : self.layer3.weights.tolist(),
                "biases": self.layer3.biases.tolist()
            }
        }
    
    def to_json(self):
        return json.dumps(self.to_dict())

    def load_from_dict(self, data):
        self.layer1.weights = np.array(data["layer1"]["weights"])
        self.layer1.biases = np.array(data["layer1"]["biases"])
        self.layer2.weights = np.array(data["layer2"]["weights"])
        self.layer2.biases = np.array(data["layer2"]["biases"])
        self.layer3.weights = np.array(data["layer3"]["weights"])
        self.layer3.biases = np.array(data["layer3"]["biases"])

def Init_Ai(save_file):
    Ai_Sample = []
    Ai_Sample.clear()

    if os.path.exists(save_file):
        with open(save_file, 'r') as imp:
            ai_data_list = json.load(imp)
            
            while len(Ai_Sample) < get_game_config('nb_species')[0] and ai_data_list:
                Saved_Ai_dict = ai_data_list.pop(0)
                network = Neuron_Network(NB_INPUTS, NB_NEURONS_LAYER1, NB_NEURONS_LAYER2, NB_NEURONS_LAYER3)
                network.load_from_dict(Saved_Ai_dict)
                Ai_Sample.append(network)

        # Mix weights of the 5 best performing AIs
        Crossover_mutation(Ai_Sample)
        
        # Add random AIs to reach get_game_config('nb_species')
        remaining = get_game_config('nb_species')[0] - len(Ai_Sample)
        for i in range(remaining):
            random_ai = Neuron_Network(NB_INPUTS, NB_NEURONS_LAYER1, NB_NEURONS_LAYER2, NB_NEURONS_LAYER3)
            Ai_Sample.append(random_ai)
        
        print(f"AIs from {save_file} successfully loaded")

    else:
        # Create get_game_config('nb_species') random AIs
        for i in range(get_game_config('nb_species')[0]):
            random_ai = Neuron_Network(NB_INPUTS, NB_NEURONS_LAYER1, NB_NEURONS_LAYER2, NB_NEURONS_LAYER3)
            Ai_Sample.append(random_ai)
        
        print(f"Random AIs successfully loaded")
    
    # Reset scores
    for i in range(get_game_config('nb_species')[0]):
        Ai_Sample[i].ai_score = 0

    return Ai_Sample
    
def Crossover_mutation(Ai_Sample):
    # Crossover and then mutation
    while (len(Ai_Sample) < get_game_config('nb_species')[0] - 5):
        # Choose 2 parent randomly from the 5 best performing AI and instance a child
        parent1, parent2 = np.random.choice(Ai_Sample[:5], 2, replace=False)
        child = Neuron_Network(NB_INPUTS, NB_NEURONS_LAYER1, NB_NEURONS_LAYER2, NB_NEURONS_LAYER3)

        # Crossover for both weights and biases
        child.layer1.weights = (parent1.layer1.weights + parent2.layer1.weights) / 2
        child.layer1.biases = (parent1.layer1.biases + parent2.layer1.biases) / 2
        child.layer2.weights = (parent1.layer2.weights + parent2.layer2.weights) / 2
        child.layer2.biases = (parent1.layer2.biases + parent2.layer2.biases) / 2
        child.layer3.weights = (parent1.layer3.weights + parent2.layer3.weights) / 2
        child.layer3.biases = (parent1.layer3.biases + parent2.layer3.biases) / 2

        # Mutation rate can be different for weights and biases
        weight_mutation_rate = 0.1
        bias_mutation_rate = 0.05

        # Mutate weights
        weight_shape = child.layer1.weights.shape
        random_values = np.random.random(weight_shape)
        mutation_mask = random_values < weight_mutation_rate
        nb_mutations = np.sum(mutation_mask)
        mutation_value = np.random.randn(nb_mutations) * 0.1
        child.layer1.weights[mutation_mask] += mutation_value

        # Mutate biases
        bias_shape = child.layer1.biases.shape
        random_values = np.random.random(bias_shape)
        mutation_mask = random_values < bias_mutation_rate
        nb_mutations = np.sum(mutation_mask)
        mutation_value = np.random.randn(nb_mutations) * 0.05
        child.layer1.biases[mutation_mask] += mutation_value

        # Do the same for layer2
        # Weights
        weight_shape = child.layer2.weights.shape
        random_values = np.random.random(weight_shape)
        mutation_mask = random_values < weight_mutation_rate
        nb_mutations = np.sum(mutation_mask)
        mutation_value = np.random.randn(nb_mutations) * 0.1
        child.layer2.weights[mutation_mask] += mutation_value

        # Biases
        bias_shape = child.layer2.biases.shape
        random_values = np.random.random(bias_shape)
        mutation_mask = random_values < bias_mutation_rate
        nb_mutations = np.sum(mutation_mask)
        mutation_value = np.random.randn(nb_mutations) * 0.05
        child.layer2.biases[mutation_mask] += mutation_value

        # Do the same for layer3
        # Weights
        weight_shape = child.layer3.weights.shape
        random_values = np.random.random(weight_shape)
        mutation_mask = random_values < weight_mutation_rate
        nb_mutations = np.sum(mutation_mask)
        mutation_value = np.random.randn(nb_mutations) * 0.1
        child.layer3.weights[mutation_mask] += mutation_value

        # Biases
        bias_shape = child.layer3.biases.shape
        random_values = np.random.random(bias_shape)
        mutation_mask = random_values < bias_mutation_rate
        nb_mutations = np.sum(mutation_mask)
        mutation_value = np.random.randn(nb_mutations) * 0.05
        child.layer3.biases[mutation_mask] += mutation_value

        # Add this mutated child to the AI's list
        Ai_Sample.append(child)

def Save_Best_Ai(Ai_Sample, save_file):
    # Sort AI from the best performer to the least one
    Ai_Sample.sort(reverse=True)

    # Create the directory if it doesn't exist
    os.makedirs(os.path.dirname(save_file), exist_ok=True)

    ai_data_list = []
    for i in range(5):
        ai_data_list.append(Ai_Sample[i].to_dict())
    
    for i in range(5, len(Ai_Sample)):
        if Ai_Sample[i].ai_score > Ai_Sample[0].ai_score * 0.90:
            ai_data_list.append(Ai_Sample[i].to_dict())
        else:
            break
    
    # Save entire list as JSON
    with open(save_file, 'w') as save:
        json.dump(ai_data_list, save)

    # Clean the list
    Ai_Sample.clear()

def train_species_wrapper(args):
    """
    Wrapper function to unpack arguments for train_normal
    
    :param args: Tuple (Ai_selected, Ai_nb)
    :return: Training result or log
    """
    Ai_selected, Ai_nb = args
    training_log = train_normal(Ai_selected, Ai_nb)
    print(training_log)
    point = Ai_selected.ai_score
    return training_log, point, Ai_nb

def train_ai(save_file):
    Ai_Sample = []
    log = ""

    nb_generation = get_game_config('nb_generation')[0]
    for j in range(nb_generation):
        log_gen = (
            f"\n        ========== Generation #{j} ===========\n"
            f"Max score = {get_game_config('max_score')[0]}\n\n"
        )
        
        print(log_gen)

        Ai_Sample = Init_Ai(save_file)

        # Prepare arguments for parallel processing
        training_args = [(Ai_Sample[i], i) for i in range(get_game_config('nb_species')[0])]

        # Use all available CPU cores except one
        with multiprocessing.Pool(processes=(multiprocessing.cpu_count() - 1)) as pool:
            training_results = pool.map(train_species_wrapper, training_args)

        for training_log, point, Ai_nb in training_results:
            log_gen += training_log + "\n"
            Ai_Sample[Ai_nb].ai_score = point

        Save_Best_Ai(Ai_Sample, save_file)
        log += log_gen
    
    return log

def load_Ai(save_file):
    with open(save_file, 'r') as imp:
        # Load first AI from JSON
        Ai_dict = json.load(imp)

        # Create a new Neuron_Network instance
        network = Neuron_Network(NB_INPUTS, NB_NEURONS_LAYER1, NB_NEURONS_LAYER2, NB_NEURONS_LAYER3)
        
        # Load the network data from the saved Ai dictionary
        network.load_from_dict(Ai_dict)
        return network