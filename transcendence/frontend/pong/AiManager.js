export async function initializeAiManager() {
    const trainButton = document.getElementById("train-ai-btn");
    const managingLog = document.getElementById('managing-log');
    managingLog.style.display = 'block';

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
        }
    });

    const dropdown = document.getElementById("saved-ai-dropdown");
    const deleteButton = document.getElementById("delete-ai-btn");
    
    // Fetch saved AIs and populate the dropdown
    async function fetchSavedAIs() {
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
            data.saved_ai.forEach(ai => {
                const option = document.createElement("option");
                option.value = ai;
                option.textContent = ai;
                dropdown.appendChild(option);
            });
        }
        
        catch(error) {
            managingLog.className = 'alert alert-danger';
            managingLog.innerText = `Error: ${error.message}`;
        }
    }
    
    // Handle Delete AI button click
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
    
            // Refresh the dropdown
            fetchSavedAIs();
        } catch (error) {
            // Update the log on error
            managingLog.className = 'alert alert-danger';
            managingLog.innerText = `Error deleting AI: ${error.message}`;
        }
    });
    
    // Initial fetch of saved AIs
    fetchSavedAIs();
}
