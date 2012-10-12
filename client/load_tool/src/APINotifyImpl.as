package 
{
	import com.flashphoner.api.Call;
	import com.flashphoner.api.Flash_API;
	import com.flashphoner.api.data.ErrorCodes;
	import com.flashphoner.api.data.PhoneConfig;
	import com.flashphoner.api.interfaces.APINotify;
	
	import flash.events.TimerEvent;
	import flash.utils.Timer;
	
	import mx.controls.Alert;
	import mx.core.Application;
	
	/**
	 * Implementation APINotify for handler events
	 * Class received event and add his to log view
	 **/	
	public class APINotifyImpl implements APINotify
	{
		private var flashAPI:Flash_API;
		private var answerTimer:Timer;		
		private var hangupTimer:Timer;

		public function APINotifyImpl()
		{
		}
		
		public function setAPI(flash:Flash_API){
			this.flashAPI = flash;
		}
		
		public function notifyCloseConnection():void{
			Application.application.logs += flashAPI.modelLocator.login+" - closed connection\n";
		}

		public function notifyConnected():void{
			Application.application.logs += flashAPI.modelLocator.login+" is connected\n";
		}

		public function notifyRegistered(_sipObject:Object):void{
			Application.application.logs += flashAPI.modelLocator.login+" is registered\n";			
		}
		
		public function notifyCallbackHold(call:Call,isHold:Boolean):void{
		}
		
		public function notify(call:Call,_sipObject:Object):void{
			Application.application.logs += flashAPI.modelLocator.login+"; callId:"+call.id+"; state:"+call.state+"\n";			
		}

		public function notifyCost(call:Call,cost:Number):void{
		}
		
		public function notifyBalance(balance:Number,_sipObject:Object):void{
		}

		public function notifyError(error:String,_sipObject:Object=null):void{
			if (error == ErrorCodes.CONNECTION_ERROR){				
				Application.application.logs += flashAPI.modelLocator.login+" - ErrorCodes.CONNECTION_ERROR\n";			
			} else if (error == ErrorCodes.AUTHENTICATION_FAIL){				
				Application.application.logs += flashAPI.modelLocator.login+" - ErrorCodes.AUTHENTICATION_FAIL\n";
				flashAPI.logoff();
			} else if (error == ErrorCodes.USER_NOT_AVAILABLE){
				Application.application.logs += flashAPI.modelLocator.login+" - ErrorCodes.USER_NOT_AVAILABLE\n";	
			} else if (error==ErrorCodes.TOO_MANY_REGISTER_ATTEMPTS){
				Application.application.logs += flashAPI.modelLocator.login+" - ErrorCodes.TOO_MANY_REGISTER_ATTEMPTS\n";;
				flashAPI.logoff();
			} else if (error==ErrorCodes.LICENSE_RESTRICTION){
				Application.application.logs += flashAPI.modelLocator.login+" - ErrorCodes.LICENSE_RESTRICTION\n";;
				flashAPI.logoff();
			} else if (error==ErrorCodes.INTERNAL_SIP_ERROR){
				Application.application.logs += flashAPI.modelLocator.login+" - ErrorCodes.INTERNAL_SIP_ERROR\n";;
			} else if (error == ErrorCodes.REGISTER_EXPIRE){
				Application.application.logs += flashAPI.modelLocator.login+" - ErrorCodes.REGISTER_EXPIRE\n";;	
			} else if (error == ErrorCodes.SIP_PORTS_BUSY){
				Application.application.logs += flashAPI.modelLocator.login+" - ErrorCodes.SIP_PORTS_BUSY\n";;
				flashAPI.logoff();
			} else if (error == ErrorCodes.MEDIA_PORTS_BUSY){
				Application.application.logs += flashAPI.modelLocator.login+" - ErrorCodes.MEDIA_PORTS_BUSY\n";;
			} else if (error == ErrorCodes.WRONG_SIPPROVIDER_ADDRESS){
				Application.application.logs += flashAPI.modelLocator.login+" - ErrorCodes.WRONG_SIPPROVIDER_ADDRESS\n";;
				flashAPI.logoff();
			}			
		}
		
		public function notifyVideoFormat(call:Call,_sipObject:Object = null):void{
		}
		
		public function notifyOpenVideoView(isViewed:Boolean):void{
		}
		
		public function notifyMessage(messageObject:Object):void{
		}		
		
		public function notifyAddCall(call:Call):void{
			Application.application.logs += flashAPI.modelLocator.login+"; add callId:"+call.id+"; incomming from:"+call.caller+"\n";
		}
		
		public function notifyRemoveCall(call:Call):void{
			Application.application.logs += flashAPI.modelLocator.login+"; remove callId:"+call.id+"; incomming from:"+call.caller+"\n";
		}		
		
		public function addLogMessage(message:String):void{
			
		}
		
		public function notifyVersion(version:String):void{
			
		}
		
		

			
		
	}
}