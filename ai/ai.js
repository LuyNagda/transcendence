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

export class Neuron_Network {
    constructor(neuron_json) {
    //     // let setup = JSON.parse(neuron_json)

    //     let setup;
    //     if (typeof neuron_json === 'string') {
    //         try {
    //             setup = JSON.parse(neuron_json);
    //         } catch (e) {
    //             console.error("Error parsing JSON:", e);
    //             throw new Error("Invalid JSON string provided");
    //         }
    //     } else if (typeof neuron_json === 'object') {
    //         setup = neuron_json;
    //     } else {
    //         throw new Error("Invalid setup provided. Must be a JSON string or object.");
    //     }

    //     if (!setup || !setup.layers1 || !setup.layers1.weights) {
    //         throw new Error("Invalid setup structure. Must contain layers1.weights.");
    //     }

    //     this.layer1 = new Layer_Dense(setup.layer1.weights)
    //     this.activation1 = new Activation_ReLU()
    //     this.activation2 = new Activation_SoftMax()
        console.log("NeuronNetwork constructor called with:", setupJson);
        console.log("Type of setupJson:", typeof setupJson);

        let setup;
        if (typeof setupJson === 'string') {
            try {
                setup = JSON.parse(setupJson);
                console.log("Parsed JSON:", setup);
            } catch (e) {
                console.error("Error parsing JSON:", e);
                throw new Error("Invalid JSON string provided: " + e.message);
            }
        } else if (typeof setupJson === 'object') {
            setup = setupJson;
            console.log("Using provided object:", setup);
        } else {
            console.error("Invalid setup type:", typeof setupJson);
            throw new Error("Invalid setup provided. Must be a JSON string or object.");
        }

        console.log("Setup after parsing:", setup);

        if (!setup) {
            console.error("Setup is undefined or null");
            throw new Error("Setup is undefined or null");
        }

        console.log("Setup keys:", Object.keys(setup));

        if (!setup.layers1) {
            console.error("Missing layers1 in setup:", setup);
            throw new Error("Invalid setup structure. Missing layers1.");
        }

        console.log("layers1:", setup.layers1);

        if (!setup.layers1.weights) {
            console.error("Missing weights in layers1:", setup.layers1);
            throw new Error("Invalid setup structure. Missing layers1.weights.");
        }

        console.log("weights:", setup.layers1.weights);

        this.layer1 = new LayerDense(setup.layers1.weights);
        this.activation1 = new ActivationReLU();
        this.activation2 = new ActivationSoftMax();
        console.log("NeuronNetwork initialized successfully");
    }

    forward(inputs) {
        let output = this.layer1.forward(inputs)
        output = this.activation1.forward(output)
        output = this.activation2.forward(output)

        return output
    }
    
    toDict() {
        return {
            layers1: {
                weights: this.layer1.weights
            }
        };
    }
}
