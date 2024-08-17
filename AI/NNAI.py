from layers import Layer_Dense, Activation_ReLU, Activation_SoftMax
import numpy as np

class Neuron_Network:
    def __init__(self):
        self.layer1 = Layer_Dense(5, 4)
        self.activation1 = Activation_ReLU()
        self.layer2 = Layer_Dense(4, 3)
        self.activation2 = Activation_SoftMax()
        self.ai_score = 0

def AI_neurons(ai, X):
    ai.layer1.forward(X)
    ai.activation1.forward(ai.layer1.output)
    ai.layer2.forward(ai.activation1.output)
    ai.activation2.forward(ai.layer2.output)

    return np.argmax(ai.activation2.output)

def AI_decision(ai, opponent, opponent_ball, HEIGHT):
    X = [opponent_ball.x / HEIGHT, opponent_ball.y / HEIGHT, opponent_ball.dx, opponent_ball.dy, opponent.y]
    return AI_neurons(ai, X)

# def Save_Best_Ai(Ai_Sample):
    
