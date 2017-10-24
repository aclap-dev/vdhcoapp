
Vdhcoapp is to be built in two parts:

Part 1: the converter (ffmpeg)
---

Running the commands below on Linux (tested on Ubuntu 16.04) generates Windows and Linux executable files.
When run on Mac (tested on Mac OS X 10.11.6), it creates Mac executable files.

```
cd converter
./get-source.sh
./build-apps.sh
```


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

*Create installer files:*

For linux:
```
gulp deb-linux-64
gulp targz-linux-64
gulp deb-linux-32
gulp targz-linux-32
```

For Windows, it requires having *wine* installed and [InnoSetup](http://www.jrsoftware.org/isdl.php) (installed with *wine*):
```
gulp iss-win
```

Mac installer files (*pkg*, *dmg*) are to be generated from a Mac.
```
gulp pkg-mac
gulp dmg-mac
```

