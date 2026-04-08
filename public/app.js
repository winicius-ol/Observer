const socket = io();

// UI Elements
const form = document.getElementById('setup-form');
const btnStart = document.getElementById('btn-start');
const btnKill = document.getElementById('btn-kill');
const logContainer = document.getElementById('log-container');
const macroCheckbox = document.getElementById('macro-checkbox');
const macroEditorGroup = document.getElementById('macro-editor-group');
const activeBotsList = document.getElementById('active-bots-list');

const currentBots = new Map();

macroCheckbox.addEventListener('change', (e) => {
    macroEditorGroup.style.display = e.target.checked ? 'block' : 'none';
});

function appendLog(level, message) {
    const el = document.createElement('div');
    el.className = `log-entry ${level}`;
    const time = new Date().toLocaleTimeString();
    el.textContent = `[${time}] ${message}`;
    logContainer.appendChild(el);
    logContainer.scrollTop = logContainer.scrollHeight;
}

function renderActiveBots() {
    activeBotsList.innerHTML = '';
    if (currentBots.size === 0) {
        activeBotsList.innerHTML = '<span style="color:var(--text-muted);font-size:13px;">No bots running.</span>';
        return;
    }

    for (const [id, botInfo] of currentBots.entries()) {
        const card = document.createElement('div');
        card.className = 'bot-card';
        
        const info = document.createElement('div');
        info.className = 'bot-card-info';
        info.innerHTML = `<strong>Bot #${id}</strong><span>Regex: ${botInfo.config.regex}</span>`;
        
        const controls = document.createElement('div');
        controls.className = 'bot-controls';
        
        const btnPause = document.createElement('button');
        btnPause.className = 'btn warning';
        btnPause.textContent = botInfo.status === 'paused' ? 'Resume' : 'Pause';
        btnPause.onclick = () => socket.emit(botInfo.status === 'paused' ? 'resume-bot' : 'pause-bot', id);
        
        const btnStop = document.createElement('button');
        btnStop.className = 'btn danger';
        btnStop.textContent = 'Stop';
        btnStop.onclick = () => socket.emit('stop-bot', id);
        
        controls.appendChild(btnPause);
        controls.appendChild(btnStop);
        card.appendChild(info);
        card.appendChild(controls);
        
        activeBotsList.appendChild(card);
    }
}

form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
        Notification.requestPermission();
    }
    
    const config = {
        targetUrl: document.getElementById('target-url').value,
        regex: document.getElementById('regex-pattern').value,
        headless: document.getElementById('headless').checked,
        actions: Array.from(document.querySelectorAll('input[name="action"]:checked')).map(cb => cb.value),
        macroCode: document.getElementById('macro-code').value
    };

    socket.emit('start-bot', config);
});

btnKill.addEventListener('click', () => {
    if (confirm('Are you sure you want to kill the server? All bots will be terminated instantly.')) {
        socket.emit('kill-server');
    }
});

socket.on('log', (data) => {
    appendLog(data.level, data.message);
});

socket.on('bot-status', (data) => {
    if (data.status === 'stopped') {
        currentBots.delete(data.botId);
    } else {
        const existing = currentBots.get(data.botId) || { config: data.config };
        existing.status = data.status;
        if (data.config) existing.config = data.config;
        currentBots.set(data.botId, existing);
    }
    renderActiveBots();
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
    }
});

socket.on('connect', () => {
    appendLog('info', 'Connected to local server.');
});

socket.on('disconnect', () => {
    appendLog('error', 'Disconnected from server.');
});

renderActiveBots();
