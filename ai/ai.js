class Layer_Dense {
    constructor(weights, biases) {
        this.weights = weights
        this.biases = biases
    }

    forward(inputs){
        this.output = this.matrixDot(inputs, this.weights) + this.biases
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
        let X = [[ball.x / height, ball.y / height, ball.dx, ball.dy, paddle_y / height]];
        let result = this.forward(X);
        return result[0].indexOf(Math.max(...result[0]));
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

function load_ai() {
  try {
    const setupJson = JSON.stringify({ // Insert respond from server
    "layer1": {
        "weights":
            [[-0.77122871, 0.41526285, 0.52767287,-0.33445871, 0.12302013, 0.06649551],
            [ 1.06295508, 0.23984624, -0.05647919, 1.11483603, 0.22362374, 1.43500877],
            [ 0.16940373,-1.85075033, -1.11887775, -1.11044702, -0.53549401, 1.27106046],
            [-1.43770982, 0.55878297, -0.62009402, -0.59799902, -1.54379893, 0.11580803],
            [-0.17091211,-0.31699362, -0.60562698, -0.4307457, 0.77251168, 0.1782166 ]],
        "biases":
            [[ 0.03925517, -0.04614097, -0.03728665, 0.03021453, 0.12752094, 0.08719572]]
        },
    "layer2": {
        "weights":
            [[ 0.45876816, -0.77967134, 0.06071178, -0.47541534, -1.41814187, -0.30965651],
            [-0.78593817, -1.0236146,   0.49336344, -0.97531939, -1.46952453,  0.51245849],
            [-0.25305294,  0.22055684, -1.08828992,  1.12113069,  0.8659473,   0.50516511],
            [ 0.66053507,  0.13860306,  0.7979378 ,  0.33391144, -0.30473416,  0.51275856],
            [-0.1188813 ,  0.53757145,  1.03160834, -0.15643701,  0.63040006,  0.27304459],
            [ 0.47189398, -0.50450811,  0.61304766,  0.37825662, -0.34945819,  0.72028791]],
        "biases":
            [[ 0.04167146, -0.02883263, -0.00028841,  0.00081215,  0.04262164,  0.02168512]]
        },
    "layer3": {
        "weights":
            [[-0.49685347,  0.58339559,  0.55374801],
            [ 0.41489293,  0.59089499,  0.62306509],
            [ 0.28206031, -0.04252524, -0.56009104],
            [ 0.18392271,  1.83954997, -0.48803141],
            [-1.49555131,  0.05271705, -0.70907336],
            [-0.34078161, -0.60988726, -0.13804254]],
        "biases":
            [[-0.01222091 -0.01847086 -0.04137601]]
        }
    });

    if (typeof Neuron_Network === 'undefined') {
      console.error("Neuron_Network is not defined. Make sure ai.js is loaded correctly.");
      return null;
    }

    return new Neuron_Network(setupJson);
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
