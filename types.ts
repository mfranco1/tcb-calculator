
export enum BhutaniRiskZone {
  High = 'High Risk Zone',
  HighIntermediate = 'High Intermediate Risk Zone',
  LowIntermediate = 'Low Intermediate Risk Zone',
  Low = 'Low Risk Zone',
  NotApplicable = 'Not Applicable',
}

export interface CalculationInput {
  birthDateTime: string;
  measurementDateTime: string;
  tcbValue: number;
  gestationalWeeks: number;
  gestationalDays: number;
  hasRiskFactors: boolean;
}

export type ThresholdStatus = 'ABOVE' | 'BELOW' | 'WITHIN' | 'N/A';

export interface ThresholdResult {
  status: ThresholdStatus;
  threshold: number | string;
}

export interface CalculationResult {
  dob: string;
  tob: string;
  hol: number;
  tcb: number;
  aog: string;
  bhutaniZone: BhutaniRiskZone;
  phototherapy: ThresholdResult;
  exchangeTransfusion: ThresholdResult;
}
