import numpy as np

np.random.seed()

class Layer_Dense:
    def __init__(self, n_inputs, n_neurons):
        self.weights = np.random.randn(n_inputs, n_neurons)             # Weights are set with random numbers
        self.biases = np.zeros((1, n_neurons))                          # Biases are set to 0
    
    def forward(self, inputs):
        self.output = np.dot(inputs, self.weights) + self.biases        # Output are calculate by multiplying each input with theirs weight and then adding the biaises

class Activation_ReLU:
    def forward(self, inputs):
        self.output = np.maximum(0, inputs)

class Activation_SoftMax:
    def forward(self, inputs):
        exp_values = np.exp(inputs - np.max(inputs, axis=1, keepdims=True))  # Protect from overflow. In case of batch inputs, keeps it in the rigth format
        probabilities = exp_values / np.sum(exp_values, axis=1, keepdims=True)
        self.output = probabilities

# # # Number of neurons "rules"
# # Nb_input = 5 (aiBall.x, aiBall.y, aiBall.dx, aiBall.dy, rightPaddle.y)
# # Nb_output = 3 (move up, stop, move down)

# # The number of hidden neurons should be between the size of the input layer and the size of the output layer.
# print("The number of hidden neurons should be between 5 and 3")
# # The number of hidden neurons should be 2/3 the size of the input layer, plus the size of the output layer.
# print("The number of hidden neurons should be 2/3: ", 2 / 3 * (5 + 3))
# # The number of hidden neurons should be less than twice the size of the input layer.
# print("The number of hidden neurons should be less than: ", 2 * 5)
# # Nh = Ns / ( α ∗ ( Ni + No ))
# # Ni = number of input neurons.
# # No = number of output neurons.
# # Ns = number of samples in training data set.
# # α = an arbitrary scaling factor usually 2-10.
# for i in range(2 , 11):
#     print("Nh = Ns / (", i, " * ( Ni + No )) = ", 500/(i*(5+3)))

# # EXAMPLE:
# X = [[1, 2, 3, 2.5],
#      [2.0, 5.0, -1.0, 2.0],
#      [-1.5, 2.7, 3.3, -0.8]]

# # EXAMPLE for Layer_Dense:
# layer1 = Layer_Dense(4, 5)
# layer2 = Layer_Dense(5, 2)

# layer1.forward(X)
# layer2.forward(layer1.output)
# print(layer2.output)

# # EXAMPLE for Activation_ReLU:
# layer1 = Layer_Dense(4, 5)
# activation1 = Activation_ReLU()

# layer1.forward(X)

# print("layer1.output:\n", layer1.output)
# activation1.forward(layer1.output)
# print("\nactivation1.output:\n", activation1.output)

# # EXAMPLE for Activation_SoftMax:
# dense1 = Layer_Dense(4, 3)
# activation1 = Activation_ReLU()

# dense2 = Layer_Dense(3, 3)
# activation2 = Activation_SoftMax()

# dense1.forward(X)
# activation1.forward(dense1.output)

# dense2.forward(activation1.output)
# activation2.forward(dense2.output)

# print(activation2.output)

# # EXAMPLE
# X = [0.1 , 0.4, 7, 7, 0.5]
# dense1 = Layer_Dense(5, 3)
# activation1 = Activation_ReLU()

# # dense2 = Layer_Dense(3, 3)
# activation2 = Activation_SoftMax()

# dense1.forward(X)
# activation1.forward(dense1.output)

# # dense2.forward(activation1.output)
# activation2.forward(activation1.output)

# print(activation2.output)
# print(np.argmax(activation2.output))