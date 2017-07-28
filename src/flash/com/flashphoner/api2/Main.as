package com.flashphoner.api2 {

    import com.flashphoner.Logger;
    import com.flashphoner.api2.Main;
    import com.flashphoner.api2.media.LocalMediaControl;
    import com.flashphoner.api2.media.RemoteMediaControl;
    import com.flashphoner.api2.connection.Connection;

    import flash.events.MouseEvent;
    import flash.events.StatusEvent;
    import flash.events.SampleDataEvent;
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
    import flash.display.*;
    import com.flashphoner.Logger;

    public class Main extends Application {

        [Embed(source='skin/fullscreen-icon.png')]
        [Bindable]
        public var iconFullScreen:Class;

        private var canvas:Canvas;
        private var remoteDisplay:Video;
        private var remoteDisplayHolder:UIComponent;
        private var localDisplay:VideoDisplay;
        private var openSettingsButton:Button;
        private var fullScreenButton:Button;

        private static var config:Object;
        private var localMediaControl:LocalMediaControl;
        private var remoteMediaControl:RemoteMediaControl;

        private var connection:Connection;

        private var timer:Timer = new Timer(1000,0);

        private var micLevel:int = -1;

        private static var scopeId:String;

        public function Main() {
            addEventListener(FlexEvent.CREATION_COMPLETE, creationHandler);
            addEventListener(Event.ADDED_TO_STAGE, addedToStage);
        }

        private function creationHandler(e:FlexEvent):void {
            Security.allowDomain("*");
            //save config
            Main.config = parameters;
            scopeId = parameters.id;
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
            remoteDisplayHolder.visible = false;
            this.canvas.addChild(remoteDisplayHolder);
            this.localDisplay = new VideoDisplay();
            this.localDisplay.percentWidth = 100;
            this.localDisplay.percentHeight = 100;
            this.localDisplay.visible = false;
            this.canvas.addChild(this.localDisplay);
            this.openSettingsButton = new Button();
            this.openSettingsButton.label = "Adobe Flash Player Settings";
            this.openSettingsButton.addEventListener(MouseEvent.CLICK, onOpenSettings);
            this.openSettingsButton.visible = false;
            this.canvas.addChild(this.openSettingsButton);
            this.fullScreenButton = new Button();
            this.fullScreenButton.width = 32;
            this.fullScreenButton.setStyle("icon", iconFullScreen);
            this.fullScreenButton.visible = false;
            this.fullScreenButton.addEventListener(MouseEvent.CLICK, fullScreenHandler);
            this.canvas.addChild(this.fullScreenButton);
            addElement(this.canvas);
            //create media controls
            this.localMediaControl = new LocalMediaControl(this, localDisplay);
            this.remoteMediaControl = new RemoteMediaControl(this, remoteDisplay);
            ExternalInterface.addCallback("connect", connect);
            ExternalInterface.addCallback("disconnect", disconnect);
            ExternalInterface.addCallback("getMediaAccess", getMediaAccess);
            ExternalInterface.addCallback("hasAccessToAudio", hasAccessToAudio);
            ExternalInterface.addCallback("setup", setup);
            ExternalInterface.addCallback("reset", reset);
            ExternalInterface.addCallback("getId", getId);
            ExternalInterface.addCallback("updateId", updateId);
            ExternalInterface.addCallback("listDevices", listDevices);
            ExternalInterface.addCallback("resize", resize);
            ExternalInterface.addCallback("setVolume", setVolume);
            ExternalInterface.addCallback("getVolume", getVolume);
            ExternalInterface.addCallback("muteAudio", muteAudio);
            ExternalInterface.addCallback("unmuteAudio", unmuteAudio);
            ExternalInterface.addCallback("isAudioMuted", isAudioMuted);
            ExternalInterface.addCallback("muteVideo", muteVideo);
            ExternalInterface.addCallback("unmuteVideo", unmuteVideo);
            ExternalInterface.addCallback("isVideoMuted", isVideoMuted);
            ExternalInterface.addCallback("isHasAudio", isHasAudio);
            ExternalInterface.addCallback("isHasVideo", isHasVideo);
            ExternalInterface.addCallback("getStats", getStats);
            ExternalInterface.addCallback("changeAudioCodec", changeAudioCodec);
            ExternalInterface.addCallback("fullScreen", fullScreen);
            ExternalInterface.addCallback("getMicrophoneLevel", getMicrophoneLevel);
            callExternalInterface("initialized", null);
        }

        function addedToStage(e:Event) {
            stage.addEventListener(Event.RESIZE, onResize);
        }

        public function reset(id:String):void {
            if (this.connection) {
                this.connection.disconnect();
            }
            Main.config.id = id;
            this.localDisplay.percentWidth = 100;
            this.localDisplay.percentHeight = 100;
        }

        public function connect(url:String, token:String, login:String):void {
            this.connection = new Connection(this);
            var obj:Object = {};
            obj.token = token;
            this.connection.connect(url, obj, login);
        }

        public function disconnect():void {
            this.connection.disconnect();
        }

        public function setup(incoming:Boolean, outgoing:Boolean, hasAudio:Boolean, hasVideo:Boolean, bufferTime:Number, reinit:Boolean):void {
            if (reinit) {
                this.connection.reinit();
            }
            if (incoming && outgoing) {
                this.connection.setupStreams(localMediaControl, remoteMediaControl, hasAudio, hasVideo, bufferTime);
                this.remoteDisplayHolder.visible = true;
                if (hasVideo) {
                    this.localDisplay.visible = true;
                    this.localDisplay.percentWidth = 20;
                    this.localDisplay.percentHeight = 20;
                }
            } else if (outgoing) {
                this.connection.setupStreams(localMediaControl, null, hasAudio, hasVideo, null);
                this.remoteDisplayHolder.visible = false;
                this.localDisplay.visible = true;
            } else {
                this.connection.setupStreams(null, remoteMediaControl, hasAudio, hasVideo, bufferTime);
                this.remoteDisplayHolder.visible = true;
                this.localDisplay.visible = false;
            }
        }

        public function getId():String {
            return config.id;
        }

        public function updateId(id:String):void {
            Logger.info("update id from " + config.id + " to " + id);
            config.id = id;
        }

        public function listDevices():Object{
            var list = {};
            list.audio = this.localMediaControl.listMicrophones();
            list.video = this.localMediaControl.listCameras();
            return list;
        }

        public static  function callExternalInterface(jsCallback:String, status:String):void {
            var callback:String = "Flashphoner.FlashApiScope['"+scopeId+"']."+jsCallback;
            if (callbackExists(jsCallback)) {
                ExternalInterface.call(callback, status);
            }
        }

        private static function callbackExists(jsCallback:String):Boolean {
            var check:String = 'function(){' +
                    "if(typeof(Flashphoner.FlashApiScope['"+scopeId+"']) === \"object\" && " +
                    "typeof(Flashphoner.FlashApiScope['" +scopeId+"']."+jsCallback+") === \"function\"){return true}}";
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

        public function getMediaAccess(constraints:Object):Boolean {
            if (localMediaControl.init(constraints)) {
                //check if we have access already
                if(localMediaControl.hasAccess()) {
                    onAccessGranted();
                    return true;
                }
                //ask user for permission
                var mic:Microphone = localMediaControl.getMicrophone();
                if (mic != null) {
                    mic.setLoopBack(true);
                    mic.addEventListener(StatusEvent.STATUS, this.onMicStatus);
                    mic.addEventListener(SampleDataEvent.SAMPLE_DATA, this.onSampleData);
                }
                timer.addEventListener(TimerEvent.TIMER, timerTick);
                timer.start();
                openSettingsButton.visible = true;
                return true;
            }
            return false;

        }

        public function getAccessToAudio():Boolean {
            var mic:Microphone = localMediaControl.getMicrophone();
            if (mic == null){
                return false;
            }
            if (!localMediaControl.hasAccessToAudio()){
                mic.setLoopBack(true);
                mic.addEventListener(StatusEvent.STATUS, this.onMicStatus);
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

        private function onMicStatus(event:StatusEvent):void {
            if (event.code == "Microphone.Muted") {
                Logger.info("Microphone access was denied.");
                timer.stop();
                openSettingsButton.visible = false;
                onAccessDenied();
            }
        }

        private function onSampleData(event:SampleDataEvent):void {
            var mic:Microphone = localMediaControl.getMicrophone();
            if (mic != null) {
                micLevel = mic.activityLevel;
            }

        }

        private function timerTick(event:TimerEvent):void{
            if (localMediaControl.hasAccess()){
                timer.stop();
                var mic:Microphone = localMediaControl.getMicrophone();
                if (mic != null) {
                    mic.setLoopBack(false);
                }
                openSettingsButton.visible = false;
                onAccessGranted();
            }
        }

        private function onAccessGranted(){
            callExternalInterface('accessGranted', null);
            if (localMediaControl.getCam() != null) {
                localMediaControl.attachLocalMedia();
                localDisplay.visible = true;
            }
        }

        private function onAccessDenied(){
            callExternalInterface('accessDenied', null);
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

        public function getVolume():int{
            return this.remoteMediaControl.getVolume();
        }

        public function setVolume(volume:int):void{
            this.remoteMediaControl.setVolume(volume);
        }

        public function muteAudio():void{
            this.localMediaControl.muteAudio();
        }

        public function unmuteAudio():void{
            this.localMediaControl.unmuteAudio();
        }

        public function isAudioMuted():Boolean{
            return this.localMediaControl.isAudioMuted();
        }

        public function muteVideo():void{
            this.localMediaControl.muteVideo();
        }

        public function unmuteVideo():void{
            this.localMediaControl.unmuteVideo();
        }

        public function isVideoMuted():Boolean{
            return this.localMediaControl.isVideoMuted();
        }

        private function onResize(event:Event):void{
            Logger.info("Stage size " + this.stage.width + "x" + this.stage.height);
            if (this.remoteDisplayHolder.visible) {
                this.fullScreenButton.y = stage.stageHeight - this.fullScreenButton.height;
                this.fullScreenButton.x = stage.stageWidth - this.fullScreenButton.width;
                this.fullScreenButton.visible = parameters.showFullScreenButton == "true";
                this.remoteDisplay.width = this.remoteDisplayHolder.width;
                this.remoteDisplay.height = this.remoteDisplayHolder.height;
            }
        }

        public function resize(width:int, height:int):void {
            Logger.info("Resize to " + width + "x" + height);
            var callback:String = "Flashphoner.FlashApiScope['"+scopeId+"'].videoResolution";
            if (callbackExists("videoResolution")) {
                ExternalInterface.call(callback, width, height);
            }
            onResize(null);
        }

        public function isHasAudio():Boolean{
            return this.localMediaControl.isHasAudio();
        }

        public function isHasVideo():Boolean{
            return this.localMediaControl.isHasVideo();
        }

        public function getStats():Object{
            var statistics:Object = new Object();
            if (this.connection) {
                statistics = this.connection.getStatistics();
            }
            return statistics;
        }

        public function changeAudioCodec(codec:String):void {
            if (this.localMediaControl) {
                localMediaControl.changeCodec(codec);
            }
        }

        public function fullScreen() {
            Logger.error("Full screen mode should be enabled manually by clicking on icon");
        }

        private function fullScreenHandler(event:MouseEvent):void {
            if (stage.displayState == StageDisplayState.NORMAL) {
                stage.displayState = StageDisplayState.FULL_SCREEN;
            } else {
                stage.displayState = StageDisplayState.NORMAL;
            }
        }

        public function getMicrophoneLevel() {
            return micLevel;
        }
    }
}
