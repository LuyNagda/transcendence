class Layer_Dense {
    constructor(weights, biases) {
        this.weights = weights;

        // If biases is not provided, create a zero-filled bias array
        if (!biases || !biases[0]) {
            this.biases = new Array(weights[0].length).fill(0);
        }
        else {
            // Ensure biases is a 1D array
            this.biases = Array.isArray(biases[0])
                ? biases[0]
                : biases;
        }
    }

    forward(inputs){
        // Ensure inputs is a 2D array
        const processed_inputs = Array.isArray(inputs[0])
            ? inputs
            : inputs.map(val => [val]);  // Wrap single values in an array;

        // Perform matrix multiplication
        const matrix_output = this.matrixDot(processed_inputs, this.weights);

        // Ensure matrix_output exists before mapping
        if (!matrix_output || !matrix_output.length) {
            console.error('Matrix multiplication failed');
            return processed_inputs;
        }

        // Add biases to each row of the output
        this.output = matrix_output.map(row =>
            row.map((val, i) => val + this.biases[i])
        );

        return this.output;
    }

    matrixDot(a, b) {
        // Additional safety checks
        if (!a || !a.length || !b || !b.length) {
            console.error('Invalid matrix multiplication inputs');
            return a;
        }

        return a.map(row => 
            b[0].map((_, i) =>
                row.reduce((sum, element, j) => sum + element * b[j][i], 0)
            )
        );
    }
}

class Activation_ReLU {
    forward(inputs) {
        const processed_inputs = Array.isArray(inputs[0]) ? inputs : [inputs];

        this.output = processed_inputs.map(row =>
            Array.isArray(row)
            ? row.map(val => Math.max(0, val))
            : Math.max(0, row));
        return this.output;
    }
}

class Activation_SoftMax {
    forward(inputs) {
        const processed_inputs = Array.isArray(inputs[0]) ? inputs : [inputs];

        const exp_values = processed_inputs.map(row => {
            const max_value = Math.max(...(Array.isArray(row) ? row : [row]));
            return Array.isArray(row)
                ? row.map(val => Math.exp(val - max_value))
                : Math.exp(row - max_value);
        });

        const sum_exp_values = exp_values.map(row => 
            Array.isArray(row) 
                ? row.reduce((a, b) => a + b, 0)
                : row);

        this.output = exp_values.map((row, i) =>
            Array.isArray(row)
                ? row.map(val => val / sum_exp_values[i])
                : row / sum_exp_values[i]
        );

        return this.output;
    }
}

window.Neuron_Network = class {
    constructor(neuron_json) {
        const setup = JSON.parse(neuron_json);
        if (!setup || !setup.layer1 || !setup.layer1.weights
            || !setup.layer2 || !setup.layer2.weights
            || !setup.layer3 || !setup.layer3.weights) {
            throw new Error("Invalid neuron_json structure. Expected:\n{\"layer1\": {\"weights\": [[...]], \"biases\":[[...]]}, \"layer2\": {\"weights\": [[...]], \"biases\":[[...]]}, \"layer3\": {\"weights\": [[...]], \"biases\":[[...]]},")
        }
        this.layer1 = new Layer_Dense(setup.layer1.weights);
        this.layer2 = new Layer_Dense(setup.layer2.weights);
        this.layer3 = new Layer_Dense(setup.layer3.weights);
        this.activation1 = new Activation_ReLU();
        this.activation2 = new Activation_ReLU();
        this.activation3 = new Activation_SoftMax();
    }

    forward(inputs) {
        let output = this.layer1.forward(inputs);
        output = this.activation1.forward(output);
        output = this.layer2.forward(output);
        output = this.activation2.forward(output);
        output = this.layer3.forward(output);
        output = this.activation3.forward(output);
        return output;
       
    }
    
    decision(paddle_y, ball, height) {
        try {
            
            let X = [[ball.x / height, ball.y / height, ball.dx, ball.dy, paddle_y / height]];
            let result = this.forward(X);
            return result[0].indexOf(Math.max(...result[0]));
        }
        catch (error) {
            console.error("Error in Neuron_Network initialization:", error);
            return 1;
        }
    }

    toDict() {
        return {
            layer1: {
                weights: this.layer1.weights,
                biases: this.layer1.biases
            },
            layer2: {
                weights: this.layer2.weights,
                biases: this.layer2.biases
            },
            layer3: {
                weights: this.layer3.weights,
                biases: this.layer3.biases
            },
        };
    }
}

async function download_ai() {
    try {
        if (typeof Neuron_Network === 'undefined') {
            console.error("Neuron_Network is not defined. Make sure ai.js is loaded correctly.");
            return null;
        }

        const response = await fetch('/api/saved-AI/') // Place holder for the correct api fetch

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const aidata = await response.json(); // Parse the aidata from the raw response
        return new Neuron_Network(JSON.stringify (aidata));
    }
    catch (error) {
        console.error("Error in Neuron_Network initialization:", error);
        return null;
    }
}

// Save the player's decision only when the ball is coming toward him
function save_match(set_stats, ball, leftPaddle, playerDecision) {
    if (ball.dx > 0)
        return;

    const state = {
        ball : {
            x: ball.x,
            y: ball.y,
            dx: ball.dx,
            dy: ball.dy      
        },
        leftPaddle : leftPaddle,
        playerDecision : playerDecision
    };

    set_stats.push(state)
}

function saveJsonAsDownload(jsonData) {
    try {
        // Create a Blob containing the JSON data
        const blob = new Blob([jsonData], { type: 'application/json' });
        
        // Create a URL for the Blob
        const url = URL.createObjectURL(blob);
        
        // Create a temporary anchor element
        const link = document.createElement('a');
        link.href = url;
        link.download = 'data.json';
        
        // Append to body, click, and remove
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Clean up the URL
        URL.revokeObjectURL(url);
        
        return true;
    } catch (err) {
        console.error('Error saving file:', err);
        return false;
    }
}
