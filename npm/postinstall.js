#!/usr/bin/env node

/**
 * Kaitu Post-Install Script
 * This script runs after npm install to install the Kaitu app
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');
const { execSync, spawn } = require('child_process');
const os = require('os');

// Get platform-specific info
function getPlatformInfo() {
  const platform = process.platform;
  const arch = process.arch;
  
  if (platform === 'darwin') {
    // For macOS, we use universal binary
    return {
      platform: 'darwin',
      arch: 'universal',
      key: 'darwin-universal',
      isMac: true,
      isWindows: false,
      isLinux: false
    };
  } else if (platform === 'win32') {
    // For Windows
    const archMap = {
      'x64': 'amd64',
      'arm64': 'arm64',
      'ia32': '386'
    };
    return {
      platform: 'windows',
      arch: archMap[arch] || arch,
      key: `windows-${archMap[arch] || arch}`,
      isMac: false,
      isWindows: true,
      isLinux: false
    };
  } else if (platform === 'linux') {
    // For Linux
    const archMap = {
      'x64': 'amd64',
      'arm64': 'arm64',
      'arm': 'arm'
    };
    return {
      platform: 'linux',
      arch: archMap[arch] || arch,
      key: `linux-${archMap[arch] || arch}`,
      isMac: false,
      isWindows: false,
      isLinux: true
    };
  }
  
  throw new Error(`Unsupported platform: ${platform}`);
}

// Read package.json to get installer URLs and hashes
function getPackageConfig() {
  const packagePath = path.join(__dirname, 'package.json');
  const packageData = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  return packageData;
}

// Check if running with sudo/admin privileges
function checkPrivileges() {
  if (process.platform === 'darwin' || process.platform === 'linux') {
    try {
      // Check if we can write to /Applications (macOS) or /usr/local (Linux)
      const testPath = process.platform === 'darwin' ? '/Applications' : '/usr/local/bin';
      fs.accessSync(testPath, fs.constants.W_OK);
      return true;
    } catch (err) {
      return false;
    }
  } else if (process.platform === 'win32') {
    // On Windows, check if running as administrator
    try {
      execSync('net session', { stdio: 'ignore' });
      return true;
    } catch (err) {
      return false;
    }
  }
  return false;
}

// Download a file from URL with progress
function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    console.log(`Downloading from: ${url}`);
    
    const file = fs.createWriteStream(destPath);
    
    https.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        // Handle redirect
        file.close();
        if (fs.existsSync(destPath)) {
          fs.unlinkSync(destPath);
        }
        return downloadFile(response.headers.location, destPath)
          .then(resolve)
          .catch(reject);
      }
      
      if (response.statusCode !== 200) {
        file.close();
        if (fs.existsSync(destPath)) {
          fs.unlinkSync(destPath);
        }
        reject(new Error(`Failed to download: HTTP ${response.statusCode}`));
        return;
      }
      
      const totalSize = parseInt(response.headers['content-length'], 10);
      let downloadedSize = 0;
      
      response.on('data', (chunk) => {
        downloadedSize += chunk.length;
        if (totalSize) {
          const percent = Math.round((downloadedSize / totalSize) * 100);
          process.stdout.write(`\rDownloading... ${percent}%`);
        }
      });
      
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        console.log('\nDownload complete');
        resolve();
      });
    }).on('error', (err) => {
      if (fs.existsSync(destPath)) {
        fs.unlinkSync(destPath);
      }
      reject(err);
    });
  });
}

// Install DMG on macOS
async function installDMG(dmgPath) {
  console.log('Installing Kaitu app from DMG...');
  
  try {
    // Create mount point
    const mountPoint = path.join(os.tmpdir(), 'kaitu-mount');
    
    // Mount the DMG
    console.log('Mounting DMG...');
    execSync(`hdiutil attach "${dmgPath}" -nobrowse -mountpoint "${mountPoint}"`, { stdio: 'inherit' });
    
    // Find the app in the mounted volume
    const appPath = path.join(mountPoint, 'Kaitu.app');
    if (!fs.existsSync(appPath)) {
      // Try to find any .app file
      const files = fs.readdirSync(mountPoint);
      const appFile = files.find(f => f.endsWith('.app'));
      if (!appFile) {
        throw new Error('No .app file found in DMG');
      }
    }
    
    // Copy to /Applications
    const destPath = '/Applications/Kaitu.app';
    console.log('Copying app to /Applications...');
    
    // Remove existing app if present
    if (fs.existsSync(destPath)) {
      console.log('Removing existing installation...');
      execSync(`rm -rf "${destPath}"`);
    }
    
    // Copy the app
    execSync(`cp -R "${appPath}" "${destPath}"`);
    
    // Unmount the DMG
    console.log('Unmounting DMG...');
    execSync(`hdiutil detach "${mountPoint}"`, { stdio: 'ignore' });
    
    // Remove the DMG file
    fs.unlinkSync(dmgPath);
    
    console.log('✅ Kaitu app installed successfully to /Applications');
    console.log('You can now launch Kaitu from your Applications folder or Launchpad');
    
  } catch (err) {
    console.error('Installation failed:', err.message);
    
    // Try to unmount if still mounted
    try {
      execSync(`hdiutil detach "${path.join(os.tmpdir(), 'kaitu-mount')}"`, { stdio: 'ignore' });
    } catch (e) {}
    
    throw err;
  }
}

// Verify file hash
function verifyHash(filePath, expectedHash) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    
    stream.on('data', (data) => {
      hash.update(data);
    });
    
    stream.on('end', () => {
      const fileHash = `sha256:${hash.digest('hex')}`;
      if (fileHash === expectedHash) {
        resolve(true);
      } else {
        reject(new Error(`Hash mismatch: expected ${expectedHash}, got ${fileHash}`));
      }
    });
    
    stream.on('error', reject);
  });
}

// Install service binary
async function installService(platformInfo, packageConfig) {
  console.log('\n📦 Installing Kaitu Service...\n');
  
  // Get service info
  const serviceConfig = packageConfig.service || {};
  const serviceInfo = serviceConfig[platformInfo.key];
  
  if (!serviceInfo) {
    console.log('No service binary available for platform:', platformInfo.key);
    return false;
  }
  
  const serviceBinaryName = `kaitu-service-${platformInfo.key}${platformInfo.isWindows ? '.exe' : ''}`;
  const tempPath = path.join(os.tmpdir(), serviceBinaryName);
  const targetPath = platformInfo.isWindows 
    ? path.join(process.env.ProgramFiles || 'C:\\Program Files', 'kaitu', 'kaitu-service.exe')
    : '/usr/local/bin/kaitu-service';
  
  try {
    // Download service binary
    console.log('Downloading service binary...');
    await downloadFile(serviceInfo.url, tempPath);
    
    // Verify hash
    console.log('Verifying service binary...');
    await verifyHash(tempPath, serviceInfo.hash);
    console.log('Verification successful');
    
    // Install to system location
    if (platformInfo.isMac || platformInfo.isLinux) {
      // Copy to /usr/local/bin
      console.log(`Installing service to ${targetPath}...`);
      
      // Create /usr/local/bin if it doesn't exist
      const binDir = path.dirname(targetPath);
      if (!fs.existsSync(binDir)) {
        execSync(`mkdir -p ${binDir}`);
      }
      
      // Copy binary
      execSync(`cp "${tempPath}" "${targetPath}"`);
      
      // Set executable permissions
      execSync(`chmod +x "${targetPath}"`);
      
      // Clean up temp file
      fs.unlinkSync(tempPath);
      
      // Run kaitu-service install
      console.log('Running service installation...');
      try {
        execSync(`"${targetPath}" install`, { stdio: 'inherit' });
        console.log('✅ Service installed successfully');
      } catch (err) {
        console.log('⚠️  Service installation requires sudo privileges');
        console.log('Please run manually: sudo kaitu-service install');
      }
      
      return true;
      
    } else if (platformInfo.isWindows) {
      // Windows service installation
      console.log('⚠️  Windows service installation is not yet automated');
      console.log('Please install the service manually');
      return false;
    }
    
  } catch (err) {
    console.error('Service installation failed:', err.message);
    return false;
  }
}

// Main post-install function
async function postInstall() {
  try {
    console.log('\n🚀 Installing Kaitu\n');
    
    // Get platform info
    const platformInfo = getPlatformInfo();
    console.log(`Platform: ${platformInfo.key}`);
    
    // Check for privileges
    const hasPrivileges = checkPrivileges();
    if (!hasPrivileges) {
      console.log('\n⚠️  Full installation requires administrator privileges');
      console.log('Please run with sudo: sudo npm install -g kaitu');
      console.log('\nContinuing with limited installation...\n');
    }
    
    // Get package configuration
    const packageConfig = getPackageConfig();
    
    // Install service first (if has privileges)
    let serviceInstalled = false;
    if (hasPrivileges) {
      serviceInstalled = await installService(platformInfo, packageConfig);
    }
    
    // Get installer info based on platform
    const installerConfig = packageConfig.installer || {};
    const installerInfo = installerConfig[platformInfo.key];
    
    if (!installerInfo) {
      console.log('\n⚠️  No desktop installer available for your platform yet.');
      console.log('Available platforms:', Object.keys(installerConfig).join(', '));
      
      if (!serviceInstalled) {
        console.log('\nPlease download the desktop app manually from:');
        console.log('https://github.com/allnationconnect/kaitu/releases\n');
      }
      return;
    }
    
    // Platform-specific installation
    if (platformInfo.isMac) {
      console.log('\n📱 Installing Kaitu Desktop App...\n');
      
      // Download DMG
      const dmgPath = path.join(os.tmpdir(), 'kaitu-installer.dmg');
      
      // Check if DMG already exists
      if (fs.existsSync(dmgPath)) {
        console.log('Using cached installer...');
        try {
          await verifyHash(dmgPath, installerInfo.hash);
        } catch (err) {
          console.log('Cached installer verification failed, re-downloading...');
          fs.unlinkSync(dmgPath);
          await downloadFile(installerInfo.url, dmgPath);
        }
      } else {
        await downloadFile(installerInfo.url, dmgPath);
      }
      
      // Verify the downloaded DMG
      console.log('Verifying installer...');
      await verifyHash(dmgPath, installerInfo.hash);
      console.log('Verification successful');
      
      // Install the DMG (only if has privileges)
      if (hasPrivileges) {
        await installDMG(dmgPath);
      } else {
        console.log('\n⚠️  Cannot install to /Applications without privileges');
        console.log('Downloaded installer to:', dmgPath);
        console.log('Please open the DMG and drag Kaitu to Applications manually');
      }
      
    } else if (platformInfo.isWindows) {
      // Windows installation (placeholder)
      console.log('\n⚠️  Windows automated installation is not yet implemented.');
      console.log('Please download and install manually from:');
      console.log('https://github.com/allnationconnect/kaitu/releases');
      console.log('\nThe installer will be available once Windows packages are ready.\n');
      
    } else if (platformInfo.isLinux) {
      // Linux installation (placeholder)
      console.log('\n⚠️  Linux automated installation is not yet implemented.');
      console.log('Please download and install manually from:');
      console.log('https://github.com/allnationconnect/kaitu/releases');
      console.log('\nThe installer will be available once Linux packages are ready.\n');
    }
    
    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('Installation Summary:');
    if (serviceInstalled) {
      console.log('✅ Service installed to /usr/local/bin/kaitu-service');
    }
    if (platformInfo.isMac && hasPrivileges && installerInfo) {
      console.log('✅ Desktop app installed to /Applications');
    }
    console.log('='.repeat(50) + '\n');
    
  } catch (err) {
    console.error('\n❌ Installation failed:', err.message);
    console.error('\nYou can download the installer manually from:');
    console.error('https://github.com/allnationconnect/kaitu/releases\n');
    process.exit(1);
  }
}

// Only run if this is the main module
if (require.main === module) {
  postInstall();
}