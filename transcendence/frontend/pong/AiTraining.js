import logger from "../utils/logger.js";

export async function startTraining() {
    // Get and validate AI name
    const aiName = document.getElementById('ai_name').value.trim();
    if (!aiName) {
        alert('AI Name is required.');
        return;
    }

    // Additional validation if needed (e.g., format checking)
    if (!/^[a-zA-Z0-9_-]+$/.test(aiName)) {
        alert('AI Name can only contain letters, numbers, underscores, and hyphens.');
        return;
    }

    // Get and validate other parameters
    const nbGeneration = document.getElementById('nb_generation').value;
    const nbSpecies = document.getElementById('nb_species').value;
    const timeLimit = document.getElementById('time_limit').value;
    const maxScore = document.getElementById('max_score').value;
    
    // Build URL
    const params = {
        ai_name: aiName,
        nb_generation: nbGeneration,
        nb_species: nbSpecies,
        time_limit: timeLimit,
        max_score: maxScore
    };

    // Get CSRF (Cross-site request forgery) token
    const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]').value;
    if (!csrfToken) {
        throw new Error('CSRF token not found. Make sure {% csrf_token %} is included in your template.');
    }

    // Show loading state
    const trainingLog = document.getElementById('training-log');
    trainingLog.className = 'alert alert-info';
    trainingLog.style.display = 'block';
    trainingLog.innerText = `Starting training for AI '${aiName}'...`;

    // Make the request
    try {
        const response = await fetch(`/ai/train/`, {
            method: 'POST',
            headers: {
                'X-CSRFToken': csrfToken,
                'Accept': 'application/json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(params),
        });

        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || 'Training failed');
        }

        const data = await response.json();
        trainingLog.className = 'alert alert-success';
        trainingLog.innerText = data.log || 'Training completed successfully.';
    } catch (error) {
        const trainingLog = document.getElementById('training-log');
        trainingLog.className = 'alert alert-danger';
        trainingLog.innerText = `Error: ${error.message}`;
    }
}
