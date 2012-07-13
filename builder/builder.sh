#!/bin/sh
. ./functions.lib

cd $CURRENT_DIR

echo "" > log
# check_root_access
# detect_java
# detect_ant

echo "Start clients build..."
build_client "$CURRENT_DIR/../"
echo "Build clients complete"
echo ""
# echo "Start server build..."
# cd "$CURRENT_DIR/../$BUILD_XML_DIR"
# ant
# 
# echo "Build server complete"
# echo ""
    
cd "$CURRENT_DIR/../release"

FOLDER_NAME=$(ls)
        
echo "Creating archive of the build"
tar -cvf $FOLDER_NAME.tar.gz $FOLDER_NAME >& /dev/null
echo "FINISH"

