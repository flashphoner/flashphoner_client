package com.flashphoner.util
{
	import com.flashphoner.Logger;
	
	import flash.events.StatusEvent;
	import flash.events.TimerEvent;
	import flash.media.Microphone;
	import flash.utils.Timer;

	public class CustomDeviceStatusListener
	{
		private var timer:Timer = new Timer(500,0);
		
		private var currentStatus:Boolean;
		
		private var fn:Function;
		
		private var mic:Microphone;
		
		public function CustomDeviceStatusListener()
		{
			timer.addEventListener(TimerEvent.TIMER, timerTick);
		}
		
		public function start(mic:Microphone, fn:Function):void {
			currentStatus = mic.muted;
			this.fn = fn;
			this.mic = mic;
			timer.start();
		}
		
		private function timerTick(event:TimerEvent):void{
			if (currentStatus != mic.muted) {
				Logger.info("current mic muted - " + mic.muted);
				var se:StatusEvent = new StatusEvent(StatusEvent.STATUS, true);
				if (mic.muted) { 
					se.code = "Microphone.Muted";
				} else {
					se.code = "Microphone.Unmuted";
				}
				currentStatus = mic.muted;
				fn.call(null,se);
				
			}
		}	
		
	}
}