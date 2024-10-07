class Layer_Dense {
    constructor(weights) {
        this.weights = weights
    }

    forward(inputs){
        this.output = this.matrixDot(inputs, this.weights)
        return this.output
    }

    matrixDot(a, b) {
        return a.map(row => 
            b[0].map((_, i) =>
                row.reduce((sum, element, j) => sum + element * b[j][i], 0)
            )
        )
    };
}

class Activation_ReLU {
    forward(inputs) {
        this.output = inputs.map(row => Array.isArray(row) ? row.map(val => Math.max(0, val)) : Math.max(0, row));
        return this.output;
    }
}

class Activation_SoftMax {
    forward(inputs) {
        const exp_values = inputs.map(row => {
            const max_value = Math.max(...(Array.isArray(row) ? row : [row]));
            return Array.isArray(row) ? row.map(val => Math.exp(val - max_value)) : Math.exp(row - max_value);
        });

        const sum_exp_values = exp_values.map(row => Array.isArray(row) ? row.reduce((a, b) => a + b, 0) : row);

        this.output = exp_values.map((row, i) =>
            Array.isArray(row) ? row.map(val => val / sum_exp_values[i]) : row / sum_exp_values[i]
        );

        return this.output;
    }
}

export class Neuron_Network {
    constructor(neuron_json) {
        const setup = JSON.parse(neuron_json);
        if (!setup || !setup.layer1 || !setup.layer1.weights) {
            throw new Error("Invalid neuron_json structure. Expected {layer1: {weights: [...]}}")
        }
        this.layer1 = new Layer_Dense(setup.layer1.weights);
        this.activation1 = new Activation_ReLU();
        this.activation2 = new Activation_SoftMax();
    }

    forward(inputs) {
        let output = this.layer1.forward(inputs);
        output = this.activation1.forward(output);
        output = this.activation2.forward(output);
        return output;
    }

    decision(paddle, ball, height) {
        let X = [[ball.x / height, ball.y / height, ball.dx, ball.dy, paddle.y / height]];
        let result = this.forward(X);
        return result[0].indexOf(Math.max(...result[0]));
    }

    toDict() {
        return {
            layer1: {
                weights: this.layer1.weights
            }
        };
    }
}
