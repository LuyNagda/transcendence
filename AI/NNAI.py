# from layers import Layer_Dense, Activation_ReLU, Activation_SoftMax

# X = [ 0.75, 0.5, 1.0, 1.0, 0.5 ]

# layer1 = Layer_Dense(5, 4)
# activation1 = Activation_ReLU()
# layer2 = Layer_Dense(4, 3)
# activation2 = Activation_SoftMax()

# layer1.forward(X)
# activation1.forward(layer1.output)
# layer2.forward(activation1.output)
# activation2.forward(layer2.output)

# print(activation2.output)

# class NNAIPong:
#     def __init__(self, species):

def AI_decision(opponent, opponent_ball, HEIGHT):
    if opponent.centery < opponent_ball and opponent.bottom < HEIGHT:
        return 1
    elif opponent.centery > opponent_ball and opponent.top > 0:
        return 2
    else:
        return 0
