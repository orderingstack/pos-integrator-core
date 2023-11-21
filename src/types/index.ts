import { IOrder } from '@orderingstack/ordering-types';

export interface IOrderRecord {
  id: IOrder['id'];
  created: IOrder['created'];
  orderStatus: IOrder['status'];
  extraData?: string;
  orderbody: ReturnType<typeof JSON.stringify>;
  stage: string;
  isCreatedCentrally?: number;
}
