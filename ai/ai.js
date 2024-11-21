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

function load_ai() {
  try {
    const setupJson = JSON.stringify( // Insert respond from server
        {"layer1": {"weights": [[-0.7515810547199705, 0.4925975552743896, 0.5279086693135954, -0.1139586378380533, 0.11955027861139103, 0.06649940241703813], [1.0569119613913214, 0.21867491438329917, -0.05156815465165615, 1.1314960354237944, 0.2391733432245025, 1.4147486841880692], [0.16228869300383514, -1.8598383818334798, -1.119694029651742, -1.110543671671019, -0.5347484282018915, 1.2610037366866511], [-1.461313545367413, 0.5578400838231194, -0.6963276428680141, -0.6272092911594809, -1.5835309126002388, 0.11912297449215906], [-0.16953467142025813, -0.3178855707569176, -0.6094645569711266, -0.40350907751749143, 0.791507661519704, 0.10514257885942428]], "biases": [[0.08284983591500729, -0.05215765022000345, -0.037344008171847604, 0.01601344772688661, 0.12752094023096316, 0.08719572327651195]]}, "layer2": {"weights": [[0.4519601456064453, -0.816892472401969, 0.08610248547238065, -0.40434755644227827, -1.4343317196466658, -0.35261158093090983], [-0.7977126703277359, -0.9889206890228264, 0.43204360889787696, -1.1095875757692284, -1.4447119876209593, 0.5093046356138855], [-0.2619407128485387, 0.22403138880468051, -0.9935986431602126, 1.1146739916798332, 0.8540912728179251, 0.5052191665939281], [0.634693566977792, 0.1272759679746157, 0.7979103307242188, 0.3441941085329288, -0.2641669680841891, 0.568468793444121], [-0.11913119088787293, 0.5654595790100289, 1.0395236522257083, -0.1563771859270764, 0.6302811029054762, 0.27879675516308744], [0.47189397741526484, -0.4932966731576448, 0.6459706176378439, 0.3119841739620979, -0.3028576746304973, 0.7203033188955006]], "biases": [[0.06851052740456462, -0.0288259442373991, -0.00020117373879043483, 0.0008650586543270734, 0.04481525969491678, 0.02140189987364574]]}, "layer3": {"weights": [[-0.4938730580019497, 0.606930420175947, 0.550482627996864], [0.312716292137034, 0.7815895605064572, 0.6229075716825336], [0.2821500766509822, -0.04252524267901836, -0.5966634372311503], [0.19020212165299766, 1.7328428951167034, -0.4435117172538613], [-1.5078776665989342, -0.034268185664355445, -0.7887878659167625], [-0.34095808085841106, -0.6098872620315158, -0.1394377699413026]], "biases": [[-0.018985687727857217, -0.018235200637551314, -0.04140061122476779]]}}
    );

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
