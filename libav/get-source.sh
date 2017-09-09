#!/bin/bash
# Copyright (C) 2016 Michel Gutierrez
# This file is license under GPL 2.0

BASEDIR=$(dirname "$0")
SRCDIR="$BASEDIR/src"

#LIBAV_VER="v11.6"
#LAME_VER="RELEASE__3_99_5"
#OGG_VER="v1.3.2"
#VORBIS_VER="HEAD@{2016-04-20 00:00:00}"
#OPUS_VER="v1.1.2"
#VPX_VER="v1.4.0"
#X264_VER="stable"
#XVID_VER="release-1_3_3"
#OCAMR_VER="v0.1.3"
#VOAACENC_VER="v0.1.3"
#VOAMRWBENC_VER="v0.1.3"
#SDL_VER="release-1.2.15"
#WEBP_VER="v5.0.0"
#ZLIB_VER="v1.2.8"
#JPEG_VER="version.1.5.2"
#X265_VER="1.9"
#SCHRO_VER="schroedinger-1.0.11"
#ORC_VER="upstream/0.4.27"
#THEORA_VER="HEAD@{2015-10-12 00:00:00}"
#RTMP_VER="HEAD@{2016-04-20 00:00:00}"
#SSL_VER="OpenSSL_1_0_2g"

LIBAV_VER="v12.1"
LAME_VER="RELEASE__3_99_5"
OGG_VER="v1.3.2"
VORBIS_VER="HEAD@{2017-09-6 00:00:00}"
OPUS_VER="v1.2.1"
VPX_VER="v1.6.1"
X264_VER="HEAD@{2017-09-6 00:00:00}"
XVID_VER="release-1_3_3"
OCAMR_VER="v0.1.5"
VOAACENC_VER="v0.1.3"
VOAMRWBENC_VER="v0.1.3"
SDL_VER="release-1.2.15"
WEBP_VER="v0.6.0"
ZLIB_VER="v1.2.9"
JPEG_VER="version.1.5.2"
X265_VER="2.5"
SCHRO_VER="schroedinger-1.0.11"
ORC_VER="upstream/0.4.27"
THEORA_VER="HEAD@{2017-09-6 00:00:00}"
RTMP_VER="HEAD@{2017-09-6 00:00:00}"
SSL_VER="OpenSSL_1_0.2l"

LIBS="libav lame ogg vorbis opus vpx x264 xvid ocamr voaacenc voamrwbenc sdl webp zlib jpeg x265 schro orc theora ssl rtmp"

rm -rf $SRCDIR
mkdir -p $SRCDIR

(cd $SRCDIR; git clone git://git.libav.org/libav.git; cd libav; git checkout "$LIBAV_VER")
(cd $SRCDIR; git clone https://github.com/rbrito/lame.git; cd lame; git checkout "$LAME_VER")
(cd $SRCDIR; git clone git://git.xiph.org/ogg.git; cd ogg; git checkout "$OGG_VER")
(cd $SRCDIR; git clone git://git.xiph.org/vorbis.git; cd vorbis; git checkout "$VORBIS_VER")
(cd $SRCDIR; git clone git://git.xiph.org/opus.git; cd opus; git checkout "$OPUS_VER")
(cd $SRCDIR; git clone https://chromium.googlesource.com/webm/libvpx vpx; cd vpx; git checkout "$VPX_VER")
(cd $SRCDIR; git clone http://git.videolan.org/git/x264.git; cd x264; git checkout "$X264_VER")
(cd $SRCDIR; git clone https://github.com/Distrotech/xvidcore.git xvid; cd xvid; git checkout "$XVID_VER")
(cd $SRCDIR; git clone git://git.code.sf.net/p/opencore-amr/code ocamr; cd ocamr; git checkout "$OCAMR_VER")
(cd $SRCDIR; git clone git://git.code.sf.net/p/opencore-amr/vo-aacenc voaacenc; cd voaacenc; git checkout "$VOAACENC_VER")
(cd $SRCDIR; git clone git://git.code.sf.net/p/opencore-amr/vo-amrwbenc voamrwbenc; cd voamrwbenc; git checkout "$VOAMRWBENC_VER")
(cd $SRCDIR; git clone https://github.com/spurious/SDL-mirror.git sdl; cd sdl; git checkout "$SDL_VER")
(cd $SRCDIR; git clone https://github.com/webmproject/libwebp.git webp; cd webp; git checkout "$WEBP_VER")
(cd $SRCDIR; git clone https://github.com/madler/zlib.git; cd zlib; git checkout "$ZLIB_VER")
(cd $SRCDIR; git clone https://github.com/uclouvain/openjpeg.git jpeg; cd jpeg; git checkout "$JPEG_VER")
(cd $SRCDIR; git clone https://github.com/videolan/x265.git x265; cd x265; git checkout "$X265_VER")
(cd $SRCDIR; git clone git@github.com:Distrotech/schroedinger.git schro; cd schro; git checkout "$SCHRO_VER")
(cd $SRCDIR; git clone git://anonscm.debian.org/pkg-gstreamer/orc.git orc; cd orc; git checkout "$ORC_VER")
(cd $SRCDIR; git clone https://github.com/Distrotech/libtheora.git theora; cd theora; git checkout "$THEORA_VER")
(cd $SRCDIR; git clone git@github.com:openssl/openssl.git ssl; cd ssl; git checkout "$SSL_VER")
(cd $SRCDIR; git clone git://git.ffmpeg.org/rtmpdump rtmp; cd rtmp; git checkout "$RTMP_VER")

for lib in $LIBS; do
    if [ ! -e "src/$lib" ]; then
        echo "$lib has not been downloaded"
    else
        echo "$lib has been downloaded"
    fi
done
