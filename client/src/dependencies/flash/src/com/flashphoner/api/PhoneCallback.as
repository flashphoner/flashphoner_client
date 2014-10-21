package com.flashphoner.api
{
	public class PhoneCallback
	{
		private var flashAPI:FlashAPI;
		public function PhoneCallback(flashAPI:FlashAPI)
		{
			this.flashAPI = flashAPI; 
		}
		
		public function ping():void{
			this.flashAPI.pong();
		}
	}
}