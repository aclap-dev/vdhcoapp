#!/bin/bash
# Copyright (C) 2016 Michel Gutierrez
# This file is license under GPL 2.0

BASEDIR=$(dirname "$0")
SRCDIR="$BASEDIR/src"

FFMPEG_VER="n4.0"
LAME_VER="RELEASE__3_99_5"
OGG_VER="v1.3.3"
VORBIS_VER="8ef0f8058854b2ef55d2d42bbe84487a9aadae12" 
OPUS_VER="v1.2.1"
VPX_VER="v1.7.0"
X264_VER="stable"
XVID_VER="release-1_3_3"
OCAMR_VER="v0.1.5"
VOAMRWBENC_VER="v0.1.3"
SDL_VER="release-2.0.8"
WEBP_VER="v0.6.0"
ZLIB_VER="v1.2.9"
JPEG_VER="version.2.1"
X265_VER="3.3"
ORC_VER="upstream/0.4.27"
THEORA_VER="distrotech-libtheora-git"
BZIP2_VER="master"
NUMA_VER="v2.0.11"
AOM_VER="v1.0.0-errata1"

LIBS="ffmpeg lame ogg vorbis opus vpx x264 xvid ocamr voamrwbenc sdl2 webp zlib jpeg x265 orc theora bzip2 numa aom"

rm -rf $SRCDIR
mkdir -p $SRCDIR

(cd $SRCDIR; git clone git://source.ffmpeg.org/ffmpeg.git; cd ffmpeg; git checkout "$FFMPEG_VER"; git cherry-pick fe84f70819d6f5aab3c4823290e0d32b99d6de78)
(cd $SRCDIR; git clone https://github.com/rbrito/lame.git; cd lame; git checkout "$LAME_VER")
(cd $SRCDIR; git clone git://git.xiph.org/ogg.git; cd ogg; git checkout "$OGG_VER")
(cd $SRCDIR; git clone git://git.xiph.org/vorbis.git; cd vorbis; git checkout "$VORBIS_VER")
(cd $SRCDIR; git clone git://git.xiph.org/opus.git; cd opus; git checkout "$OPUS_VER")
(cd $SRCDIR; git clone https://chromium.googlesource.com/webm/libvpx vpx; cd vpx; git checkout "$VPX_VER")
(cd $SRCDIR; git clone https://code.videolan.org/videolan/x264.git; cd x264; git checkout "$X264_VER")
(cd $SRCDIR; git clone https://github.com/Distrotech/xvidcore.git xvid; cd xvid; git checkout "$XVID_VER")
(cd $SRCDIR; git clone git://git.code.sf.net/p/opencore-amr/code ocamr; cd ocamr; git checkout "$OCAMR_VER")
(cd $SRCDIR; git clone git://git.code.sf.net/p/opencore-amr/vo-amrwbenc voamrwbenc; cd voamrwbenc; git checkout "$VOAMRWBENC_VER")
(cd $SRCDIR; git clone https://github.com/spurious/SDL-mirror.git sdl2; cd sdl2; git checkout "$SDL_VER")
(cd $SRCDIR; git clone https://github.com/webmproject/libwebp.git webp; cd webp; git checkout "$WEBP_VER")
(cd $SRCDIR; git clone https://github.com/madler/zlib.git; cd zlib; git checkout "$ZLIB_VER")
(cd $SRCDIR; git clone https://github.com/uclouvain/openjpeg.git jpeg; cd jpeg; git checkout "$JPEG_VER")
(cd $SRCDIR; git clone https://github.com/videolan/x265.git x265; cd x265; git checkout "$X265_VER")
(cd $SRCDIR; git clone git://anonscm.debian.org/pkg-gstreamer/orc.git orc; cd orc; git checkout "$ORC_VER")
(cd $SRCDIR; git clone https://github.com/Distrotech/libtheora.git theora; cd theora; git checkout "$THEORA_VER")
(cd $SRCDIR; git clone https://github.com/enthought/bzip2-1.0.6.git bzip2; cd bzip2; git checkout "$BZIP2_VER")
(cd $SRCDIR; git clone https://github.com/numactl/numactl.git numa; cd numa; git checkout "$NUMA_VER")
(cd $SRCDIR; git clone https://aomedia.googlesource.com/aom aom; cd aom; git checkout "$AOM_VER")

for lib in $LIBS; do
    if [ ! -e "src/$lib" ]; then
        echo "$lib has not been downloaded"
    else
        echo "$lib has been downloaded"
    fi
done
