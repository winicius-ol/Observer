const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { BotInstance } = require('./bot');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

const activeBots = new Map();
let botIdCounter = 0;

io.on('connection', (socket) => {
    console.log('UI Connected');
    
    // Send initial state of all currently active bots
    for (const [id, bot] of activeBots.entries()) {
        socket.emit('bot-status', { botId: id, status: bot.isPaused ? 'paused' : 'running', config: bot.config });
    }

    socket.on('start-bot', async (config) => {
        const id = ++botIdCounter;
        
        try {
            socket.emit('log', { level: 'info', message: `Initializing Bot #${id}...` });
            
            const instance = new BotInstance(id, config, (event, data) => {
                socket.emit(event, data);
            });
            activeBots.set(id, instance);
            
            await instance.start();

            socket.emit('bot-status', { botId: id, status: 'running', config: config });
            socket.emit('log', { level: 'success', message: `Bot #${id} started successfully.` });
        } catch (error) {
            activeBots.delete(id);
            socket.emit('log', { level: 'error', message: `Bot #${id} failed: ${error.message}` });
            socket.emit('bot-status', { botId: id, status: 'stopped' });
        }
    });

    socket.on('stop-bot', async (id) => {
        const instance = activeBots.get(id);
        if (instance) {
            try {
                await instance.stop();
                activeBots.delete(id);
                socket.emit('log', { level: 'info', message: `Bot #${id} stopped.` });
                socket.emit('bot-status', { botId: id, status: 'stopped' });
            } catch(e) {
                socket.emit('log', { level: 'error', message: `Error stopping Bot #${id}: ${e.message}` });
            }
        }
    });

    socket.on('pause-bot', (id) => {
        const instance = activeBots.get(id);
        if (instance) {
            instance.pause();
            socket.emit('log', { level: 'warning', message: `Bot #${id} PAUSED.` });
            socket.emit('bot-status', { botId: id, status: 'paused' });
        }
    });

    socket.on('resume-bot', (id) => {
        const instance = activeBots.get(id);
        if (instance) {
            instance.resume();
            socket.emit('log', { level: 'info', message: `Bot #${id} RESUMED.` });
            socket.emit('bot-status', { botId: id, status: 'running' });
        }
    });

    socket.on('kill-server', async () => {
        console.log('Kill request received. Shutting down...');
        socket.emit('log', { level: 'error', message: 'Server is shutting down... Goodbye!' });
        
        for (const [id, instance] of activeBots.entries()) {
            try { await instance.stop(); } catch(e) {}
        }
        
        setTimeout(() => { process.exit(0); }, 1000);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
