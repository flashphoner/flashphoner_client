/*
Copyright (c) 2011 Flashphoner
All rights reserved. This Code and the accompanying materials
are made available under the terms of the GNU Public License v2.0
which accompanies this distribution, and is available at
http://www.gnu.org/licenses/old-licenses/gpl-2.0.html

Contributors:
    Flashphoner - initial API and implementation

This code and accompanying materials also available under LGPL and MPL license for Flashphoner buyers. Other license versions by negatiation. Write us support@flashphoner.com with any questions.
*/
package com.flashphoner.api
{	
	import com.adobe.cairngorm.control.CairngormEventDispatcher;
	import com.flashphoner.Logger;
	import com.flashphoner.api.data.ErrorCodes;
	import com.flashphoner.api.data.ModelLocator;
	import com.flashphoner.api.data.PhoneConfig;
	import com.flashphoner.api.interfaces.APINotify;
	import com.flashphoner.api.management.VideoControl;
	
	import flash.events.*;
	import flash.net.*;
	import flash.system.Security;
	import flash.system.SecurityPanel;
	import flash.utils.Timer;
	import flash.utils.setTimeout;
	
	import mx.controls.Alert;
	
	/**
	 * Media server outgoing communication class
	 * **/
	internal class PhoneServerProxy
	{			
		//output voice stream
		private static var outStream:NetStream;
		
		private var responder:Responder;
		internal var nc:NetConnection;		
		
		public var hasDisconnectAttempt:Boolean;
		
		public static var sendVideo:Boolean = false;
		
		public var phoneSpeaker:PhoneSpeaker;
		
		private var flash_API:Flash_API;
		
		private var keepAliveTimer:Timer;
		
		private var keepAliveTimeoutTimer:Timer;
		
		private var isConnected:Boolean;
		
		public function PhoneServerProxy(responder:Responder,flash_API:Flash_API)
		{		
			this.flash_API = flash_API;
			this.responder = responder;
			nc = new NetConnection();
			nc.client = new PhoneCallback(flash_API);
			phoneSpeaker = new PhoneSpeaker(nc,flash_API);
			isConnected = false;
			
		}
		
		public function login(loginObject:Object, WCSUrl:String):int{
			
			var modelLocator:ModelLocator = flash_API.modelLocator;
			loginObject.registerRequired = PhoneConfig.REGISTER_REQUIRED;

			loginObject.width = PhoneConfig.VIDEO_WIDTH;
			loginObject.height = PhoneConfig.VIDEO_HEIGHT;
			loginObject.supportedResolutions = PhoneConfig.SUPPORTED_RESOLUTIONS;
			
			if (loginObject.token == null) { 
				if (loginObject.authenticationName == null || loginObject.authenticationName == ""){
					loginObject.authenticationName = loginObject.login;
				}
				loginObject.visibleName = modelLocator.visibleName;
			}			
			createConnection(loginObject, WCSUrl);
			return 0;			
		}
		
		private function createConnection(obj:Object, WCSUrl:String):void {
			Logger.info("createConnection serverUrl: "+WCSUrl);
			nc.addEventListener(NetStatusEvent.NET_STATUS,netStatusHandler);
			nc.connect(WCSUrl,obj);
		}
		
		public function subscribe(subscribeObj:Object):void{
			Logger.info("subscribe "+subscribeObj);
			nc.call("subscribe",null,subscribeObj);
		}
		
		/*		
		public function loginByTokenWithPageUrl(token:String = null, pageUrl:String):void{
			var modelLocator:ModelLocator = flash_API.modelLocator;
			var obj:Object = new Object();
			obj.registerRequired = PhoneConfig.REGISTER_REQUIRED;
			obj.token = token;
			obj.width = PhoneConfig.VIDEO_WIDTH;
			obj.height = PhoneConfig.VIDEO_HEIGHT;	
			obj.pageUrl = pageUrl;
			nc.addEventListener(NetStatusEvent.NET_STATUS,netStatusHandler);
			nc.connect(PhoneConfig.SERVER_URL+"/"+PhoneConfig.APP_NAME,obj);
		}
		*/
		
		public function call(callObject:Object):void{
			Logger.info("PhoneServerProxy.call()");
			nc.call("call", responder, callObject);
		}
		
		public function callByToken(callObject:Object):void{
			Logger.info("PhoneServerProxy.callByToken()");
			nc.call("call", responder, callObject);
		}
		
		public function msrpCall(callObject:Object):void{
			Logger.info("PhoneServerProxy.msrpCall()");
			nc.call("msrpCall", responder, callObject);
		}		
		public function disconnect():void {
			hasDisconnectAttempt = true;
			nc.close();
		}
		
		public function initKeepAlive():void{
			Logger.info("initKeepAlive");	
			keepAliveTimer = new Timer(PhoneConfig.KEEP_ALIVE_INTERVAL,1);
			keepAliveTimer.addEventListener(TimerEvent.TIMER_COMPLETE,fireKeepAlive);
			
			keepAliveTimeoutTimer = new Timer(PhoneConfig.KEEP_ALIVE_TIMEOUT,1);
			keepAliveTimeoutTimer.addEventListener(TimerEvent.TIMER_COMPLETE,fireKeepAliveTimeout);
			Logger.info("keepAliveTimeoutTimer: "+PhoneConfig.KEEP_ALIVE_INTERVAL+" keepAliveTimeoutTimer: "+PhoneConfig.KEEP_ALIVE_TIMEOUT);
		}
		
		public function startKeepAlive():void{			
			Logger.debug("startKeepAlive "+new Date());
			keepAliveTimer.start();			
		}
		
		public function fireKeepAlive(event:TimerEvent):void{
			Logger.debug("fireKeepAlive "+new Date());			
			nc.call("keepAlive",new Responder(keepAliveResponse));
			keepAliveTimeoutTimer.start();
		}
		
		public function keepAliveResponse(result:int):void{
			Logger.debug("keepAliveResponse: "+result);
			keepAliveTimeoutTimer.stop();			
			startKeepAlive();
		}
		
		public function fireKeepAliveTimeout(event:TimerEvent):void{
			Logger.info("fireKeepAliveTimeout. Close connection by keep alive timeout: "+PhoneConfig.KEEP_ALIVE_TIMEOUT);			
			nc.close();			
		}
		
		public function netStatusHandler(event : NetStatusEvent) : void
		{			
			var modelLocator:ModelLocator = flash_API.modelLocator;
			if(event.info.code == "NetConnection.Connect.Success")
			{
				Logger.info("NetConnection.Connect.Success");
				for each (var apiNotify:APINotify in Flash_API.apiNotifys){
					apiNotify.notifyConnected();
				}
				CairngormEventDispatcher.getInstance().dispatchEvent(new MainEvent(MainEvent.CONNECTED,flash_API));
				if (PhoneConfig.KEEP_ALIVE){
					initKeepAlive();
					startKeepAlive();
				}
				
				isConnected = true;
								
			} else if(event.info.code == "NetConnection.Connect.Failed")
			{
				Logger.info("NetConnection.Connect.Failed");
				flash_API.dropRegisteredTimer();
				for each (var apiNotify:APINotify in Flash_API.apiNotifys){
					apiNotify.notifyError(ErrorCodes.CONNECTION_ERROR);
				}
				hasDisconnectAttempt = false;
			} else if (event.info.code == 'NetConnection.Connect.Rejected')
			{
				Logger.info("NetConnection.Connect.Rejected");
				Alert.show("Connect rejected,\n permission to server denied.");
				hasDisconnectAttempt = false;
			} else if (event.info.code == 'NetConnection.Connect.Closed')
			{				
				Logger.info("NetConnection.Connect.Closed");
				for each (var apiNotify:APINotify in Flash_API.apiNotifys){
					apiNotify.notifyCloseConnection();
				}
				CairngormEventDispatcher.getInstance().dispatchEvent(new MainEvent(MainEvent.DISCONNECT,flash_API));
				hasDisconnectAttempt = false;
				isConnected = false;
			}		
		}
		
		public function sendInstantMessage(msg:Object):void{		
			nc.call("sendInstantMessage",null,msg);
		}
		
		public function notificationResult(notificationResult:Object):void{		
			nc.call("notificationResult", null, notificationResult);
		}
		
		public function sendInfo(infoObject:Object):void{
			nc.call("sendInfo", null, infoObject);
		}
		
		public function pushLogs(logs:String):Boolean {
			if(isConnected) {
				//merge JS and FLASH logs
				var logsToServer:String = Logger.merge(logs);

				//clear FLASH logs
				Logger.clear();

				nc.call("pushLogs", null, logsToServer);
				return true;
			} else {
				return false;
			}
		}
		
		public function submitBugReport(reportObj:Object){
			if (isConnected){
				nc.call("submitBugReport",null,reportObj);
			}
		}
		
		public function pong(){
			nc.call("pong",null);		
		}
		
		public function setLTState(stateObj:Object):void{
			nc.call("setLTState", null,  stateObj);
		}
		
		public function sendXcapRequest(xcapUrl:String):void{
			nc.call("sendXcapRequest", null, xcapUrl);
		}
		
	}
}
