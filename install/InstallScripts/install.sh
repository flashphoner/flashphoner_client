SILENT=$1
#flashphoner_client installer
FLASHPHONER_URL="flashphoner.com"
INSTALLER_DIR=`pwd`
PRODUCT="flashphoner_client"
VERSION=`cat ./flashphoner_client.version`
SHORT_VERSION=`echo "$VERSION" | sed 's/\(.*\.\)\(.*\.\)\(.*\)/\3/'`
echo "SHORT_VERSION:$SHORT_VERSION"
SUPPORT_URL="http://flashphoner.com"
PRODUCT_APP_JAR=tbs-phone-app.jar
DEFAULT_WWW_DIR=/var/www/html

clear

echo "****************************************************"
echo "*                                                   "
echo "*       Installing flashphoner_client v.$VERSION    "

# check user
USERID=`id | sed -e 's/).*//; s/^.*(//;'`
if [ "X$USERID" != "Xroot" ]; then
echo ""
echo "ERROR: You must be logged in as the root user to install the Flashphoner."
echo ""
exit
fi

##################
# Welcome user
##################
echo "*                                                   "
echo "*  (C) Flashphoner.com 2010. All rights reserved.   "
echo "*  To install press ENTER, to abort press CTRL+C.   "
echo "*                                                   "
echo "****************************************************"

if [ "$SILENT" != "-silent" ]; then
    read cont < /dev/tty
fi

####################
# Detecting JDK
####################

echo "****************************************************"
echo "*                                                  *"
echo "*               Preparing the system               *"
echo "*                                                  *"
echo "****************************************************"
echo ""

echo "DETECTING java command..."

JAVA_SYMLINK_BIN=`which java 2>/dev/null`
if ! test -f "$JAVA_SYMLINK_BIN" ; then
    echo ""
    echo "ERROR: The Java command (java) could not be found."
    echo "Search path: $PATH"
    echo "In most cases this problem can be fixed by adding a symbolic "
    echo "link to the Java command in the /usr/bin directory. "
    echo "To do this first execute the command \"which java\" to identify "
    echo "the full path to the Java executable. Next, create a symbolic "
    echo "link to this file with the command"
    echo "\"ln -sf [path-to-java] /usr/bin/java\" where [path-to-java] is "
    echo "the path returned by the \"which\" command."
    echo ""
exit 0
else
echo "- Java command found successfully."
fi
echo ""
  
echo "DETECTING JVM architecture..."
java -version 2> tmp.jdk-version 1> /dev/null
JDK_VERSION=`cat tmp.jdk-version`
rm tmp.jdk-version
JVM_ARCH_DIGIT=`echo $JDK_VERSION | grep 64 | sed 's/\(.*\)\(64\)\(.*\)/\2/'`
if [ "$JVM_ARCH_DIGIT" != "64" ]; then
    JVM_ARCH_DIGIT="32"
fi
echo "- $JVM_ARCH_DIGIT bit architecture detected successfully."
echo ""

echo "DETECTING hardware platform..."
HW_PLATFORM=`uname -m`
HW_PLATFORM_DIGIT=`echo $HW_PLATFORM | sed 's/\(.*\)\(64\)\(.*\)/\2/'`
if [ "$HW_PLATFORM_DIGIT" != "64" ]; then
    HW_PLATFORM_DIGIT="32"
fi
echo "- Hardware platform detected successfully: $HW_PLATFORM_DIGIT bit"
echo ""

if [ "$HW_PLATFORM_DIGIT" != "$JVM_ARCH_DIGIT" ]; then
    echo "Error. JVM architect: $JVM_ARCH_DIGIT is not compatible with hardware architect: $HW_PLATFORM_DIGIT bit($HW_PLATFORM)."
    echo "Please, uninstall current JVM/JDK and download and install latest JDK $HW_PLATFORM from oracle.com."
    echo "Support - support@flashphoner.com, forum - www.flashphoner.com/forums";
    exit 0;
fi

echo "DETECTING JDK home..."
JAVA_SYMLINK=`ls -l $JAVA_SYMLINK_BIN`
JDK_BIN=`echo $JAVA_SYMLINK | sed 's/.*->//'`
JDK_HOME=`echo $JDK_BIN | sed 's|[^/]*/\(.*\)/bin.*|/\1|g'`
if [ ! -f $JDK_HOME/include/jni.h ]; then
    echo "- Can not find jni.h in JDK_HOME/include dir."    
    get_jdk_home () {
	echo "- Please specify JDK_HOME path manually. File JDK_HOME/include/jni.h must exist."
	read in
	if [ ! -z "$in" ]; then
	    if [ ! -f $in/include/jni.h ]; then
		echo "- Can not find jni.h in JDK_HOME/include dir."
		get_jdk_home
	    fi
	    JDK_HOME=$in
	    echo "- JDK home detected successfully: $JDK_HOME"
	else	
	    echo "- Please do not enter a blank JDK home."
	    get_jdk_home
	fi
    }
    get_jdk_home    
else
    echo "- JDK home detected successfully: $JDK_HOME."    
fi
echo ""

echo "DETECTING Wowza home..."

WOWZA_HOME=/usr/local/WowzaStreamingEngine

if [ ! -f $WOWZA_HOME/lib/wms-server.jar ]; then
    echo "- Please specify Wowza home directory"
    get_wowza_home () {
    read in
    if [ ! -z "$in" ];then 
	if [ ! -f $in/lib/wms-server.jar ]; then
	    echo "- Wrong Wowza home path: $in."
	    get_wowza_home
	fi
	WOWZA_HOME=$in
	echo "- Wowza home detected successfully: $WOWZA_HOME."
    else
	echo "- Please do not enter blank Wowza home path."
	get_wowza_home
    fi
    }
    get_wowza_home

else
    echo "- Wowza home detected successfully: $WOWZA_HOME"
fi
echo ""

echo "DETECTING previous flashphoner_server version..."
FLASHPHONER_VERSION_FILE=$WOWZA_HOME/conf/flashphoner.version
if [ -f $FLASHPHONER_VERSION_FILE ]; then
    FLASHPHONER_VERSION_CONTENT=`cat $FLASHPHONER_VERSION_FILE`
    CURRENT_SERVER_VERSION=$(echo | awk -v a="$FLASHPHONER_VERSION_CONTENT" -v b="." 'BEGIN {split(a,c,b); print c[4];}')
    MINIMUM_SERVER_VERSION=960
    if [ $CURRENT_SERVER_VERSION -ge $MINIMUM_SERVER_VERSION ]; then
        echo "- flashphoner_server installed."
	echo ""
    else
	FLASHPHONER_PATCH_VERSION_FILE=$WOWZA_HOME/conf/flashphoner_patch.version
	if [ -f $FLASHPHONER_PATCH_VERSION_FILE ]; then
	    FLASHPHONER_PATCH_VERSION_CONTENT=`cat $FLASHPHONER_PATCH_VERSION_FILE`
	    CURRENT_PATCH_VERSION=$(echo | awk -v a="$FLASHPHONER_PATCH_VERSION_CONTENT" -v b="-p." 'BEGIN {split(a,c,b); print c[2];}')
	    if [ $CURRENT_PATCH_VERSION -ge $MINIMUM_SERVER_VERSION ]; then
    		echo "- flashphoner_server installed."
		echo ""
	    else
    		echo "- flashphoner_server has old version. Please download and install last version."
    		echo""
    		read cont < /dev/tty	
    		exit 0;
	    fi
	else
	    echo "- flashphoner_server has old version. Please download and install last version."
	    echo""
    	    read cont < /dev/tty	
    	    exit 0;
	
	fi
    fi
else
    echo "- flashphoner_server is not installed. Please install last version."
    echo ""
    read cont < /dev/tty	
    exit 0;
fi

if [ "$JVM_ARCH_DIGIT" = "64" ]; then
    SYSTEM_LIB_DIR=lib64
    JVM_ARCH_X=x8664
    else
    SYSTEM_LIB_DIR=lib
    JVM_ARCH_X=x86         
fi

echo ""
echo "************************************************************************************************"
echo "*                                                                                              *"
echo "*                                        Preparing Wowza                                       *"
echo "*                                                                                              *"
echo "************************************************************************************************"
echo ""

echo "CONFIGURING Wowza (Server.xml, Streams.xml)..."

#getting Wowza conf files from jar
cd $WOWZA_HOME/lib/
jar xf wms-server.jar com/wowza/wms/conf/Server.xml
jar xf wms-server.jar com/wowza/wms/conf/Streams.xml

cd $INSTALLER_DIR/server/WowzaMediaServer/bin

SERVER_XML=$WOWZA_HOME/lib/com/wowza/wms/conf/Server.xml
STREAMS_XML=$WOWZA_HOME/lib/com/wowza/wms/conf/Streams.xml


SERVER_LISTENER="$INSTALLER_DIR/server/WowzaMediaServer/conf/ServerListener.xml"
RTMP2VOIP_STREAM="$INSTALLER_DIR/server/WowzaMediaServer/conf/Rtmp2VoipStream.xml"

SERVER_LISTENER_XPATH="/Root/Server/ServerListeners/ServerListener[BaseClass=\"com.flashphoner.phone_app.PhoneServerListener\"]"
SERVER_LISTENERS_XPATH="Root/Server/ServerListeners"

RTMP2VOIP_STREAM_XPATH="/Root/Streams/Stream[Name=\"phone_rtmp_to_voip\"]"
STREAMS_XPATH="/Root/Streams"

java -cp $WOWZA_HOME/bin/tbs-flashphoner-configurator.jar  com.flashphoner.configurator.xpath.XPath removeNode $SERVER_XML null $SERVER_LISTENER_XPATH null
java -cp $WOWZA_HOME/bin/tbs-flashphoner-configurator.jar  com.flashphoner.configurator.xpath.XPath addNodeFromFile $SERVER_XML $SERVER_LISTENER $SERVER_LISTENER_XPATH $SERVER_LISTENERS_XPATH

java -cp $WOWZA_HOME/bin/tbs-flashphoner-configurator.jar  com.flashphoner.configurator.xpath.XPath removeNode $STREAMS_XML null $RTMP2VOIP_STREAM_XPATH null
java -cp $WOWZA_HOME/bin/tbs-flashphoner-configurator.jar  com.flashphoner.configurator.xpath.XPath addNodeFromFile $STREAMS_XML $RTMP2VOIP_STREAM $RTMP2VOIP_STREAM_XPATH $STREAMS_XPATH

#push files to wowza jar
cd $WOWZA_HOME/lib/
jar uf wms-server.jar com/wowza/wms/conf/Server.xml
jar uf wms-server.jar com/wowza/wms/conf/Streams.xml

#delete com directory
rm -rf com
echo "- Wowza configuring completed."
echo ""

INST_LOG=$WOWZA_HOME/bin/$PRODUCT-install.log

if [ -f $INST_LOG ]; then
echo "REMOVING previous $PRODUCT files according $INST_LOG..."
cat $INST_LOG | while read line; do
if [ -f $line ]; then
    rm -f $line
fi
done
echo "- Files removed successfully"
echo ""
fi

echo "COPYING files..."

cd $INSTALLER_DIR/server/WowzaMediaServer

#Components
C1=applications/phone_app
C3=conf/phone_app
C7=lib/$PRODUCT_APP_JAR
C11=$INSTALLER_DIR/uninstall.sh

cp -rf $C1 $WOWZA_HOME/applications
echo "$WOWZA_HOME/$C1" > $INST_LOG

cp -rf $C3 $WOWZA_HOME/conf

cp -f $C7 $WOWZA_HOME/lib
echo "$WOWZA_HOME/$C7" >> $INST_LOG

PRODUCT_UNINSTALLER=$WOWZA_HOME/bin/$PRODUCT-uninstall.sh
cp -f $C11 $PRODUCT_UNINSTALLER
echo "$PRODUCT_UNINSTALLER" >> $INST_LOG
chmod +x $PRODUCT_UNINSTALLER

PRODUCT_VERSION_FILE=$WOWZA_HOME/conf/$PRODUCT.version
echo "$PRODUCT_VERSION_FILE" >> $INST_LOG
echo "$VERSION" > $PRODUCT_VERSION_FILE
echo "- Copying completed."
echo ""

PRODUCT_CONFIG=$WOWZA_HOME/conf/phone_app/flashphoner-client.properties

echo "#Config for client" > $PRODUCT_CONFIG
echo "# get_callee_url            - Url or path to file for get callee for call. Example: $WOWZA_HOME/conf/phone_app/callee.xml" >> $PRODUCT_CONFIG
echo "# auto_login_url            - Url or path to file for authorize by token. Example: $WOWZA_HOME/conf/phone_app/account.xml" >> $PRODUCT_CONFIG
echo "# allow_domains             - Domains that allowed access (They must be separeted by comma)" >> $PRODUCT_CONFIG

echo "" >> $PRODUCT_CONFIG
echo "get_callee_url              =$WOWZA_HOME/conf/phone_app/callee.xml" >> $PRODUCT_CONFIG
echo "auto_login_url              =$WOWZA_HOME/conf/phone_app/account.xml" >> $PRODUCT_CONFIG
echo "allow_domains               =" >> $PRODUCT_CONFIG

echo "- Configuration complete. Your configuration parameters:"
echo ""
cat $PRODUCT_CONFIG
echo ""
echo "- You can edit it here - $WOWZA_HOME/conf/phone_app/flashphoner-client.properties"
echo ""
cd $INSTALLER_DIR
CLIENT_PATH=''
function get_path_client(){
    echo "- Please specify directory to copying flashphoner_client files. You will run flashphoner_client from this folder."
    read in
    if [ ! -z "$in" ]; then
	if [ ! -d "$in" ]; then
		function yes_no(){
			echo "Directory is not exist. Do you want create it? (y/n)"
			read in_y_n
			if [ "$in_y_n" == "y" -o "$in_y_n" == "n" ]; then
				if [ "$in_y_n" == "y" ]; then
					mkdir -p "$in"
        				CLIENT_PATH=$in
        				echo ""
				else
					get_path_client
				fi
			else
				yes_no
			fi			
		}
		yes_no
	else
        	CLIENT_PATH=$in
		echo ""
	fi
    else
        echo "Please do not enter a blank path."
        echo ""
        get_path_client
    fi
}

if [ "$SILENT" != "-silent" ]; then
    get_path_client
else    
    CLIENT_PATH=$DEFAULT_WWW_DIR/$SHORT_VERSION    
fi

if [[ ! "$CLIENT_PATH" = /* ]]
then
    CLIENT_PATH=`pwd`/$CLIENT_PATH
fi
echo "Client path detected successfully: $CLIENT_PATH"

echo""

echo "COPYING clients..."
IP=$(java -cp $WOWZA_HOME/lib/tbs-flashphoner.jar com.flashphoner.sdk.rtmp.FlashphonerProperties "$WOWZA_HOME/conf/flashphoner.properties" "ip")
URL="rtmp://$IP:1935"
FLASHPHONER_XML_PATH="$INSTALLER_DIR/client/flashphoner.xml"
FLASHPHONER_XML_CONTENT=`cat $FLASHPHONER_XML_PATH`
INDEX1=$(echo | awk -v a="$FLASHPHONER_XML_CONTENT" -v b="<rtmp_server>" 'BEGIN{ print index(a,b)}')
INDEX2=$(echo | awk -v a="$FLASHPHONER_XML_CONTENT" -v b="</rtmp_server>" 'BEGIN{ print index(a,b)}')
let "INDEX11 = $INDEX1+12"
FILE_CONTENT1=$(echo | awk -v a="$FLASHPHONER_XML_CONTENT" -v b="0" -v c="$INDEX11" 'BEGIN{ print substr(a,b,c)}')
FILE_CONTENT2=$(echo | awk -v a="$FLASHPHONER_XML_CONTENT" -v b="$INDEX2" 'BEGIN{ print substr(a,b)}')
echo "$FILE_CONTENT1$URL$FILE_CONTENT2" > $FLASHPHONER_XML_PATH

cd $INSTALLER_DIR/client 
if [ ! -d "$CLIENT_PATH/flashphoner_client" ]; then
	mkdir -p $CLIENT_PATH/flashphoner_client
fi

for file in `ls -1`
do
   cp -r "$file" $CLIENT_PATH/flashphoner_client
done
echo "- Copying completed. Use '$CLIENT_PATH/flashphoner_client/Phone.html' for run flashphoner_client"

echo ""
echo "************************************************************************************************"
echo "*                                                                                              *"
echo "*                                   Installation complete!                                     *"
echo "*                        Thank you for trying flashphoner_client!                              *"   
echo "*                                                                                              *"
echo "*   Please restart Wowza Media Server before start work with Flashphoner.                      *"
echo "*   Write us with any questions to support@flashphoner.com                                     *"
echo "*                                                                                              *"
echo "*                                                                                              *"
echo "*                                                                      Press ENTER to continue *"
echo "************************************************************************************************"
echo ""

if [ "$SILENT" != "-silent" ]; then
    read cont < /dev/tty
fi