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
[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier("Observer").Show($toast)
`;
    const tempFile = path.join(os.tmpdir(), `notify_${Date.now()}.ps1`);
    try {
        fs.writeFileSync(tempFile, scriptContent);
        exec(`powershell -NoProfile -ExecutionPolicy Bypass -File "${tempFile}"`, () => {
            try { fs.unlinkSync(tempFile); } catch(e){}
        });
    } catch(e) {}
}

class BotInstance {
    constructor(id, config, emit) {
        this.id = id;
        this.config = config;
        this.emit = emit;
        
        this.browser = null;
        this.context = null;
        this.globalPage = null;
        this.isPaused = false;
        
        this.lastTriggerTime = 0;
        this.debounceTimeMs = 3000;
        
        this.targetRegex = null;
    }

    async start() {
        if (this.browser) throw new Error("Bot instance is already running.");
        this.isPaused = false;
        
        this.browser = await chromium.launch({
            headless: this.config.headless,
            channel: 'msedge',
            args: [
                '--disable-blink-features=AutomationControlled',
                '--disable-infobars',
                '--no-sandbox',
                '--disable-setuid-sandbox'
            ]
        });
        
        this.context = await this.browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
            viewport: { width: 1366, height: 768 },
            locale: 'en-US'
        });
        
        this.globalPage = await this.context.newPage();
        
        // Stealth Overrides
        await this.context.addInitScript(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            window.chrome = { runtime: {} };
            Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3] });
            Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
        });

        try {
            const match = this.config.regex.match(new RegExp('^/(.*?)/([gimy]*)$'));
            if (match) {
                this.targetRegex = new RegExp(match[1], match[2]);
            } else {
                this.targetRegex = new RegExp(this.config.regex, 'i');
            }
        } catch(e) {
            throw new Error("Invalid Regex provided.");
        }

        this.emit('log', { level: 'info', message: `[Bot #${this.id}] Monitoring initialized. Regex: ${this.targetRegex}` });

        this.globalPage.on('response', async (response) => {
            if (this.isPaused) return;

            try {
                const url = response.url();
                let isMatch = this.targetRegex.test(url);
                
                if (!isMatch) {
                    const contentType = response.headers()['content-type'] || '';
                    if (contentType.includes('application/json') || contentType.includes('text/')) {
                        const buffer = await response.body();
                        const text = buffer.toString('utf-8');
                        isMatch = this.targetRegex.test(text);
                    }
                }

                if (isMatch) {
                    this.emit('match', { url: url, botId: this.id });
                    
                    const now = Date.now();
                    const isDebouncedPhase = (now - this.lastTriggerTime) < this.debounceTimeMs;
                    
                    this.emit('log', { level: 'success', message: `✅ [Bot #${this.id}] Match found: ${url}${isDebouncedPhase ? ' (Skipping Actions due to debounce)' : ''}` });
                    
                    if (isDebouncedPhase) return;
                    this.lastTriggerTime = now;
                    
                    if (this.config.actions.includes('notification')) {
                        this.emit('show-notification', {
                            title: `Observer - Bot #${this.id}`,
                            message: `Match triggered on network request!`
                        });
                        triggerNativeNotification(`Observer - Bot #${this.id}`, 'Match triggered on network request!');
                    }
                    
                    if (this.config.actions.includes('audio')) {
                        this.emit('play-audio', {});
                    }

                    if (this.config.actions.includes('macro') && this.config.macroCode && this.config.macroCode.trim() !== '') {
                        this.emit('log', { level: 'info', message: `[Bot #${this.id}] Running macro...` });
                        try {
                            const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
                            const runMacro = new AsyncFunction('page', this.config.macroCode);
                            await runMacro(this.globalPage);
                            this.emit('log', { level: 'success', message: `[Bot #${this.id}] Macro executed.` });
                        } catch (err) {
                            this.emit('log', { level: 'error', message: `[Bot #${this.id}] Macro failed: ${err.message}` });
                        }
                    }
                }
            } catch (error) {}
        });

        this.globalPage.on('close', () => {
            this.emit('bot-status', { botId: this.id, status: 'stopped' });
            this.emit('log', { level: 'warning', message: `[Bot #${this.id}] Browser was closed.` });
            this.browser = null;
        });

        if (this.config.targetUrl && this.config.targetUrl.trim() !== '') {
            let urlTarget = this.config.targetUrl.trim();
            if (!urlTarget.startsWith('http')) {
                urlTarget = 'https://' + urlTarget;
            }
            this.emit('log', { level: 'info', message: `[Bot #${this.id}] Navigating to ${urlTarget}` });
            this.globalPage.goto(urlTarget).catch(() => {});
        }
    }

    async stop() {
        if (this.browser) {
            await this.browser.close().catch(()=>{}).finally();
            this.browser = null;
            this.context = null;
            this.globalPage = null;
        }
    }

    pause() {
        this.isPaused = true;
    }

    resume() {
        this.isPaused = false;
    }
}

module.exports = { BotInstance };
