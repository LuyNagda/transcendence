import logger from '../logger.js';
import { store } from '../state/store.js'
import { aiActions } from '../state/aiState.js'
import { connectionManager } from '../networking/ConnectionManager.js';

// Function to initialize the AI WebSocket connection
function initializeAiSocket() {
    const aiConnectionGroup = connectionManager.createConnectionGroup('ai', {
        main: {
            type: 'websocket',
            config: {
                endpoint: '/ws/ai-training/',
                options: {
                    maxReconnectAttempts: 5,
                    reconnectInterval: 1000,
                    connectionTimeout: 10000
                }
            }
        }
    });

    aiConnectionGroup.get('main').on('message', (data) => {
        if (data.type === 'ai_training_started') {
            store.dispatch({
                domain: 'ai',
                type: aiActions.START_TRAINING
            });
        } else if (data.type === 'ai_training_ended') {
            store.dispatch({
                domain: 'ai',
                type: aiActions.END_TRAINING
            });
        } else if (data.type === 'ai_modified') {
            logger.info('[AiManager] ai_modified message received')
            fetchSavedAIs()
        } else if (data.type === 'ai_training_log') {
            logger.info("[AI Training Log]:", data.content);
            updateManagingLog(data)
        }
    });

    aiConnectionGroup.get('main').on('close', () => {
        logger.info('[AiManager] AI WebSocket connection closed');
    });

    aiConnectionGroup.get('main').on('error', (error) => {
        logger.error('[AiManager] AI WebSocket error:', error);
    });

    connectionManager.connectGroup('ai');
}

// Function to handle training button state
function updateTrainingButtonState(isTrainingInProgress) {
    logger.info('[AiManager] Updating button state:', isTrainingInProgress);

    const trainingButton = document.getElementById('train-ai-btn');
    const deleteButton = document.getElementById('delete-ai-btn');

    if (trainingButton) {
        trainingButton.disabled = isTrainingInProgress;
        trainingButton.innerText = isTrainingInProgress ? 'Training in progress ...' : 'Start Training';
    } else {
        logger.warn('[AiManager] Training button not found!');
    }

    if (deleteButton) {
        deleteButton.disabled = isTrainingInProgress;
        deleteButton.innerText = isTrainingInProgress ? 'Server is busy ...' : 'Delete AI';
    } else {
        logger.warn('[AiManager] Delete button not found!');
    }
}

// Subscribe to the AI state to listen for training status changes
store.subscribe('ai', (aiState) => {
    const isTrainingInProgress = aiState.trainingInProgress;
    updateTrainingButtonState(isTrainingInProgress);
});

// Append log to the UI
function updateManagingLog(data) {
    const managingLog = document.getElementById("managing-log");

    // If the log message indicates the start of training, clear the log
    if (data.content.startsWith("Start of ")) {
        managingLog.innerText = "AI manager's log:\n"; // Clear previous logs
    }

    if (managingLog) {
        managingLog.innerText += data.content + "\n";
    }
}

// Append log to the UI
function updateManagingLog(data) {
    const managingLog = document.getElementById("managing-log");

    // If the log message indicates the start of training, clear the log
    if (data.content.startsWith("Start of ")) {
        managingLog.innerText = "AI manager's log: "; // Clear previous logs
    }

    if (managingLog) {
        managingLog.innerText += data.content + "\n";
    }
}

// Fetch saved AIs and populate the dropdown
async function fetchSavedAIs() {
    logger.info(`Fetching saved AIs...`);

    const dropdown = document.getElementById("saved-ai-dropdown");
    const managingLog = document.getElementById('managing-log');
    managingLog.style.display = 'block';

    try {
        const response = await fetch('/ai/list-saved-ai', {
            method: 'GET'
        });

        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || 'Fetching saved AIs failed');
        }

        const data = await response.json();
        dropdown.innerHTML = '<option value="" disabled selected>Select AI to delete</option>';
        const disabled_ai = ["Marvin"];
        data.saved_ai.forEach(ai => {
            const option = document.createElement("option");
            option.value = ai;
            option.textContent = ai;
            if (disabled_ai.includes(ai))
                option.disabled = true;
            dropdown.appendChild(option);
            logger.info(`AIs fetched successfully`);
        });
    } catch (error) {
        managingLog.className = 'alert alert-danger';
        managingLog.innerText = `Error: ${error.message}`;
    }
}

export async function fetchTrainingStatus() {
    try {
        logger.info('[AiManager] Fetching training\'s status');

        const response = await fetch('/ai/training-status/', {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
            }
        });
        if (!response.ok) {
            throw new Error('Fetching training status failed');
        }
        const data = await response.json();

        logger.info('[AiManager] received status', data)

        if (data.in_training) {
            store.dispatch({
                domain: 'ai',
                type: aiActions.START_TRAINING
            });
        } else {
            store.dispatch({
                domain: 'ai',
                type: aiActions.END_TRAINING
            });
        }

        updateTrainingButtonState(store.getState().ai.trainingInProgress)

        logger.info('[AiManager] Fetching training\'s status successed')
    } catch (error) {
        logger.error('[AiManager] Fetching training status failed', error)
    }
}

let glob_aiIsInit = false;

export async function initializeAiManager() {
    if (glob_aiIsInit) return;

    glob_aiIsInit = true;
    logger.info(`Initialization of AiManager...`);
    const managingLog = document.getElementById('managing-log');
    managingLog.style.display = 'block';

    initializeAiSocket();
    
    // Initial fetch of saved AIs
    await fetchSavedAIs();
    
    logger.info(`AiManager inatialized successfully`);
    
    const trainButton = document.getElementById("train-ai-btn");
    trainButton.addEventListener("click", async () => {
        // Get and validate AI name
        const aiName = document.getElementById('ai_name').value.trim();
        if (!aiName) {
            alert('AI Name is required.');
            return;
        }
        
        // Validate AI name format
        if (!/^[a-zA-Z0-9_-]+$/.test(aiName)) {
            alert('AI Name can only contain letters, numbers, underscores, and hyphens.');
            return;
        }

        // Dispatch to the store
        startTraining();
        
        // Show loading state
        managingLog.className = 'alert alert-info';
        managingLog.style.display = 'block';

        // Show loading state
        managingLog.className = 'alert alert-info';
        managingLog.style.display = 'block';

        
        // List of inputs and their limits
        const fields = [
            { id: 'nb_generation', min: 1, max: 10, name: "Number of Generations" },
            { id: 'nb_species', min: 50, max: 100, name: "Number of Species" },
            { id: 'time_limit', min: 5, max: 60, name: "Simulated Time Limit" },
            { id: 'max_score', min: 50, max: 500, name: "Max Score" }
        ];
        
        // Validate each field
        for (const { id, min, max, name } of fields) {
            const value = Number(document.getElementById(id).value);
            if (!Number.isFinite(value) || value < min || value > max) {
                alert(`${name} must be between ${min} and ${max}.`);
                return;
            }
        }

        // Get other parameters
        const nbGeneration = document.getElementById('nb_generation').value;
        const nbSpecies = document.getElementById('nb_species').value;
        const timeLimit = document.getElementById('time_limit').value;
        const maxScore = document.getElementById('max_score').value;

        const params = {
            ai_name: aiName,
            nb_generation: nbGeneration,
            nb_species: nbSpecies,
            time_limit: timeLimit,
            max_score: maxScore,
        };    

        try {
            // Make the request
            const response = await fetch(`/ai/train/`, {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(params),
            });

            // Parse the response JSON
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Training failed');
            }

        } catch (error) {
            // Update the log on error
            managingLog.className = 'alert alert-danger';
            managingLog.innerText = `Error: ${error.message}`;
        }
    });

    // Handle Delete AI button click
    const deleteButton = document.getElementById("delete-ai-btn");
    const dropdown = document.getElementById("saved-ai-dropdown");
    deleteButton.addEventListener("click", async () => {
        const selectedAI = dropdown.value;
        if (!selectedAI) {
            alert("Please select an AI to delete!");
            return;
        }
        managingLog.innerText = `Request for deleting AI '${selectedAI}'...`;

        try {
            // Await the fetch response
            const response = await fetch('/ai/delete-saved-ai/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ ai_name: selectedAI }),
            });

            // Parse the response JSON
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Deleting saved AIs failed');
            }

            // Update the log on success
            managingLog.className = 'alert alert-success';
            managingLog.innerText = `AI successfully deleted: ${data.message}`;

        } catch (error) {
            // Update the log on error
            managingLog.className = 'alert alert-danger';
            managingLog.innerText = `Error deleting AI: ${error.message}`;
        }
    });
}
