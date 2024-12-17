import logger from "../utils/logger.js";

class Layer_Dense {
    constructor(weights, biases) {
        this.weights = weights;

        // If biases is not provided, create a zero-filled bias array
        if (!biases || !biases[0]) {
            logger.debug('No biases provided, creating zero-filled array');
            this.biases = new Array(weights[0].length).fill(0);
        }
        else {
            // Ensure biases is a 1D array
            logger.debug('Using provided biases');
            this.biases = Array.isArray(biases[0])
                ? biases[0]
                : biases;
        }
    }

    forward(inputs) {
        logger.debug('Layer_Dense forward pass starting');
        // Ensure inputs is a 2D array
        const processed_inputs = Array.isArray(inputs[0])
            ? inputs
            : inputs.map(val => [val]);  // Wrap single values in an array;

        // Perform matrix multiplication
        const matrix_output = this.matrixDot(processed_inputs, this.weights);

        // Ensure matrix_output exists before mapping
        if (!matrix_output || !matrix_output.length) {
            logger.error('Matrix multiplication failed in Layer_Dense forward pass');
            return processed_inputs;
        }

        // Add biases to each row of the output
        this.output = matrix_output.map(row =>
            row.map((val, i) => val + this.biases[i])
        );

        logger.debug('Layer_Dense forward pass completed');
        return this.output;
    }

    matrixDot(a, b) {
        logger.debug('Starting matrix multiplication');
        // Additional safety checks
        if (!a || !a.length || !b || !b.length) {
            logger.error('Invalid matrix multiplication inputs', { a, b });
            return a;
        }

        return a.map(row =>
            b[0].map((_, i) =>
                row.reduce((sum, element, j) => sum + element * b[j][i], 0)
            )
        );
    }
}

// Activation with rectified linear unit: negative output are set to 0
class Activation_ReLU {
    forward(inputs) {
        logger.debug('ReLU activation forward pass starting');
        const processed_inputs = Array.isArray(inputs[0]) ? inputs : [inputs];

        this.output = processed_inputs.map(row =>
            Array.isArray(row)
                ? row.map(val => Math.max(0, val))
                : Math.max(0, row));
        logger.debug('ReLU activation forward pass completed');
        return this.output;
    }
}

// Activation_SoftMax takes input numbers and normalizes it into a probability distribution
class Activation_SoftMax {
    forward(inputs) {
        logger.debug('SoftMax activation forward pass starting');
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

        logger.debug('SoftMax activation forward pass completed');
        return this.output;
    }
}

export class AIController {
    static instance = null;

    constructor() {
        logger.info('Initializing AIController');
        this.layer1 = null;
        this.layer2 = null;
        this.layer3 = null;
        this.activation1 = null;
        this.activation2 = null;
        this.activation3 = null;
        this.aiBall = null;
        this.lastBallUpdate = 0;
    }

    static async init(difficulty) {
        try {
            if (this.instance) {
                logger.info('Returning existing AIController instance');
                return this.instance;
            }

            logger.info('Creating new AIController instance');
            this.instance = new AIController();

            logger.info(`Initializing AI with difficulty: ${difficulty}`);

            const response = await fetch(`/ai/get-ai`); // Place holder for the correct api fetch
            if (!response.ok) {
                logger.error(`Failed to fetch AI data: ${response.status}`);
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const setup = await response.json();
            logger.debug('Received AI data from server', setup);
            if (!setup || !setup.layer1 || !setup.layer1.weights
                || !setup.layer2 || !setup.layer2.weights
                || !setup.layer3 || !setup.layer3.weights) {
                logger.error('Invalid AI data structure received');
                throw new Error("Invalid neuron_json structure. Expected:\n{\"layer1\": {\"weights\": [[...]], \"biases\":[[...]]}, \"layer2\": {\"weights\": [[...]], \"biases\":[[...]]}, \"layer3\": {\"weights\": [[...]], \"biases\":[[...]]},")
            }

            logger.info('Initializing neural network layers');
            this.layer1 = new Layer_Dense(setup.layer1.weights);
            this.layer2 = new Layer_Dense(setup.layer2.weights);
            this.layer3 = new Layer_Dense(setup.layer3.weights);
            this.activation1 = new Activation_ReLU();
            this.activation2 = new Activation_ReLU();
            this.activation3 = new Activation_SoftMax();

            logger.info('AIController initialization completed successfully');
            return this.instance;
        }
        catch (error) {
            logger.error('Error in AIController initialization:', error);
            return null;
        }
    }

    decision(gameState) {
        logger.debug('Making AI decision', { gameState });
        const currentTime = Date.now();
        const timeLastUpdate = currentTime - this.lastBallUpdate;

        // Update the ai's ball every seconde (1000ms)
        if (this.lastBallUpdate == 0 || timeLastUpdate >= 1000){
            this.lastBallUpdate = currentTime;
            this.aiBall = gameState.ball;
        }

        try {
            let X = [[this.aiBall.x / height,
                this.aiBall.y / height,
                this.aiBall.dx,
                this.aiBall.dy,
                gameState.leftPaddle.y / height]];

            let result = this.forward(X);
            logger.debug('AI decision result', { result });
            return result[0].indexOf(Math.max(...result[0]));
        }
        catch (error) {
            logger.error('Error in AI decision making:', error);
            return 1;
        }
    }

    forward(inputs) {
        logger.debug('Starting forward propagation', { inputs });
        let output = this.layer1.forward(inputs);
        output = this.activation1.forward(output);
        output = this.layer2.forward(output);
        output = this.activation2.forward(output);
        output = this.layer3.forward(output);
        output = this.activation3.forward(output);
        logger.debug('Forward propagation completed', { output });
        return output;
    }

    toDict() {
        logger.debug('Converting AI model to dictionary');
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

    // Save the player's decision only when the ball is coming toward him and don't miss it
    save_match(set_stats, ball, leftPaddle, playerDecision) {
        if (ball.dx > 0) {
            logger.debug('Ball moving away, skipping state save');
            return;
        }

        logger.info('Saving match state');
        const state = {
            ball: {
                x: ball.x,
                y: ball.y,
                dx: ball.dx,
                dy: ball.dy
            },
            leftPaddle: leftPaddle,
            playerDecision: playerDecision
        };

        set_stats.push(state);
        logger.debug('Match state saved', { state });
    }

    saveJsonAsDownload(jsonData) {
        try {
            logger.info('Starting JSON download');
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

            logger.info('JSON download completed successfully');
            return true;
        } catch (err) {
            logger.error('Error saving JSON file:', err);
            return false;
        }
    }
}
