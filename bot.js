const { chromium } = require('playwright-core');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { exec } = require('child_process');

function triggerNativeNotification(title, message) {
    const scriptContent = `
[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
[Windows.UI.Notifications.ToastNotification, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
[Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] | Out-Null
$xml = New-Object Windows.Data.Xml.Dom.XmlDocument
$xml.LoadXml('<toast><visual><binding template="ToastText02"><text id="1">${title.replace(/[\'\"]/g, '')}</text><text id="2">${message.replace(/[\'\"]/g, '')}</text></binding></visual></toast>')
$toast = New-Object Windows.UI.Notifications.ToastNotification $xml
[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier("RoboDaFila").Show($toast)
`;
    const tempFile = path.join(os.tmpdir(), `notify_${Date.now()}.ps1`);
    try {
        fs.writeFileSync(tempFile, scriptContent);
        exec(`powershell -NoProfile -ExecutionPolicy Bypass -File "${tempFile}"`, () => {
            try { fs.unlinkSync(tempFile); } catch(e){}
        });
    } catch(e) {}
}

let browser = null;
let context = null;
let globalPage = null;
let isPaused = false;

async function startBot(config, emit) {
    if (browser) {
        throw new Error("Bot is already running.");
    }
    
    isPaused = false;
    
    browser = await chromium.launch({
        headless: config.headless,
        channel: 'msedge' // Automates the local Microsoft Edge so friends don't need to download a browser!
    });
    
    context = await browser.newContext();
    globalPage = await context.newPage();

    let targetRegex;
    try {
        const match = config.regex.match(new RegExp('^/(.*?)/([gimy]*)$'));
        if (match) {
            targetRegex = new RegExp(match[1], match[2]);
        } else {
            targetRegex = new RegExp(config.regex, 'i'); // Default case-insensitive
        }
    } catch(e) {
        throw new Error("Invalid Regex provided.");
    }

    emit('log', { level: 'info', message: `Monitoring initialized. Regex compiled successfully.` });

    globalPage.on('response', async (response) => {
        if (isPaused) return; // Skip if paused

        try {
            const url = response.url();
            
            // Try to match URL first
            let isMatch = targetRegex.test(url);
            
            // If not URL, check response body (only for text/json to avoid crashing on binaries)
            if (!isMatch) {
                const contentType = response.headers()['content-type'] || '';
                if (contentType.includes('application/json') || contentType.includes('text/')) {
                    const buffer = await response.body();
                    const text = buffer.toString('utf-8');
                    isMatch = targetRegex.test(text);
                }
            }

            if (isMatch) {
                emit('match', { url: url });
                emit('log', { level: 'success', message: `✅ Match found on: ${url}` });
                
                // Trigger Actions
                if (config.actions.includes('notification')) {
                    emit('show-notification', {
                        title: 'Robô da Fila',
                        message: `Match triggered on network request!`
                    });
                    // Fallback to Native Windows OS Toaster
                    triggerNativeNotification('Robô da Fila', 'Match triggered on network request!');
                }
                
                if (config.actions.includes('audio')) {
                    emit('play-audio', {});
                }

                if (config.actions.includes('macro') && config.macroCode && config.macroCode.trim() !== '') {
                    emit('log', { level: 'info', message: `Running macro...` });
                    try {
                        const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
                        const runMacro = new AsyncFunction('page', config.macroCode);
                        await runMacro(globalPage);
                        emit('log', { level: 'success', message: `Macro executed successfully.` });
                    } catch (err) {
                        emit('log', { level: 'error', message: `Macro failed: ${err.message}` });
                    }
                }
            }
            
        } catch (error) {
            // Some responses might fail to read body if connection closes early
        }
    });

    globalPage.on('close', () => {
        emit('bot-status', { status: 'stopped' });
        emit('log', { level: 'warning', message: `Browser was closed by the user.` });
        browser = null;
    });

    if (config.targetUrl && config.targetUrl.trim() !== '') {
        let urlTarget = config.targetUrl.trim();
        if (!urlTarget.startsWith('http')) {
            urlTarget = 'https://' + urlTarget;
        }
        emit('log', { level: 'info', message: `Navigating to ${urlTarget}` });
        globalPage.goto(urlTarget).catch(() => {});
    }
}

async function stopBot() {
    if (browser) {
        await browser.close().catch(()=>{}).finally();
        browser = null;
        context = null;
        globalPage = null;
    }
}

function pauseBot() {
    isPaused = true;
}

function resumeBot() {
    isPaused = false;
}

module.exports = {
    startBot, stopBot, pauseBot, resumeBot
};
