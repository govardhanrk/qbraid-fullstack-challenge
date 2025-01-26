# qBraid Chat Extension for VS Code

A Visual Studio Code extension that allows you to interact with qBraid's AI models and quantum computing services directly from your IDE.

## Features

- Chat with qBraid's AI models directly within VS Code
- Query available quantum devices and their status
- Check quantum job statuses
- Select from multiple AI models for different use cases
- Stream responses in real-time

## Installation

1. Download the `.vsix` file from the latest release
2. Install using VS Code:
   ```bash
   code --install-extension qbraid-chat-0.1.0.vsix
   ```
   Or install through VS Code's Extensions view by selecting "Install from VSIX..."

## Setup

Before using the extension, you'll need to set up your qBraid API key. You can do this in one of two ways:

1. **VS Code Settings**:
   - Open Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)
   - Run "qBraid Chat: Set API Key"
   - Enter your API key when prompted

2. **Configuration File**:
   - Create or edit `~/.qbraid/qbraidrc`
   - Add your API key: `api_key=your_api_key_here`

## Usage

1. Start a chat session:
   - Open Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)
   - Run "qBraid Chat: Start"

2. Select your preferred AI model from the dropdown menu

3. Try these special commands:
   - Ask "What quantum devices available through qBraid are currently online and available?"
   - Check job status with "What is the status of the most recent quantum job I submitted?"

## Extension Settings

This extension contributes the following settings:

* `qbraidChat.apiKey`: Your qBraid API key
* `qbraidChat.defaultModel`: Default AI model to use for chat (e.g., "gpt-4o-mini")

## Requirements

- Visual Studio Code ^1.75.0
- Active qBraid account with API access
- Internet connection to access qBraid's services

## Development

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Package the extension:
   ```bash
   npm run vsce:package
   ```

## License

[MIT License](LICENSE)

## Support

For issues, questions, or suggestions, please contact:
- Email: contact@qbraid.com
- Website: https://docs.qbraid.com

## Release Notes

### 0.1.0
- Initial release
- Basic chat functionality with model selection
- Real-time quantum device status queries
- Job status checking capability
