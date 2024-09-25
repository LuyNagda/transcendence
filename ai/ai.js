class Layer_Dense {
    constructor(weights) {
        this.weights = weights
    }

    forward(inputs){
        this.output = this.matrixDot(inputs, this.weights)
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
        this.output = inputs.map(row => row.map(val = Math.max(0, val)))
        
        return this.output
    }
}

class Activation_SoftMax {
    forward(inputs) {
        const exp_values = inputs.map(row => {
            const max_value = Math.max(...row)
            return row.map(val => Math.exp(val - max_value))
        })

        const sum_exp_values = exp_values.map(row => row.reduce((a, b) => a + b, 0))

        this.output = exp_values.map((row, i) =>
            row.map(val => val / sum_exp_values[i])
        )

        return this.output
    }
}

class Neuron_Network {
    constructor(neuron_json) {
        const setup = JSON.parse(neuron_json)
        this.layer1 = new Layer_Dense(setup.layer1.weights)
        this.activation1 = new Activation_ReLU()
        this.activation2 = new Activation_SoftMax()
    }

    forward(inputs) {
        let output = this.layer1.forward(inputs)
        output = this.activation1.forward(output)
        output = this.activation2.forward(output)

        return output
    }
}
