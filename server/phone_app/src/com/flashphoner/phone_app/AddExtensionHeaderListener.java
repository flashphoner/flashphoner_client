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
package com.flashphoner.phone_app;

import com.flashphoner.sdk.sip.ISipMessageListener;
import com.flashphoner.sdk.softphone.Logger;
import gov.nist.javax.sip.address.SipUri;
import gov.nist.javax.sip.header.RequestLine;
import gov.nist.javax.sip.message.SIPMessage;
import gov.nist.javax.sip.message.SIPRequest;

import javax.sip.message.Request;
import java.text.ParseException;

/**
 * Example of using ISipMessageListener interface.<br/>
 * Adds <code>ConfID=1</code> parameter to Request Line for INVITE requests.
 */
public class AddExtensionHeaderListener implements ISipMessageListener {

    public void processMessage(SIPMessage sipMessage) {
        if (Request.INVITE.equals(sipMessage.getCSeq().getMethod()) && (sipMessage instanceof SIPRequest)) {
            RequestLine requestLine = ((SIPRequest) sipMessage).getRequestLine();
            SipUri uri = (SipUri) requestLine.getUri();
            try {
                uri.setParameter("ConfID", "1");
            } catch (ParseException e) {
                e.printStackTrace();
            }

        }

        Logger.logger.info("AddExtensionHeaderListener processMessage:\n" + sipMessage.toString());
    }
}
