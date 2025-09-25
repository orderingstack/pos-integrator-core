import {
  INotificationMessage,
  IOrder,
  ISteeringCommand,
} from '@orderingstack/ordering-types';
import { Client, IFrame, Message, ReconnectionTimeMode } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { logger } from './logger';

interface WebsocketConnectParams {
  tenant: string;
  venue: string;
  authDataProviderCallbackAsync: () => Promise<{
    access_token: string;
    UUID: string;
  } | null>;
  onConnectedAsync: (access_token: string) => Promise<void>;
  onDisconnectAsync: () => Promise<void>;
  onMessageAsync: (order: IOrder) => Promise<void>;
  onOrdersUpdateAsync?: (order: IOrder) => Promise<void>;
  onNotificationAsync?: (message: INotificationMessage) => Promise<void>;
  onSteeringCommandAsync?: (cmd: ISteeringCommand) => Promise<void>;
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
export function connectWebSockets({
  tenant,
  venue,
  authDataProviderCallbackAsync,
  onConnectedAsync,
  onDisconnectAsync,
  onMessageAsync,
  onOrdersUpdateAsync,
  onNotificationAsync,
  onSteeringCommandAsync,
}: WebsocketConnectParams): void {
  const config = {
    baseUrl: process.env.BASE_URL,
    reconnectDelay: process.env.WS_RECONNECT_DELAY
      ? parseInt(process.env.WS_RECONNECT_DELAY, 10)
      : 5000,
    maxReconnectDelay: 30000,
    heartbeatIncoming: process.env.WS_HEARTBEAT_INCOMING
      ? parseInt(process.env.WS_HEARTBEAT_INCOMING, 10)
      : 4000,
    heartbeatOutgoing: process.env.WS_HEARTBEAT_OUTGOING
      ? parseInt(process.env.WS_HEARTBEAT_OUTGOING, 10)
      : 4000,
    connectionTimeout: 8000,
    includeVenueHeader: process.env.WS_INCLUDE_VENUE_HEADER === 'true',
  };

  const client = new Client();

  const connectionState = {
    accessToken: '',
    userUUID: '',
  };

  client.configure({
    brokerURL: `${config.baseUrl}/ws`,
    reconnectTimeMode: ReconnectionTimeMode.EXPONENTIAL,
    reconnectDelay: config.reconnectDelay,
    maxReconnectDelay: config.maxReconnectDelay,
    connectionTimeout: config.connectionTimeout,
    heartbeatIncoming: config.heartbeatIncoming,
    heartbeatOutgoing: config.heartbeatOutgoing,
    discardWebsocketOnCommFailure: true,

    debug: (str: string) => {
      // logger.debug(str);
    },

    beforeConnect: async () => {
      try {
        const authData = await authDataProviderCallbackAsync();
        if (!authData) {
          logger.error(
            'Authentication provider did not return data. Deactivating client.',
          );
          await client.deactivate();
          return;
        }

        connectionState.accessToken = authData.access_token;
        connectionState.userUUID = authData.UUID;

        client.connectHeaders = {
          login: connectionState.accessToken,
          passcode: '',
        };
      } catch (error) {
        logger.error('Error during authDataProviderCallbackAsync:', error);
        await client.deactivate();
      }
    },

    onConnect: async (frame: IFrame) => {
      logger.info('Websocket connected.');
      await onConnectedAsync(connectionState.accessToken);

      client.subscribe(`/kds/${tenant}/${venue}`, (message: Message) => {
        onMessageAsync(JSON.parse(message.body));
      });

      const headers = config.includeVenueHeader
        ? { 'x-venue': venue }
        : undefined;

      if (onOrdersUpdateAsync) {
        client.subscribe(
          `/order-changes/${tenant}/${connectionState.userUUID}`,
          (message: Message) => {
            onOrdersUpdateAsync(JSON.parse(message.body));
          },
          headers,
        );
      }
      if (onNotificationAsync) {
        client.subscribe(
          `/notifications/${tenant}/${connectionState.userUUID}`,
          (message: Message) => {
            onNotificationAsync(JSON.parse(message.body));
          },
          headers,
        );
      }
      if (onSteeringCommandAsync) {
        client.subscribe(`/steering/${tenant}/${venue}`, (message: Message) => {
          onSteeringCommandAsync(JSON.parse(message.body));
        });
      }
    },

    onStompError: (frame: IFrame) => {
      // Will be invoked in case of error encountered at Broker
      // Bad login/passcode typically will cause an error
      // Complaint brokers will set `message` header with a brief message. Body may contain details.
      // Compliant brokers will terminate the connection after any error
      logger.error('Broker reported error: ' + frame.headers['message']);
      logger.error('Additional details: ' + frame.body);
    },

    onWebSocketClose: (event: CloseEvent) => {
      logger.warn(
        `Websocket closed. Code: ${event.code}, Reason: ${event.reason}`,
      );
      onDisconnectAsync();
    },

    onWebSocketError: (event: Event) => {
      logger.error('Websocket error.', event);
    },
  });

  if (typeof WebSocket !== 'function') {
    client.webSocketFactory = () => {
      return new SockJS(`${config.baseUrl}/ws`) as WebSocket;
    };
  }

  client.activate();
}
