package com.flashphoner.api2 {

    import com.flashphoner.api2.media.LocalMediaControl;
    import com.flashphoner.api2.media.RemoteMediaControl;
    import com.flashphoner.api2.connection.Connection;

    import flash.events.MouseEvent;
    import flash.events.TimerEvent;
    import flash.events.Event;
    import flash.system.SecurityPanel;
    import flash.system.Security;
    import flash.external.ExternalInterface;
    import flash.utils.Timer;
    import mx.controls.Alert;
    import mx.controls.Button;
    import mx.containers.Canvas;
    import mx.controls.VideoDisplay;
    import flash.media.Video;
    import mx.controls.Button;
    import mx.events.FlexEvent;
    import mx.core.UIComponent;
    import spark.components.Application;
    import flash.system.Capabilities;
    import flash.media.Microphone;

    import com.flashphoner.Logger;

    public class Main extends Application {

        private var canvas:Canvas;
        private var remoteDisplay:Video;
        private var remoteDisplayHolder:UIComponent;
        private var localDisplay:VideoDisplay;
        private var openSettingsButton:Button;

        private static var config:Object;
        private var localMediaControl:LocalMediaControl;
        private var remoteMediaControl:RemoteMediaControl;

        private var connection:Connection;

        private var timer:Timer = new Timer(1000,0);

        public function Main() {
            addEventListener(FlexEvent.CREATION_COMPLETE, creationHandler);
        }

        private function creationHandler(e:FlexEvent):void {
            //save config
            Main.config = parameters;
            Logger.init();
            //create elements
            this.canvas = new Canvas();
            this.canvas.percentWidth = 100;
            this.canvas.percentHeight = 100;
            this.remoteDisplay = new Video();
            remoteDisplayHolder = new UIComponent();
            remoteDisplayHolder.percentWidth = 100;
            remoteDisplayHolder.percentHeight = 100;
            remoteDisplayHolder.addChild(this.remoteDisplay);
            remoteDisplayHolder.addEventListener(Event.RESIZE,onResize);
            remoteDisplayHolder.visible = false;
            this.canvas.addChild(remoteDisplayHolder);
            this.localDisplay = new VideoDisplay();
            this.localDisplay.width = 320;
            this.localDisplay.height = 240;
            this.localDisplay.visible = false;
            this.canvas.addChild(this.localDisplay);
            this.openSettingsButton = new Button();
            this.openSettingsButton.label = "Adobe Flash Player Settings";
            this.openSettingsButton.addEventListener(MouseEvent.CLICK, onOpenSettings);
            this.openSettingsButton.visible = false;
            this.canvas.addChild(this.openSettingsButton);
            addElement(this.canvas);
            //create media controls
            this.localMediaControl = new LocalMediaControl(localDisplay);
            this.remoteMediaControl = new RemoteMediaControl(this, remoteDisplay);

            ExternalInterface.addCallback("connect", connect);
            ExternalInterface.addCallback("disconnect", disconnect);
            ExternalInterface.addCallback("getAccessToAudio", getAccessToAudio);
            ExternalInterface.addCallback("getAccessToAudioAndVideo", getAccessToAudioAndVideo);
            ExternalInterface.addCallback("hasAccessToAudio", hasAccessToAudio);
            ExternalInterface.addCallback("setup", setup);
            ExternalInterface.addCallback("reset", reset);
            ExternalInterface.addCallback("getId", getId);
            callExternalInterface("initialized", null);
        }

        public function reset(id:String):void {
            if (this.connection) {
                this.connection.disconnect();
            }
            Main.config.id = id;
        }

        public function connect(url:String, token:String):void {
            this.connection = new Connection(this);
            var obj:Object = {};
            obj.token = token;
            this.connection.connect(url, obj);
        }

        public function disconnect():void {
            this.connection.disconnect();
        }

        public function setup(incoming:Boolean, outgoing:Boolean, hasAudio:Boolean, hasVideo:Boolean):void {
            if (incoming && outgoing) {
                this.connection.setupStreams(localMediaControl, remoteMediaControl, hasAudio, hasVideo);
                this.remoteDisplayHolder.visible = true;
                this.localDisplay.visible = true;
            } else if (outgoing) {
                this.connection.setupStreams(localMediaControl, null, hasAudio, hasVideo);
                this.remoteDisplayHolder.visible = false;
                this.localDisplay.visible = true;
            } else {
                this.connection.setupStreams(null, remoteMediaControl, hasAudio, hasVideo);
                this.remoteDisplayHolder.visible = true;
                this.localDisplay.visible = false;
            }
        }

        public function getId():String {
            return config.id;
        }

        public static  function callExternalInterface(jsCallback:String, status:String):void {
            var callback:String = "Flashphoner.FlashApiScope['"+config.id+"']."+jsCallback;
            if (callbackExists(jsCallback)) {
                ExternalInterface.call(callback, status);
            }
        }

        private static function callbackExists(jsCallback:String):Boolean {
            var check:String = 'function(){' +
                    "if(typeof(Flashphoner.FlashApiScope['"+config.id+"']) === \"object\" && " +
                    "typeof(Flashphoner.FlashApiScope['" + config.id+"']."+jsCallback+") === \"function\"){return true}}";
            return ExternalInterface.call(check);
        }

        public static function addLogMessage(message:String) {
            callExternalInterface("addLogMessage", message);
        }

        public static function getFlashPlayerMajorVersion():int {
            var flashPlayerVersion:String = Capabilities.version;
            var osArray:Array = flashPlayerVersion.split(' ');
            var osType:String = osArray[0];
            var versionArray:Array = osArray[1].split(',');
            return parseInt(versionArray[0]);
        }



        protected function onOpenSettings(event:MouseEvent):void
        {
            Security.showSettings(SecurityPanel.PRIVACY);
        }

        public function getAccessToAudio():Boolean {
            var mic:Microphone = localMediaControl.getMicrophone();
            if (mic == null){
                return false;
            }
            if (!localMediaControl.hasAccessToAudio()){
                mic.setLoopBack(true);
                timer.addEventListener(TimerEvent.TIMER, timerTick);
                timer.start();
                openSettingsButton.visible = true;
            } else {
                onAccessGranted();
            }

            return true;
        }

        public function getAccessToAudioAndVideo():Boolean {
            if (localMediaControl.getCam() == null){
                return false;
            }
            return getAccessToAudio();
        }

        private function timerTick(event:TimerEvent):void{
            if (localMediaControl.hasAccessToAudio()){
                timer.stop();
                var mic:Microphone = localMediaControl.getMicrophone();
                mic.setLoopBack(false);
                openSettingsButton.visible = false;
                if (localMediaControl.getCam() != null) {
                    localMediaControl.attachLocalMedia();
                    localDisplay.visible = true;
                }
                onAccessGranted();
            }
        }

        private function onAccessGranted(){
            callExternalInterface('accessGranted', null);
        }

        public function hasAccessToAudio():Boolean{
            var m:Microphone = localMediaControl.getMicrophone();
            if (m == null){
                return false;
            }else{
                if (m.muted){
                    return false;
                }else{
                    return true;
                }

            }
        }

        private function onResize(event:Event):void{
            Logger.info("Changed size to " + remoteDisplayHolder.width + "x" + remoteDisplayHolder.height);
        }
    }
}
