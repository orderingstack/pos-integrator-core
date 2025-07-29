import { IOrder } from '@orderingstack/ordering-types';

export interface IOrderRecord {
  id: IOrder['id'];
  checkSeq?: string | null;
  isCreatedCentrally: number;
  created: IOrder['created'];
  processedLocally: number | null;
  processedLocallyAt?: string;
  processLocallyNumOfFails: number;
  processedCentrally: number | null;
  processedCentrallyAt?: string;
  processCentrallyNumOfFails: number;
  orderbody: ReturnType<typeof JSON.stringify>;
  orderStatus: IOrder['status'];
  extraData?: string;
  stage: string;
  stageUpdatedAt?: string;
  nextStageRunAt: string;
}

export type OrderRecordEditableParams = Partial<
  Pick<
    IOrderRecord,
    | 'stage'
    | 'checkSeq'
    | 'isCreatedCentrally'
    | 'processedLocally'
    | 'processedCentrally'
  >
>;

export interface GetDeviceCodeResponse {
  user_code: string;
  device_code: string;
  interval: number;
  verification_uri_complete: string;
  verification_uri: string;
  expires_in: number;
}

export interface ModuleConfig {
  id: string;
  type: string;
  production: boolean;
  venue: string;
  config: Record<string, any>;
  extra: Record<string, any>;
}

export interface PollForTokenResponseSuccess {
  access_token: string;
  refresh_token: string;
  scope: string;
  token_type: string;
  UUID: string;
  expires_in: number;
  TENANT: string;
  TRUST: string;
}

export interface PollForTokenResponsePending {
  error: 'authorization_pending' | 'slow_down';
  error_uri: string;
}

export type PollForTokenResponse =
  | PollForTokenResponseSuccess
  | PollForTokenResponsePending;

export interface AuthData {
  access_token: string;
  refresh_token: string;
  scope: string;
  MFA?: string;
  token_type: string;
  UUID: string;
  expires_in: number;
  TENANT: string;
  TRUST: string;
}
