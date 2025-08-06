#!/usr/bin/env node

/**
 * Kaitu CLI Entry Point
 * This file provides a friendly CLI interface for Kaitu
 */

const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Check if service is installed
function isServiceInstalled() {
  const servicePath = process.platform === 'win32'
    ? path.join(process.env.ProgramFiles || 'C:\\Program Files', 'kaitu', 'kaitu-service.exe')
    : '/usr/local/bin/kaitu-service';
  return fs.existsSync(servicePath);
}

// Check if app is installed
function isAppInstalled() {
  if (process.platform === 'darwin') {
    return fs.existsSync('/Applications/Kaitu.app');
  } else if (process.platform === 'win32') {
    // Check common installation paths on Windows
    const paths = [
      path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Kaitu'),
      path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Kaitu')
    ];
    return paths.some(p => fs.existsSync(p));
  }
  return false;
}

// Launch the desktop app
function launchApp() {
  if (process.platform === 'darwin') {
    try {
      execSync('open -a Kaitu', { stdio: 'inherit' });
      console.log('✅ Kaitu app launched');
    } catch (err) {
      console.error('Failed to launch Kaitu app:', err.message);
      console.log('Please launch manually from /Applications');
    }
  } else if (process.platform === 'win32') {
    console.log('Please launch Kaitu from your Start Menu or Desktop');
  } else {
    console.log('Please launch Kaitu from your application menu');
  }
}

// Show help information
function showHelp() {
  console.log(`
Kaitu CLI - Desktop Application and Service Manager

Usage: kaitu [command] [options]

Commands:
  start          Launch the Kaitu desktop application
  service        Manage the Kaitu service (requires sudo)
  install        Install Kaitu app and service (requires sudo)
  status         Check installation status
  help           Show this help message

Service Commands (requires sudo):
  kaitu service install    Install the service
  kaitu service start      Start the service
  kaitu service stop       Stop the service
  kaitu service status     Check service status
  kaitu service uninstall  Uninstall the service

Examples:
  kaitu start              # Launch the desktop app
  sudo kaitu service start # Start the background service
  kaitu status             # Check what's installed

For more information: https://github.com/allnationconnect/kaitu
`);
}

// Show installation status
function showStatus() {
  console.log('\nKaitu Installation Status:\n');
  console.log('Desktop App:', isAppInstalled() ? '✅ Installed' : '❌ Not installed');
  console.log('Service Binary:', isServiceInstalled() ? '✅ Installed' : '❌ Not installed');
  
  if (!isAppInstalled() || !isServiceInstalled()) {
    console.log('\nTo install missing components:');
    console.log('  sudo npm install -g kaitu');
  }
  console.log();
}

// Run service commands
function runServiceCommand(args) {
  const servicePath = process.platform === 'win32'
    ? path.join(process.env.ProgramFiles || 'C:\\Program Files', 'kaitu', 'kaitu-service.exe')
    : '/usr/local/bin/kaitu-service';
  
  if (!fs.existsSync(servicePath)) {
    console.error('❌ Service not installed');
    console.log('Please run: sudo npm install -g kaitu');
    process.exit(1);
  }
  
  // Pass through to service binary
  const child = spawn(servicePath, args, {
    stdio: 'inherit',
    env: process.env
  });
  
  child.on('error', (err) => {
    console.error('Failed to run service command:', err.message);
    if (err.code === 'EACCES') {
      console.log('\nTry running with sudo: sudo kaitu service', args.join(' '));
    }
    process.exit(1);
  });
  
  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
    } else {
      process.exit(code || 0);
    }
  });
}

// Run the installation
function runInstall() {
  console.log('Running post-install setup...');
  const postinstallPath = path.join(__dirname, 'postinstall.js');
  
  const child = spawn('node', [postinstallPath], {
    stdio: 'inherit',
    env: process.env
  });
  
  child.on('error', (err) => {
    console.error('Failed to run installation:', err.message);
    process.exit(1);
  });
  
  child.on('exit', (code) => {
    process.exit(code || 0);
  });
}

// Main execution
function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  switch(command) {
    case 'start':
    case 'launch':
    case 'open':
      if (!isAppInstalled()) {
        console.error('❌ Kaitu app is not installed');
        console.log('Please run: sudo npm install -g kaitu');
        process.exit(1);
      }
      launchApp();
      break;
      
    case 'service':
      runServiceCommand(args.slice(1));
      break;
      
    case 'install':
    case 'setup':
      runInstall();
      break;
      
    case 'status':
      showStatus();
      break;
      
    case 'help':
    case '--help':
    case '-h':
    case undefined:
      showHelp();
      break;
      
    default:
      console.error(`Unknown command: ${command}`);
      showHelp();
      process.exit(1);
  }
}

// Run the main function
main();