#!/bin/sh
BASE_DIR=`pwd`
. ./builder/functions.lib

echo "" > $BASE_DIR"/log"

echo "Start clients build..."
build_client $BASE_DIR
build_chat $BASE_DIR
build_streaming $BASE_DIR
build_player $BASE_DIR
echo "Build clients complete"
echo ""
    
echo "Creating archive of the build"
cd $BASE_DIR
rm -rf output
mkdir output
cp client/src/examples output -R
cp client/src/Flashphoner.js output
mkdir output/dependencies
cp client/src/dependencies/jquery output/dependencies -R
cp client/src/dependencies/js output/dependencies -R
cp client/src/dependencies/swf output/dependencies -R
cp client/src/dependencies/ie8 output/dependencies -R
cp client/src/dependencies/ie9 output/dependencies -R
cp client/src/dependencies/bootstrap output/dependencies -R
cp client/src/dependencies/player/player.swf output/dependencies/swf
mkdir output/dependencies/flash
cp client/src/dependencies/flash/asdoc output/dependencies/flash -R
cp client/src/dependencies/flash/MediaManager.swf output/dependencies/flash
echo "FINISH"
