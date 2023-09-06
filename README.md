# DownloadHelper CoApp:

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

**Linux**: download the `.deb` file (on Ubuntu and Debian), and install it: `dpkg -i <deb file>`.

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

# Notes about Flatpak/Snap browsers

**Firefox**: In older version of Flatpak, Snap and Firefox, the application was not
visible from within the browser. This should not be a problem anymore.
Make sure to update your Firefox.

**Chromium based browsers (Chrome, Brave, …)**: sadly, there's no easy workaround as
of now. It's up to the Chromium team to fix Native Messaging in sandboxes, or to packagers
to allow a persistent `.config` directory in their flatpak installation.
