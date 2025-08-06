# Kaitu

Complete installation package for Kaitu desktop application and service.

## Installation

Install globally using npm with administrator privileges:

```bash
# macOS/Linux
sudo npm install -g kaitu

# Windows (run as Administrator)
npm install -g kaitu
```

This will install:
- **Kaitu Desktop App** to `/Applications` (macOS) 
- **Kaitu Service** to `/usr/local/bin/kaitu-service`
- **CLI commands** for managing both

## What Gets Installed

### macOS
- Desktop application: `/Applications/Kaitu.app`
- Service binary: `/usr/local/bin/kaitu-service`
- CLI tool: `kaitu` command

### Windows (Coming Soon)
- Desktop application: Program Files
- Service binary: System service
- CLI tool: `kaitu` command

### Linux (Coming Soon)
- Desktop application: AppImage/Snap/Flatpak
- Service binary: `/usr/local/bin/kaitu-service`
- CLI tool: `kaitu` command

## Usage

### Basic Commands

```bash
# Check installation status
kaitu status

# Launch the desktop application
kaitu start

# Show help
kaitu help
```

### Service Management

The service commands require administrator privileges:

```bash
# Install service (auto-runs during npm install)
sudo kaitu service install

# Start the service
sudo kaitu service start

# Stop the service
sudo kaitu service stop

# Check service status
sudo kaitu service status

# Uninstall service
sudo kaitu service uninstall
```

## Installation Process

The npm package will:

1. Detect your platform (macOS/Windows/Linux)
2. Download the appropriate desktop installer
3. Download the service binary
4. Verify all files using SHA256 checksums
5. Install the desktop app to system Applications
6. Install the service binary to system path
7. Run `kaitu-service install` to set up the service

## Troubleshooting

### Permission Denied

If you get permission errors, make sure to run with `sudo`:

```bash
sudo npm install -g kaitu
```

### Manual Installation

If automatic installation fails, you can:

1. Download installers manually from: https://github.com/allnationconnect/kaitu/releases
2. Install the desktop app manually
3. Run `sudo kaitu service install` to set up the service

### Service Not Starting

If the service fails to start:

```bash
# Check service logs
sudo kaitu service status

# Reinstall service
sudo kaitu service uninstall
sudo kaitu service install
```

## Supported Platforms

Currently supported:
- macOS (Intel & Apple Silicon) ✅
- Windows (x64 & ARM64) 🚧 Coming Soon
- Linux (x64 & ARM64) 🚧 Coming Soon

## License

ISC

## Repository

https://github.com/allnationconnect/kaitu