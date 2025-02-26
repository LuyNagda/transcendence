import logger from '../logger.js';
import { store } from '../state/store.js'
import { aiActions } from '../state/aiState.js'

// Function to handle training button state
function updateTrainingButtonState(isTrainingInProgress) {
    const trainingButton = document.getElementById('train-ai-btn');
    if (trainingButton) {
        trainingButton.disabled = isTrainingInProgress;
    }
}

// Subscribe to the AI state to listen for training status changes
store.subscribe('ai', (aiState) => {
    const isTrainingInProgress = aiState.trainingInProgress;
    updateTrainingButtonState(isTrainingInProgress);
});

// Dispatch actions when training starts and ends
function startTraining() {
    store.dispatch({
        domain: 'ai',
        type: aiActions.START_TRAINING
    });
}

function endTraining() {
    store.dispatch({
        domain: 'ai',
        type: aiActions.END_TRAINING
    });
}

export async function initializeAiManager() {
    logger.info(`Initialization of AiManager...`);

    const trainButton = document.getElementById("train-ai-btn");
    const deleteButton = document.getElementById("delete-ai-btn");
    const dropdown = document.getElementById("saved-ai-dropdown");
    const managingLog = document.getElementById('managing-log');
    managingLog.style.display = 'block';

    // Initial fetch of saved AIs
    await fetchSavedAIs();

    logger.info(`AiManager inatialized successfully`);

    // Fetch saved AIs and populate the dropdown
    async function fetchSavedAIs() {
		logger.info(`Fetching saved AIs...`);

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
            const disabled_ai = ["Hard", "Medium", "Easy"];
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

    // Disable all the page's buttons
    function disabled_buttons() {
        document.getElementById("delete-ai-btn").disabled = true;
        document.getElementById("train-ai-btn").disabled = true;
    }

    // Enable all the page's buttons
    function enabled_buttons() {
        document.getElementById("delete-ai-btn").disabled = false;
        document.getElementById("train-ai-btn").disabled = false;
    }

    trainButton.addEventListener("click", async () => {
        startTraining();

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

        // Get and validate other parameters
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

        // Get CSRF token
        const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]').value;
        if (!csrfToken) {
            managingLog.className = 'alert alert-danger';
            managingLog.innerText = 'CSRF token not found. Make sure {% csrf_token %} is included in your template.';
            return;
        }

        // Show loading state
        managingLog.className = 'alert alert-info';
        managingLog.style.display = 'block';
        managingLog.innerText = `Starting training for AI '${aiName}'...`;

        try {
            // Make the request
            const response = await fetch(`/ai/train/`, {
                method: 'POST',
                headers: {
                    'X-CSRFToken': csrfToken,
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

            // Update the log on success
            managingLog.className = 'alert alert-success';
            managingLog.innerText = data.log || 'Training completed successfully.';

            // Refresh the dropdown
            fetchSavedAIs();

        } catch (error) {
            // Update the log on error
            managingLog.className = 'alert alert-danger';
            managingLog.innerText = `Error: ${error.message}`;
        } finally {
            endTraining();
        }
    });

    // Handle Delete AI button click
    deleteButton.addEventListener("click", async () => {
        disabled_buttons();

        const selectedAI = dropdown.value;
        if (!selectedAI) {
            alert("Please select an AI to delete!");
            enabled_buttons();
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
                enabled_buttons();
                throw new Error(data.error || 'Deleting saved AIs failed');
            }

            // Update the log on success
            managingLog.className = 'alert alert-success';
            managingLog.innerText = `AI successfully deleted: ${data.message}`;

            // Refresh the dropdown
            fetchSavedAIs();
        } catch (error) {
            // Update the log on error
            managingLog.className = 'alert alert-danger';
            managingLog.innerText = `Error deleting AI: ${error.message}`;
        }

        enabled_buttons()
    });
}
