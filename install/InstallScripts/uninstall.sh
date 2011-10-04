#Uninstall

echo ""; echo ""; echo ""; echo ""; echo ""; echo ""; echo ""; echo ""; echo ""; echo "";
echo ""; echo ""; echo ""; echo ""; echo ""; echo ""; echo ""; echo ""; echo ""; echo "";
echo ""; echo ""; echo ""; echo ""; echo ""; echo ""; echo ""; echo ""; echo ""; echo "";
echo ""; echo ""; echo ""; echo ""; echo ""; echo ""; echo ""; echo ""; echo ""; echo "";
echo ""; echo ""; echo ""; echo ""; echo ""; echo ""; echo ""; echo ""; echo ""; echo "";
echo ""; echo ""; echo ""; echo ""; echo ""; echo ""; echo ""; echo ""; echo ""; echo "";

echo "**************************************************"
echo "*                                                *"
echo "*         Uninstalling flashphoner_client        *"
echo "*                                                *"
echo "* (c) Flashphoner.com 2010. All rights reserved  *"
echo "*                                                *"
echo "**************************************************"
echo ""

echo "DETECTING Wowza home..."

WOWZA_HOME=/usr/local/WowzaMediaServer

if [ ! -f $WOWZA_HOME/conf/Server.xml ]; then
    echo "- Please specify Wowza home directory"
    get_wowza_home () {
    read in
    if [ ! -z "$in" ];then
	if [ ! -f $in/conf/Server.xml ]; then
    	    echo "- Wrong Wowza home path: $in"
            get_wowza_home
        fi
            WOWZA_HOME=$in
            echo "- Wowza home detected successfully: $WOWZA_HOME."
    else
        echo "- Please do not enter blank Wowza home."
        get_wowza_home
    fi
    }
    get_wowza_home
else
    echo "- Wowza home detected successfully: $WOWZA_HOME."
fi
echo ""                                                                                                            

PRODUCT=flashphoner_client
INSTALL_LOG=$WOWZA_HOME/bin/$PRODUCT-install.log
PRODUCT_VERSION_FILE=$WOWZA_HOME/conf/flashphoner_client.version

echo "UNINSTALLING flashphoner_client..."
echo ""

echo "1. Removing Wowza configuration changes..."

SERVER_LISTENER_XPATH="/Root/Server/ServerListeners/ServerListener[BaseClass=\"com.flashphoner.phone_app.PhoneServerListener\"]"
RTMP2VOIP_STREAM_XPATH="/Root/Streams/Stream[Name=\"phone_rtmp_to_voip\"]"
java -cp $WOWZA_HOME/bin/tbs-flashphoner-configurator.jar com.flashphoner.configurator.xpath.XPath removeNode $WOWZA_HOME/conf/Server.xml null $SERVER_LISTENER_XPATH null
java -cp $WOWZA_HOME/bin/tbs-flashphoner-configurator.jar com.flashphoner.configurator.xpath.XPath removeNode $WOWZA_HOME/conf/Streams.xml null $RTMP2VOIP_STREAM_XPATH null

echo "- Removing changes completed."
echo ""

echo "2. Removing $PRODUCT files accordingly to install.log..."
if [ -f $INSTALL_LOG ]; then
cat $INSTALL_LOG | while read line; do
rm -rf $line
done
fi
echo "- Removing old files completed."


rm -f $INSTALL_LOG
rm -f $PRODUCT_VERSION_FILE
rm -rf $WOWZA_HOME/conf/phone_app

echo ""
echo "***************************************************************************"
echo "*                                                                         *"
echo "*                         Uninstallation complete!                        *"
echo "*                                                                         *"
echo "*  Thank you for trying flashphoner_client!                               *"
echo "*  Please restart Wowza before further work                               *"
echo "*  Support - support@flashphoner.com, forum - www.flashphoner.com/forums  *"
echo "*  Press Enter to continue                                                *"
echo "*                                                                         *"
echo "***************************************************************************"
echo ""

read cont < /dev/tty



