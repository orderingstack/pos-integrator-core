import axios from 'axios';

export enum AlertSeverity {
  DEBUG,
  INFO,
  WARN,
  ERROR,
  CRITICAL,
}

export async function sendAlertMessage(
  accessToken: string,
  message: {
    source: string;
    eventName: string;
    severity: AlertSeverity;
    dateTime?: string;
    user?: string;
    tenant?: string;
    orderId?: string;
    venues?: string[];
    params?: Record<string, string>;
  },
) {
  if (!message.dateTime) message.dateTime = new Date().toISOString();
  try {
    const response = await axios.post(
      `${process.env.BASE_URL}/alert-service/message`,
      message,
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );
    return { data: response.data };
  } catch (error) {
    return {
      data: null,
      error: error,
    };
  }
}