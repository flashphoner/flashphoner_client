package com.flashphoner.api2.connection {
	import com.flashphoner.Logger;
	import com.flashphoner.api2.media.LocalMediaControl;
	import com.flashphoner.api2.media.RemoteMediaControl;
	import com.flashphoner.api2.stream.Stream;
	import com.flashphoner.api2.Main;

	import flash.events.*;
	import flash.media.Camera;
	import flash.media.H264Profile;
	import flash.net.*;
	import flash.system.Security;
	import flash.system.SecurityPanel;
	import flash.utils.Timer;
	import flash.utils.setTimeout;
	
	import mx.controls.Alert;
	
	/**
	 * Media server outgoing communication class
	 * **/
	public class Connection
	{			
		internal var nc:NetConnection;		
		
		public var hasDisconnectAttempt:Boolean;
		
		private var application:Main;
		
		private var isConnected:Boolean;
		
		private var incomingStream:Stream;
		private var outgoingStream:Stream;

		public function Connection(application:Main)
		{		
			this.application = application;

			nc = new NetConnection();
			nc.client = new ConnectionCallback(this);
			isConnected = false;
			
		}
		
		public function connect(WCSUrl:String, obj:Object):void {
			Logger.info("Connect to " + WCSUrl);
			nc.addEventListener(NetStatusEvent.NET_STATUS,netStatusHandler);
			nc.connect(WCSUrl,obj);
		}
		
		public function disconnect():void {
			Logger.info("disconnect");
			hasDisconnectAttempt = true;
			nc.close();
		}
		
		public function netStatusHandler(event : NetStatusEvent) : void
		{		
			var eventInfoStr:String = "";
			for(var id:String in event.info) {
				var value:Object = event.info[id];
				eventInfoStr += id + "=" + value + "; ";
			}
			Logger.info("NetConnection " + event + " - " + eventInfoStr);

			if(event.info.code == "NetConnection.Connect.Success")
			{
				isConnected = true;
				Main.callExternalInterface("connectionStatus", "Success");
			} else if(event.info.code == "NetConnection.Connect.Failed")
			{
				hasDisconnectAttempt = false;
				Main.callExternalInterface("connectionStatus", "Failed");
			} else if (event.info.code == 'NetConnection.Connect.Rejected')
			{
				Alert.show("Connect rejected,\n permission to server denied.");
				hasDisconnectAttempt = false;
				Main.callExternalInterface("connectionStatus", "Rejected");
			} else if (event.info.code == 'NetConnection.Connect.Closed')
			{				
				hasDisconnectAttempt = false;
				isConnected = false;
				Main.callExternalInterface("connectionStatus", "Closed");
			}		
		}

		public function setupStreams(localMediaControl:LocalMediaControl, remoteMediaControl:RemoteMediaControl,
									hasAudio:Boolean, hasVideo:Boolean):void {
			if (remoteMediaControl) {
				incomingStream = new Stream(application, nc);
				incomingStream.setup(null, remoteMediaControl, hasAudio, hasVideo);
			}
			if (localMediaControl) {
				outgoingStream = new Stream(application, nc);
				outgoingStream.setup(localMediaControl, null, hasAudio, hasVideo);
			}
		}
		
		public function pong():void{
			nc.call("pong", null);		
		}
		
	}
}
