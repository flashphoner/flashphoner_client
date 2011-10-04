#!/bin/sh
. ./functions.lib

cd $CURRENT_DIR

echo "" > log
check_root_access
detect_java
detect_ant

echo "Start clients build..."
build_client "$CURRENT_DIR/../"
echo "Build clients complete"
echo ""
echo "Start server build..."
cd "$CURRENT_DIR/../$BUILD_XML_DIR"
BUILD_RESPONSE=$(ant 2>&1 |tee -a $CURRENT_DIR"/log" | grep -i FAILED)
if [ -n "$BUILD_RESPONSE" ]; then
    echo "Error. Build was not created"
else
    echo "Build server complete"
    echo ""
    
    cd "$CURRENT_DIR/../release"

    FOLDER_NAME=$(ls)
        
    echo "Creating archive of the build"
    tar -cvf $FOLDER_NAME.tar.gz $FOLDER_NAME >& /dev/null

    echo "FINISH"
fi
