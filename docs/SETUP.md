# Setup Guide

Step-by-step instructions to install and run J33T Intel on your computer.

---

## Prerequisites

You'll need three things installed:

| Tool | What it does | How to get it |
|------|-------------|---------------|
| **Git** | Downloads code and uploads changes | See below |
| **Node.js 20+** | Runs the JavaScript/TypeScript code | See below |
| **pnpm** | Installs code libraries | See below |

You'll also need a **free Helius API key** to fetch Solana data. Get one at [helius.dev](https://helius.dev).

---

## Mac

### 1. Install Homebrew (Mac package manager)

Open **Terminal** (press `Cmd + Space`, type "Terminal", press Enter).

Paste this and press Enter:

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

It will ask for your Mac password (characters won't appear — that's normal).

**If you have an Apple Silicon Mac (M1/M2/M3/M4)** and see "Add Homebrew to your PATH" at the end, run:

```bash
echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
eval "$(/opt/homebrew/bin/brew shellenv)"
```

### 2. Install Git, Node.js, and pnpm

```bash
brew install git
brew install node@20
npm install -g pnpm
```

Verify everything works:

```bash
git --version        # should show: git version 2.x.x
node --version       # should show: v20.x.x
pnpm --version       # should show: 9.x.x or 10.x.x
```

### 3. Set up Git with your name

```bash
git config --global user.name "Your Name"
git config --global user.email "your@email.com"
```

---

## Windows

### 1. Install Git

Download and run the installer from [git-scm.com](https://git-scm.com/download/win). Use all default settings.

### 2. Install Node.js

Download the **LTS** version from [nodejs.org](https://nodejs.org). Run the installer with default settings.

### 3. Install pnpm

Open **PowerShell** (search for it in the Start menu) and run:

```powershell
npm install -g pnpm
```

### 4. Verify

```powershell
git --version
node --version
pnpm --version
```

---

## Linux (Ubuntu/Debian)

```bash
sudo apt update
sudo apt install -y git curl
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
npm install -g pnpm
```

---

## Download and Install J33T Intel

These steps are the same on all platforms.

### 1. Clone the repository

```bash
git clone https://github.com/petershepherd/j33t-intel.git
cd j33t-intel
```

### 2. Install dependencies

```bash
pnpm install
```

### 3. Build the project

```bash
pnpm build
```

If you see no red error messages, everything is working.

### 4. Set up your API keys

Copy the example configuration:

```bash
cp .env.example .env
```

Open the `.env` file in a text editor and add your Helius API key:

**Mac/Linux (using nano):**
```bash
nano .env
```
Edit the line `HELIUS_API_KEY=your_helius_key_here` to include your actual key, then save with `Ctrl+X`, `Y`, `Enter`.

**Windows:** Open `.env` with Notepad.

**Any platform:** You can also use VS Code (`code .env`).

### 5. Run your first analysis

```bash
node packages/cli/dist/index.js backtest DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263 --verbose
```

This analyzes the BONK token. You should see scores, signals, and a JSON file will be saved in your current directory.

---

## Getting a Helius API Key

1. Go to [helius.dev](https://helius.dev)
2. Click "Start Building" or "Sign Up"
3. Create a free account
4. Go to your dashboard and copy your API key
5. Paste it into your `.env` file as the `HELIUS_API_KEY` value

The free tier gives you enough API calls for personal use. If you need more, Helius offers paid plans.

---

## Troubleshooting

### "command not found"
Close and reopen your Terminal/PowerShell, then try again. This refreshes your system's path.

### "permission denied" (Mac/Linux)
Add `sudo` before the command, e.g.: `sudo npm install -g pnpm`

### Build errors
Make sure all three tools are installed:
```bash
git --version && node --version && pnpm --version
```
If any of them fails, reinstall that tool.

### "Cannot find module" errors
Run `pnpm install` again, then `pnpm build`.

### API errors when running analysis
Check that your `.env` file has a valid Helius API key. You can test it by opening this URL in your browser (replace YOUR_KEY):
```
https://api.helius.xyz/v0/addresses/So11111111111111111111111111111111111111112/transactions?api-key=YOUR_KEY&limit=1
```
If you see JSON data, your key works.

---

## Next Steps

- Try analyzing different tokens with `backtest` and `rugcheck`
- Read [How It Works](HOW-IT-WORKS.md) to understand the scoring engine
- Read [Configuration](CONFIGURATION.md) to customize settings
