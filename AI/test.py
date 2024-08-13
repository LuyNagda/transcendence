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

layers_outputs = [4.8, 1.21, 2.385]

exp_values= np.exp(layers_outputs - np.max(layers_outputs))              # Protect from overflow by subtracting each values by the max_values

print(exp_values)

norm_values = exp_values / np.sum(exp_values)

print(norm_values)
print(sum(norm_values))