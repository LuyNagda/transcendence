# import math

# layers_outputs = [4.8, 1.21, 2.385]

# E = math.e

# exp_values= []

# for output in layers_outputs:
#     exp_values.append(E**output)

# print(exp_values)

# norm_base = sum(exp_values)
# norm_values = []

# for value in exp_values:
#     norm_values.append(value / norm_base)

# print(norm_values)
# print(sum(norm_values))

# For single set of outputs
import numpy as np
import math

# Input -> Exponentiate -> Normalize -> Output
# Softmax = Exponentiate -> Normalize
# Input -> Softmax -> Output

# layers_outputs = [4.8, 1.21, 2.385]

# exp_values= np.exp(layers_outputs - np.max(layers_outputs))              # Protect from overflow by subtracting each values by the max_values

# print(exp_values)

# norm_values = exp_values / np.sum(exp_values)

# print(norm_values)
# print(sum(norm_values))

# Test NNAI

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

