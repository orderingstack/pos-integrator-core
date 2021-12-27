const StompJs = require('@stomp/stompjs');
const sjsc = require('sockjs-client');

/**
 * Create Stomp on websocket connection to Ordering Stack listening for new orders to process by handlers/callback (onMessageAsync)
 * 
 * @param {*} tenant 
 * @param {*} venue 
 * @param {*} accessTokenProviderCallbackAsync function called before connecting to STOMP server. Should return access token.
 * @param {*} onConnectedAsync async function (accessToken) {....}
 * @param {*} onDisconnectAsync 
 * @param {*} onMessageAsync async function (message, accessToken) {....}
 */
async function connectWebSockets({ tenant, venue, authDataProviderCallbackAsync, onConnectedAsync, onDisconnectAsync, onMessageAsync, onOrdersUpdateAsync, onNotificationAsync, onSteeringCommandAsync }) {
    const stompConfig = {
        brokerURL: `${process.env.BASE_URL}/ws`,        
        connectHeaders: {
            login: null,
            passcode: null
        },
        userUUID: null,
        debug: function (a) {
            //console.log(a);
        },
        reconnectDelay: 20000,
        heartbeatIncoming: 4000,
        heartbeatOutgoing: 4000,

        beforeConnect: async function () {
            const {access_token, UUID} = await authDataProviderCallbackAsync();            
            // if (!accessToken) {
            //     //console.error('Access token provider error - deactivating socket')
            //     //client.deactivate();                
            // }
            stompConfig.connectHeaders.login = access_token;
            stompConfig.userUUID = UUID;
        },

        onConnect: async function () {
            const accessToken = stompConfig.connectHeaders.login;
            await onConnectedAsync(accessToken);
            console.log('Websocket connected.');
            var subscription = client.subscribe(`/kds/${tenant}/${venue}`, async function (data) {
                var message = JSON.parse(data.body);
                await onMessageAsync(message);
            });
            if (onOrdersUpdateAsync) {
                var subscriptionForOrdersUpdate = client.subscribe(`/order-changes/${tenant}/${stompConfig.userUUID}`, async function (data) {
                    var message = JSON.parse(data.body);
                    await onOrdersUpdateAsync(message);
                });
            }
            if (onNotificationAsync) {
                var subscriptionForNotifications = client.subscribe(`/notifications/${tenant}/${stompConfig.userUUID}`, async function (data) {
                    var message = JSON.parse(data.body);
                    await onNotificationAsync(message);
                });
            }
            if (onSteeringCommandAsync) {
                const subscriptionForSteeringCmds = client.subscribe(`/steering/${tenant}/${venue}`, async function (data) {
                    var message = JSON.parse(data.body);
                    await onSteeringCommandAsync(message);
                });
            }
        },

        onDisconnect: async function () {
            await onDisconnectAsync();
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
        onWebSocketClose: function (e) {
            console.log('Websocket closed.');
            //console.log(e);
        },
        onWebSocketError: function (e) {
            console.log('Websocket error.');
            //console.log(e);
        },
        onUnhandledMessage: function (m) {
            //console.log(m);
        },
        logRawCommunication: true,
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

