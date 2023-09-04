# VdhCoApp:

*vdhcoapp* is a multi-platform (Windows, Mac, Linux) application
providing the [Video DownloadHelper](https://downloadhelper.net/)
browser add-on with a set of extra features not available directly
from the add-on:

- file writing API
- launching default video player application on a data file
- a build of the [ffmpeg](http://ffmpeg.org/) video converter

*vdhcoapp* complies with the
[native messaging protocol](https://developer.mozilla.org/en-US/Add-ons/WebExtensions/Native_messaging)
and is not intended to be used directly from the command line.

Installer executables for the various platforms are available
from the [releases page](https://github.com/aclap-dev/vdhcoapp/releases).

## Post installation:

Post installation is *not* necessary on Windows, Mac `.pkg` and Linux `.deb`.

Only necessary for Mac `.dmg` and Linux `.tar.bz2`.

### Mac (DMG)

Just double click on the app, it will then register itself.
If you move the app to a new location, double click on the app again.

### Linux (tar.bz2)

```
INSTALL_LOCATION/vdhcoapp install
```

### Linux Flatpak-ed browsers

In older version of Flatpak, Snap and Firefox, the application was not
visible from within the Flatpak-ed browser.

This should work around the limitation:

```
# Only for old versions of Ubuntu
INSTALL_LOCATION/vdhcoapp install --flatpak-workaround
```
