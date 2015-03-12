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

import com.flashphoner.sdk.rtmp.*;
import com.flashphoner.sdk.sip.request_params.InfoParams;
import com.flashphoner.sdk.softphone.*;
import com.flashphoner.sdk.softphone.exception.CrossCallException;
import com.flashphoner.sdk.softphone.exception.LicenseRestictionException;
import com.flashphoner.sdk.softphone.exception.PortsBusyException;
import com.flashphoner.sdk.softphone.exception.SoftphoneException;
import com.wowza.wms.amf.AMFData;
import com.wowza.wms.amf.AMFDataItem;
import com.wowza.wms.amf.AMFDataList;
import com.wowza.wms.amf.AMFDataObj;
import com.wowza.wms.application.IApplicationInstance;
import com.wowza.wms.client.IClient;
import com.wowza.wms.module.IModuleOnApp;
import com.wowza.wms.module.IModuleOnConnect;
import com.wowza.wms.module.ModuleBase;
import com.wowza.wms.request.RequestFunction;
import gov.nist.javax.sip.SIPConstants;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.w3c.dom.Document;
import org.w3c.dom.Element;

import javax.net.ssl.*;
import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;
import java.io.*;
import java.net.HttpURLConnection;
import java.net.MalformedURLException;
import java.net.URL;
import java.net.URLConnection;
import java.security.KeyManagementException;
import java.security.NoSuchAlgorithmException;
import java.security.cert.X509Certificate;
import java.util.HashMap;
import java.util.Map;

/**
 * Main application class. Default wowza application: flashphoner_app used this class as base. See config <code>conf/flashphoner_app/Application.xml</code>.<br/>
 * FlashPhonerApp handles connects disconnects and serves commands invoked by flash-client.<br/>
 * Flash client uses <code>NetConnection.connect()</code>, <code>NetConnection.call()</code> client-methods.<br/>
 * PhoneApp supports one modes <i>flashphoner</i>.<br/>
 */
public class PhoneApp extends ModuleBase implements IModuleOnConnect, IModuleOnApp, IRtmpClientsCollectionSupport {

    private static Logger log = LoggerFactory.getLogger(PhoneApp.class);

    private static boolean ALLOW_THIRD_PARTY_CONNECTIONS = false;

    static {
        try {
            ALLOW_THIRD_PARTY_CONNECTIONS = Boolean.parseBoolean(ClientConfig.getInstance().getProperty("allow_third_party_connections"));
        } catch (Exception e) {
        }
        log.info("ALLOW_THIRD_PARTY_CONNECTIONS: " + ALLOW_THIRD_PARTY_CONNECTIONS);
    }

    /**
     * Wowza application name. If your use own application name, you should change it here
     */
    public static final String APPLICATION_NAME = "phone_app";

    /**
     * Application instance. Default instance used.
     */
    public static IApplicationInstance instance;

    /**
     * Application starts after receiving first RTMP connect.<br/>
     * It initializes sipAccountsPool during starting.
     *
     * @param appInst
     */
    public void onAppStart(IApplicationInstance appInst) {
        instance = appInst;
        log.info("Initializing sip accounts complete");
    }

    /**
     * Invokes by Wowza server when application has no connected users and timeout has been expired.
     *
     * @param appInst
     */
    public void onAppStop(IApplicationInstance appInst) {

    }

    /**
     * Invokes when client does <code>NetConnection.connect()</code>.<br/>
     * See Wowza documentation API for more info about IClient, RequestFunction, AMFDataList classes.<br/>
     * If mode is <i>flashphoner</i>, Flashphoner creates new internal softphone and register it on VoIP server if <code>register_required=true</code>.<br/>
     *
     * @param client
     * @param requestFunction
     * @param params
     */
    public void onConnect(IClient client, RequestFunction requestFunction, AMFDataList params) {

        // If we are logged by token - we will not send user data to client app, because this is security violation
        boolean loggedByToken = false;
        log.info("onConnect " + params + " clientId: " + client.getClientId());

        /**
         * Looking for THIRD_PARTY_CONNECTION param
         * Example:
         * rtmp://host/phone_app?THIRD_PARTY_CONNECTION=1
         * If the parameter is found in query string, or if it is a netConnection.connect() parameter,
         * then we will authorize this connection.
         * Applicable if we want to broadcast a SIP stream as RTMP stream.
         */
        if (ALLOW_THIRD_PARTY_CONNECTIONS) {

            AMFData amfData = params.get(PARAM1);

            String qString = client.getQueryStr();
            log.info("qString: " + qString);

            if (qString != null && qString.length() != 0 && qString.indexOf("THIRD_PARTY_CONNECTION") != -1) {
                client.acceptConnection();
                return;
            } else {
                if (amfData != null && amfData instanceof AMFDataItem) {
                    String value = amfData.getValue().toString();
                    log.info("THIRD_PARTY_CONNECTION value: " + value);
                    if ("THIRD_PARTY_CONNECTION".equals(value)) {
                        client.acceptConnection();
                        return;
                    }
                }
            }
        }

        if (!isDefaultInstance(client)) {
            client.rejectConnection();
            return;
        }

        /**
         * Example: {Obj[]: app: "phone_app", flashVer: "WIN 11,0,1,152", swfUrl: "http://87.226.225.62/120/flashphoner_client/flashphoner_js_api.swf", tcUrl: "rtmp://87.226.225.62:1935/phone_app", fpad: false, capabilities: 239.0, audioCodecs: 3575.0, videoCodecs: 252.0, videoFunction: 1.0, pageUrl: "http://87.226.225.62/120/flashphoner_client/PhoneJS.html", objectEncoding: 0.0}
         */
        AMFDataObj obj2 = params.getObject(2);

        String swfUrl = obj2.getString("swfUrl");
        String pageUrl = obj2.getString("pageUrl");

        /** ------------------------------------------------
         * WSP-1855 - Problem with pageUrl + Firefox
         * If browser = Firefox, then pageUrlFromJS != 0 and we need use it
         * because default pageUrl not works in Firefox
         */

        AMFDataObj obj3 = params.getObject(3);
        String pageUrlFromJS = obj3.getString("pageUrl");

        if (pageUrlFromJS != null) {
            if (!pageUrlFromJS.equals("") && !pageUrlFromJS.equals("null")) {
                pageUrl = pageUrlFromJS;
                log.info("Client browser is Firefox, pageUrl from JS = " + pageUrlFromJS);
            }
        }
        // ------------------------------------------------

        String allowDomainsString = ClientConfig.getInstance().getProperty("allow_domains");
        log.info("swfUrl: {}, pageUrl: {}, allowDomainsString: {}", new Object[]{swfUrl, pageUrl, allowDomainsString});

        if (allowDomainsString != null && !"".equals(allowDomainsString)) {
            String[] allowDomains = allowDomainsString.split(",");
            Boolean isAllowDomain = false;
            for (String allowDomain : allowDomains) {
                int index = swfUrl.indexOf(allowDomain);
                log.debug("swfUrl.indexOf(allowDomain) {}", index);
                if (index >= 0 && index <= 7) {
                    isAllowDomain = true;
                }
            }
            if (!isAllowDomain) {
                log.info("THIS DOMAIN IS NOT ALLOWED!!!");
                client.rejectConnection();
                client.setShutdownClient(true);
                return;
            }
        }
        String flashVer = obj2.getString("flashVer");
        String[] splat = flashVer.split("\\s");
        String os = splat[0];//WIN
        String version = splat[1];//11,0,1,152
        String[] splat2 = version.split(",");
        int majorMinorVersion = Integer.parseInt(splat2[0] + splat2[1]);//110
        log.info("majorMinorVersion: " + majorMinorVersion);

        AMFDataObj obj = params.getObject(PARAM1);


        if (obj == null) {
            log.info("Connect's parameters are NULL");
            client.rejectConnection();
            client.setShutdownClient(true);
            return;
        }

        int width = obj.getInt("width");
        int height = obj.getInt("height");
        String supportedResolutions = obj.getString("supportedResolutions");


        boolean regRequired = obj.getBoolean("registerRequired");

        IRtmpClient rtmpClient;
        String token = obj.getString("token");
        String outboundProxy;
        String domain = null;
        int port;

        String auto_login_url = ClientConfig.getInstance().getProperty("auto_login_url");
        String authenticationName = obj.getString("authenticationName");
        String login = obj.getString("login");
        String password = obj.getString("password");
        String visibleName = obj.getString("visibleName");

        if (login != null && password != null) {


            outboundProxy = obj.getString("outboundProxy");
            if (outboundProxy == null || "".equals(outboundProxy)) {
                client.rejectConnection();
                return;
            }

            domain = obj.getString("domain");
            if (domain == null || "".equals(domain)) {
                domain = outboundProxy;
                return;
            }
            try {
                port = Integer.parseInt(obj.getString("port"));
            } catch (NumberFormatException ex) {
                port = SIPConstants.DEFAULT_PORT;
            }
        } else {
            loggedByToken = true;

            if (auto_login_url == null) {
                log.error("ERROR - Property auto_login_url - '" + auto_login_url + "' does not exits in flashphoner-client.properties");
                client.rejectConnection();
                client.setShutdownClient(true);
                return;
            }
            URL url;
            StringBuilder response = new StringBuilder();

            try {

                File file = new File(auto_login_url);
                BufferedReader bufferedReader;
                URLConnection conn;

                if (file.exists()) {
                    bufferedReader = new BufferedReader(new InputStreamReader(new FileInputStream(file)));
                } else {
                    url = new URL(auto_login_url + "?token=" + token + "&swfUrl=" + swfUrl + "&pageUrl=" + pageUrl);

                    // We need support of https too.
                    if (auto_login_url.contains("https")) {
                        /*
                       Invoke method, where we override some verifiers to allow us use self-signed certificates.
                       without that we will have errors in case of self-signed certificate.
                        */
                        fixForSelfSignedCertificate();
                        log.debug("Do fix for self-signed certificates");
                        conn = (HttpsURLConnection) url.openConnection();
                    } else {
                        conn = (HttpURLConnection) url.openConnection();
                    }

                    bufferedReader = new BufferedReader(new InputStreamReader(conn.getInputStream()));
                }

                String line;
                while ((line = bufferedReader.readLine()) != null) {
                    response.append(line);
                }
                bufferedReader.close();

                log.info("response from auth server - " + response.toString());
            } catch (MalformedURLException e) {
                log.error("ERROR - '" + auto_login_url + "' is wrong;" + e);
                client.rejectConnection();
                client.setShutdownClient(true);
                return;
            } catch (IOException e) {
                log.error("ERROR - '" + auto_login_url + "' is wrong;" + e);
                client.rejectConnection();
                client.setShutdownClient(true);
                return;
            }
            Document dom;
            DocumentBuilderFactory dbf = DocumentBuilderFactory.newInstance();
            try {
                DocumentBuilder db = dbf.newDocumentBuilder();
                InputStream in = new ByteArrayInputStream(response.toString().getBytes("UTF-8"));
                dom = db.parse(in);
            } catch (Exception e) {
                log.error("ERROR - '" + response.toString() + "' has wrong format;" + e);
                client.rejectConnection();
                client.setShutdownClient(true);
                return;
            }

            Element el = dom.getDocumentElement();

            String temp = el.getAttribute("registered");
            if (!(temp == null || "".equals(temp))) {
                regRequired = Boolean.parseBoolean(temp);
            }

            temp = el.getAttribute("authenticationName");
            if (!(temp == null || "".equals(temp))) {
                authenticationName = temp;
            }

            login = el.getAttribute("login");
            if (login == null || "".equals(login)) {
                log.error("ERROR - '" + response.toString() + "' has wrong format;");
            }
            password = el.getAttribute("password");
            if (password == null || "".equals(password)) {
                log.error("ERROR - '" + response.toString() + "' has wrong format;");
            }

            visibleName = el.getAttribute("visibleName");

            outboundProxy = el.getAttribute("outboundProxy");

            if (outboundProxy == null || "".equals(outboundProxy)) {
                log.error("ERROR - '" + response.toString() + "' has wrong format;");
                client.rejectConnection();
                client.setShutdownClient(true);
                return;
            }

            String portString = el.getAttribute("port");
            if (portString == null || "".equals(portString)) {
                port = SIPConstants.DEFAULT_PORT;
            } else {
                try {
                    port = Integer.parseInt(portString);
                } catch (NumberFormatException ex) {
                    port = SIPConstants.DEFAULT_PORT;
                }
            }

            domain = el.getAttribute("domain");

        }
        log.info("outboundProxy - " + outboundProxy);


        if (visibleName == null || "".equals(visibleName)) {
            visibleName = login;
        }

        RtmpClientConfig config = new RtmpClientConfig();
        config.setLogin(login);
        config.setAuthenticationName(authenticationName);
        config.setPassword(password);
        config.setDomain(domain);
        config.setOutboundProxy(outboundProxy);
        config.setPort(port);

        config.setVisibleName(visibleName);
        config.setRegRequired(regRequired);
        config.setApplicationName(APPLICATION_NAME);
        config.setWidth(width);
        config.setHeight(height);
        config.setSupportedResolutions(supportedResolutions);
        config.setMajorMinorPlayerVersion(majorMinorVersion);
        config.setSwfUrl(swfUrl);
        config.setPageUrl(pageUrl);

        log.info(config.toString());

        rtmpClient = new RtmpClient(config, client);

        AMFDataObj amfDataObj = new AMFDataObj();
        amfDataObj.put("login", config.getLogin());

        /* If we login by token - we will not send other user data except user login.
        But user login we MUST send, because it need for flash client to parse incoming stream.
        If we will not send login - it will raise bug here. (we will can`t hear incoming stream on flash side)
        */

        if (!loggedByToken) {
            if (config.getAuthenticationName() != null) {
                amfDataObj.put("authenticationName", config.getAuthenticationName());
            }
            amfDataObj.put("password", config.getPassword());
            amfDataObj.put("domain", config.getDomain());
            amfDataObj.put("outboundProxy", config.getOutboundProxy());
            amfDataObj.put("port", config.getPort());
            amfDataObj.put("regRequired", regRequired);
        }

        client.call("getUserData", null, amfDataObj);

        getRtmpClients().add(rtmpClient);

        log.info("getRtmpClients " + getRtmpClients());

        client.acceptConnection();

        client.call("getVersion", null, Config.getInstance().getVersion());

    }

    /**
     * This method invoked when flash-client disconnects from wowza server.<br/>
     * Flashphoner sends unregister request if it registered.
     *
     * @param client
     */
    public void onDisconnect(IClient client) {
        log.info("Disconnect client: " + client.getClientId());
        if (!isDefaultInstance(client)) {
            return;
        }

        IRtmpClient rtmpClientByClient = getRtmpClients().findByClient(client);
        if (rtmpClientByClient != null) {
            log.info("Shutdown RtmpClient: " + rtmpClientByClient.getRtmpClientConfig().getLogin());
            IRtmpClient rtmpClient = getRtmpClients().remove(rtmpClientByClient);
            ISoftphone softphone = rtmpClient.getSoftphone();
            if (softphone != null) {
                try {
                    softphone.release();
                } catch (Exception e) {
                    log.error("Can not release softphone! Possible leak", e);
                }
            }
            //release sip account in pool
            log.info("Release sip account in pool: " + rtmpClient.getRtmpClientConfig().getLogin());
        }
    }

    /**
     * Flashphoner uses default application instance.<br/>
     * If you would like to connect with another instance, you should do this in the onConnect method:
     * <p>
     * <code>
     * if (!isDefaultInstance(client)) {
     * client.acceptConnection();
     * return;
     * }
     * </code>
     * </p>
     * Note, that this is security leak. Do not use this behavior in production.<br/>
     * isDefaultInstance method just checks if application instance which client trying to connect is default.
     *
     * @param client
     * @return
     */
    private boolean isDefaultInstance(IClient client) {
        log.info("checking instance " + client.getAppInstance().getName());
        return client.getAppInstance().getName().equals("_definst_");
    }

    /**
     * Invokes after the connect accepted
     *
     * @param iClient
     */
    public void onConnectAccept(IClient iClient) {

    }

    /**
     * Invokes after the connect rejected
     *
     * @param iClient
     */
    public void onConnectReject(IClient iClient) {

    }

    /**
     * Retrieves reference to collection of IRtmpClient instances
     *
     * @return IRtmpClientsCollection
     */
    public IRtmpClientsCollection getRtmpClients() {
        return RtmpClients.getInstance();
    }

    /**
     * Sends DTMF message, where PARAM1 is DTMF and PARAM2 is callId, which DTMF addressed.<br/>
     * See <code>NetConnection.call("sendDtmf")</code> in flash-client.
     *
     * @param client
     * @param requestFunction
     * @param params
     */
    public void sendDtmf(IClient client, RequestFunction requestFunction, AMFDataList params) {
        String dtmf = params.getString(PARAM1);
        String callId = params.getString(PARAM2);
        log.info("Send DTMF: " + dtmf);
        if ((dtmf != null) && (dtmf.length() != 0)) {
            IRtmpClient rtmpClient = getRtmpClients().findByClient(client);
            try {
                rtmpClient.getSoftphone().sendDtmf(callId, dtmf);
            } catch (SoftphoneException e) {
                log.error("Can not send DTMF", e);
            }
        }
    }

    /**
     * Creates outgoing call using PARAM1 - visibleName, PARAM3 - isVideoCall.<br/>
     * See <code>NetConnection.call("call")</code> in flash-client.
     *
     * @param client
     * @param requestFunction
     * @param params
     */
    public void call(IClient client, RequestFunction requestFunction, AMFDataList params) {
        log.info("call " + params);
        IRtmpClient rtmpClient = getRtmpClients().findByClient(client);

        String caller = rtmpClient.getRtmpClientConfig().getLogin();
        String callee = params.getString(PARAM1);
        String visibleName = params.getString(PARAM2);
        Boolean isVideoCall = params.getBoolean(PARAM3);
        String token = params.getString(PARAM4);
        AMFData inviteParametersObj = params.get(PARAM5);

        Map<String, String> inviteParameters = null;
        if (inviteParametersObj != null && (inviteParametersObj instanceof AMFDataObj)) {
            AMFDataObj inviteParametersDataObj = (AMFDataObj) inviteParametersObj;
            if (inviteParametersDataObj.size() > 0) {
                inviteParameters = new HashMap<String, String>();
                for (Object temp : inviteParametersDataObj.getKeys()) {
                    String key = (String) temp;
                    inviteParameters.put(key, inviteParametersDataObj.getString(key));
                }

            }
        }

        if (token != null && !"null".equals(token)) {
            String[] data = getCalleeByToken(token, rtmpClient.getRtmpClientConfig().getSwfUrl(), rtmpClient.getRtmpClientConfig().getPageUrl());
            callee = data[0];
            visibleName = rtmpClient.getRtmpClientConfig().getVisibleName();
        }
        if (callee == null || "".equals(callee)) {
            rtmpClient.fail(ErrorCodes.CALLEE_NAME_IS_NULL, null);
            return;
        }

        if ((visibleName == null) || (visibleName.length() == 0)) {
            visibleName = rtmpClient.getRtmpClientConfig().getLogin();
        }

        ISoftphoneCall call;

        try {

            call = rtmpClient.getSoftphone().call(caller, callee, visibleName, isVideoCall, inviteParameters);

        } catch (LicenseRestictionException e) {
            log.info(e.getMessage());
            return;
        } catch (PortsBusyException e) {
            rtmpClient.fail(ErrorCodes.MEDIA_PORTS_BUSY, null);
            return;
        } catch (SoftphoneException e) {
            Throwable cause = e.getCause();
            if ((cause != null) && (cause instanceof CrossCallException)) {
                log.info("Cross call has been detected caller=" + caller + " callee=" + callee);
            } else {
                log.error("Softphone error", e);
            }
            return;
        }

        ModuleBase.sendResult(client, params, call.toAMFDataObj());
    }

    private String[] getCalleeByToken(String token, String swfUrl, String pageUrl) {

        String getCalleeUrl = ClientConfig.getInstance().getProperty("get_callee_url");

        if (getCalleeUrl == null) {
            log.error("ERROR - Property get_callee_url - '" + getCalleeUrl + "' does not exits in flashphoner-client.properties");
            return null;
        }

        URL url;
        StringBuilder response = new StringBuilder();

        try {
            File file = new File(getCalleeUrl);
            BufferedReader bufferedReader;
            URLConnection conn;

            if (file.exists()) {
                bufferedReader = new BufferedReader(new InputStreamReader(new FileInputStream(file)));
            } else {
                url = new URL(getCalleeUrl + "?token=" + token + "&swfUrl=" + swfUrl + "&pageUrl=" + pageUrl);

                // We need support of https too.
                if (getCalleeUrl.contains("https")) {
                    /*
                     Invoke method, where we override some verifiers to allow us use self-signed certificates.
                     without that we will have errors in case of self-signed certificate.
                      */
                    fixForSelfSignedCertificate();
                    log.info("--- fixForSelfSignedCertificate ---");
                    conn = (HttpsURLConnection) url.openConnection();
                } else {
                    conn = (HttpURLConnection) url.openConnection();
                }

                /*
                WSP-1667 - auto-login not work.
                This parameters imitate browser request, because some servers do not allow java make requests.
                 */
                conn.addRequestProperty("User-Agent", "Mozilla/4.0 (compatible; MSIE 6.0; Windows NT 5.0)");
                bufferedReader = new BufferedReader(new InputStreamReader(conn.getInputStream()));
            }

            String line;
            while ((line = bufferedReader.readLine()) != null) {
                response.append(line);
            }

            bufferedReader.close();
            log.info("response from get_callee_url - " + response.toString());

            Document dom;
            DocumentBuilderFactory dbf = DocumentBuilderFactory.newInstance();
            try {
                DocumentBuilder db = dbf.newDocumentBuilder();
                InputStream in = new ByteArrayInputStream(response.toString().getBytes("UTF-8"));
                dom = db.parse(in);
            } catch (Exception e) {
                log.error("ERROR - '" + response.toString() + "' has wrong format;" + e);
                return null;
            }

            Element el = dom.getDocumentElement();

            String[] data = new String[1];
            String temp = el.getAttribute("account");
            if (!(temp == null || "".equals(temp))) {
                data[0] = temp;
            }
            return data;

        } catch (MalformedURLException e) {
            log.error("ERROR - '" + getCalleeUrl + "' is wrong;" + e);
            return null;
        } catch (IOException e) {
            log.error("ERROR - '" + getCalleeUrl + "' is wrong;" + e);
            return null;
        }
    }

    /**
     * Answer incoming call, PARAM1 - callId, PARAM2 - isVideoCall.<br/>
     * See <code>NetConnection.call("answer")</code> in flash-client.
     *
     * @param client
     * @param requestFunction
     * @param params
     */
    public void answer(IClient client, RequestFunction requestFunction, AMFDataList params) {
        log.info("answer " + params);
        String callId = params.getString(PARAM1);
        Boolean isVideoCall = params.getBoolean(PARAM2);
        IRtmpClient rtmpClient = getRtmpClients().findByClient(client);
        try {
            rtmpClient.getSoftphone().answer(callId, isVideoCall);
        } catch (SoftphoneException e) {
            log.error("Can not answer the call", e);
        }
    }

    /**
     * Updates call session to video.<br/>
     * PARAM1 - callId.<br/>
     * See <code>NetConnection.call("updateCallToVideo")</code> in flash-client.
     *
     * @param client
     * @param requestFunction
     * @param params
     */
    public void updateCallToVideo(IClient client, RequestFunction requestFunction, AMFDataList params) {
        log.info("updateCallToVideo " + params);
        String callId = params.getString(PARAM1);
        IRtmpClient rtmpClient = getRtmpClients().findByClient(client);
        try {
            rtmpClient.getSoftphone().updateCallToVideo(callId);
        } catch (SoftphoneException e) {
            log.error("Can not update call to video", e);
        }
    }

    /**
     * Transfer call.<br/>
     * PARAM1 - callId.<br/>
     * PARAM2 - callee.<br/>
     * See <code>NetConnection.call("transfer")</code> in flash-client.
     *
     * @param client
     * @param requestFunction
     * @param params
     */
    public void transfer(IClient client, RequestFunction requestFunction, AMFDataList params) {
        log.info("transfer " + params);
        String callId = params.getString(PARAM1);
        String callee = params.getString(PARAM2);
        IRtmpClient rtmpClient = getRtmpClients().findByClient(client);
        try {
            rtmpClient.getSoftphone().transfer(callId, callee);
        } catch (SoftphoneException e) {
            log.error("Can not transfer call", e);
        }
    }

    /**
     * Transfer call.<br/>
     * PARAM1 - callId.<br/>
     * PARAM2 - isHold.<br/>
     * See <code>NetConnection.call("hold")</code> in flash-client.
     *
     * @param client
     * @param requestFunction
     * @param params
     */
    public void hold(IClient client, RequestFunction requestFunction, AMFDataList params) {
        log.info("hold " + params);
        String callId = params.getString(PARAM1);
        Boolean isHold = params.getBoolean(PARAM2);
        IRtmpClient rtmpClient = getRtmpClients().findByClient(client);
        try {
            rtmpClient.getSoftphone().hold(callId, isHold);
        } catch (SoftphoneException e) {
            log.error("Can not hold call", e);
        }
    }

    /**
     * Hangup call.<br/>
     * PARAM1 - callId.<br/>
     * See <code>NetConnection.call("hangup")</code> in flash-client.
     *
     * @param client
     * @param requestFunction
     * @param params
     */
    public void hangup(IClient client, RequestFunction requestFunction, AMFDataList params) {
        log.info("hangup " + params);
        String callId = params.getString(PARAM1);
        IRtmpClient rtmpClient = getRtmpClients().findByClient(client);
        try {
            rtmpClient.getSoftphone().hangup(callId);
        } catch (SoftphoneException e) {
            log.error("Can not hangup call", e);
        }
    }

    public void sendInstantMessage(IClient client, RequestFunction requestFunction, AMFDataList params) {
        IRtmpClient rtmpClient = getRtmpClients().findByClient(client);

        AMFDataObj obj = params.getObject(PARAM1);

        InstantMessage instantMessage = new InstantMessage();
        instantMessage.setBody(obj.getString("body"));
        instantMessage.setContentType(obj.getString("contentType"));
        instantMessage.setTo(obj.getString("to"));
        instantMessage.setId(obj.getString("id"));

        try {
            rtmpClient.getSoftphone().sendInstantMessage(instantMessage);
        } catch (SoftphoneException e) {
            log.error("Can not send instant message", e);
        }
    }

    public void sendInfo(IClient client, RequestFunction requestFunction, AMFDataList params) {
        IRtmpClient rtmpClient = getRtmpClients().findByClient(client);
        AMFDataObj obj = params.getObject(PARAM1);
        InfoParams infoParams = new InfoParams(obj.getString("contentType"), obj.getString("body"), obj.getString("callId"));
        try {
            rtmpClient.getSoftphone().sendInfo(infoParams);
        } catch (SoftphoneException e) {
            log.error("Can not send info", e);
        }
    }

    public void keepAlive(IClient client, RequestFunction requestFunction, AMFDataList params) {
        log.debug("keepAlive");
        sendResult(client, params, 1);
    }


    /**
     * That method override some methods, and allow us use even self-signed certificates
     * from site where are placed account.xml and callee.xml.
     * Else we would need add every new self-signed certificate to our JRE.
     * To avoid this, we override some methods and avoid checking certificate for reliability.
     * That is less secure but more convenient.
     * Doing this, we mean that we will place account.xml and callee.xml only on our own sites.
     * and we trust that certificate. We just want traffic be encrypted.
     */

    public static void fixForSelfSignedCertificate() {

        TrustManager[] trustAllCerts = new TrustManager[]{
                new X509TrustManager() {
                    public java.security.cert.X509Certificate[] getAcceptedIssuers() {
                        return null;
                    }

                    public void checkClientTrusted(X509Certificate[] certs, String authType) {
                    }

                    public void checkServerTrusted(X509Certificate[] certs, String authType) {
                    }

                }
        };

        try {

            SSLContext sc = SSLContext.getInstance("SSL");
            sc.init(null, trustAllCerts, new java.security.SecureRandom());
            HttpsURLConnection.setDefaultSSLSocketFactory(sc.getSocketFactory());

        } catch (NoSuchAlgorithmException e) {
            System.out.println("NoSuchAlgorithmException: " + e);
        } catch (KeyManagementException e) {
            System.out.println("KeyManagementException: " + e);
        }

        // Create all-trusting host name verifier
        HostnameVerifier allHostsValid = new HostnameVerifier() {
            public boolean verify(String hostname, SSLSession session) {
                return true;
            }
        };
        // Install the all-trusting host verifier
        HttpsURLConnection.setDefaultHostnameVerifier(allHostsValid);
        /*
        * end of the fix
        */
    }

    // WSP-1869
    public void setProperty(IClient client, RequestFunction requestFunction, AMFDataList params) {

        IRtmpClient rtmpClient = getRtmpClients().findByClient(client);
        AMFDataObj obj = params.getObject(PARAM1);
        String key = obj.getString("key");
        String value = obj.getString("value");

        log.info("setProperty: key = " + key + ", value = " + value);
        rtmpClient.getRtmpClientConfig().setProperty(key, value);

    }

}
