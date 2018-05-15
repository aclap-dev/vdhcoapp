# Compiling for Windows and Linux

The converter part of the Video DownloadHelper Companion App is designed to generate Windows and Linux executables from a *Linux Ubuntu 16.04 64 bits* system. 

*Note: you can use a more recent Linux version like Ubuntu 18.04 to build the applications and it will probably work, but the generated binaries for Linux may not work on older systems like Ubuntu 16.04 or Fedora 27 due to an incompatibility with the GLIBC version*

To recompile the converter, you can create a virtual machine running *Ubuntu 16.04 amd64* server version and apply the following commands:

```
sudo apt-get update
sudo apt-get install gcc make perl
```

You can now install the Guest Addition CD and run it, then:

```
sudo apt-get -y install \
	autoconf \
	automake \
	build-essential \
	cmake \
	git \
	libtool \
	pkg-config \
	yasm \
	gcc-mingw-w64-x86-64 \
	gcc-mingw-w64-i686 \
	gcc-multilib \
	lib32stdc++-5-dev \
	g++-mingw-w64-x86-64 \
	mingw-w64-tools \
	g++-mingw-w64-i686 \
	libmirclient-dev \
	libxkbcommon-dev \
	libegl1-mesa-dev \
	libgles2-mesa-dev \
	libsdl2-dev
```

**Important Warning regarding Linux target:** 

Installing the packages above allow to compile the converter for Linux 64 and 32. **However**, the 32 bits `ffplay` binary won't be generated because 32bits SDL2 libraries are missing.

To setup those missing SDL2 components, install the packages as shown below. **However**, when doing so, it will remove the 64 bits SDL2 libraries, causing the 64 bits `ffplay` version to not being created anymore.

Our solution for now is to compile separately for Linux 32 and 64, re-installing the SDL2 depending on the target we compile. If you can suggest a better solution, please let us know.

```
sudo apt-get -y install \
	libmirclient-dev:i386 \
	libxkbcommon-dev:i386 \
	libegl1-mesa-dev:i386 \
	libgles2-mesa-dev:i386 \
	libsdl2-dev:i386
```

You can now clone the `https://github.com/mi-g/vdhcoapp.git` repository, move to `vdhcoapp/converter`, run `./get-sources.sh` to get all the `ffmpeg` and libraries source code, run `./build-apps.sh` to compile them.
