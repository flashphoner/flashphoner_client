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
package com.flashphoner.c2c_app;

import com.flashphoner.sdk.sip.ISipMessageListener;
import gov.nist.javax.sip.header.CallID;
import gov.nist.javax.sip.message.SIPMessage;

import java.text.ParseException;

/**
 * Example of using ISipMessageListener interface.<br/>
 * Replaces symbol ":" to "AbCdEfGh" for incoming SIP messsages.<br/>
 * Replaces "AbCdEfGh" to symbol ":" for outgoing SIP messages.
 */
public class ChangeCallIdListener implements ISipMessageListener {

    private final String COLON_SUNSTITUTION = "AbCdEfGh";

    public void processMessage(SIPMessage sipMessage) {
        CallID callIdHeader = (CallID) sipMessage.getHeader(CallID.NAME);
        String callId = callIdHeader.getCallId();

        if (callId.indexOf(":") != -1) {
            callId = callId.replaceAll(":", COLON_SUNSTITUTION);
        } else if (callId.indexOf(COLON_SUNSTITUTION) != -1) {
            callId = callId.replaceAll(COLON_SUNSTITUTION, ":");
        }

        try {
            callIdHeader.setCallId(callId);
        } catch (ParseException e) {
            e.printStackTrace();
        }
    }
}
