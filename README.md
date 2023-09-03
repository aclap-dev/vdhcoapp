VdhCoApp:
=========

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

Post manual installation process (Linux & Mac):
==============================================

If the application was installed via an installer (.deb on Linux, .pkg on Mac),
these steps are not necessary.

Otherwise, after unpacking the application in its final location, these commands
are necessary to let different browsers know where to look for the coapp:

Linux:
=====

Recommended method:

```
INSTALL_LOCATION/vdhcoapp install --user
```

In older version of Flatpak and Snap, the application was not visible from within the Flatpak-ed browser.
This should work around the limitation:

```
# Only for old versions of Ubuntu
INSTALL_LOCATION/vdhcoapp install --flatpak-workaround
```

For system wide installation (not recommened):

```
sudo INSTALL_LOCATION/vdhcoapp install --system
```

Mac:
===

```
INSTALL_LOCATION/net.downloadhelper.coapp.app/Contents/MacOS/vdhcoapp install
```

Uninstall:
=========

Same as above, but with `uninstall`, then you safely remove the app.
