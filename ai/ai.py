import os, json, multiprocessing, logging
import numpy as np
from ai.gamesimulation import train_normal
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync

logger = logging.getLogger(__name__)

NB_INPUTS = 5
NB_NEURONS_LAYER1 = 6
NB_NEURONS_LAYER2 = 6
NB_NEURONS_LAYER3 = 3

WEIGHT_MUTATION_RATE = 0.1
BIAS_MUTATION_RATE = 0.05

np.random.seed()

class Layer_Dense:
    def __init__(self, n_inputs, n_neurons):
        # Weights and biases are set with random numbers
        self.weights = np.random.randn(n_inputs, n_neurons)
        self.biases = np.random.randn(1, n_neurons) * 0.1
        
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
        self.sample_gen = 0

    def __copy__(self):
        """Copy constructor to create a new instance with the same weights and biases."""
        new_network = Neuron_Network(NB_INPUTS, NB_NEURONS_LAYER1, NB_NEURONS_LAYER2, NB_NEURONS_LAYER3)
        
        new_network.layer1.weights = self.layer1.weights.copy()
        new_network.layer1.biases = self.layer1.biases.copy()
        new_network.layer2.weights = self.layer2.weights.copy()
        new_network.layer2.biases = self.layer2.biases.copy()
        new_network.layer3.weights = self.layer3.weights.copy()
        new_network.layer3.biases = self.layer3.biases.copy()
        
        new_network.ai_score = self.ai_score
        new_network.sample_gen = self.sample_gen
        return new_network

    def forward(self, inputs):
        self.output = self.layer1.forward(inputs)
        self.output = self.activation1.forward(self.output)
        self.output = self.layer2.forward(self.output)
        self.output = self.activation2.forward(self.output)
        self.output = self.layer3.forward(self.output)
        self.output = self.activation3.forward(self.output)
        return self.output
    
    def decision(self, paddle_y, ball, height, width):
        ball_relative_x = ball.center_x / width
        ball_relative_y = ball.center_y / height
        paddle_relative_y = paddle_y / height

        X = [ball_relative_x, ball_relative_y, ball.dx, ball.dy, paddle_relative_y]
        response = self.forward(X)

        return np.argmax(response)
    
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

def Init_Ai(save_file, nb_species):
    Ai_Sample = []
    Ai_Sample.clear()

    if os.path.exists(save_file):
        with open(save_file, 'r') as imp:
            ai_data_list = json.load(imp)
            
            while len(Ai_Sample) < nb_species and ai_data_list:
                Saved_Ai_dict = ai_data_list.pop(0)
                network = Neuron_Network(NB_INPUTS, NB_NEURONS_LAYER1, NB_NEURONS_LAYER2, NB_NEURONS_LAYER3)
                network.load_from_dict(Saved_Ai_dict)
                Ai_Sample.append(network)

        # Mutate weights of the 5 best performing AIs
        Crossover_mutation(Ai_Sample, nb_species)
        
        # Add random AIs to reach 'nb_species'
        remaining = nb_species - len(Ai_Sample)
        for i in range(remaining):
            random_ai = Neuron_Network(NB_INPUTS, NB_NEURONS_LAYER1, NB_NEURONS_LAYER2, NB_NEURONS_LAYER3)
            Ai_Sample.append(random_ai)
        
        print(f"AIs from {save_file} successfully loaded")

    else:
        # Create 'nb_species' random AIs
        for i in range(nb_species):
            random_ai = Neuron_Network(NB_INPUTS, NB_NEURONS_LAYER1, NB_NEURONS_LAYER2, NB_NEURONS_LAYER3)
            Ai_Sample.append(random_ai)
        
        print(f"Random AIs successfully loaded")
    
    # Reset scores
    for i in range(nb_species):
        Ai_Sample[i].ai_score = 0

    return Ai_Sample

def apply_mutation(layer):
    """
    Apply mutation to the weights and biases of a neural network layer.

    Parameters:
    layer (Layer_Dense): The layer to mutate.

    Returns:
    Layer_Dense: The mutated layer.

    Raises:
    Exception: If an error occurs during mutation.
    """

    try:
        # Get weights' matrix shape
        weight_shape = layer.weights.shape
        # Generate a matrix with random value
        random_values = np.random.random(weight_shape)
        # Creat a boolean mask, true indicates the weight that will mutate
        mutation_mask = random_values < WEIGHT_MUTATION_RATE
        # Count the number of mutations
        nb_mutations = np.sum(mutation_mask)
        # Generate some mutation values
        mutation_value = np.random.randn(nb_mutations) * 0.1
        # Add the mutations to the weights specified byt the mutation mask
        layer.weights[mutation_mask] += mutation_value

        # Do the same for the biases
        bias_shape = layer.biases.shape
        random_values = np.random.random(bias_shape)
        mutation_mask = random_values < BIAS_MUTATION_RATE
        nb_mutations = np.sum(mutation_mask)
        mutation_value = np.random.randn(nb_mutations) * 0.05
        layer.biases[mutation_mask] += mutation_value

    except FloatingPointError as e:
        raise Exception(f"Numerical error during mutation: {e}")

    except Exception as e:
        raise Exception(f"An unexpected error occurred during mutation: {e}")

    return layer

def Crossover_mutation(Ai_Sample, nb_species):
    """
    Perform crossover and mutation on a population of AI samples.

    Parameters:
    Ai_Sample (list): The current population of AI samples.
    nb_species (int): The target number of species in the population.

    Returns:
    None
    """

    # Crossover & Mutation
    while (len(Ai_Sample) < nb_species - 5):
        # Select 2 parent randomly from the 5 best performing AI and instance a child
        parent1, parent2 = np.random.choice(Ai_Sample[:5], 2, replace=False)
        child = Neuron_Network(NB_INPUTS, NB_NEURONS_LAYER1, NB_NEURONS_LAYER2, NB_NEURONS_LAYER3)

        # Crossover for both weights and biases
        child.layer1.weights = (parent1.layer1.weights + parent2.layer1.weights) / 2
        child.layer1.biases = (parent1.layer1.biases + parent2.layer1.biases) / 2
        child.layer2.weights = (parent1.layer2.weights + parent2.layer2.weights) / 2
        child.layer2.biases = (parent1.layer2.biases + parent2.layer2.biases) / 2
        child.layer3.weights = (parent1.layer3.weights + parent2.layer3.weights) / 2
        child.layer3.biases = (parent1.layer3.biases + parent2.layer3.biases) / 2

        # Mutate for both weights and biases
        child.layer1 = apply_mutation(child.layer1)
        child.layer2 = apply_mutation(child.layer2)
        child.layer3 = apply_mutation(child.layer3)

        # Add this mutated child to the AI's list
        Ai_Sample.append(child)

def Save_Best_Ai(Ai_Sample, save_file):
    # Sort AI from the best performer to the least one
    Ai_Sample.sort(reverse=True)

    if (Ai_Sample[0].ai_score == 0):
        print("Save aborted: no competent AI find")
        return

    # Create the directory if it doesn't exist
    os.makedirs(os.path.dirname(save_file), exist_ok=True)

    ai_data_list = []
    for i in range(5):
        ai_data_list.append(Ai_Sample[i].to_dict())
    
    for i in range(5, len(Ai_Sample)):
        if Ai_Sample[i].ai_score > Ai_Sample[0].ai_score * 0.95:
            ai_data_list.append(Ai_Sample[i].to_dict())
        else:
            break
    
    # Save entire list as JSON
    with open(save_file, 'w') as save:
        json.dump(ai_data_list, save)
        print("Save complete: ", save_file)

    # Clean the list
    Ai_Sample.clear()

def train_species_wrapper(args):
    """
    Wrapper function to unpack arguments for train_normal
    
    :param args: Tuple (Ai_selected, Ai_nb)
    :return: Training result or log
    """
    Ai_selected, Ai_nb, time_limit, max_score = args
    training_log = train_normal(Ai_selected, Ai_nb, time_limit, max_score)

    logger.info(training_log)

    point = Ai_selected.ai_score
    return training_log, point, Ai_nb

def train_ai(ai_name, save_file, training_params):
    Ai_Sample = []
    send_training_update(f"Start of {ai_name}'s training")

    nb_generation = training_params.get('nb_generation')
    nb_species = training_params.get('nb_species')
    time_limit = training_params.get('time_limit')
    max_score = training_params.get('max_score')

    for j in range(nb_generation):
        log_header = ""
        log_header += (
            f"\n        ========== Generation #{j} ===========\n"
            f"Max score = {max_score}\n\n"
        )

        logger.info(log_header)
        send_training_update(log_header)

        try:
            Ai_Sample = Init_Ai(save_file, nb_species)
        
        except Exception as e:
            error = f"Error in Ai initialisation: {e}"
            send_training_update(error)
            logger.error(error)
            continue

        # Prepare arguments for parallel processing
        training_args = [(Ai_Sample[i], i, time_limit, max_score) for i in range(nb_species)]

        # Use half of available CPU cores
        nb_core = max(1, multiprocessing.cpu_count() // 2)
        with multiprocessing.Pool(processes=(nb_core)) as pool:
            training_results = pool.map(train_species_wrapper, training_args)

        for training_log, point, Ai_nb in training_results:
            send_training_update(training_log)
            Ai_Sample[Ai_nb].ai_score = point

        Save_Best_Ai(Ai_Sample, save_file)

def load_Ai(save_file):
    with open(save_file, 'r') as imp:
        # Load first AI from JSON
        ai_dict = json.load(imp)

        # Create a new Neuron_Network instance
        network = Neuron_Network(NB_INPUTS, NB_NEURONS_LAYER1, NB_NEURONS_LAYER2, NB_NEURONS_LAYER3)
        
        # Load the network data from the saved Ai dictionary
        network.load_from_dict(ai_dict)
        return network

def send_training_update(log_message):
    """Send AI training log updates to all users via WebSocket."""
    channel_layer = get_channel_layer()
    async_to_sync(channel_layer.group_send)(
        "ai_group",
        {
            "type": "ai_training_log",
            "message": log_message
        }
    )