function updateProgress(percentage, message) {
    const progressBar = document.getElementById('progress-bar');
    const progressText = document.getElementById('progress-text');

    if (progressBar) {
        progressBar.style.width = percentage.toFixed(1) + '%';
    }

    if (progressText) {
        progressText.textContent = message + ` (${percentage.toFixed(1)}%)`;
    }
}
