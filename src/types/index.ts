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
