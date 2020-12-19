const StompJs = require('@stomp/stompjs');
const sjsc = require('sockjs-client');

/**
 * Create Stomp on websocket connection to Ordering Stack listening for new orders to process by handlers/callback (onMessageAsync)
 * 
 * @param {*} tenant 
 * @param {*} venue 
 * @param {*} accessTokenProviderCallbackAsync function called before connecting to STOMP server. Should return access token.
 * @param {*} _onConnectAsync async function (accessToken) {....}
 * @param {*} _onDisconnectAsync 
 * @param {*} _onMessageAsync async function (message, accessToken) {....}
 */
async function connectWebSockets(tenant, venue, accessTokenProviderCallbackAsync, _onConnectAsync, _onDisconnectAsync, _onMessageAsync) {
    const stompConfig = {
        brokerURL:  `${process.env.BASE_URL}/ws`, 
        connectHeaders: {
            login: null, 
            passcode: null
        },
        debug: function (a) {
            //console.log(a);
        },
        reconnectDelay: 20000,
        heartbeatIncoming: 4000,
        heartbeatOutgoing: 4000,

        beforeConnect: async function () {
            const accessToken = await accessTokenProviderCallbackAsync();
            // if (!accessToken) {
            //     //console.error('Access token provider error - deactivating socket')
            //     //client.deactivate();                
            // }
            stompConfig.connectHeaders.login = accessToken;
        },

        onConnect: async function () {
            const accessToken = stompConfig.connectHeaders.login;
            await _onConnectAsync(accessToken);
            console.log('Websocket connected.');
            var subscription = client.subscribe(`/kds/${tenant}/${venue}`, async function (data) {
                var message = JSON.parse(data.body);
                await _onMessageAsync(message, accessToken);
            });
        },

        onDisconnect: async function () {
            await _onDisconnectAsync();
            console.log('Websocket disconnected.');
        },

        onStompError: function (frame) {
            // Will be invoked in case of error encountered at Broker
            // Bad login/passcode typically will cause an error
            // Complaint brokers will set `message` header with a brief message. Body may contain details.
            // Compliant brokers will terminate the connection after any error
            console.error('Broker reported error: ' + frame.headers['message']);
            console.error('Additional details: ' + frame.body);
        },
        onWebSocketClose: function(e) {
            console.log('Websocket closed.');
            //console.log(e);
        },
        onWebSocketError: function (e){
            console.log('Websocket error.');
            //console.log(e);
        },
        onUnhandledMessage: function(m) {
            //console.log(m);
        },
        logRawCommunication:true,
        discardWebsocketOnCommFailure: true,
    };

    const client = new StompJs.Client(stompConfig);    
    if (typeof WebSocket !== 'function') { // Fallback code
        client.webSocketFactory = () => {
            const ws = sjsc(`${process.env.BASE_URL}/ws`);
            return ws;
        };    
    }
    client.activate();
}

module.exports = {
    connectWebSockets
}

