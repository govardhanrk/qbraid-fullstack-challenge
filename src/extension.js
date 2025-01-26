const vscode = require("vscode");
const fs = require('fs');
const path = require('path');
const os = require('os');

let models = [];

//API endpoints
const QBRAID_API_BASE = "https://api.qbraid.com/api";
const API_ENDPOINTS = {
    CHAT: `${QBRAID_API_BASE}/chat`,
    DEVICES: `${QBRAID_API_BASE}/quantum-devices`,
    JOBS: `${QBRAID_API_BASE}/quantum-jobs`
};

function activate(context) {
    // Register commands
    let startChat = vscode.commands.registerCommand("qbraid-chat.start", startChatCommand);
    let setApiKey = vscode.commands.registerCommand("qbraid-chat.setApiKey", setApiKeyCommand);

    context.subscriptions.push(startChat, setApiKey);
}

async function startChatCommand() {
    const apiKey = await getApiKey();
    if (!apiKey) {
        vscode.window.showErrorMessage("Please set your qBraid API key first");
        return;
    }

    // Fetch available models
    try {
        await fetchModels(apiKey);
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to fetch models: ${error.message}`);
        return;
    }

    const panel = vscode.window.createWebviewPanel(
        "qbraidChat",
        "qBraid Chat",
        vscode.ViewColumn.One,
        { enableScripts: true }
    );

    panel.webview.html = getWebviewContent(models);

    panel.webview.onDidReceiveMessage(async (message) => {
        switch (message.command) {
            case 'sendMessage':
                const response = await sendChatMessage(message.text, message.model, apiKey);
                panel.webview.postMessage({ command: 'receiveMessage', text: response });
                break;
            case 'changeModel':
                await vscode.workspace.getConfiguration().update('qbraidChat.defaultModel', message.model, true);
                break;
        }
    });
}

async function setApiKeyCommand() {
    const apiKey = await vscode.window.showInputBox({
        prompt: "Enter your qBraid API key",
        password: true
    });

    if (apiKey) {
        await vscode.workspace.getConfiguration().update('qbraidChat.apiKey', apiKey, true);
        vscode.window.showInformationMessage('API key saved successfully');
    }
}

async function getApiKey() {
    // Try getting from VS Code settings
    let apiKey = vscode.workspace.getConfiguration().get('qbraidChat.apiKey');
    if (apiKey) return apiKey;

    // Try reading from ~/.qbraid/qbraidrc
    try {
        const rcPath = path.join(os.homedir(), '.qbraid', 'qbraidrc');
        if (fs.existsSync(rcPath)) {
            const content = fs.readFileSync(rcPath, 'utf8');
            const match = content.match(/api[_-]key[=:]\s*["']?([^"'\s]+)["']?/i);
            if (match) return match[1];
        }
    } catch (error) {
        console.error('Error reading qbraidrc:', error);
    }

    // Prompt user if no key found
    return vscode.window.showInputBox({
        prompt: "Enter your qBraid API key",
        password: true
    });
}

async function fetchModels(apiKey) {
    const response = await globalThis.fetch("https://api.qbraid.com/api/chat/models", {
        headers: { "api-key": apiKey }
    });
    
    if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.statusText}`);
    }
    
    const data = await response.json();
    models = Array.isArray(data) ? data : [];
}

async function sendChatMessage(text, model, apiKey) {
    // Add special command handling
    if(text.toLowerCase().includes("qbraid")){
    if ((text.toLowerCase().includes("devices") || text.toLowerCase().includes("simulators") || text.toLowerCase().includes("qpus")) 
        && (text.toLowerCase().includes("online") || text.toLowerCase().includes("available"))) {
        return await handleDevicesQuery(apiKey);
    } else if (text.toLowerCase().includes("job") && text.toLowerCase().includes("status")) {
        return await handleJobStatusQuery(apiKey);
    }}

    // Regular chat handling (existing code)
    const controller = new AbortController();
    const signal = controller.signal;

    try {
        const response = await globalThis.fetch(API_ENDPOINTS.CHAT, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "api-key": apiKey
            },
            body: JSON.stringify({
                prompt: text,
                model: model,
                stream: true
            }),
            signal
        });

        if (!response.ok) {
            throw new Error(`API request failed: ${response.statusText}`);
        }

        const reader = response.body.getReader();
        let result = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            // Convert the chunk to text and append
            const chunk = new TextDecoder().decode(value);
            result += chunk;
        }

        return result;
    } catch (error) {
        return `Error: ${error.message}`;
    }
}

async function handleDevicesQuery(apiKey) {
    try {
        const queryParams = new URLSearchParams({
            status: 'ONLINE',
            isAvailable: 'true'
        });

        const response = await globalThis.fetch(`${API_ENDPOINTS.DEVICES}?${queryParams}`, {
            headers: { "api-key": apiKey }
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch devices: ${response.statusText}`);
        }

        const data = await response.json();
        /** @type {any[]} */
        const onlineDevices = Array.isArray(data) ? data : [];
        //const onlineDevices = devices.filter(device => device.isAvailable === true);
        
        if (onlineDevices.length === 0) {
            return "No devices are currently available.";
        }

        return `Currently available quantum devices:\n\n${onlineDevices.map(device => 
            `• ${device.name} (${device.provider}),` +
            ` Type: ${device.type},` +
            ` Qubits: ${device.numberQubits},` +
            ` Status: ${device.status},` +
            ` Pending Jobs: ${device.pendingJobs},` +
            ` Next Available: ${new Date(device.nextAvailable).toLocaleString()},` +
            ` Pricing: ${formatPricing(device.pricing)}`
        ).join('\n\n')}`;
    } catch (error) {
        return `Error fetching devices: ${error.message}`;
    }
}

function formatPricing(pricing) {
    if (!pricing) return 'No pricing information available';
    
    const parts = [];
    if (pricing.perTask) parts.push(`${pricing.perTask} credits/task`);
    if (pricing.perShot) parts.push(`${pricing.perShot} credits/shot`);
    if (pricing.perMinute) parts.push(`${pricing.perMinute} credits/minute`);
    return parts.length ? parts.join(', ') : 'No pricing information available';
}

async function handleJobStatusQuery(apiKey) {
    try {
        const response = await globalThis.fetch(`${API_ENDPOINTS.JOBS}?limit=5`, {
            headers: { "api-key": apiKey }
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch job status: ${response.statusText}`);
        }

        const data = await response.json();
        const jobsArray = (data && typeof data === 'object' && 'jobsArray' in data) 
            ? data.jobsArray 
            : [];
        if (!Array.isArray(jobsArray) || jobsArray.length === 0) {
            return "No recent quantum jobs found.";
        }

        const latestJob = jobsArray[0];
        return `Latest quantum job status:
- Job ID: ${latestJob.qbraidJobId}
- Status: ${latestJob.status}
- Device: ${latestJob.qbraidDeviceId}
- Circuit Info: ${latestJob.circuitNumQubits} qubits, depth ${latestJob.circuitDepth}
- Shots: ${latestJob.shots}
- Created: ${new Date(latestJob.timeStamps.createdAt).toLocaleString()}
${latestJob.timeStamps.endedAt ? `- Completed: ${new Date(latestJob.timeStamps.endedAt).toLocaleString()}` : ''}
${latestJob.timeStamps.executionDuration ? `- Duration: ${latestJob.timeStamps.executionDuration}ms` : ''}
${latestJob.status === 'QUEUED' ? `- Queue Position: ${latestJob.queuePosition} of ${latestJob.queueDepth}` : ''}
${latestJob.cost ? `- Cost: ${latestJob.cost} credits` : latestJob.escrow ? `- Estimated Cost: ${latestJob.escrow} credits` : ''}
${latestJob.measurementCounts ? `- Results: ${JSON.stringify(latestJob.measurementCounts, null, 2)}` : ''}`;
    } catch (error) {
        return `Error fetching job status: ${error.message}`;
    }
}

function getWebviewContent(models) {
    const defaultModel = vscode.workspace.getConfiguration().get('qbraidChat.defaultModel');
    
    return `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { padding: 10px; }
                #chat-box { 
                    height: 400px; 
                    overflow-y: auto; 
                    border: 1px solid #ccc; 
                    margin-bottom: 10px; 
                    padding: 10px;
                }
                .input-container {
                    display: flex;
                    gap: 10px;
                    margin-bottom: 10px;
                }
                #chat-input {
                    flex-grow: 1;
                }
            </style>
        </head>
        <body>
            <h2>qBraid Chat</h2>
            <select id="model-select" onchange="changeModel()">
                ${models.map(m => `
                    <option value="${m.model}" ${m.model === defaultModel ? 'selected' : ''}>
                        ${m.model} - ${m.description}
                    </option>
                `).join('')}
            </select>
            <div id="chat-box"></div>
            <div class="suggestions">
                <p><strong>Try asking about:</strong></p>
                <ul>
                    <li>"What quantum devices available through qBraid are currently online and available?"</li>
                    <li>"What is the status of the most recent quantum job I submitted to the qBraid QIR simulator?"</li>
                </ul>
            </div>
            <div class="input-container">
                <input id="chat-input" type="text" placeholder="Type a message...">
                <button onclick="sendMessage()">Send</button>
            </div>
            
            <script>
                const vscode = acquireVsCodeApi();
                
                function sendMessage() {
                    const input = document.getElementById('chat-input');
                    const model = document.getElementById('model-select').value;
                    vscode.postMessage({ 
                        command: 'sendMessage', 
                        text: input.value,
                        model: model
                    });
                    
                    // Add user message to chat
                    document.getElementById('chat-box').innerHTML += 
                        '<p><strong>You:</strong> ' + input.value + '</p>';
                    input.value = '';
                }

                function changeModel() {
                    const model = document.getElementById('model-select').value;
                    vscode.postMessage({ 
                        command: 'changeModel', 
                        model: model 
                    });
                }

                window.addEventListener('message', event => {
                    const message = event.data;
                    if (message.command === 'receiveMessage') {
                        document.getElementById('chat-box').innerHTML += 
                            '<p><strong>Assistant:</strong> ' + message.text + '</p>';
                    }
                });

                // Enter key support
                document.getElementById('chat-input').addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        sendMessage();
                    }
                });
            </script>
        </body>
        </html>
    `;
}

module.exports = { activate };