const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const bot = require('./bot');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static UI files
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

io.on('connection', (socket) => {
    console.log('UI Connected');

    // Start Bot Request
    socket.on('start-bot', async (config) => {
        try {
            socket.emit('log', { level: 'info', message: 'Starting bot...' });
            
            await bot.startBot(config, (event, data) => {
                // Event proxy from Bot to UI
                socket.emit(event, data);
            });

            socket.emit('bot-status', { status: 'running' });
            socket.emit('log', { level: 'success', message: 'Bot started successfully.' });
        } catch (error) {
            socket.emit('log', { level: 'error', message: `Failed to start: ${error.message}` });
            socket.emit('bot-status', { status: 'stopped' });
        }
    });

    // Stop Bot Request
    socket.on('stop-bot', async () => {
        try {
            await bot.stopBot();
            socket.emit('log', { level: 'info', message: 'Bot stopped.' });
            socket.emit('bot-status', { status: 'stopped' });
        } catch(e) {
            socket.emit('log', { level: 'error', message: `Error stopping: ${e.message}` });
        }
    });

    // Pause Bot
    socket.on('pause-bot', () => {
        bot.pauseBot();
        socket.emit('log', { level: 'warning', message: 'Monitoring PAUSED.' });
        socket.emit('bot-status', { status: 'paused' });
    });

    // Resume Bot
    socket.on('resume-bot', () => {
        bot.resumeBot();
        socket.emit('log', { level: 'info', message: 'Monitoring RESUMED.' });
        socket.emit('bot-status', { status: 'running' });
    });

    // Kill Server
    socket.on('kill-server', async () => {
        console.log('Kill request received. Shutting down...');
        socket.emit('log', { level: 'error', message: 'Server is shutting down... Goodbye!' });
        
        // Close bot first if running
        try { await bot.stopBot(); } catch(e) {}
        
        // Exit process
        setTimeout(() => {
            process.exit(0);
        }, 1000);
    });

});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
