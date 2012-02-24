#!/bin/sh
FULL_PATH=$0
CURRENT_DIR=`dirname $FULL_PATH`
cd $CURRENT_DIR
cd builder
chmod +x builder.sh
/builder.sh