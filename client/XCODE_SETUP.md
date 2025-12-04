# Setting Up Xcode for iOS Development

## Step 1: Install Xcode

1. **Open Mac App Store**
   - Click the Apple menu → App Store
   - Search for "Xcode"
   - Click "Get" or the download button (⬇️)

2. **Wait for Download**
   - Size: ~15GB
   - Time: 1-2 hours depending on your internet
   - You can continue using your Mac while it downloads

3. **Open Xcode**
   - Once installed, open Xcode from Applications
   - Accept the license agreement
   - Wait for "Installing components..." to complete (~5-10 minutes)

## Step 2: Set Up Command Line Tools

After Xcode is installed, run these commands in Terminal:

```bash
# Point xcode-select to Xcode
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer

# Set encoding (important for CocoaPods)
export LANG=en_US.UTF-8

# Verify it worked
xcode-select -p
# Should show: /Applications/Xcode.app/Contents/Developer
```

## Step 3: Sync Capacitor for iOS

```bash
cd /Users/charleszheng/Desktop/Ideas/Cat\ Judge/client

# This will install iOS dependencies via CocoaPods
npx cap sync
```

## Step 4: Open Your App in Xcode

```bash
# Still in client folder
npx cap open ios
```

This opens Xcode with your Pause app project.

## Step 5: Run on Simulator

In Xcode:

1. **Select a simulator**
   - Top bar: click device dropdown
   - Choose "iPhone 15 Pro" (or any iPhone)

2. **Click Run ▶️**
   - Big play button in top left
   - Wait for app to build (~1 minute first time)
   - Simulator will launch and show your app!

## Step 6: Test Your App

- Sign in/Sign up
- Test all features
- Check splash screen appears on launch
- Verify app icon looks correct

---

## Troubleshooting

**"Build Failed"**
- Run `npx cap sync` again
- Clean build: Xcode menu → Product → Clean Build Folder

**Simulator won't launch**
- Xcode menu → Xcode → Settings → Locations
- Ensure Command Line Tools is set to your Xcode version

**CocoaPods errors**
```bash
cd ios/App
pod repo update
pod install
```

---

## Quick Reference

```bash
# After any front-end changes
npm run build
npx cap sync

# Open in Xcode
npx cap open ios

# Open in Android Studio
npx cap open android
```
