# Observer

A local utility tool that automates headless browser instances to monitor website network requests. When a specific network response or URL matches a user-defined regex, the bot triggers automated notifications or runs custom macros.

## Tech Stack
- **Backend**: Node.js, Express, Socket.IO
- **Browser Automation**: `playwright-core` 
- **Frontend**: Standard HTML/CSS/JS

## Core Features
1. **Multi-Instance Architecture**: You can launch and manage multiple independent browser instances concurrently from a single dashboard. 
2. **Regex Matching**: Continuously monitors a page's `response` events and checks the payload body or URL string against the config.
3. **Trigger Actions**:
    - **Audio Alerts**: Utilizes the native Web Audio API (`AudioContext`) to generate synthesized beeps.
    - **Desktop Notifications**: Bypasses external libraries by dynamically injecting a PowerShell script to directly invoke Windows XML toast notifications.
    - **Playwright Macros**: Allows users to input Javascript (e.g., `await page.click(...)`) which executes on the Playwright `page` object dynamically upon a regex match.
4. **Stealth Mode**: By default, the browser masks standard `navigator.webdriver` indicators, normalizes `User-Agent` to Microsoft Edge, and injects mock plugin arrays to mitigate basic automated bot detection.
5. **Standalone Execution**: Uses `@yao-pkg/pkg` to package the entire project into a single `Observer.exe` file. Instead of downloading heavy standalone Chromium binaries, the config binds Playwright to the native Microsoft Edge channel installed on standard Windows machines.

## Running the Project

If you have downloaded the source code directly:
```bash
npm install
node server.js
```
Then navigate to `http://localhost:3000`.

## Building the Executable

To compile the application into a single `.exe` file that can be distributed easily:
```bash
npm run build
```
This will automatically invoke `pkg` and output the `Observer.exe` standalone file inside your core directory.

## Development Context (Antigravity AI)

This project was developed strictly via **Antigravity**, an autonomous agentic coding assistant developed by Google Deepmind.

### Efficiency Snapshot:
- The entire application was engineered end-to-end within a single short conversational session with zero manual user code input.
- **Problem Solving:** When packaging the Node application to a single `.exe` caused the `node-notifier` native binaries to fail, the agent autonomously architected a workaround by replacing it with an inline PowerShell script and a native Web Audio API synthesizer, eliminating all physical dependencies.
- **Refactoring:** The transition from a simple singleton script to a multi-instance OOP backend was managed programmatically and cleanly across the Node logic and DOM elements via autonomous file multi-replacements.
