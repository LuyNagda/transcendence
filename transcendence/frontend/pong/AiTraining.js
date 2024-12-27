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

// TODO: clean
document.addEventListener("DOMContentLoaded", () => {
    const dropdown = document.getElementById("saved-ai-dropdown");
    const deleteButton = document.getElementById("delete-ai-btn");
    const trainingLog = document.getElementById('training-log');
    trainingLog.style.display = 'block';
    
    // Fetch saved AIs and populate the dropdown
    function fetchSavedAIs() {
        fetch('/ai/list-saved-ai', { method: 'GET', credentials: 'include' })
        .then(response => {
            if (!response.ok) throw new Error("Failed to fetch saved AIs");
            return response.json();
        })
        .then(data => {
            dropdown.innerHTML = '<option value="" disabled selected>Select AI to Delete</option>';
            data.saved_ai.forEach(ai => {
                const option = document.createElement("option");
                option.value = ai;
                option.textContent = ai;
                dropdown.appendChild(option);
            });
        })
        .catch(error => {
            console.error("Error fetching saved AIs:", error);
        });
    }
    
    // Handle Delete AI button click
    deleteButton.addEventListener("click", () => {
        const selectedAI = dropdown.value;
        if (!selectedAI) {
            alert("Please select an AI to delete!");
            return;
        }
        trainingLog.innerText = `Request for deleting AI '${selectedAI}'...`;

        fetch('/ai/delete-saved-ai/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({ ai_name: selectedAI }),
        })
            .then(response => response.json())
            .then(data => {
                trainingLog.className = 'alert alert-success';
                trainingLog.innerText = data.log || 'Ai successfully deleted.';
                fetchSavedAIs(); // Refresh the dropdown
            })
            .catch(error => {
                trainingLog.className = 'alert alert-danger';
                trainingLog.innerText = `Error deleting AI: ${error.message}`;
            });
    });

    // Initial fetch of saved AIs
    fetchSavedAIs();
});

            // export async function deleteAi() {
            //     const aiName = document.getElementById('ai_name').value.trim();
            //     if (!aiName) {
            //         alert('AI Name is required.');
            //         return;
            //     }
            
            //     // Get CSRF (Cross-site request forgery) token
            //     const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]').value;
            //     if (!csrfToken) {
            //         throw new Error('CSRF token not found. Make sure {% csrf_token %} is included in your template.');
            //     }
            
            //     // Show loading state
            //     const trainingLog = document.getElementById('training-log');
            //     trainingLog.className = 'alert alert-info';
            //     trainingLog.style.display = 'block';
            //     trainingLog.innerText = `Request for deleting AI '${aiName}'...`;
                
            //     // Make the request
            //     try {
            //         const response = await fetch(`/ai/delete-saved-ai/`, {
            //             method: 'POST',
            //             headers: {
            //                 'X-CSRFToken': csrfToken,
            //                 'Accept': 'application/json',
            //                 'Content-Type': 'application/json',
            //             },
            //             body: JSON.stringify({ ai_name: aiName }),
            //         });
            
            //         if (!response.ok) {
            //             const data = await response.json();
            //             throw new Error(data.error || 'Deleting ai failed');
            //         }
            
            //         const data = await response.json();
            //         trainingLog.className = 'alert alert-success';
            //         trainingLog.innerText = data.log || 'Ai successfully deleted.';
            //     } catch (error) {
            //         const trainingLog = document.getElementById('training-log');
            //         trainingLog.className = 'alert alert-danger';
            //         trainingLog.innerText = `Error: ${error.message}`;
            //     }
            // }
