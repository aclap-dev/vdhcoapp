
Vdhcoapp is to be built in two parts:

Part 1: the converter (ffmpeg)
---

First the ffmpeg binaries need to be downloaded:

```
./converter/get-apps.sh
```

Once downloaded, the executables and libraries are available in `./converter/build/ffmpeg-<os>-<arch>/`

Part 2: the application
---

Tested on Linux (Ubuntu 16.04).

Install dependencies: 

```
npm install
```

*Creating executable files*

Build for Linux 64 bits:
```
gulp build-linux-64
```
Build for Linux 32 bits:
```
gulp build-linux-32
```
Build for Windows 64 bits:
```
gulp build-win-64
```
Build for Windows 32 bits:
```
gulp build-win-32
```
Build for Mac:
```
gulp build-mac-64
```

Executable files are generated under directory `./bin`.

*Create installer files:*

For Linux, installer files can be built as .deb files (Debian, Ubuntu):
```
gulp deb-linux-64
gulp deb-linux-32
```

Or .tar.gz (any distribution)
```
gulp targz-linux-64
gulp targz-linux-32
```
Note that unpacking the tarball is not sufficient to be able to use the application, you then need to run once the application from the command line, with argument `install` in order to setup the manifest files required by Firefox, Chrome or Chromium. If the targz has been installed under the home directory, the manifests are installed only for the user. Otherwise the installation is system wide and it requires executing the install command as superuser, for instance `sudo /opt/net.downloadhelper.coapp/bin/net.downloadhelper.coapp-linux-64 install`

For Windows, it requires having *wine* installed and [InnoSetup](http://www.jrsoftware.org/isdl.php) (installed with *wine*):
```
gulp iss-win
```

Windows converter executables and libraries and application executables are automatically signed assuming the file `config.json` contains an entry `win.certificate` pointing to a certicate JSON containing fields `certificateFile` (the code signing certificate in p12 format) and `certificatePass` (the password to access this certificate). 

For instance, `config.json`:
```
{
	"win": {
		...
		"certificate": "private/certificate.json"
	}
}
```

and `private/certificate.json`:
```
{
	"certificateFile": "mycertificate.p12",
	"certificatePass": "mysecret"
}
```

Mac installer files (*pkg*, *dmg*) are to be generated from a Mac.
```
gulp pkg-mac
gulp dmg-mac
```

Mac installers are automatically signed is the file `config.json` contains an entry `mac.sign` containing the name of a valid code signing certificate (from the OS X KeyChain application) and `mac.signApp` equals to `true`.

For instance, `config.json`:
```
{
	"mac": {
		...
		"sign": "ACLAP",
		"signApp": true
	}
}
```

Installers are generated under directory `./builds`.

Tools
---

During development, it is useful to be able to use the built applications without having to create installers. You can setup the manifest files (so the browsers can launch the application) to use directly the executables from the repository directory `./bin`:
```
gulp setup-local
```
and remove the manifests (to check how the add-on behaves without the application installed):
```
gulp unsetup-local
```

This code is under GPL license. This means if for distributing binaries, the full source code must be made available, including the converter and libraries, even if this source code is not part of this repository (scripts obtain the source code from the original respective repositories). To generate a tarball containing the source code (stripped from git files):
```
gulp build-source-tarball
```


