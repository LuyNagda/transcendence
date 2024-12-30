// Encapsulate the AI Training logic in an object for better structure
const AiManager = {
    init: function () {
        // Initialize event listeners
        this.bindEvents();
        this.loadSavedAIs();
    },

    bindEvents: function () {
        const trainButton = document.getElementById("train-ai-btn");
        const deleteButton = document.getElementById("delete-ai-btn");

        // Event listener for the Start Training button
        trainButton.addEventListener("click", this.startTraining.bind(this));

        // Event listener for the Delete AI button
        deleteButton.addEventListener("click", this.deleteAI.bind(this));
    },

    startTraining: function () {
        const aiName = document.getElementById("ai_name").value;
        const nbGeneration = document.getElementById("nb_generation").value;
        const nbSpecies = document.getElementById("nb_species").value;
        const timeLimit = document.getElementById("time_limit").value;
        const maxScore = document.getElementById("max_score").value;

        if (!aiName) {
            alert("AI Name is required to start training!");
            return;
        }

        fetch("/api/train-ai/", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
                ai_name: aiName,
                nb_generation: nbGeneration,
                nb_species: nbSpecies,
                time_limit: timeLimit,
                max_score: maxScore,
            }),
        })
            .then((response) => {
                if (!response.ok) throw new Error("Failed to start training");
                return response.json();
            })
            .then((data) => {
                this.updateLog(data.log || "Training started successfully!", "success");
            })
            .catch((error) => {
                console.error("Error during training:", error);
                this.updateLog("An error occurred while starting training.", "danger");
            });
    },

    deleteAI: function () {
        const dropdown = document.getElementById("saved-ai-dropdown");
        const selectedAI = dropdown.value;

        if (!selectedAI) {
            alert("Please select an AI to delete!");
            return;
        }

        fetch("/api/delete-saved-ai/", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ ai_name: selectedAI }),
        })
            .then((response) => {
                if (!response.ok) throw new Error("Failed to delete AI");
                return response.json();
            })
            .then((data) => {
                alert(data);
                this.loadSavedAIs(); // Refresh dropdown
            })
            .catch((error) => {
                console.error("Error deleting AI:", error);
                this.updateLog("An error occurred while deleting the AI.", "danger");
            });
    },

    loadSavedAIs: function () {
        const dropdown = document.getElementById("saved-ai-dropdown");

        fetch("/api/saved-ai/", {
            method: "GET",
            credentials: "include",
        })
            .then((response) => {
                if (!response.ok) throw new Error("Failed to fetch saved AIs");
                return response.json();
            })
            .then((data) => {
                dropdown.innerHTML = '<option value="" disabled selected>Select AI to delete</option>';
                data.saved_ai.forEach((ai) => {
                    const option = document.createElement("option");
                    option.value = ai;
                    option.textContent = ai;
                    dropdown.appendChild(option);
                });
            })
            .catch((error) => {
                console.error("Error fetching saved AIs:", error);
                this.updateLog("Unable to load saved AIs.", "warning");
            });
    },

    updateLog: function (message, type) {
        const log = document.getElementById("managing-log");
        log.textContent = message;
        log.className = `alert alert-${type}`;
    },
};

// Initialize the AI Manager when the DOM is fully loaded
document.addEventListener("DOMContentLoaded", () => {
    AiManager.init();
});

// document.addEventListener("DOMContentLoaded", () => {
//     const trainButton = document.getElementById("train-ai-btn")
//     const dropdown = document.getElementById("saved-ai-dropdown");
//     const deleteButton = document.getElementById("delete-ai-btn");
//     const managingLog = document.getElementById('managing-log');
//     managingLog.style.display = 'block';
    
//     // Fetch saved AIs and populate the dropdown
//     async function fetchSavedAIs() {
//         try {
//             const response = await fetch('/ai/list-saved-ai', {
//                 method: 'GET'
//             });

//             if (!response.ok) {
//                 const data = await response.json();
//                 throw new Error(data.error || 'Fetching saved AIs failed');
//             }

//             const data = await response.json();
//             dropdown.innerHTML = '<option value="" disabled selected>Select AI to delete</option>';
//             data.saved_ai.forEach(ai => {
//                 const option = document.createElement("option");
//                 option.value = ai;
//                 option.textContent = ai;
//                 dropdown.appendChild(option);
//             });
//         }
        
//         catch(error) {
//             managingLog.className = 'alert alert-danger';
//             managingLog.innerText = `Error: ${error.message}`;
//         }
//     }
    
//     trainButton.addEventListener("click", () => {
//         // Get and validate AI name
//         const aiName = document.getElementById('ai_name').value.trim();
//         if (!aiName) {
//             alert('AI Name is required.');
//             return;
//         }

//         // Additional validation if needed (e.g., format checking)
//         if (!/^[a-zA-Z0-9_-]+$/.test(aiName)) {
//             alert('AI Name can only contain letters, numbers, underscores, and hyphens.');
//             return;
//         }

//         // Get and validate other parameters
//         const nbGeneration = document.getElementById('nb_generation').value;
//         const nbSpecies = document.getElementById('nb_species').value;
//         const timeLimit = document.getElementById('time_limit').value;
//         const maxScore = document.getElementById('max_score').value;
        
//         const params = {
//             ai_name: aiName,
//             nb_generation: nbGeneration,
//             nb_species: nbSpecies,
//             time_limit: timeLimit,
//             max_score: maxScore
//         };

//         // Get CSRF (Cross-site request forgery) token
//         const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]').value;
//         if (!csrfToken) {
//             throw new Error('CSRF token not found. Make sure {% csrf_token %} is included in your template.');
//         }

//         // Show loading state
//         managingLog.className = 'alert alert-info';
//         managingLog.style.display = 'block';
//         managingLog.innerText = `Starting training for AI '${aiName}'...`;

//         // Make the request
//         try {
//             const response = fetch(`/ai/train/`, {
//                 method: 'POST',
//                 headers: {
//                     'X-CSRFToken': csrfToken,
//                     'Accept': 'application/json',
//                     'Content-Type': 'application/json',
//                 },
//                 body: JSON.stringify(params),
//             });

//             if (!response.ok) {
//                 const data = response.json();
//                 throw new Error(data.error || 'Training failed');
//             }

//             const data = response.json();
//             managingLog.className = 'alert alert-success';
//             managingLog.innerText = data.log || 'Training completed successfully.';
//             fetchSavedAIs();
//         }
        
//         catch (error) {
//             const managingLog = document.getElementById('managing-log');
//             managingLog.className = 'alert alert-danger';
//             managingLog.innerText = `Error: ${error.message}`;
//         }
//     });

//     // Handle Delete AI button click
//     deleteButton.addEventListener("click", () => {
//         const selectedAI = dropdown.value;
//         if (!selectedAI) {
//             alert("Please select an AI to delete!");
//             return;
//         }
//         managingLog.innerText = `Request for deleting AI '${selectedAI}'...`;

//         try {
//             const response = fetch('/ai/delete-saved-ai/', {
//                 method: 'POST',
//                 headers: {
//                     'Content-Type': 'application/json',
//                 },
//                 body: JSON.stringify({ ai_name: selectedAI }),
//             })

//             if (!response.ok) {
//                 const data = response.json();
//                 throw new Error(data.error || 'Deleting saved AIs failed');
//             }

//             managingLog.className = 'alert alert-success';
//             managingLog.innerText = 'Ai successfully deleted.';

//             fetchSavedAIs(); // Refresh the dropdown
//         }

//         catch (error) {
//             managingLog.className = 'alert alert-danger';
//             managingLog.innerText = `Error deleting AI: ${error.message}`;
//         }
//     });

//     // Initial fetch of saved AIs
//     fetchSavedAIs();
// });
