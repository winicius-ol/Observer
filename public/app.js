const socket = io();

// UI Elements
const form = document.getElementById('setup-form');
const btnStart = document.getElementById('btn-start');
const btnStop = document.getElementById('btn-stop');
const btnPause = document.getElementById('btn-pause');
const btnResume = document.getElementById('btn-resume');
const btnKill = document.getElementById('btn-kill');
const logContainer = document.getElementById('log-container');
const macroCheckbox = document.getElementById('macro-checkbox');
const macroEditorGroup = document.getElementById('macro-editor-group');
const audioPlayer = document.getElementById('alert-sound');
const liveControls = document.getElementById('live-controls');

// Toggle Macro Editor
macroCheckbox.addEventListener('change', (e) => {
    macroEditorGroup.style.display = e.target.checked ? 'block' : 'none';
});

// Appending Logs
function appendLog(level, message) {
    const el = document.createElement('div');
    el.className = `log-entry ${level}`;
    const time = new Date().toLocaleTimeString();
    el.textContent = `[${time}] ${message}`;
    logContainer.appendChild(el);
    logContainer.scrollTop = logContainer.scrollHeight;
}

// Form Submission (Start Bot)
form.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const targetUrl = document.getElementById('target-url').value;
    const regex = document.getElementById('regex-pattern').value;
    const headless = document.getElementById('headless').checked;
    const macroCode = document.getElementById('macro-code').value;
    
    const actions = [];
    document.querySelectorAll('input[name="action"]:checked').forEach(cb => {
        actions.push(cb.value);
    });

    const config = {
        targetUrl,
        regex,
        headless,
        actions,
        macroCode
    };

    btnStart.disabled = true;
    socket.emit('start-bot', config);
});

// Button Controls
btnStop.addEventListener('click', () => {
    socket.emit('stop-bot');
});

btnPause.addEventListener('click', () => {
    socket.emit('pause-bot');
});

btnResume.addEventListener('click', () => {
    socket.emit('resume-bot');
});

btnKill.addEventListener('click', () => {
    if (confirm('Are you sure you want to kill the server? The dashboard will stop working immediately.')) {
        socket.emit('kill-server');
    }
});

// Socket Events
socket.on('log', (data) => {
    appendLog(data.level, data.message);
});

socket.on('bot-status', (data) => {
    if (data.status === 'running') {
        btnStart.disabled = true;
        btnStop.disabled = false;
        liveControls.style.display = 'flex';
        btnPause.style.display = 'block';
        btnResume.style.display = 'none';
    } else if (data.status === 'stopped') {
        btnStart.disabled = false;
        btnStop.disabled = true;
        liveControls.style.display = 'none';
    } else if (data.status === 'paused') {
        btnPause.style.display = 'none';
        btnResume.style.display = 'block';
    }
});

socket.on('play-audio', () => {
    // Play the alert sound
    audioPlayer.currentTime = 0;
    audioPlayer.play().catch(e => {
        appendLog('warning', 'Browser prevented auto-play audio. Please interact with the page once.');
    });
});

socket.on('connect', () => {
    appendLog('info', 'Connected to local server.');
});

socket.on('disconnect', () => {
    appendLog('error', 'Disconnected from server.');
});
