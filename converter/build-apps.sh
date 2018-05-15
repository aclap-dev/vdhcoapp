#!/bin/bash
# Copyright (C) 2016 Michel Gutierrez
# This file is license under GPL 2.0

HOST_PLATFORM=$(uname)
BASEDIR=$(cd "$(dirname "$0")"; pwd)
BUILDDIR="$BASEDIR/build"
SRCDIR="$BASEDIR/src-build"
SRCCLEANDIR="$BASEDIR/src"
case $HOST_PLATFORM in
	Darwin) LIBTOOLIZE=glibtoolize ;;
	Linux) LIBTOOLIZE=libtoolize ;;
	*) echo "$HOST_PLATFORM not supported as a build platform"
esac	

build_lame() {
	(
	echo "Building lame"
	cd $ARCHSRCDIR/lame
	OLD_CFLAGS="$CFLAGS"
	case $PLATFORM in
	win)
		if [ "$ARCH" == "i686" ]; then
		    export CFLAGS="$OLD_CFLAGS -msse"
		fi
		./configure --prefix=$ARCHSRCDIR/deps --host=$HOST --target=mingw32 || exit -1
	;;
	linux)
		case $ARCH in
		i686) sed -i -e '/xmmintrin\.h/d' configure ;;
		esac
		./configure --prefix=$ARCHSRCDIR/deps --host=$HOST || exit -1
	;;
	mac)
		./configure --prefix=$ARCHSRCDIR/deps --host=$HOST || exit -1	
	;;
	esac
	
	CFLAGS="$OLD_CFLAGS"
	make || exit -1
	make install || exit -1
	)
}

build_ogg() {
	(
	echo "Building ogg"
	cd $ARCHSRCDIR/ogg
	./autogen.sh
	case $PLATFORM in
	win)
		./configure --prefix=$ARCHSRCDIR/deps --host=$HOST --target=mingw32 || exit -1
		;;
	*)
		./configure --prefix=$ARCHSRCDIR/deps --host=$HOST || exit -1
		;;
	esac
	make || exit -1
	make install || exit -1
	)
}

build_vorbis() {
	(
	echo "Building vorbis"
	echo "HOST=$HOST"
	cd $ARCHSRCDIR/vorbis
	./autogen.sh || exit -1
	export OLD_CFLAGS="$CFLAGS"
	export CFLAGS="$OLD_CFLAGS -I$ARCHSRCDIR/deps/include"
	case $PLATFORM in
	win)
		./configure --prefix=$ARCHSRCDIR/deps --host=$HOST --target=mingw32 || exit -1
		;;
	*)
		./configure --prefix=$ARCHSRCDIR/deps --host=$HOST || exit -1
		;;
	esac
	export CFLAGS="$OLD_CFLAGS"
	make || exit -1
	make install || exit -1
	)
}

build_opus() {
	(
	echo "Building opus"
	cd $ARCHSRCDIR/opus
	./autogen.sh || exit -1
	case $PLATFORM in
	win)
		./configure --prefix=$ARCHSRCDIR/deps --host=$HOST --target=mingw32 || exit -1
		;;
	*)
		./configure --prefix=$ARCHSRCDIR/deps --host=$HOST || exit -1
		;;
	esac
	make || exit -1
	make install-am || exit -1
	)
}

build_vpx() {
	(
	echo "Building vpx"
	cd $ARCHSRCDIR/vpx
	case $PLATFORM in
	win)
		OPTS="--target=x86_64-win64-gcc"
		if [ "$ARCH" == "i686" ]; then
			OPTS="--target=x86-win32-gcc"
		fi
	;;
	linux)
		OPTS="--target=x86_64-linux-gcc"
		if [ "$ARCH" == "i686" ]; then
			OPTS="--target=x86-linux-gcc"
		fi
		OPTS="$OPTS --enable-pic"
		;;
	mac)
		OPTS="--target=x86_64-darwin14-gcc"
		;;
	esac

	./configure --prefix=$ARCHSRCDIR/deps $OPTS \
        --disable-examples \
        --disable-tools \
        --disable-docs \
        --disable-install-bins \
        --disable-install-srcs \
		--disable-unit-tests \
        --size-limit=16384x16384 \
        --enable-postproc \
        --enable-multi-res-encoding \
        --enable-temporal-denoising \
        --enable-vp9-temporal-denoising \
        --enable-vp9-postproc || exit -1
	OPTS=
	make || exit -1
	make install || exit -1
	)
}

build_x264() {
	(
	echo "Building x264"
	cd $ARCHSRCDIR/x264
	case $PLATFORM in
	win)
		./configure --host=$ARCH-w64-mingw32 --cross-prefix=$ARCH-w64-mingw32- \
    		--prefix=$ARCHSRCDIR/deps --enable-shared --sysroot=/usr/$ARCH-w64-mingw32/ --disable-asm || exit -1
		;;
	*)
		./configure \
    		--prefix=$ARCHSRCDIR/deps --host=$HOST --enable-shared --disable-asm --disable-cli || exit -1
		;;
	esac
	make || exit -1
	make install install-lib-dev install-lib-shared install-lib-static || exit -1
	)
}

build_xvid() {
	(
	echo "Building xvid"
	cd $ARCHSRCDIR/xvid/build/generic
	./bootstrap.sh
	case $PLATFORM in
	win)
		./configure --host=$ARCH-w64-mingw32 --target=mingw32 --prefix=$ARCHSRCDIR/deps --disable-assembly || exit -1
		;;
	*)
		./configure --host=$HOST --prefix=$ARCHSRCDIR/deps --disable-assembly || exit -1
		;;
	esac	
	make || exit -1
	make install || exit -1
	)
}

build_ocamr() {
	(
	echo "Building ocamr (Opencore AMR)"
	cd $ARCHSRCDIR/ocamr
	"$LIBTOOLIZE"
	aclocal
	autoheader
	automake --force-missing --add-missing
	autoconf
	case $PLATFORM in
	win)
		./configure --host=$ARCH-w64-mingw32 --target=mingw32 --prefix=$ARCHSRCDIR/deps || exit -1
		;;
	*)
		./configure --host=$HOST --prefix=$ARCHSRCDIR/deps || exit -1
		;;
	esac
	make || exit -1
	make install || exit -1
	)
}

build_voamrwbenc() {
	(
	echo "Building voamrwbenc (Opencore Visual On AMR WB encoder)"
	cd $ARCHSRCDIR/voamrwbenc
	"$LIBTOOLIZE"
	aclocal
	autoheader
	automake --force-missing --add-missing
	autoconf
	case $PLATFORM in
	win)
		./configure --host=$ARCH-w64-mingw32 --target=mingw32 --prefix=$ARCHSRCDIR/deps || exit -1
		;;
	*)
		./configure --host=$HOST --prefix=$ARCHSRCDIR/deps || exit -1
		;;
	esac
	make || exit -1
	make install || exit -1
	)
}

# sdl used with ffmpeg < 3
build_sdl() {
	(
	echo "Building sdl"
	cd $ARCHSRCDIR/sdl
	rm -r autom4te.cache configure config.h config.h.i config.status config.mak Makefile libtool ltmain.sh
	./autogen.sh || exit -1
	case $PLATFORM in
	win)
		./configure --host=$ARCH-w64-mingw32 --target=mingw32 --prefix=$ARCHSRCDIR/deps || exit -1
		;;
	linux)
		./configure --host=$HOST --prefix=$ARCHSRCDIR/deps \
			--enable-video-x11=no \
			--enable-x11-shared=yes \
			|| exit -1
		;;
	mac)
		sed -i -e '/CGDirectPaletteRef/d' src/video/quartz/SDL_QuartzVideo.h
		./configure --host=$HOST --prefix=$ARCHSRCDIR/deps \
			--enable-video-x11=no \
			|| exit -1
		;;
	esac		
	make || exit -1
	make install || exit -1
	)
}

# sdl2 used with ffmpeg >= 3
build_sdl2() {
	(
	echo "Building sdl2"
	cd $ARCHSRCDIR/sdl2
	rm -r autom4te.cache configure config.h config.h.i config.status config.mak Makefile libtool ltmain.sh
	./autogen.sh || exit -1
	case $PLATFORM in
	win)
		./configure --host=$ARCH-w64-mingw32 --target=mingw32 --prefix=$ARCHSRCDIR/deps --enable-assertions=release || exit -1
		;;
	linux)
		./configure --host=$HOST --prefix=$ARCHSRCDIR/deps \
			--disable-rpath --enable-sdl-dlopen --disable-loadso \
			--disable-nas --disable-esd --disable-arts \
			--disable-alsa-shared --disable-pulseaudio-shared \
			--enable-ibus \
			--disable-video-directfb \
			--enable-video-opengles \
			--enable-video-wayland --disable-wayland-shared \
			--enable-video-x11=no \
			|| exit -1
		;;
	mac)
		sed -i -e '/CGDirectPaletteRef/d' src/video/quartz/SDL_QuartzVideo.h
		./configure --host=$HOST --prefix=$ARCHSRCDIR/deps \
			--enable-video-x11=no \
			|| exit -1
		;;
	esac		
	make || exit -1
	make install || exit -1
	)
}

build_webp() {
	(
	echo "Building webp"
	cd $ARCHSRCDIR/webp
	"$LIBTOOLIZE"
	aclocal
	autoheader
	automake --force-missing --add-missing
	autoconf
	case $PLATFORM in
	win)
		./configure --host=$ARCH-w64-mingw32 --target=mingw32 --prefix=$ARCHSRCDIR/deps \
		    --enable-libwebpmux --enable-libwebpdemux  --enable-libwebpdecoder|| exit -1
		;;
	*)
		./configure --host=$HOST --prefix=$ARCHSRCDIR/deps \
		    --enable-libwebpmux --enable-libwebpdemux  --enable-libwebpdecoder|| exit -1
		;;
	esac
	make || exit -1
	make install || exit -1
	)
}

build_zlib() {
	(
	echo "Building zlib"
	cd $ARCHSRCDIR/zlib
	case $PLATFORM in
	win)
	    sed -i "s/PREFIX =/PREFIX = $ARCH-w64-mingw32-/" win32/Makefile.gcc
    	make \
			INCLUDE_PATH="/include" \
			LIBRARY_PATH="/lib" \
			BINARY_PATH="/bin" \
			DESTDIR="$ARCHSRCDIR/deps" install \
			-f win32/Makefile.gcc SHARED_MODE=1 || exit -1
		;;
	*)
		./configure --prefix=$ARCHSRCDIR/deps || exit -1
    	make \
			INCLUDE_PATH="/include" \
			LIBRARY_PATH="/lib" \
			BINARY_PATH="/bin" \
			install \
				SHARED_MODE=1 || exit -1
		;;
	esac
	)
}

build_jpeg() {
	(
	echo "Building jpeg"
	cd $ARCHSRCDIR/jpeg
	JPEG_SHARED_LIBS=ON
	case $PLATFORM in
	win) 
		SYSTEM_NAME=Windows 
		JPEG_SHARED_LIBS=OFF
		;;
	linux) SYSTEM_NAME=Linux ;;
	mac) SYSTEM_NAME=Darwin ;;
	esac	
	cmake -DCMAKE_SYSTEM_NAME="$SYSTEM_NAME" -DBUILD_THIRDPARTY=1 \
		-DCMAKE_INSTALL_PREFIX="$ARCHSRCDIR/deps" \
		-DBUILD_SHARED_LIBS=$JPEG_SHARED_LIBS \
		-DBUILD_PKGCONFIG_FILES=ON \
		-DOPENJPEG_INSTALL_INCLUDE_DIR="$ARCHSRCDIR/deps/include" \
		-DOPENJPEG_INSTALL_LIB_DIR="$ARCHSRCDIR/deps/lib" \
		-DOPENJPEG_INSTALL_DOC_DIR="$ARCHSRCDIR/deps/doc" \
		-DOPENJPEG_INSTALL_BIN_DIR="$ARCHSRCDIR/deps/bin" \
		-DOPENJPEG_INSTALL_DATA_DIR="$ARCHSRCDIR/deps/data" \
		-DOPENJPEG_INSTALL_SHARE_DIR="$ARCHSRCDIR/deps/share" \
		-DOPENJPEG_INSTALL_PACKAGE_DIR="$ARCHSRCDIR/deps/lib/pkgconfig" \
		. || exit -1
    make install
	SYSTEM_NAME=
	JPEG_SHARED_LIBS=
	)
}

build_x265() {
	(
	echo "Building x265"
	cd $ARCHSRCDIR/x265
	case $PLATFORM in
	win)
		cmake \
			-DWINXP_SUPPORT=1 \
			-DCMAKE_INSTALL_PREFIX="$ARCHSRCDIR/deps" \
			-DCMAKE_SYSTEM_NAME="Windows" \
			-DCMAKE_C_COMPILER="$ARCH-w64-mingw32-gcc" \
			-DCMAKE_CXX_COMPILER="$ARCH-w64-mingw32-g++" \
			-DCMAKE_RC_COMPILER="$ARCH-w64-mingw32-windres" \
			-DCMAKE_RANLIB="$ARCH-w64-mingw32-ranlib" \
			-DCMAKE_ASM_YASM_COMPILER="yasm" \
			source
		make x265-shared
		cp libx265.dll.a "$ARCHSRCDIR/deps/lib"
		cp libx265.dll "$ARCHSRCDIR/deps/bin"
		cp source/x265.h "$ARCHSRCDIR/deps/include"
		cp x265_config.h "$ARCHSRCDIR/deps/include"
		cp x265.pc "$ARCHSRCDIR/deps/lib/pkgconfig"
		;;
	*)
		case $PLATFORM in
			linux) SYSTEM_NAME="Linux"; LIBEXT="so" ;;
			mac) SYSTEM_NAME="Darwin"; LIBEXT="dylib" ;;
		esac
		cmake \
			-DWINXP_SUPPORT=1 \
			-DCMAKE_INSTALL_PREFIX="$ARCHSRCDIR/deps" \
			-DCMAKE_SYSTEM_NAME="$SYSTEM_NAME" \
			-DCMAKE_C_COMPILER="gcc" \
			-DCMAKE_CXX_COMPILER="g++" \
			-DCMAKE_RANLIB="ranlib" \
			-DCMAKE_ASM_YASM_COMPILER="yasm" \
			source
		make x265-shared
		cp libx265*.$LIBEXT "$ARCHSRCDIR/deps/lib"
		cp source/x265.h "$ARCHSRCDIR/deps/include"
		cp x265_config.h "$ARCHSRCDIR/deps/include"
		cp x265.pc "$ARCHSRCDIR/deps/lib/pkgconfig"
		SYSTEM_NAME=
		LIBEXT=
		;;
	esac
	)
}

build_orc() {
	(
	echo "Building orc"
	cd $ARCHSRCDIR/orc
	OLD_CFLAGS="$CFLAGS"
	./autogen.sh
	case $PLATFORM in
	win)
		if [ "$ARCH" == "i686" ]; then
			export LDFLAGS="-L$GCC_LIBDIR -L/usr/$ARCH-w64-mingw32/lib -L$ARCHSRCDIR/deps/lib"
			export CFLAGS="$OLD_CFLAGS -I$ARCHSRCDIR/deps/include/orc-0.4"
		fi
		./configure --host=$ARCH-w64-mingw32 --prefix=$ARCHSRCDIR/deps \
		--enable-shared --enable-static \
		|| exit -1
		;;
	*)
		./configure --host=$HOST --prefix=$ARCHSRCDIR/deps \
		--enable-shared --enable-static \
		|| exit -1
		;;
	esac
	make || exit -1
	make install
    export LDFLAGS=
	CFLAGS="$OLD_CFLAGS"
	)
}

build_theora() {
	(
	echo "Building theora"
	cd $ARCHSRCDIR/theora
	"$LIBTOOLIZE"
	aclocal
	autoheader
	automake --force-missing --add-missing
	autoconf
	case $PLATFORM in
	win)
		./configure --host=$ARCH-w64-mingw32 --prefix=$ARCHSRCDIR/deps \
			--disable-examples --without-vorbis --disable-oggtest \
		|| exit -1
		sed -i -e 's#\r##g' win32/xmingw32/libtheoradec-all.def
		sed -i -e 's#\r##g' win32/xmingw32/libtheoraenc-all.def
		;;
	*)
		./configure --host=$HOST --prefix=$ARCHSRCDIR/deps \
			--disable-examples --without-vorbis --disable-oggtest \
		|| exit -1
		;;
	esac
	make || exit -1
	make install || exit -1
	)
}

build_bzip2() {
	(
	echo "Building bzip2"
	cd $ARCHSRCDIR/bzip2
	case $PLATFORM in
	linux)
		make -f Makefile-libbz2_so || exit -1
		cp libbz2.so.1.0.6 "$ARCHSRCDIR/deps/lib"
		cp -d libbz2.so.1.0 "$ARCHSRCDIR/deps/lib"
		;;
	*)
		;;
	esac
	)
}

build_numa() {
	(
	echo "Building numa"
	cd $ARCHSRCDIR/numa
	case $PLATFORM in
	linux)
		./autogen.sh
		OLD_CC="$CC"
		CC="$CC $CFLAGS"
		./configure --prefix=$ARCHSRCDIR/deps --host=$HOST || exit -1
		make || exit -1
		make install || exit -1
		CC="$OLD_CC"
		;;
	*)
		;;
	esac
	)
}

build_ffmpeg() {
	(
	echo "Building ffmpeg"
	cd $ARCHSRCDIR/ffmpeg
	OLD_LDFLAGS="$LDFLAGS"
	case $PLATFORM in
	win)
		./configure \
			--cross-prefix=$ARCH-w64-mingw32- \
			--sysroot=/usr/$ARCH-w64-mingw32/ \
			--extra-ldflags=-static-libgcc \
			--target-os=mingw32 \
			--arch=$ARCH \
			--prefix=$BUILDARCHDIR \
			--extra-version="vdhcoapp" \
			--extra-cflags="-I$ARCHSRCDIR/deps/include" \
			--extra-ldflags="-static-libgcc -L$ARCHSRCDIR/deps/lib -L$ARCHSRCDIR/zlib" \
			--pkg-config=$PKG_CONFIG \
			--enable-shared \
			--enable-gpl \
			--enable-pthreads \
			--disable-w32threads \
			--enable-libmp3lame \
			--enable-libopenjpeg \
			--enable-libopus \
			--enable-libtheora \
			--enable-libvorbis \
			--enable-libvpx \
			--enable-libwebp \
			--enable-libx265 \
			--enable-libxvid \
			--enable-libx264 \
			--enable-avresample \
			--disable-doc \
			|| exit -1
		;;
	linux)
		case $ARCH in 
		x86_64)
			DEVLIB="-L/usr/lib/x86_64-linux-gnu"
			;;
		i686)
			DEVLIB="-L/usr/lib/i386-linux-gnu"
			;;
		esac
		read -d '' CONFIGURE_OPTS << EOF
			--arch=$ARCH 
			--prefix=$BUILDARCHDIR 
			--extra-version="vdhcoapp" 
			--extra-cflags="-I$ARCHSRCDIR/deps/include" 
			--pkg-config=$PKG_CONFIG 
			--pkgconfigdir=$PKG_CONFIG_PATH 
			--extra-libs="-ldl" 
			--enable-shared 
			--enable-gpl 
			--enable-libmp3lame 
			--enable-libopenjpeg 
			--enable-libopus 
			--enable-libtheora 
			--enable-libvorbis 
			--enable-libvpx 
			--enable-libwebp 
			--enable-libx265 
			--enable-libxvid 
			--enable-libx264 
			--enable-avresample 
			--disable-indev=sndio --disable-outdev=sndio 
			--disable-doc 
EOF
		./configure $CONFIGURE_OPTS \
			--disable-ffplay \
			--extra-ldflags="-L$ARCHSRCDIR/deps/lib -L$ARCHSRCDIR/zlib" \
			|| exit -1
		make || exit -1
		make install || exit -1
		./configure $CONFIGURE_OPTS \
			--disable-ffmpeg --disable-ffprobe \
			--extra-ldflags="-L$ARCHSRCDIR/deps/lib -L$ARCHSRCDIR/zlib $DEVLIB" \
			|| exit -1
		DEVLIB=
		;;
	mac)
		./configure \
			--arch=$ARCH \
			--enable-runtime-cpudetect \
			--enable-gpl \
			--extra-version="vdhcoapp" \
			--enable-shared \
			--enable-pthreads \
			--prefix=$BUILDARCHDIR \
			--enable-version3 \
			--extra-cflags="-I$ARCHSRCDIR/deps/include" \
			--extra-ldflags="-L$ARCHSRCDIR/deps/lib -L$ARCHSRCDIR/zlib" \
			--pkg-config=$PKG_CONFIG \
			--enable-libvo-amrwbenc \
			--enable-libopus \
			--enable-libvorbis \
			--enable-libx264 \
			--enable-libmp3lame \
			--enable-libvpx \
			--enable-libxvid \
			--enable-libopencore_amrnb \
			--enable-libopencore_amrwb \
			--enable-encoder=libvpx-vp9 \
			--enable-libwebp \
			--enable-zlib \
			--enable-libopenjpeg \
			--enable-libx265 \
			--enable-libtheora \
			--disable-doc \
			|| exit -1
		;;
	esac
	make || exit -1
	make install || exit -1
	LDFLAGS="$OLD_LDFLAGS"
	)
}

build_arch() {
	PLATFORM="$1"
	ARCH="$2"
	FINALARCHDIR="$3"
	ARCHSRCDIR="$4"
	BUILDARCHDIR="$ARCHSRCDIR/converter-build"

	echo "Build for $ARCH to $BUILDARCHDIR via $ARCHSRCDIR"

	case $PLATFORM in
	win)
		HOST="$ARCH-w64-mingw32"
		CROSS_COMPILE="/usr/bin/${ARCH}-w64-mingw32-"
		;;
	linux)
		HOST="$ARCH-pc-linux-gnu"
		CROSS_COMPILE=""
		;;
	esac

	export CC="${CROSS_COMPILE}gcc"
	export CXX="${CROSS_COMPILE}g++"
	export NM="${CROSS_COMPILE}nm"
	export STRIP="${CROSS_COMPILE}strip"
	export RANLIB="${CROSS_COMPILE}ranlib"
	export AR="${CROSS_COMPILE}ar"
	export LD="${CROSS_COMPILE}ld"
	export PKG_CONFIG="${CROSS_COMPILE}pkg-config"
	export PKG_CONFIG_PATH=$ARCHSRCDIR/deps/lib/pkgconfig
	export PKG_CONFIG_LIB_DIR=$ARCHSRCDIR/deps/lib/pkgconfig
	export GCC_LIBDIR=$(ls -d /usr/lib/gcc/$ARCH-w64-mingw32/*-posix)

	echo "PLATFORM=\"$1\""
	echo "ARCH=\"$2\""
	echo "FINALARCHDIR=\"$3\""
	echo "ARCHSRCDIR=\"$4\""
	echo "BUILDARCHDIR=$ARCHSRCDIR/converter-build"
	echo "HOST=\"$ARCH-w64-mingw32\""
	echo "CROSS_COMPILE=\"/usr/bin/${ARCH}-w64-mingw32-\""
	echo "export CC=\"${CROSS_COMPILE}gcc\""
	echo "export CXX=\"${CROSS_COMPILE}g++\""
	echo "export NM=\"${CROSS_COMPILE}nm\""
	echo "export STRIP=\"${CROSS_COMPILE}strip\""
	echo "export RANLIB=\"${CROSS_COMPILE}ranlib\""
	echo "export AR=\"${CROSS_COMPILE}ar\""
	echo "export LD=\"${CROSS_COMPILE}ld\""
	echo "export PKG_CONFIG=\"${CROSS_COMPILE}pkg-config\""
	echo "export PKG_CONFIG_PATH=\"$ARCHSRCDIR/deps/lib/pkgconfig\""
	echo "export GCC_LIBDIR=\"$GCC_LIBDIR\""

	build_lame || exit -1
	build_ogg || exit -1
	build_vorbis || exit -1
	build_opus || exit -1
	build_vpx || exit -1
	build_x264 || exit -1
	build_xvid || exit -1
	build_ocamr || exit -1
	build_voamrwbenc || exit -1
	build_webp || exit -1
	build_zlib || exit -1
    build_jpeg || exit -1
    build_x265 || exit -1
    build_orc || exit -1
    build_theora || exit -1
	build_numa || exit -1
	build_bzip2 || exit -1
	case $PLATFORM in
	win|mac)
		build_sdl2 || exit -1
		#build_sdl || exit -1
		;;
	esac
	build_ffmpeg || exit -1

	export CROSS_COMPILE=
	export CC=
	export CXX=
	export NM=
	export STRIP=
	export RANLIB=
	export AR=
	export LD=
	export PKG_CONFIG="${CROSS_COMPILE}pkg-config"
	export PKG_CONFIG_PATH=
	export PKG_CONFIG_LIBDIR=

	case $PLATFORM in

	win)

		cp $BUILDARCHDIR/bin/ffmpeg.exe $BUILDARCHDIR/bin/ffprobe.exe $BUILDARCHDIR/bin/ffplay.exe $BUILDARCHDIR/bin/*.dll $FINALARCHDIR
    	cp /usr/$ARCH-w64-mingw32/lib/libwinpthread-1.dll $FINALARCHDIR
    	cp $GCC_LIBDIR/libstdc++-6.dll $FINALARCHDIR
    	if [ "$ARCH" == "i686" ]; then
	        cp $GCC_LIBDIR/libgcc_s_sjlj-1.dll $FINALARCHDIR
		fi
	    if [ "$ARCH" == "x86_64" ]; then
        	cp $GCC_LIBDIR/libgcc_s_seh-1.dll $FINALARCHDIR
		fi
		cp $(find "$ARCHSRCDIR/deps" -name "*.dll") $FINALARCHDIR
	;;

	mac)
		cp -a $BUILDARCHDIR/bin/ffmpeg $BUILDARCHDIR/bin/ffprobe $BUILDARCHDIR/bin/ffplay \
			$(find $ARCHSRCDIR/deps/lib -regex ".*\\.[0-9]*\\.dylib") \
			$(find $BUILDARCHDIR -regex ".*\\.[0-9]*\\.dylib") \
			$ARCHSRCDIR/zlib/libz.1.dylib \
			$FINALARCHDIR
	;;
	
	linux)
		cp $BUILDARCHDIR/bin/ffmpeg $BUILDARCHDIR/bin/ffprobe $BUILDARCHDIR/bin/ffplay \
			$(find $ARCHSRCDIR/deps/lib -regex ".*\\.so\\.[0-9]+") \
			$(find $BUILDARCHDIR/lib -regex ".*\\.so\\.[0-9]+") \
			$ARCHSRCDIR/deps/lib/libbz2.so.1.0 \
			$FINALARCHDIR
	;;

	esac

	(cd $FINALARCHDIR; strip *)

	export GCC_LIBDIR=
}

build_win() {
	mkdir -p "$SRCDIR/win/32" "$SRCDIR/win/64"
	cp -r $SRCCLEANDIR/* "$SRCDIR/win/64"
	mkdir -p "$SRCDIR/win/64/deps"
	cp -r $SRCCLEANDIR/* "$SRCDIR/win/32"
	mkdir -p "$SRCDIR/win/32/deps"
	mkdir -p "$SRCDIR/win/32/converter-build"

	mkdir -p "$BUILDDIR/win/32" "$BUILDDIR/win/64"

	build_arch win x86_64 $BUILDDIR/win/64 $SRCDIR/win/64 || exit -1
	build_arch win i686 $BUILDDIR/win/32 $SRCDIR/win/32 || exit -1
}

build_linux() {
	mkdir -p "$SRCDIR/linux/32" "$SRCDIR/linux/64"
	cp -r $SRCCLEANDIR/* "$SRCDIR/linux/64"
	mkdir -p "$SRCDIR/linux/64/deps"
	cp -r $SRCCLEANDIR/* "$SRCDIR/linux/32"
	mkdir -p "$SRCDIR/linux/32/deps"
	mkdir -p "$SRCDIR/linux/32/converter-build"
	mkdir -p "$BUILDDIR/linux/32" "$BUILDDIR/linux/64"
	build_arch linux x86_64 $BUILDDIR/linux/64 $SRCDIR/linux/64 || exit -1
	export CFLAGS="-m32"
	export CXXFLAGS="-m32"
	export LDFLAGS="-m32"
	build_arch linux i686 $BUILDDIR/linux/32 $SRCDIR/linux/32 || exit -1
	export CFLAGS=
	export CXXFLAGS=
	export LDFLAGS=
}

build_mac() {
	echo "Building for Mac"
	mkdir -p "$SRCDIR/mac/64"
	cp -r $SRCCLEANDIR/* "$SRCDIR/mac/64"
	mkdir -p "$SRCDIR/mac/64/deps"
	mkdir -p "$BUILDDIR/mac/64"
	build_arch mac x86_64 $BUILDDIR/mac/64 $SRCDIR/mac/64 || exit -1
}

rm -rf $BUILDDIR
rm -rf $SRCDIR

if [[ "$HOST_PLATFORM" = "Darwin" ]]; then
	build_mac || exit -1
else
	build_linux || exit -1
	build_win || exit -1
fi

echo "*** Look's like a success !!! ***"		
