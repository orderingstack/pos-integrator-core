import {
  INotificationMessage,
  IOrder,
  ISteeringCommand,
} from '@orderingstack/ordering-types';
const StompJs = require('@stomp/stompjs');
import sjsc from 'sockjs-client';
import { logger } from './logger';

interface WebsocketConnectParams {
  tenant: string;
  venue: string;
  authDataProviderCallbackAsync: () => Promise<any>;
  onConnectedAsync: (access_token: string) => Promise<void>;
  onDisconnectAsync: () => Promise<void>;
  onMessageAsync: (order: IOrder) => Promise<void>;
  onOrdersUpdateAsync: (order: IOrder) => Promise<void>;
  onNotificationAsync: (message: INotificationMessage) => Promise<void>;
  onSteeringCommandAsync: (cmd: ISteeringCommand) => Promise<void>;
}

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
export async function connectWebSockets({
  tenant,
  venue,
  authDataProviderCallbackAsync,
  onConnectedAsync,
  onDisconnectAsync,
  onMessageAsync,
  onOrdersUpdateAsync,
  onNotificationAsync,
  onSteeringCommandAsync,
}: WebsocketConnectParams) {
  const stompConfig = {
    brokerURL: `${process.env.BASE_URL}/ws`,
    connectHeaders: {
      login: null,
      passcode: null,
    },
    userUUID: null,
    debug: function (a: any) {
      //logger.debug(a);
    },
    reconnectDelay: 20000,
    heartbeatIncoming: 4000,
    heartbeatOutgoing: 4000,

    beforeConnect: async function () {
      const authDataResp = await authDataProviderCallbackAsync();
      if (!authDataResp) {
        logger.error('Access token provider error - deactivating socket');
        client.deactivate();
        return;
      }

      const { access_token, UUID } = authDataResp;
      stompConfig.connectHeaders.login = access_token;
      stompConfig.userUUID = UUID;
    },

    onConnect: async function () {
      const accessToken = stompConfig.connectHeaders.login as unknown as string;
      await onConnectedAsync(accessToken);
      logger.info('Websocket connected.');
      var subscription = client.subscribe(
        `/kds/${tenant}/${venue}`,
        async function (data: any) {
          var message = JSON.parse(data.body);
          await onMessageAsync(message);
        },
      );
      if (onOrdersUpdateAsync) {
        var subscriptionForOrdersUpdate = client.subscribe(
          `/order-changes/${tenant}/${stompConfig.userUUID}`,
          async function (data: any) {
            var message = JSON.parse(data.body);
            await onOrdersUpdateAsync(message);
          },
          {
            'x-venue': venue,
          },
        );
      }
      if (onNotificationAsync) {
        var subscriptionForNotifications = client.subscribe(
          `/notifications/${tenant}/${stompConfig.userUUID}`,
          async function (data: any) {
            var message = JSON.parse(data.body);
            await onNotificationAsync(message);
          },
          {
            'x-venue': venue,
          },
        );
      }
      if (onSteeringCommandAsync) {
        const subscriptionForSteeringCmds = client.subscribe(
          `/steering/${tenant}/${venue}`,
          async function (data: any) {
            var message = JSON.parse(data.body);
            await onSteeringCommandAsync(message);
          },
        );
      }
    },

    onDisconnect: async function () {
      await onDisconnectAsync();
      logger.warn('Websocket disconnected.');
    },

    onStompError: function (frame: any) {
      // Will be invoked in case of error encountered at Broker
      // Bad login/passcode typically will cause an error
      // Complaint brokers will set `message` header with a brief message. Body may contain details.
      // Compliant brokers will terminate the connection after any error
      logger.error('Broker reported error: ' + frame.headers['message']);
      logger.error('Additional details: ' + frame.body);
    },
    onWebSocketClose: function (e: any) {
      logger.info('Websocket closed.');
    },
    onWebSocketError: function (e: any) {
      logger.error('Websocket error.', e);
    },
    onUnhandledMessage: function (m: any) {
      //logger.debug(m);
    },
    logRawCommunication: true,
    discardWebsocketOnCommFailure: true,
  };

  // @ts-ignore
  const client = new StompJs.Client(stompConfig);
  if (typeof WebSocket !== 'function') {
    // Fallback code
    // @ts-ignore
    client.webSocketFactory = () => {
      const ws = sjsc(`${process.env.BASE_URL}/ws`);
      return ws;
    };
  }
  client.activate();
}
