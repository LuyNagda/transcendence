function startTraining() {
    const aiName = document.getElementById('ai_name').value;
    if (!aiName) {
        alert('AI Name is required.');
        return;
    }

    // TODO: change dynamicly the website_url
    const baseUrl = `<website_url>/ai/train/${encodeURIComponent(aiName)}`;
    const params = new URLSearchParams();
    
    const nbGeneration = document.getElementById('nb_generation').value;
    const nbSpecies = document.getElementById('nb_species').value;
    const timeLimit = document.getElementById('time_limit').value;
    const maxScore = document.getElementById('max_score').value;
    
    if (nbGeneration) params.append('nb_generation', nbGeneration);
    if (nbSpecies) params.append('nb_species', nbSpecies);
    if (timeLimit) params.append('time_limit', timeLimit);
    if (maxScore) params.append('max_score', maxScore);
    
    const url = `${baseUrl}?${params.toString()}`;

    fetch(url, { method: 'POST' })
        .then(response => response.json())
        .then(data => {
            document.getElementById('training-log').classList.remove('alert-info');
            document.getElementById('training-log').classList.add('alert-success');
            document.getElementById('training-log').innerText = data.log || 'Training completed successfully.';
        })
        .catch(error => {
            document.getElementById('training-log').classList.remove('alert-info');
            document.getElementById('training-log').classList.add('alert-danger');
            document.getElementById('training-log').innerText = `Error: ${error.message}`;
        });

    document.getElementById('training-log').classList.remove('alert-success', 'alert-danger');
    document.getElementById('training-log').classList.add('alert-info');
    document.getElementById('training-log').innerText = 'Training in progress. When the training is completed, the log will be displayed.';
}
