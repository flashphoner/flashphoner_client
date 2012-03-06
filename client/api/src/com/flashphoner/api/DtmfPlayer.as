package com.flashphoner.api
{
	import com.flashphoner.Logger;
	
	import flash.events.SampleDataEvent;
	import flash.media.Sound;
	import flash.media.SoundChannel;
	import flash.net.URLRequest;
	import flash.utils.ByteArray;
	
	public class DtmfPlayer
	{	
		private static var sampleRate:int = 44100;
		private var dtmfTone:String;
		private var dtmfSound:Sound;
		private var dtmfData:ByteArray;
		
		private static const COL1:Array = [697, 770, 852, 941];
		private static const COL2:Array = [1209, 1336, 1477, 1633];
		private static const DTMF_LAYOUT:Array = [ ["1","2","3","A"] ,
			["4","5","6","B"] ,
			["7","8","9","C"] ,
			["*","0","#","D"] ];
		
		
		public function DtmfPlayer(tone:String)			
		{			
			this.dtmfTone = tone;
			Logger.info("Create DtmfPlayer: "+tone);
		}		
				
		public function play():void {
			Logger.info("play");
			dtmfSound = new Sound();
			dtmfData = generateDTMF(250,dtmfTone);
			dtmfData.position=0;
			dtmfSound.addEventListener(SampleDataEvent.SAMPLE_DATA, playByteArray);
			dtmfSound.play();
		}		
		
		private function playByteArray(e:SampleDataEvent):void
		{
			if (!dtmfData.bytesAvailable > 0)
				return;
			var length:int = 8192; // Change to between 2048 and 8192
			for (var i:int = 0; i < length; i++)
			{
				var sample:Number = 0;
				if (dtmfData.bytesAvailable > 0)
					sample = dtmfData.readFloat();
				e.data.writeFloat(sample);
				e.data.writeFloat(sample);
			}				
		}
		
		private function generateDTMF(length:int, tone:String):ByteArray
		{
			var mySound:ByteArray = new ByteArray();
			var neededSamples:int = Math.floor(length * sampleRate / 1000);
			var mySampleCol:Number = 0;
			var mySampleRow:Number = 0;
			
			var hz:Object = findDTMF(tone.charAt(0));
			
			for (var i:int = 0; i < neededSamples; i++)
			{
				mySampleCol = Math.sin(i * hz.col * Math.PI * 2 / sampleRate) * 0.5;
				mySampleRow = Math.sin(i * hz.row * Math.PI * 2 / sampleRate) * 0.5;
				mySound.writeFloat(mySampleRow + mySampleCol);
				
			}
			Logger.info("Dtmf sound has been generated: "+mySound.length);
			return mySound;
		}
		
		private function findDTMF(tone:String):Object
		{
			var myDTMF:Object = new Object();	
			
			switch(tone)
			{
				case "1":
					myDTMF.col = COL1[0];
					myDTMF.row = COL2[0];
					break;
				case "2":
					myDTMF.col = COL1[0];
					myDTMF.row = COL2[1];
					break;
				case "3":
					myDTMF.col = COL1[0];
					myDTMF.row = COL2[2];
					break;
				case "A":
					myDTMF.col = COL1[0];
					myDTMF.row = COL2[3];
					break;
				case "4":
					myDTMF.col = COL1[1];
					myDTMF.row = COL2[0];
					break;
				case "5":
					myDTMF.col = COL1[1];
					myDTMF.row = COL2[1];
					break;
				case "6":
					myDTMF.col = COL1[1];
					myDTMF.row = COL2[2];
					break;
				case "B":
					myDTMF.col = COL1[1];
					myDTMF.row = COL2[3];
					break;
				case "7":
					myDTMF.col = COL1[2];
					myDTMF.row = COL2[0];
					break;
				case "8":
					myDTMF.col = COL1[2];
					myDTMF.row = COL2[1];
					break;
				case "9":
					myDTMF.col = COL1[2];
					myDTMF.row = COL2[2];
					break;
				case "C":
					myDTMF.col = COL1[2];
					myDTMF.row = COL2[3];
					break;	
				case "*":
					myDTMF.col = COL1[3];
					myDTMF.row = COL2[0];
					break;
				case "0":
					myDTMF.col = COL1[3];
					myDTMF.row = COL2[1];
					break;
				case "#":
					myDTMF.col = COL1[3];
					myDTMF.row = COL2[2];
					break;
				case "D":
					myDTMF.col = COL1[3];
					myDTMF.row = COL2[2];
					break;				
				default:
					myDTMF.col = 0;
					myDTMF.row = 0;
			}
			return myDTMF;
		}
		
	}
}