from layers import Layer_Dense, Activation_ReLU, Activation_SoftMax
import numpy as np

class Neuron_Network:
    def __init__(self):
        self.layer1 = Layer_Dense(5, 3)
        self.activation1 = Activation_ReLU()
        # self.layer2 = Layer_Dense(3, 3)
        self.activation2 = Activation_SoftMax()
        self.ai_score = 0

    def __lt__(self, other):
        return ((self.ai_score) < (other.ai_score))
    
    def __repr__(self):
        return str(self.ai_score)

def AI_neurons(ai, X):
    ai.layer1.forward(X)
    ai.activation1.forward(ai.layer1.output)

    # ai.layer2.forward(ai.activation1.output)
    # ai.activation2.forward(ai.layer2.output)

    # return np.argmax(ai.activation2.output)

    ai.activation2.forward(ai.activation1.output)
    ai_response = np.argmax(ai.activation2.output)

    return ai_response

def AI_decision(ai, opponent, ai_ball, HEIGHT):
    X = [ai_ball.x / HEIGHT, ai_ball.y / HEIGHT, ai_ball.dx, ai_ball.dy, opponent.y]
    return AI_neurons(ai, X)

    
