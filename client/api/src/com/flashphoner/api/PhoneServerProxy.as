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
	import flash.net.NetConnection;
	import flash.net.NetStream;
	import flash.net.Responder;
	import flash.net.SharedObject;
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
		
		
		public function PhoneServerProxy(responder:Responder,flash_API:Flash_API)
		{		
			this.flash_API = flash_API;
			this.responder = responder;
			nc = new NetConnection();
			nc.client = new PhoneCallback(flash_API);
			phoneSpeaker = new PhoneSpeaker(nc,flash_API);	
			
		}
		
		public function login(loginObject:Object):int{
			var username:String = loginObject.username;
			var authenticationName:String = loginObject.authenticationName;
			var password:String = loginObject.password;
			var outboundProxy:String = loginObject.outboundProxy;
			var port:String = loginObject.port;
			var qValue:String = loginObject.qValue;
			
			var modelLocator:ModelLocator = flash_API.modelLocator;
			var obj:Object = new Object();
			obj.registerRequired = PhoneConfig.REGISTER_REQUIRED;
			if (username.indexOf("sip:") != 0 || username.indexOf("@") < 4){
				return 1;
			}	
			username = username.substring(4);
			obj.login = username.substring(0,username.indexOf("@"));
			if (authenticationName == null || authenticationName == ""){
				obj.authenticationName = username.substring(0,username.indexOf("@"));
			}else{
				obj.authenticationName = authenticationName; 
			}
			obj.password = password;
			obj.width = PhoneConfig.VIDEO_WIDTH;
			obj.height = PhoneConfig.VIDEO_HEIGHT;
			var endIndex:int = username.indexOf(":");
			if (endIndex == -1){
				endIndex = username.length;
			}
			obj.domain = username.substring(username.indexOf("@")+1,endIndex);
			obj.outboundProxy = outboundProxy;
			obj.port = port;
			obj.supportedResolutions = PhoneConfig.SUPPORTED_RESOLUTIONS;
			obj.visibleName = modelLocator.visibleName;
			obj.qValue = qValue;
						
			nc.addEventListener(NetStatusEvent.NET_STATUS,netStatusHandler);	
			nc.connect(PhoneConfig.SERVER_URL+"/"+PhoneConfig.APP_NAME,obj);
			return 0;			
		}

		
		public function loginByToken(token:String = null, pageUrl:String = null):void{
			
			/** 
			 * pageUrl need here by that reason = WSP-1855 "Problem with pageUrl in Firefox"
			 * if client broswer is Firefox, default pageUrl not works, and we send from js special pageUrl 
			 */
			
			var modelLocator:ModelLocator = flash_API.modelLocator;
			var obj:Object = new Object();
			obj.registerRequired = PhoneConfig.REGISTER_REQUIRED;
			obj.token = token;
			obj.pageUrl = pageUrl;
			obj.width = PhoneConfig.VIDEO_WIDTH;
			obj.height = PhoneConfig.VIDEO_HEIGHT;
			
			nc.addEventListener(NetStatusEvent.NET_STATUS,netStatusHandler);
			nc.connect(PhoneConfig.SERVER_URL+"/"+PhoneConfig.APP_NAME,obj);
			
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
		
		public function call(callee:String, visibleName:String, isVideoCall:Boolean, inviteParameters:Object):void{
			Logger.info("PhoneServerProxy.call()");
			nc.call("call", responder, callee, visibleName, isVideoCall, null, inviteParameters);
		}
		
		public function callByToken(token:String, isVideoCall:Boolean, inviteParameters:Object):void{
			Logger.info("PhoneServerProxy.callByToken()");
			nc.call("call",responder, null, null, isVideoCall, token,inviteParameters);
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
			}		
		}
		
		public function sendInstantMessage(instantMessage:InstantMessage):void{
			
			var instantMessageObj:Object = new Object();
			instantMessageObj.to=instantMessage.to;
			instantMessageObj.body=instantMessage.body;
			instantMessageObj.contentType=instantMessage.contentType;
			instantMessageObj.id = instantMessage.id;
			
			nc.call("sendInstantMessage",null,instantMessageObj);
		}
		
		public function sendInfo(infoObject:Object):void{
			nc.call("sendInfo", null, infoObject);
		}
		
	}
}
