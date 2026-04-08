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
    
    if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
        Notification.requestPermission();
    }
    
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
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(800, audioCtx.currentTime);
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        oscillator.start();
        gainNode.gain.setValueAtTime(1, audioCtx.currentTime);
        gainNode.gain.setValueAtTime(0, audioCtx.currentTime + 0.1);
        gainNode.gain.setValueAtTime(1, audioCtx.currentTime + 0.2);
        gainNode.gain.setValueAtTime(0, audioCtx.currentTime + 0.3);
        gainNode.gain.setValueAtTime(1, audioCtx.currentTime + 0.4);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);
        oscillator.stop(audioCtx.currentTime + 0.6);
    } catch(e) {
        appendLog('error', 'Audio alert failed: ' + e.message);
    }
});

socket.on('show-notification', (data) => {
    if (Notification.permission === 'granted') {
        new Notification(data.title, { body: data.message });
    } else {
        appendLog('warning', 'Could not show desktop notification. Browser permission denied.');
    }
});

socket.on('connect', () => {
    appendLog('info', 'Connected to local server.');
});

socket.on('disconnect', () => {
    appendLog('error', 'Disconnected from server.');
});
