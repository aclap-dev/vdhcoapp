# DownloadHelper CoApp

*DownloadHelper CoApp* is a multi-platform (Windows, Mac, Linux) application
providing the [Video DownloadHelper](https://downloadhelper.net/)
browser add-on with a set of extra features not available directly
from the add-on:

- file writing API
- launching default video player application on a data file
- a build of the [ffmpeg](http://ffmpeg.org/) video converter

*DownloadHelper CoApp* complies with the
[native messaging protocol](https://developer.mozilla.org/en-US/Add-ons/WebExtensions/Native_messaging)
and is not intended to be used directly from the command line.

Installer executables for the various platforms are available
from the [releases page](https://github.com/aclap-dev/vdhcoapp/releases).

# Installation

**Windows**: download the `.exe` file, double click on it, and follow the instructions.

**Mac**: download the `.pkg` file, double click on it, and follow the instructions.

**Linux debian-based**: download the `.deb` file and install it: `sudo dpkg -i <deb file>`.

**Linux other**: download the `.tar.bz2` file, unpack and move to a desired location, and run `./vdhcoapp install`.

At this point, the app should be recognised within your browser.

You can check in the Video DownloadHelper add-on settings:

![settings](./assets/instruction1.png "Settings")
![app check](./assets/instruction2.png "App check")

# Alternative installation methods

**Mac DMG**: download the `.dmg` file, open it and move the app to **Application** folder.
Launch the app once to register its manifest within the different browsers (it will show
a notification then close). Re-run the app if you ever move the application to a new location.

**Linux tar.bz2**: download the `.tar.bz2` file, extract it where ever you want to
install the app, then run `<install location>/vdhcoapp install` to register the
manifest within the different browsers. Re-run the install command if you ever move
the application to a new location.

# Troubleshooting

If the coapp is not recognised by the extension, here are a few things you can try:

- Try the latest coapp. You will find the download links here: https://www.downloadhelper.net/install-coapp-v2
- Make sure the Video DownloadHelper addon is at least version 8.1, and has been installed from its official location: https://www.downloadhelper.net/install
- If you use Edge, make sure to install the addon from the Microsoft store, not the Google store. See relevant links here: https://www.downloadhelper.net/install
- **Windows 7**
  - We have dedicated builds for Windows 7. You will find the download links here: https://www.downloadhelper.net/install-coapp-v2 - Make sure to install the Windows 7 version.
- **Mac**
  - Double click on the coapp, this should re-register the app in the relevant browsers.
- **Linux**
  - Run `/opt/vdhcoapp/vdhcoapp install` (**not as root! Don't use sudo**) to re-register the app.
  - Move to the installation folder of the coapp in your terminal, and run: `./vdhcoapp --info`. It will run some diagnostic operations.
- **Ubuntu** (and Flatpak / Snap based distributions)
  - do not install vdhcoapp within the `/usr/` directory, it won't be detected by your browser. [See here why](https://github.com/aclap-dev/vdhcoapp/issues/160#issuecomment-1780765719).
  - Firefox should have showed you a prompt to allow the coapp to communicate with the extension. Some people miss the prompt, or the prompt just never shows up. There's no user interface to change that setting.
To solve this, run these commands (even if you don't use Flatpak):
```
sudo apt-get install -y flatpak
flatpak permission-set webextensions net.downloadhelper.coapp snap.firefox yes
```
- **Snap Chromium-based browsers**
  - They do not support native messaging yet. It is up to Google to fix this issue.

# Note about the registration process

After the app is installed, the coapp installs a json file into browser-specific directories,
as described by the Mozilla, Google and Microsoft documentation:

- https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Native_manifests
- https://developer.chrome.com/docs/extensions/mv3/nativeMessaging/#native-messaging-host-location
- https://learn.microsoft.com/en-us/microsoft-edge/extensions-chromium/developer-guide/native-messaging?tabs=v3%2Cwindows

You can see the list of files installed by running `vdhcoapp install`.
Those files can be remove with `vdhcoapp uninstall`.
