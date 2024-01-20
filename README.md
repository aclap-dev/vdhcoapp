⚠️ This is a developer dedicated place. If you are a user and need help with Video DownloadHelper and/or its companion app:

- you can find [all relevant links here](https://github.com/aclap-dev/video-downloadhelper).
- if you have an issue with the CoApp not being registered, [read this](https://github.com/aclap-dev/video-downloadhelper/wiki/CoApp-not-recognized).
- [all the documentation is here](https://github.com/aclap-dev/video-downloadhelper/wiki).
- you can [ask questions here](https://github.com/aclap-dev/video-downloadhelper/discussions).


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

# Note about the registration process

After the app is installed, the coapp installs a json file into browser-specific directories,
as described by the Mozilla, Google and Microsoft documentation:

- https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Native_manifests
- https://developer.chrome.com/docs/extensions/mv3/nativeMessaging/#native-messaging-host-location
- https://learn.microsoft.com/en-us/microsoft-edge/extensions-chromium/developer-guide/native-messaging?tabs=v3%2Cwindows

You can see the list of files installed by running `vdhcoapp install`.
Those files can be remove with `vdhcoapp uninstall`.
