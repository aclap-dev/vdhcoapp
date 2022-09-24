
***vdhcoapp*** is a multi-platform (Windows, Mac, Linux) application providing the 
[Video DownloadHelper](https://downloadhelper.net/) browser add-on with:

- file writing API features that are not available from the browser
- temporary file name generation
- launching default application on a data file
- a build of the [ffmpeg](http://ffmpeg.org/) video converter

***vdhcoapp*** complies with the [native messaging protocol](https://developer.mozilla.org/en-US/Add-ons/WebExtensions/Native_messaging) and is not intended to be used directly from the command line.

Installer executables for the various platforms are available from the [releases page](https://github.com/mi-g/vdhcoapp/releases).

***how to install tar.gz binary version***
1- Download from [releases page](https://github.com/mi-g/vdhcoapp/releases), example
wget https://github.com/mi-g/vdhcoapp/releases/download/v1.6.3/net.downloadhelper.coapp-1.6.3-1_amd64-glibc-2.27.tar.gz
2- extract and install the binary
tar xvf net.downloadhelper.coapp-1.6.3-1_amd64-glibc-2.27.tar.gz && cd net.downloadhelper.coapp-1.6.3-1_amd64-glibc-2.27/bin
./net.downloadhelper.coapp-linux-64 install --user
3- then go to "Video DownloadHelper" addons setting page in firefox/chrome. On "Companion App installed" section, it read below:
Found companion app: VdhCoApp 1.6.3
Companion app binary: /home/user/net.downloadhelper.coapp-1.6.3/bin/net.downloadhelper.coapp-linux-64
