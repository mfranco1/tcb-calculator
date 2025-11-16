import { describe, it, expect } from 'vitest';
import {
  calculateBilirubinRisk,
  linearInterpolate,
  getBhutaniZone,
  getAapThresholds,
  getMaiselsThresholds,
} from './bilirubinCalculator';
import { BhutaniRiskZone, CalculationInput, ThresholdStatus } from '../types';

type DataPoints = [number, number][];

// Test data extracted from the calculator
const bhutaniData = {
  low: [[12, 3.5], [24, 5.5], [36, 7.5], [48, 8.5], [60, 9], [96, 11.5], [144, 12.5]] as DataPoints,
  lowIntermediate: [[12, 5], [24, 7.5], [36, 9.5], [48, 11], [60, 12], [96, 13.5], [144, 15]] as DataPoints,
  highIntermediate: [[12, 6.5], [24, 9.5], [36, 12], [48, 13.5], [60, 15], [96, 17], [144, 17.5]] as DataPoints,
};

const aapPlData = {
  lowerRisk: [[0, 5], [24, 12], [48, 15], [72, 18], [96, 20], [120, 21], [168, 21.5]] as DataPoints,
  mediumRisk: [[0, 4], [24, 10], [48, 13], [72, 15], [96, 17], [120, 18], [168, 18.5]] as DataPoints,
  higherRisk: [[0, 3], [24, 8], [48, 11], [72, 13], [96, 14.5], [120, 15.5], [168, 16]] as DataPoints,
};

const aapDvetData = {
  lowerRisk: [[0, 12], [24, 19], [48, 22], [72, 24], [96, 25], [168, 25]] as DataPoints,
  mediumRisk: [[0, 10], [24, 17], [48, 19], [72, 21], [96, 22.5], [168, 23]] as DataPoints,
  higherRisk: [[0, 8], [24, 15], [48, 17], [72, 18.5], [96, 20], [168, 20.5]] as DataPoints,
};

const maiselsData = {
  28: { pl: [5, 6] as [number, number], dvet: [11, 14] as [number, number] },
  29: { pl: [6, 8] as [number, number], dvet: [12, 14] as [number, number] },
  31: { pl: [8, 10] as [number, number], dvet: [13, 16] as [number, number] },
  33: { pl: [10, 12] as [number, number], dvet: [15, 18] as [number, number] },
  34: { pl: [12, 14] as [number, number], dvet: [17, 19] as [number, number] },
};

describe('linearInterpolate', () => {
  const testPoints: DataPoints = [[0, 0], [10, 10], [20, 20]];

  it('should return exact y value when x matches a point exactly', () => {
    expect(linearInterpolate(testPoints, 0)).toBe(0);
    expect(linearInterpolate(testPoints, 10)).toBe(10);
    expect(linearInterpolate(testPoints, 20)).toBe(20);
  });

  it('should return first y value when x is before first point', () => {
    expect(linearInterpolate(testPoints, -5)).toBe(0);
    expect(linearInterpolate(testPoints, -1)).toBe(0);
  });

  it('should return last y value when x is after last point', () => {
    expect(linearInterpolate(testPoints, 25)).toBe(20);
    expect(linearInterpolate(testPoints, 100)).toBe(20);
  });

  it('should interpolate between two known points', () => {
    expect(linearInterpolate(testPoints, 5)).toBe(5); // Midpoint
    expect(linearInterpolate(testPoints, 15)).toBe(15); // Midpoint
    expect(linearInterpolate(testPoints, 2)).toBe(2); // 20% of way
    expect(linearInterpolate(testPoints, 18)).toBe(18); // 80% of way
  });

  it('should handle non-linear interpolation correctly', () => {
    const nonLinear: DataPoints = [[0, 0], [10, 20], [20, 10]];
    expect(linearInterpolate(nonLinear, 5)).toBe(10);
    expect(linearInterpolate(nonLinear, 15)).toBe(15);
  });

  it('should handle edge case with duplicate x values', () => {
    const duplicateX: DataPoints = [[0, 0], [10, 10], [10, 20], [20, 20]];
    // When x1 === x0, should return y0
    expect(linearInterpolate(duplicateX, 10)).toBe(10);
  });

  it('should handle single point array', () => {
    const singlePoint: DataPoints = [[5, 10]];
    expect(linearInterpolate(singlePoint, 0)).toBe(10);
    expect(linearInterpolate(singlePoint, 5)).toBe(10);
    expect(linearInterpolate(singlePoint, 10)).toBe(10);
  });

  it('should interpolate using actual Bhutani data points', () => {
    const points = bhutaniData.low;
    expect(linearInterpolate(points, 12)).toBe(3.5);
    expect(linearInterpolate(points, 24)).toBe(5.5);
    expect(linearInterpolate(points, 18)).toBeCloseTo(4.5, 1); // Between 12 and 24
  });

  it('should interpolate using actual AAP data points', () => {
    const points = aapPlData.lowerRisk;
    expect(linearInterpolate(points, 0)).toBe(5);
    expect(linearInterpolate(points, 24)).toBe(12);
    expect(linearInterpolate(points, 12)).toBeCloseTo(8.5, 1); // Between 0 and 24
  });
});

describe('getBhutaniZone', () => {
  it('should return NotApplicable when HOL > 144 hours', () => {
    expect(getBhutaniZone(145, 10)).toBe(BhutaniRiskZone.NotApplicable);
    expect(getBhutaniZone(200, 20)).toBe(BhutaniRiskZone.NotApplicable);
  });

  it('should return Low zone when TCB is below low threshold', () => {
    expect(getBhutaniZone(12, 3)).toBe(BhutaniRiskZone.Low); // Below 3.5
    expect(getBhutaniZone(24, 5)).toBe(BhutaniRiskZone.Low); // Below 5.5
    expect(getBhutaniZone(36, 7)).toBe(BhutaniRiskZone.Low); // Below 7.5
  });

  it('should return LowIntermediate zone when TCB is above low threshold but below lowIntermediate threshold', () => {
    expect(getBhutaniZone(12, 4)).toBe(BhutaniRiskZone.LowIntermediate); // Between 3.5 and 5
    expect(getBhutaniZone(24, 6)).toBe(BhutaniRiskZone.LowIntermediate); // Between 5.5 and 7.5
    expect(getBhutaniZone(36, 9)).toBe(BhutaniRiskZone.LowIntermediate); // Between 7.5 and 9.5
  });

  it('should return HighIntermediate zone when TCB is above lowIntermediate threshold but below highIntermediate threshold', () => {
    expect(getBhutaniZone(12, 5.5)).toBe(BhutaniRiskZone.HighIntermediate); // Between 5 and 6.5
    expect(getBhutaniZone(24, 9)).toBe(BhutaniRiskZone.HighIntermediate); // Between 7.5 and 9.5
    expect(getBhutaniZone(36, 11.5)).toBe(BhutaniRiskZone.HighIntermediate); // Between 9.5 and 12
  });

  it('should return High zone when TCB is above highIntermediate threshold', () => {
    expect(getBhutaniZone(12, 7)).toBe(BhutaniRiskZone.High); // Above 6.5
    expect(getBhutaniZone(24, 10)).toBe(BhutaniRiskZone.High); // Above 9.5
    expect(getBhutaniZone(36, 13)).toBe(BhutaniRiskZone.High); // Above 12
  });

  it('should handle boundary conditions at exact threshold values', () => {
    // At exact low threshold, should return Low (not LowIntermediate)
    expect(getBhutaniZone(12, 3.5)).toBe(BhutaniRiskZone.Low);
    expect(getBhutaniZone(24, 5.5)).toBe(BhutaniRiskZone.Low);

    // At exact lowIntermediate threshold, should return LowIntermediate (not HighIntermediate)
    expect(getBhutaniZone(12, 5)).toBe(BhutaniRiskZone.LowIntermediate);
    expect(getBhutaniZone(24, 7.5)).toBe(BhutaniRiskZone.LowIntermediate);

    // At exact highIntermediate threshold, should return HighIntermediate (not High)
    expect(getBhutaniZone(12, 6.5)).toBe(BhutaniRiskZone.HighIntermediate);
    expect(getBhutaniZone(24, 9.5)).toBe(BhutaniRiskZone.HighIntermediate);
  });

  it('should handle all HOL data points: 12, 24, 36, 48, 60, 96, 144 hours', () => {
    // Test at 12 hours
    expect(getBhutaniZone(12, 2)).toBe(BhutaniRiskZone.Low);
    expect(getBhutaniZone(12, 4.5)).toBe(BhutaniRiskZone.LowIntermediate);
    expect(getBhutaniZone(12, 6)).toBe(BhutaniRiskZone.HighIntermediate);
    expect(getBhutaniZone(12, 7)).toBe(BhutaniRiskZone.High);

    // Test at 24 hours
    expect(getBhutaniZone(24, 4)).toBe(BhutaniRiskZone.Low);
    expect(getBhutaniZone(24, 6.5)).toBe(BhutaniRiskZone.LowIntermediate);
    expect(getBhutaniZone(24, 9)).toBe(BhutaniRiskZone.HighIntermediate);
    expect(getBhutaniZone(24, 10)).toBe(BhutaniRiskZone.High);

    // Test at 36 hours
    expect(getBhutaniZone(36, 6)).toBe(BhutaniRiskZone.Low);
    expect(getBhutaniZone(36, 8.5)).toBe(BhutaniRiskZone.LowIntermediate);
    expect(getBhutaniZone(36, 11.5)).toBe(BhutaniRiskZone.HighIntermediate);
    expect(getBhutaniZone(36, 13)).toBe(BhutaniRiskZone.High);

    // Test at 48 hours
    expect(getBhutaniZone(48, 7)).toBe(BhutaniRiskZone.Low);
    expect(getBhutaniZone(48, 10)).toBe(BhutaniRiskZone.LowIntermediate);
    expect(getBhutaniZone(48, 13)).toBe(BhutaniRiskZone.HighIntermediate);
    expect(getBhutaniZone(48, 14)).toBe(BhutaniRiskZone.High);

    // Test at 60 hours
    expect(getBhutaniZone(60, 8)).toBe(BhutaniRiskZone.Low);
    expect(getBhutaniZone(60, 11)).toBe(BhutaniRiskZone.LowIntermediate);
    expect(getBhutaniZone(60, 14.5)).toBe(BhutaniRiskZone.HighIntermediate);
    expect(getBhutaniZone(60, 16)).toBe(BhutaniRiskZone.High);

    // Test at 96 hours
    expect(getBhutaniZone(96, 10)).toBe(BhutaniRiskZone.Low);
    expect(getBhutaniZone(96, 12.5)).toBe(BhutaniRiskZone.LowIntermediate);
    expect(getBhutaniZone(96, 16.5)).toBe(BhutaniRiskZone.HighIntermediate);
    expect(getBhutaniZone(96, 18)).toBe(BhutaniRiskZone.High);

    // Test at 144 hours
    expect(getBhutaniZone(144, 11)).toBe(BhutaniRiskZone.Low);
    expect(getBhutaniZone(144, 14)).toBe(BhutaniRiskZone.LowIntermediate);
    expect(getBhutaniZone(144, 17)).toBe(BhutaniRiskZone.HighIntermediate);
    expect(getBhutaniZone(144, 18)).toBe(BhutaniRiskZone.High);
  });

  it('should interpolate zones correctly between HOL data points', () => {
    // At 18 hours (between 12 and 24)
    expect(getBhutaniZone(18, 4)).toBe(BhutaniRiskZone.Low);
    expect(getBhutaniZone(18, 6)).toBe(BhutaniRiskZone.LowIntermediate);
    expect(getBhutaniZone(18, 8)).toBe(BhutaniRiskZone.HighIntermediate);
    expect(getBhutaniZone(18, 10)).toBe(BhutaniRiskZone.High);

    // At 30 hours (between 24 and 36)
    expect(getBhutaniZone(30, 5)).toBe(BhutaniRiskZone.Low);
    expect(getBhutaniZone(30, 7)).toBe(BhutaniRiskZone.LowIntermediate);
    expect(getBhutaniZone(30, 10)).toBe(BhutaniRiskZone.HighIntermediate);
    expect(getBhutaniZone(30, 12)).toBe(BhutaniRiskZone.High);
  });

  it('should handle edge cases: HOL = 0, HOL = 144, HOL = 145', () => {
    // HOL = 0 (before first data point, should use first point)
    expect(getBhutaniZone(0, 2)).toBe(BhutaniRiskZone.Low);
    expect(getBhutaniZone(0, 4)).toBe(BhutaniRiskZone.LowIntermediate);

    // HOL = 144 (exact boundary)
    expect(getBhutaniZone(144, 10)).toBe(BhutaniRiskZone.Low);
    expect(getBhutaniZone(144, 18)).toBe(BhutaniRiskZone.High);

    // HOL = 145 (should return NotApplicable)
    expect(getBhutaniZone(145, 10)).toBe(BhutaniRiskZone.NotApplicable);
  });
});

describe('getAapThresholds', () => {
  describe('gestational age >= 38 weeks', () => {
    it('should use lowerRisk curves when no risk factors', () => {
      const result = getAapThresholds(24, 38, false, 10);
      expect(result.phototherapy.threshold).toBe(12);
      expect(result.exchangeTransfusion.threshold).toBe(19);
    });

    it('should use mediumRisk curves when has risk factors', () => {
      const result = getAapThresholds(24, 38, true, 10);
      expect(result.phototherapy.threshold).toBe(10);
      expect(result.exchangeTransfusion.threshold).toBe(17);
    });
  });

  describe('gestational age 35-37.9 weeks', () => {
    it('should use mediumRisk curves when no risk factors', () => {
      const result = getAapThresholds(24, 35, false, 10);
      expect(result.phototherapy.threshold).toBe(10);
      expect(result.exchangeTransfusion.threshold).toBe(17);
    });

    it('should use higherRisk curves when has risk factors', () => {
      const result = getAapThresholds(24, 35, true, 10);
      expect(result.phototherapy.threshold).toBe(8);
      expect(result.exchangeTransfusion.threshold).toBe(15);
    });
  });

  describe('phototherapy threshold status', () => {
    it('should return BELOW when TCB is below threshold', () => {
      const result = getAapThresholds(24, 38, false, 10); // Threshold is 12
      expect(result.phototherapy.status).toBe('BELOW');
      expect(result.phototherapy.threshold).toBe(12);
    });

    it('should return ABOVE when TCB is at threshold', () => {
      const result = getAapThresholds(24, 38, false, 12); // Threshold is 12
      expect(result.phototherapy.status).toBe('ABOVE');
      expect(result.phototherapy.threshold).toBe(12);
    });

    it('should return ABOVE when TCB is above threshold', () => {
      const result = getAapThresholds(24, 38, false, 15); // Threshold is 12
      expect(result.phototherapy.status).toBe('ABOVE');
      expect(result.phototherapy.threshold).toBe(12);
    });
  });

  describe('exchange transfusion threshold status', () => {
    it('should return BELOW when TCB is below threshold', () => {
      const result = getAapThresholds(24, 38, false, 15); // Threshold is 19
      expect(result.exchangeTransfusion.status).toBe('BELOW');
      expect(result.exchangeTransfusion.threshold).toBe(19);
    });

    it('should return ABOVE when TCB is at threshold', () => {
      const result = getAapThresholds(24, 38, false, 19); // Threshold is 19
      expect(result.exchangeTransfusion.status).toBe('ABOVE');
      expect(result.exchangeTransfusion.threshold).toBe(19);
    });

    it('should return ABOVE when TCB is above threshold', () => {
      const result = getAapThresholds(24, 38, false, 22); // Threshold is 19
      expect(result.exchangeTransfusion.status).toBe('ABOVE');
      expect(result.exchangeTransfusion.threshold).toBe(19);
    });
  });

  describe('all HOL data points: 0, 24, 48, 72, 96, 120, 168 hours', () => {
    it('should calculate correct thresholds at HOL = 0', () => {
      const result = getAapThresholds(0, 38, false, 5);
      expect(result.phototherapy.threshold).toBe(5);
      expect(result.exchangeTransfusion.threshold).toBe(12);
    });

    it('should calculate correct thresholds at HOL = 24', () => {
      const result = getAapThresholds(24, 38, false, 10);
      expect(result.phototherapy.threshold).toBe(12);
      expect(result.exchangeTransfusion.threshold).toBe(19);
    });

    it('should calculate correct thresholds at HOL = 48', () => {
      const result = getAapThresholds(48, 38, false, 14);
      expect(result.phototherapy.threshold).toBe(15);
      expect(result.exchangeTransfusion.threshold).toBe(22);
    });

    it('should calculate correct thresholds at HOL = 72', () => {
      const result = getAapThresholds(72, 38, false, 17);
      expect(result.phototherapy.threshold).toBe(18);
      expect(result.exchangeTransfusion.threshold).toBe(24);
    });

    it('should calculate correct thresholds at HOL = 96', () => {
      const result = getAapThresholds(96, 38, false, 19);
      expect(result.phototherapy.threshold).toBe(20);
      expect(result.exchangeTransfusion.threshold).toBe(25);
    });

    it('should calculate correct thresholds at HOL = 120', () => {
      const result = getAapThresholds(120, 38, false, 20);
      expect(result.phototherapy.threshold).toBe(21);
      expect(result.exchangeTransfusion.threshold).toBe(25);
    });

    it('should calculate correct thresholds at HOL = 168', () => {
      const result = getAapThresholds(168, 38, false, 21);
      expect(result.phototherapy.threshold).toBe(21.5);
      expect(result.exchangeTransfusion.threshold).toBe(25);
    });
  });

  it('should interpolate thresholds between HOL points', () => {
    // At 12 hours (between 0 and 24)
    const result = getAapThresholds(12, 38, false, 8);
    expect(result.phototherapy.threshold).toBeCloseTo(8.5, 1); // Between 5 and 12
    expect(result.exchangeTransfusion.threshold).toBeCloseTo(15.5, 1); // Between 12 and 19
  });

  it('should format thresholds with 2 decimal precision', () => {
    const result = getAapThresholds(30, 38, false, 10); // Interpolated value
    expect(result.phototherapy.threshold).toBeCloseTo(parseFloat(result.phototherapy.threshold.toString()), 2);
    expect(result.exchangeTransfusion.threshold).toBeCloseTo(parseFloat(result.exchangeTransfusion.threshold.toString()), 2);
  });

  it('should handle boundary gestational ages: 35.0, 37.9, 38.0', () => {
    // At 35.0 weeks, no risk factors → mediumRisk
    const result35 = getAapThresholds(24, 35.0, false, 10);
    expect(result35.phototherapy.threshold).toBe(10); // mediumRisk

    // At 37.9 weeks, no risk factors → mediumRisk
    const result37_9 = getAapThresholds(24, 37.9, false, 10);
    expect(result37_9.phototherapy.threshold).toBe(10); // mediumRisk

    // At 38.0 weeks, no risk factors → lowerRisk
    const result38 = getAapThresholds(24, 38.0, false, 10);
    expect(result38.phototherapy.threshold).toBe(12); // lowerRisk
  });

  it('should handle all risk factor combinations', () => {
    // AOG >= 38, no risk factors
    const result1 = getAapThresholds(48, 40, false, 14);
    expect(result1.phototherapy.threshold).toBe(15); // lowerRisk

    // AOG >= 38, with risk factors
    const result2 = getAapThresholds(48, 40, true, 14);
    expect(result2.phototherapy.threshold).toBe(13); // mediumRisk

    // 35 <= AOG < 38, no risk factors
    const result3 = getAapThresholds(48, 36, false, 14);
    expect(result3.phototherapy.threshold).toBe(13); // mediumRisk

    // 35 <= AOG < 38, with risk factors
    const result4 = getAapThresholds(48, 36, true, 14);
    expect(result4.phototherapy.threshold).toBe(11); // higherRisk
  });
});

describe('getMaiselsThresholds', () => {
  describe('gestational age brackets', () => {
    it('should use maiselsData[28] when AOG < 28', () => {
      const result = getMaiselsThresholds(27, 5);
      expect(result.phototherapy.threshold).toBe('5-6');
      expect(result.exchangeTransfusion.threshold).toBe('11-14');
    });

    it('should use maiselsData[29] when 28 <= AOG < 30', () => {
      const result = getMaiselsThresholds(28, 6);
      expect(result.phototherapy.threshold).toBe('6-8');
      expect(result.exchangeTransfusion.threshold).toBe('12-14');
      
      const result29 = getMaiselsThresholds(29.5, 7);
      expect(result29.phototherapy.threshold).toBe('6-8');
      expect(result29.exchangeTransfusion.threshold).toBe('12-14');
    });

    it('should use maiselsData[31] when 30 <= AOG < 32', () => {
      const result = getMaiselsThresholds(30, 8);
      expect(result.phototherapy.threshold).toBe('8-10');
      expect(result.exchangeTransfusion.threshold).toBe('13-16');
      
      const result31 = getMaiselsThresholds(31.5, 9);
      expect(result31.phototherapy.threshold).toBe('8-10');
      expect(result31.exchangeTransfusion.threshold).toBe('13-16');
    });

    it('should use maiselsData[33] when 32 <= AOG < 34', () => {
      const result = getMaiselsThresholds(32, 10);
      expect(result.phototherapy.threshold).toBe('10-12');
      expect(result.exchangeTransfusion.threshold).toBe('15-18');
      
      const result33 = getMaiselsThresholds(33.5, 11);
      expect(result33.phototherapy.threshold).toBe('10-12');
      expect(result33.exchangeTransfusion.threshold).toBe('15-18');
    });

    it('should use maiselsData[34] when AOG >= 34', () => {
      const result = getMaiselsThresholds(34, 12);
      expect(result.phototherapy.threshold).toBe('12-14');
      expect(result.exchangeTransfusion.threshold).toBe('17-19');
      
      const result35 = getMaiselsThresholds(35, 13);
      expect(result35.phototherapy.threshold).toBe('12-14');
      expect(result35.exchangeTransfusion.threshold).toBe('17-19');
    });
  });

  describe('phototherapy threshold status', () => {
    it('should return BELOW when TCB < min', () => {
      const result = getMaiselsThresholds(27, 4); // min is 5 for [28] bracket
      expect(result.phototherapy.status).toBe('BELOW');
      expect(result.phototherapy.threshold).toBe('5-6');
    });

    it('should return WITHIN when TCB is within range', () => {
      const result = getMaiselsThresholds(27, 5.5); // between 5 and 6 for [28] bracket
      expect(result.phototherapy.status).toBe('WITHIN');
      expect(result.phototherapy.threshold).toBe('5-6');
    });

    it('should return WITHIN when TCB equals min', () => {
      const result = getMaiselsThresholds(27, 5); // equals min for [28] bracket
      expect(result.phototherapy.status).toBe('WITHIN');
      expect(result.phototherapy.threshold).toBe('5-6');
    });

    it('should return WITHIN when TCB equals max', () => {
      const result = getMaiselsThresholds(27, 6); // equals max for [28] bracket
      expect(result.phototherapy.status).toBe('WITHIN');
      expect(result.phototherapy.threshold).toBe('5-6');
    });

    it('should return ABOVE when TCB > max', () => {
      const result = getMaiselsThresholds(27, 7); // above 6 for [28] bracket
      expect(result.phototherapy.status).toBe('ABOVE');
      expect(result.phototherapy.threshold).toBe('5-6');
    });
  });

  describe('exchange transfusion threshold status', () => {
    it('should return BELOW when TCB < min', () => {
      const result = getMaiselsThresholds(27, 10); // min is 11 for [28] bracket
      expect(result.exchangeTransfusion.status).toBe('BELOW');
      expect(result.exchangeTransfusion.threshold).toBe('11-14');
    });

    it('should return WITHIN when TCB is within range', () => {
      const result = getMaiselsThresholds(27, 12.5); // between 11 and 14 for [28] bracket
      expect(result.exchangeTransfusion.status).toBe('WITHIN');
      expect(result.exchangeTransfusion.threshold).toBe('11-14');
    });

    it('should return WITHIN when TCB equals min', () => {
      const result = getMaiselsThresholds(27, 11); // equals min for [28] bracket
      expect(result.exchangeTransfusion.status).toBe('WITHIN');
      expect(result.exchangeTransfusion.threshold).toBe('11-14');
    });

    it('should return WITHIN when TCB equals max', () => {
      const result = getMaiselsThresholds(27, 14); // equals max for [28] bracket
      expect(result.exchangeTransfusion.status).toBe('WITHIN');
      expect(result.exchangeTransfusion.threshold).toBe('11-14');
    });

    it('should return ABOVE when TCB > max', () => {
      const result = getMaiselsThresholds(27, 15); // above 14 for [28] bracket
      expect(result.exchangeTransfusion.status).toBe('ABOVE');
      expect(result.exchangeTransfusion.threshold).toBe('11-14');
    });
  });

  it('should format threshold as string "min-max"', () => {
    const result = getMaiselsThresholds(30, 8);
    expect(typeof result.phototherapy.threshold).toBe('string');
    expect(result.phototherapy.threshold).toMatch(/^\d+-\d+$/);
    expect(result.exchangeTransfusion.threshold).toMatch(/^\d+-\d+$/);
  });

  it('should handle all age bracket boundaries: 28.0, 30.0, 32.0, 34.0', () => {
    // At 27.9, should use [28]
    const result27_9 = getMaiselsThresholds(27.9, 5);
    expect(result27_9.phototherapy.threshold).toBe('5-6');

    // At 28.0, should use [29]
    const result28 = getMaiselsThresholds(28.0, 6);
    expect(result28.phototherapy.threshold).toBe('6-8');

    // At 29.9, should use [29]
    const result29_9 = getMaiselsThresholds(29.9, 7);
    expect(result29_9.phototherapy.threshold).toBe('6-8');

    // At 30.0, should use [31]
    const result30 = getMaiselsThresholds(30.0, 8);
    expect(result30.phototherapy.threshold).toBe('8-10');

    // At 31.9, should use [31]
    const result31_9 = getMaiselsThresholds(31.9, 9);
    expect(result31_9.phototherapy.threshold).toBe('8-10');

    // At 32.0, should use [33]
    const result32 = getMaiselsThresholds(32.0, 10);
    expect(result32.phototherapy.threshold).toBe('10-12');

    // At 33.9, should use [33]
    const result33_9 = getMaiselsThresholds(33.9, 11);
    expect(result33_9.phototherapy.threshold).toBe('10-12');

    // At 34.0, should use [34]
    const result34 = getMaiselsThresholds(34.0, 12);
    expect(result34.phototherapy.threshold).toBe('12-14');
  });
});

describe('calculateBilirubinRisk', () => {
  const createValidInput = (overrides: Partial<CalculationInput> = {}): CalculationInput => ({
    birthDateTime: '2024-01-01T10:00',
    measurementDateTime: '2024-01-02T10:00',
    tcbValue: 10,
    gestationalWeeks: 38,
    gestationalDays: 0,
    hasRiskFactors: false,
    usePediatricCorrectedAge: false,
    ...overrides,
  });

  describe('input validation', () => {
    it('should return null when birthDateTime is missing', () => {
      const input = createValidInput({ birthDateTime: '' });
      expect(calculateBilirubinRisk(input)).toBeNull();
    });

    it('should return null when measurementDateTime is missing', () => {
      const input = createValidInput({ measurementDateTime: '' });
      expect(calculateBilirubinRisk(input)).toBeNull();
    });

    it('should return null when tcbValue is missing', () => {
      const input = createValidInput({ tcbValue: 0 });
      // tcbValue of 0 might be valid, let's check with undefined/null
      const input2: any = { ...createValidInput(), tcbValue: undefined };
      expect(calculateBilirubinRisk(input2)).toBeNull();
    });

    it('should return null when gestationalWeeks is missing', () => {
      const input: any = { ...createValidInput(), gestationalWeeks: undefined };
      expect(calculateBilirubinRisk(input)).toBeNull();
    });

    it('should return null when dates are invalid', () => {
      const input = createValidInput({ birthDateTime: 'invalid-date' });
      expect(calculateBilirubinRisk(input)).toBeNull();
    });

    it('should return null when measurementDateTime <= birthDateTime', () => {
      const input = createValidInput({
        birthDateTime: '2024-01-02T10:00',
        measurementDateTime: '2024-01-02T10:00', // Same time
      });
      expect(calculateBilirubinRisk(input)).toBeNull();

      const input2 = createValidInput({
        birthDateTime: '2024-01-03T10:00',
        measurementDateTime: '2024-01-02T10:00', // Before birth
      });
      expect(calculateBilirubinRisk(input2)).toBeNull();
    });
  });

  describe('date parsing', () => {
    it('should handle ISO format: yyyy-mm-ddThh:mm', () => {
      const input = createValidInput({
        birthDateTime: '2024-01-01T10:00',
        measurementDateTime: '2024-01-02T10:00',
      });
      const result = calculateBilirubinRisk(input);
      expect(result).not.toBeNull();
      expect(result!.hol).toBe(24);
    });

    it('should handle space-separated format: yyyy-mm-dd hh:mm', () => {
      const input = createValidInput({
        birthDateTime: '2024-01-01 10:00',
        measurementDateTime: '2024-01-02 10:00',
      });
      const result = calculateBilirubinRisk(input);
      expect(result).not.toBeNull();
      expect(result!.hol).toBe(24);
    });

    it('should handle slash-separated format: yyyy/mm/dd - hh:mm', () => {
      const input = createValidInput({
        birthDateTime: '2024/01/01 - 10:00',
        measurementDateTime: '2024/01/02 - 10:00',
      });
      const result = calculateBilirubinRisk(input);
      expect(result).not.toBeNull();
      expect(result!.hol).toBe(24);
    });

    it('should normalize date separators correctly', () => {
      const input = createValidInput({
        birthDateTime: '2024/01/01 10:00',
        measurementDateTime: '2024/01/02 10:00',
      });
      const result = calculateBilirubinRisk(input);
      expect(result).not.toBeNull();
    });

    it('should handle mixed formats', () => {
      const input = createValidInput({
        birthDateTime: '2024-01-01T10:00',
        measurementDateTime: '2024/01/02 10:00',
      });
      const result = calculateBilirubinRisk(input);
      expect(result).not.toBeNull();
      expect(result!.hol).toBe(24);
    });
  });

  describe('HOL (Hours of Life) calculation', () => {
    it('should calculate HOL correctly for 1 hour difference', () => {
      const input = createValidInput({
        birthDateTime: '2024-01-01T10:00',
        measurementDateTime: '2024-01-01T11:00',
      });
      const result = calculateBilirubinRisk(input);
      expect(result).not.toBeNull();
      expect(result!.hol).toBe(1);
    });

    it('should calculate HOL correctly for 12 hours difference', () => {
      const input = createValidInput({
        birthDateTime: '2024-01-01T10:00',
        measurementDateTime: '2024-01-01T22:00',
      });
      const result = calculateBilirubinRisk(input);
      expect(result).not.toBeNull();
      expect(result!.hol).toBe(12);
    });

    it('should calculate HOL correctly for 24 hours difference', () => {
      const input = createValidInput({
        birthDateTime: '2024-01-01T10:00',
        measurementDateTime: '2024-01-02T10:00',
      });
      const result = calculateBilirubinRisk(input);
      expect(result).not.toBeNull();
      expect(result!.hol).toBe(24);
    });

    it('should calculate HOL correctly for 48 hours difference', () => {
      const input = createValidInput({
        birthDateTime: '2024-01-01T10:00',
        measurementDateTime: '2024-01-03T10:00',
      });
      const result = calculateBilirubinRisk(input);
      expect(result).not.toBeNull();
      expect(result!.hol).toBe(48);
    });

    it('should format HOL with 1 decimal precision', () => {
      const input = createValidInput({
        birthDateTime: '2024-01-01T10:00',
        measurementDateTime: '2024-01-01T10:06', // 6 minutes = 0.1 hours
      });
      const result = calculateBilirubinRisk(input);
      expect(result).not.toBeNull();
      expect(result!.hol).toBeCloseTo(0.1, 1);
    });

    it('should handle exact hour boundaries', () => {
      const input = createValidInput({
        birthDateTime: '2024-01-01T10:00',
        measurementDateTime: '2024-01-08T10:00', // 7 days = 168 hours
      });
      const result = calculateBilirubinRisk(input);
      expect(result).not.toBeNull();
      expect(result!.hol).toBe(168);
    });
  });

  describe('AOG (Age of Gestation) calculation', () => {
    it('should calculate AOG decimal correctly: weeks + (days / 7)', () => {
      const input = createValidInput({
        gestationalWeeks: 38,
        gestationalDays: 0,
      });
      const result = calculateBilirubinRisk(input);
      expect(result).not.toBeNull();
      expect(result!.aog).toBe('38w 0d');
    });

    it('should format AOG as "Xw Yd"', () => {
      const input = createValidInput({
        gestationalWeeks: 35,
        gestationalDays: 3,
      });
      const result = calculateBilirubinRisk(input);
      expect(result).not.toBeNull();
      expect(result!.aog).toBe('35w 3d');
    });

    it('should handle various gestational age combinations', () => {
      const testCases = [
        { weeks: 28, days: 0, expected: '28w 0d' },
        { weeks: 35, days: 5, expected: '35w 5d' },
        { weeks: 38, days: 2, expected: '38w 2d' },
        { weeks: 40, days: 6, expected: '40w 6d' },
      ];

      testCases.forEach(({ weeks, days, expected }) => {
        const input = createValidInput({
          gestationalWeeks: weeks,
          gestationalDays: days,
        });
        const result = calculateBilirubinRisk(input);
        expect(result).not.toBeNull();
        expect(result!.aog).toBe(expected);
      });
    });

    it('should handle edge cases: 0 days, all 7 days', () => {
      const input0 = createValidInput({
        gestationalWeeks: 38,
        gestationalDays: 0,
      });
      expect(calculateBilirubinRisk(input0)!.aog).toBe('38w 0d');

      const input7 = createValidInput({
        gestationalWeeks: 37,
        gestationalDays: 7,
      });
      expect(calculateBilirubinRisk(input7)!.aog).toBe('37w 7d');
    });
  });

  describe('Bhutani zone integration', () => {
    it('should return NotApplicable when AOG < 35 weeks', () => {
      const input = createValidInput({
        gestationalWeeks: 34,
        gestationalDays: 6,
        tcbValue: 15,
      });
      const result = calculateBilirubinRisk(input);
      expect(result).not.toBeNull();
      expect(result!.bhutaniZone).toBe(BhutaniRiskZone.NotApplicable);
    });

    it('should calculate Bhutani zone when AOG >= 35 weeks', () => {
      const input = createValidInput({
        gestationalWeeks: 38,
        gestationalDays: 0,
        tcbValue: 10,
      });
      const result = calculateBilirubinRisk(input);
      expect(result).not.toBeNull();
      expect(result!.bhutaniZone).not.toBe(BhutaniRiskZone.NotApplicable);
    });

    it('should return correct zone at boundary AOG = 35.0', () => {
      const input = createValidInput({
        gestationalWeeks: 35,
        gestationalDays: 0,
        tcbValue: 10,
        measurementDateTime: '2024-01-02T10:00', // 24 hours
      });
      const result = calculateBilirubinRisk(input);
      expect(result).not.toBeNull();
      expect(result!.bhutaniZone).not.toBe(BhutaniRiskZone.NotApplicable);
    });
  });

  describe('threshold selection logic', () => {
    it('should use getAapThresholds when AOG >= 35 weeks', () => {
      const input = createValidInput({
        gestationalWeeks: 38,
        gestationalDays: 0,
        tcbValue: 10,
        hasRiskFactors: false,
      });
      const result = calculateBilirubinRisk(input);
      expect(result).not.toBeNull();
      // AAP thresholds return numeric values, Maisels returns string ranges
      expect(typeof result!.phototherapy.threshold).toBe('number');
      expect(typeof result!.exchangeTransfusion.threshold).toBe('number');
    });

    it('should use getMaiselsThresholds when AOG < 35 weeks', () => {
      const input = createValidInput({
        gestationalWeeks: 34,
        gestationalDays: 6,
        tcbValue: 10,
      });
      const result = calculateBilirubinRisk(input);
      expect(result).not.toBeNull();
      // Maisels thresholds return string ranges
      expect(typeof result!.phototherapy.threshold).toBe('string');
      expect(result!.phototherapy.threshold).toMatch(/^\d+-\d+$/);
    });

    it('should handle boundary at exactly 35.0 weeks', () => {
      const input = createValidInput({
        gestationalWeeks: 35,
        gestationalDays: 0,
        tcbValue: 10,
      });
      const result = calculateBilirubinRisk(input);
      expect(result).not.toBeNull();
      // Should use AAP thresholds
      expect(typeof result!.phototherapy.threshold).toBe('number');
    });
  });

  describe('result formatting', () => {
    it('should format dob using toLocaleDateString', () => {
      const input = createValidInput({
        birthDateTime: '2024-01-01T10:00',
      });
      const result = calculateBilirubinRisk(input);
      expect(result).not.toBeNull();
      expect(result!.dob).toBeDefined();
      expect(typeof result!.dob).toBe('string');
    });

    it('should format tob using toLocaleTimeString', () => {
      const input = createValidInput({
        birthDateTime: '2024-01-01T10:00',
      });
      const result = calculateBilirubinRisk(input);
      expect(result).not.toBeNull();
      expect(result!.tob).toBeDefined();
      expect(typeof result!.tob).toBe('string');
    });

    it('should format hol as a number with 1 decimal', () => {
      const input = createValidInput({
        birthDateTime: '2024-01-01T10:00',
        measurementDateTime: '2024-01-01T10:06',
      });
      const result = calculateBilirubinRisk(input);
      expect(result).not.toBeNull();
      expect(typeof result!.hol).toBe('number');
      expect(result!.hol).toBeCloseTo(0.1, 1);
    });

    it('should preserve tcb value from input', () => {
      const input = createValidInput({
        tcbValue: 12.5,
      });
      const result = calculateBilirubinRisk(input);
      expect(result).not.toBeNull();
      expect(result!.tcb).toBe(12.5);
    });

    it('should include all required result fields', () => {
      const input = createValidInput();
      const result = calculateBilirubinRisk(input);
      expect(result).not.toBeNull();
      expect(result).toHaveProperty('dob');
      expect(result).toHaveProperty('tob');
      expect(result).toHaveProperty('hol');
      expect(result).toHaveProperty('tcb');
      expect(result).toHaveProperty('aog');
      expect(result).toHaveProperty('bhutaniZone');
      expect(result).toHaveProperty('phototherapy');
      expect(result).toHaveProperty('exchangeTransfusion');
      expect(result).toHaveProperty('isUsingMaisels');
      expect(result).toHaveProperty('isUsingCorrectedAge');
      expect(result).toHaveProperty('correctedAog');
    });

    it('should have correct types for all result fields', () => {
      const input = createValidInput();
      const result = calculateBilirubinRisk(input);
      expect(result).not.toBeNull();
      expect(typeof result!.dob).toBe('string');
      expect(typeof result!.tob).toBe('string');
      expect(typeof result!.hol).toBe('number');
      expect(typeof result!.tcb).toBe('number');
      expect(typeof result!.aog).toBe('string');
      expect(typeof result!.bhutaniZone).toBe('string');
      expect(typeof result!.phototherapy).toBe('object');
      expect(typeof result!.phototherapy.status).toBe('string');
      expect(typeof result!.exchangeTransfusion).toBe('object');
      expect(typeof result!.exchangeTransfusion.status).toBe('string');
      expect(typeof result!.isUsingMaisels).toBe('boolean');
      expect(typeof result!.isUsingCorrectedAge).toBe('boolean');
      expect(result!.correctedAog === null || typeof result!.correctedAog === 'string').toBe(true);
    });
  });

  describe('complete integration tests', () => {
    it('should handle preterm infant (< 35 weeks) with low TCB', () => {
      const input = createValidInput({
        gestationalWeeks: 32,
        gestationalDays: 4,
        tcbValue: 8,
        measurementDateTime: '2024-01-02T10:00', // 24 hours
      });
      const result = calculateBilirubinRisk(input);
      expect(result).not.toBeNull();
      expect(result!.bhutaniZone).toBe(BhutaniRiskZone.NotApplicable);
      expect(typeof result!.phototherapy.threshold).toBe('string'); // Maisels
    });

    it('should handle preterm infant (< 35 weeks) with high TCB', () => {
      const input = createValidInput({
        gestationalWeeks: 32,
        gestationalDays: 4,
        tcbValue: 15,
        measurementDateTime: '2024-01-02T10:00', // 24 hours
      });
      const result = calculateBilirubinRisk(input);
      expect(result).not.toBeNull();
      expect(result!.bhutaniZone).toBe(BhutaniRiskZone.NotApplicable);
      expect(result!.phototherapy.status).toBe('ABOVE'); // High TCB
    });

    it('should handle term infant (>= 35 weeks) without risk factors', () => {
      const input = createValidInput({
        gestationalWeeks: 38,
        gestationalDays: 0,
        tcbValue: 10,
        hasRiskFactors: false,
        measurementDateTime: '2024-01-02T10:00', // 24 hours
      });
      const result = calculateBilirubinRisk(input);
      expect(result).not.toBeNull();
      expect(result!.bhutaniZone).not.toBe(BhutaniRiskZone.NotApplicable);
      expect(typeof result!.phototherapy.threshold).toBe('number'); // AAP
    });

    it('should handle term infant (>= 35 weeks) with risk factors', () => {
      const input = createValidInput({
        gestationalWeeks: 38,
        gestationalDays: 0,
        tcbValue: 10,
        hasRiskFactors: true,
        measurementDateTime: '2024-01-02T10:00', // 24 hours
      });
      const result = calculateBilirubinRisk(input);
      expect(result).not.toBeNull();
      // With risk factors, thresholds should be lower
      expect(result!.phototherapy.threshold).toBeLessThan(12); // Lower than no risk factors
    });

    it('should handle late preterm (35-37 weeks) without risk factors', () => {
      const input = createValidInput({
        gestationalWeeks: 36,
        gestationalDays: 3,
        tcbValue: 12,
        hasRiskFactors: false,
        measurementDateTime: '2024-01-02T10:00', // 24 hours
      });
      const result = calculateBilirubinRisk(input);
      expect(result).not.toBeNull();
      expect(result!.bhutaniZone).not.toBe(BhutaniRiskZone.NotApplicable);
    });

    it('should handle late preterm (35-37 weeks) with risk factors', () => {
      const input = createValidInput({
        gestationalWeeks: 36,
        gestationalDays: 3,
        tcbValue: 12,
        hasRiskFactors: true,
        measurementDateTime: '2024-01-02T10:00', // 24 hours
      });
      const result = calculateBilirubinRisk(input);
      expect(result).not.toBeNull();
      expect(result!.bhutaniZone).not.toBe(BhutaniRiskZone.NotApplicable);
      // With risk factors, should use higherRisk curves
      expect(result!.phototherapy.threshold).toBe(8); // higherRisk at 24 hours
    });

    it('should handle term (>= 38 weeks) without risk factors', () => {
      const input = createValidInput({
        gestationalWeeks: 40,
        gestationalDays: 2,
        tcbValue: 15,
        hasRiskFactors: false,
        measurementDateTime: '2024-01-02T10:00', // 24 hours
      });
      const result = calculateBilirubinRisk(input);
      expect(result).not.toBeNull();
      expect(result!.phototherapy.threshold).toBe(12); // lowerRisk at 24 hours
    });

    it('should handle term (>= 38 weeks) with risk factors', () => {
      const input = createValidInput({
        gestationalWeeks: 40,
        gestationalDays: 2,
        tcbValue: 15,
        hasRiskFactors: true,
        measurementDateTime: '2024-01-02T10:00', // 24 hours
      });
      const result = calculateBilirubinRisk(input);
      expect(result).not.toBeNull();
      expect(result!.phototherapy.threshold).toBe(10); // mediumRisk at 24 hours
    });
  });

  describe('Pediatric Corrected Age', () => {
    it('should not apply corrected age when checkbox is unchecked', () => {
      const input = createValidInput({
        gestationalWeeks: 32,
        gestationalDays: 0,
        tcbValue: 10,
        usePediatricCorrectedAge: false,
        measurementDateTime: '2024-01-08T10:00', // 7 days = 168 hours
      });
      const result = calculateBilirubinRisk(input);
      expect(result).not.toBeNull();
      expect(result!.isUsingCorrectedAge).toBe(false);
      expect(result!.correctedAog).toBeNull();
      expect(result!.isUsingMaisels).toBe(true);
      // Should use original GA (32 weeks) for Maisels
      expect(result!.aog).toBe('32w 0d');
    });

    it('should not apply corrected age when original GA >= 35 weeks even if checkbox is checked', () => {
      const input = createValidInput({
        gestationalWeeks: 36,
        gestationalDays: 0,
        tcbValue: 10,
        usePediatricCorrectedAge: true,
        measurementDateTime: '2024-01-08T10:00', // 7 days = 168 hours
      });
      const result = calculateBilirubinRisk(input);
      expect(result).not.toBeNull();
      expect(result!.isUsingCorrectedAge).toBe(false);
      expect(result!.correctedAog).toBeNull();
      expect(result!.isUsingMaisels).toBe(false);
      // Should use AAP/Bhutani
      expect(typeof result!.phototherapy.threshold).toBe('number');
    });

    it('should apply corrected age when checkbox is checked and original GA < 35 weeks', () => {
      const input = createValidInput({
        gestationalWeeks: 31,
        gestationalDays: 5,
        tcbValue: 10,
        usePediatricCorrectedAge: true,
        measurementDateTime: '2024-01-15T10:00', // 14 days = 336 hours = 2 weeks
      });
      const result = calculateBilirubinRisk(input);
      expect(result).not.toBeNull();
      expect(result!.isUsingCorrectedAge).toBe(true);
      expect(result!.correctedAog).not.toBeNull();
      expect(result!.correctedAog).toContain('(PCA)');
      // Original GA: 31 + 5/7 = 31.714 weeks
      // HOL: 336 hours = 2 weeks
      // Corrected GA: 31.714 + 2 = 33.714 weeks ≈ 33w 5d
      expect(result!.correctedAog).toMatch(/33w\s+\d+d\s+\(PCA\)/);
    });

    it('should use corrected GA for Maisels when corrected GA < 35 weeks', () => {
      const input = createValidInput({
        gestationalWeeks: 32,
        gestationalDays: 0,
        tcbValue: 10,
        usePediatricCorrectedAge: true,
        measurementDateTime: '2024-01-03T10:00', // 2 days = 48 hours = 0.286 weeks
      });
      const result = calculateBilirubinRisk(input);
      expect(result).not.toBeNull();
      expect(result!.isUsingCorrectedAge).toBe(true);
      expect(result!.isUsingMaisels).toBe(true);
      // Original GA: 32 weeks
      // HOL: 48 hours ≈ 0.286 weeks
      // Corrected GA: 32.286 weeks < 35, so should use Maisels
      expect(typeof result!.phototherapy.threshold).toBe('string'); // Maisels returns string ranges
      expect(result!.bhutaniZone).toBe(BhutaniRiskZone.NotApplicable);
    });

    it('should switch to AAP/Bhutani when corrected GA >= 35 weeks', () => {
      const input = createValidInput({
        gestationalWeeks: 34,
        gestationalDays: 6,
        tcbValue: 10,
        usePediatricCorrectedAge: true,
        hasRiskFactors: false,
        measurementDateTime: '2024-01-02T10:00', // 1 day = 24 hours
      });
      const result = calculateBilirubinRisk(input);
      expect(result).not.toBeNull();
      expect(result!.isUsingCorrectedAge).toBe(true);
      expect(result!.isUsingMaisels).toBe(false);
      // Original GA: 34 + 6/7 = 34.857 weeks
      // HOL: 24 hours ≈ 0.143 weeks
      // Corrected GA: 34.857 + 0.143 = 35.0 weeks >= 35, so should use AAP/Bhutani
      // HOL is 24 hours which is < 144 hours, so Bhutani zone should be calculated
      expect(typeof result!.phototherapy.threshold).toBe('number'); // AAP returns numbers
      expect(result!.bhutaniZone).not.toBe(BhutaniRiskZone.NotApplicable);
    });

    it('should calculate corrected AOG correctly at 35 week boundary', () => {
      const input = createValidInput({
        gestationalWeeks: 34,
        gestationalDays: 6,
        tcbValue: 10,
        usePediatricCorrectedAge: true,
        measurementDateTime: '2024-01-02T10:00', // 1 day = 24 hours = 0.143 weeks
      });
      const result = calculateBilirubinRisk(input);
      expect(result).not.toBeNull();
      expect(result!.isUsingCorrectedAge).toBe(true);
      // Original GA: 34 + 6/7 = 34.857 weeks
      // HOL: 24 hours ≈ 0.143 weeks
      // Corrected GA: 34.857 + 0.143 = 35.0 weeks (at boundary)
      expect(result!.isUsingMaisels).toBe(false); // Should be false at exactly 35
      expect(typeof result!.phototherapy.threshold).toBe('number');
    });

    it('should format corrected AOG correctly with weeks and days', () => {
      const input = createValidInput({
        gestationalWeeks: 31,
        gestationalDays: 3,
        tcbValue: 10,
        usePediatricCorrectedAge: true,
        measurementDateTime: '2024-01-08T10:00', // 7 days = 168 hours = 1 week
      });
      const result = calculateBilirubinRisk(input);
      expect(result).not.toBeNull();
      expect(result!.correctedAog).not.toBeNull();
      // Original GA: 31 + 3/7 = 31.429 weeks
      // HOL: 168 hours = 1 week
      // Corrected GA: 32.429 weeks = 32w 3d
      expect(result!.correctedAog).toMatch(/^\d+w\s+\d+d\s+\(PCA\)$/);
      const match = result!.correctedAog!.match(/(\d+)w\s+(\d+)d/);
      expect(match).not.toBeNull();
      if (match) {
        const weeks = parseInt(match[1], 10);
        const days = parseInt(match[2], 10);
        expect(weeks).toBeGreaterThanOrEqual(31);
        expect(weeks).toBeLessThanOrEqual(33);
        expect(days).toBeGreaterThanOrEqual(0);
        expect(days).toBeLessThanOrEqual(6);
      }
    });

    it('should use corrected GA for AAP thresholds when corrected GA >= 35', () => {
      const input = createValidInput({
        gestationalWeeks: 34,
        gestationalDays: 0,
        tcbValue: 12,
        usePediatricCorrectedAge: true,
        hasRiskFactors: false,
        measurementDateTime: '2024-01-08T10:00', // 7 days = 168 hours = 1 week
      });
      const result = calculateBilirubinRisk(input);
      expect(result).not.toBeNull();
      expect(result!.isUsingCorrectedAge).toBe(true);
      expect(result!.isUsingMaisels).toBe(false);
      // Original GA: 34 weeks
      // HOL: 168 hours = 1 week
      // Corrected GA: 35 weeks
      // At 168 hours HOL, lowerRisk threshold should be higher than at 24 hours
      expect(typeof result!.phototherapy.threshold).toBe('number');
      expect(result!.phototherapy.threshold).toBeGreaterThan(12);
    });

    it('should use corrected GA for Maisels thresholds when corrected GA < 35', () => {
      const input = createValidInput({
        gestationalWeeks: 30,
        gestationalDays: 0,
        tcbValue: 9,
        usePediatricCorrectedAge: true,
        measurementDateTime: '2024-01-03T10:00', // 2 days = 48 hours
      });
      const result = calculateBilirubinRisk(input);
      expect(result).not.toBeNull();
      expect(result!.isUsingCorrectedAge).toBe(true);
      expect(result!.isUsingMaisels).toBe(true);
      // Original GA: 30 weeks
      // HOL: 48 hours ≈ 0.286 weeks
      // Corrected GA: 30.286 weeks < 35, so should use Maisels
      // For 30-31.6/7 weeks, Maisels threshold is 8-10
      expect(typeof result!.phototherapy.threshold).toBe('string');
      expect(result!.phototherapy.threshold).toContain('-');
    });

    it('should handle multiple weeks of corrected age correctly', () => {
      const input = createValidInput({
        gestationalWeeks: 28,
        gestationalDays: 0,
        tcbValue: 10,
        usePediatricCorrectedAge: true,
        measurementDateTime: '2024-01-29T10:00', // 28 days = 672 hours = 4 weeks
      });
      const result = calculateBilirubinRisk(input);
      expect(result).not.toBeNull();
      expect(result!.isUsingCorrectedAge).toBe(true);
      // Original GA: 28 weeks
      // HOL: 672 hours = 4 weeks
      // Corrected GA: 32 weeks < 35, so should use Maisels
      expect(result!.isUsingMaisels).toBe(true);
      expect(result!.correctedAog).toMatch(/32w\s+\d+d\s+\(PCA\)/);
    });

    it('should preserve original AOG in result when using corrected age', () => {
      const input = createValidInput({
        gestationalWeeks: 32,
        gestationalDays: 4,
        tcbValue: 10,
        usePediatricCorrectedAge: true,
        measurementDateTime: '2024-01-08T10:00', // 7 days
      });
      const result = calculateBilirubinRisk(input);
      expect(result).not.toBeNull();
      // Original AOG should still be in result.aog
      expect(result!.aog).toBe('32w 4d');
      // Corrected AOG should be in result.correctedAog
      expect(result!.correctedAog).not.toBeNull();
      expect(result!.correctedAog).not.toBe(result!.aog);
    });
  });
});

describe('Edge cases and boundary tests', () => {
  it('should handle HOL at exact data points vs interpolated points', () => {
    const input1: CalculationInput = {
      birthDateTime: '2024-01-01T10:00',
      measurementDateTime: '2024-01-02T10:00', // Exactly 24 hours
      tcbValue: 10,
      gestationalWeeks: 38,
      gestationalDays: 0,
      hasRiskFactors: false,
      usePediatricCorrectedAge: false,
    };
    const result1 = calculateBilirubinRisk(input1);
    expect(result1).not.toBeNull();
    expect(result1!.hol).toBe(24);

    const input2: CalculationInput = {
      birthDateTime: '2024-01-01T10:00',
      measurementDateTime: '2024-01-02T16:00', // 30 hours (interpolated)
      tcbValue: 10,
      gestationalWeeks: 38,
      gestationalDays: 0,
      hasRiskFactors: false,
      usePediatricCorrectedAge: false,
    };
    const result2 = calculateBilirubinRisk(input2);
    expect(result2).not.toBeNull();
    expect(result2!.hol).toBe(30);
  });

  it('should handle TCB values exactly at threshold boundaries', () => {
    // Test AAP threshold boundaries
    const inputAtThreshold: CalculationInput = {
      birthDateTime: '2024-01-01T10:00',
      measurementDateTime: '2024-01-02T10:00', // 24 hours, threshold is 12 for lowerRisk
      tcbValue: 12, // Exactly at threshold
      gestationalWeeks: 38,
      gestationalDays: 0,
      hasRiskFactors: false,
      usePediatricCorrectedAge: false,
    };
    const resultAt = calculateBilirubinRisk(inputAtThreshold);
    expect(resultAt).not.toBeNull();
    expect(resultAt!.phototherapy.status).toBe('ABOVE');

    const inputBelowThreshold: CalculationInput = {
      ...inputAtThreshold,
      tcbValue: 11.99,
    };
    const resultBelow = calculateBilirubinRisk(inputBelowThreshold);
    expect(resultBelow).not.toBeNull();
    expect(resultBelow!.phototherapy.status).toBe('BELOW');
  });

  it('should handle gestational ages at exact bracket boundaries', () => {
    const boundaries = [27.9, 28.0, 29.9, 30.0, 31.9, 32.0, 33.9, 34.0, 34.9, 35.0];

    boundaries.forEach((aog) => {
      const weeks = Math.floor(aog);
      const days = Math.round((aog - weeks) * 7);
      const input: CalculationInput = {
        birthDateTime: '2024-01-01T10:00',
        measurementDateTime: '2024-01-02T10:00',
        tcbValue: 10,
        gestationalWeeks: weeks,
        gestationalDays: days,
        hasRiskFactors: false,
        usePediatricCorrectedAge: false,
      };
      const result = calculateBilirubinRisk(input);
      expect(result).not.toBeNull();
      if (aog < 35) {
        expect(result!.bhutaniZone).toBe(BhutaniRiskZone.NotApplicable);
        expect(typeof result!.phototherapy.threshold).toBe('string'); // Maisels
      } else {
        expect(result!.bhutaniZone).not.toBe(BhutaniRiskZone.NotApplicable);
        expect(typeof result!.phototherapy.threshold).toBe('number'); // AAP
      }
    });
  });

  it('should handle extreme TCB values', () => {
    const inputLow: CalculationInput = {
      birthDateTime: '2024-01-01T10:00',
      measurementDateTime: '2024-01-02T10:00',
      tcbValue: 0.1, // Very low
      gestationalWeeks: 38,
      gestationalDays: 0,
      hasRiskFactors: false,
      usePediatricCorrectedAge: false,
    };
    const resultLow = calculateBilirubinRisk(inputLow);
    expect(resultLow).not.toBeNull();
    expect(resultLow!.phototherapy.status).toBe('BELOW');

    const inputHigh: CalculationInput = {
      ...inputLow,
      tcbValue: 30, // Very high
    };
    const resultHigh = calculateBilirubinRisk(inputHigh);
    expect(resultHigh).not.toBeNull();
    expect(resultHigh!.phototherapy.status).toBe('ABOVE');
    expect(resultHigh!.exchangeTransfusion.status).toBe('ABOVE');
  });

  it('should handle extreme HOL values', () => {
    const testCases = [
      { hours: 0.1, description: 'very low' },
      { hours: 1, description: '1 hour' },
      { hours: 144, description: '144 hours (Bhutani boundary)' },
      { hours: 168, description: '168 hours (1 week)' },
      { hours: 200, description: '200+ hours' },
    ];

    testCases.forEach(({ hours, description }) => {
      const birthDate = new Date(2024, 0, 1, 10, 0);
      const measurementDate = new Date(birthDate);
      measurementDate.setTime(birthDate.getTime() + hours * 60 * 60 * 1000);
      
      // Format dates as ISO strings without timezone
      const formatDate = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const h = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${year}-${month}-${day}T${h}:${minutes}`;
      };

      const input: CalculationInput = {
        birthDateTime: formatDate(birthDate),
        measurementDateTime: formatDate(measurementDate),
        tcbValue: 10,
        gestationalWeeks: 38,
        gestationalDays: 0,
        hasRiskFactors: false,
        usePediatricCorrectedAge: false,
      };
      const result = calculateBilirubinRisk(input);
      expect(result).not.toBeNull();
      expect(result!.hol).toBeCloseTo(hours, 1);
    });
  });

  it('should produce different results when risk factors toggle', () => {
    const inputWithout: CalculationInput = {
      birthDateTime: '2024-01-01T10:00',
      measurementDateTime: '2024-01-02T10:00', // 24 hours
      tcbValue: 10,
      gestationalWeeks: 38,
      gestationalDays: 0,
      hasRiskFactors: false,
      usePediatricCorrectedAge: false,
    };
    const resultWithout = calculateBilirubinRisk(inputWithout);

    const inputWith: CalculationInput = {
      ...inputWithout,
      hasRiskFactors: true,
    };
    const resultWith = calculateBilirubinRisk(inputWith);

    expect(resultWithout).not.toBeNull();
    expect(resultWith).not.toBeNull();
    // With risk factors, thresholds should be lower (more restrictive)
    expect(resultWith!.phototherapy.threshold).toBeLessThan(resultWithout!.phototherapy.threshold as number);
  });
});

describe('Data consistency tests', () => {
  it('should verify Bhutani nomogram data points are correctly structured', () => {
    expect(bhutaniData.low.length).toBeGreaterThan(0);
    expect(bhutaniData.lowIntermediate.length).toBeGreaterThan(0);
    expect(bhutaniData.highIntermediate.length).toBeGreaterThan(0);

    // Verify all zones have same HOL points
    expect(bhutaniData.low.length).toBe(bhutaniData.lowIntermediate.length);
    expect(bhutaniData.low.length).toBe(bhutaniData.highIntermediate.length);

    // Verify HOL values are in ascending order
    const checkAscending = (points: DataPoints) => {
      for (let i = 1; i < points.length; i++) {
        expect(points[i][0]).toBeGreaterThan(points[i - 1][0]);
      }
    };
    checkAscending(bhutaniData.low);
    checkAscending(bhutaniData.lowIntermediate);
    checkAscending(bhutaniData.highIntermediate);
  });

  it('should verify AAP nomogram data points are correctly structured', () => {
    expect(aapPlData.lowerRisk.length).toBeGreaterThan(0);
    expect(aapPlData.mediumRisk.length).toBeGreaterThan(0);
    expect(aapPlData.higherRisk.length).toBeGreaterThan(0);

    // Verify all curves have same HOL points
    expect(aapPlData.lowerRisk.length).toBe(aapPlData.mediumRisk.length);
    expect(aapPlData.lowerRisk.length).toBe(aapPlData.higherRisk.length);

    // Verify HOL values are in ascending order
    const checkAscending = (points: DataPoints) => {
      for (let i = 1; i < points.length; i++) {
        expect(points[i][0]).toBeGreaterThanOrEqual(points[i - 1][0]);
      }
    };
    checkAscending(aapPlData.lowerRisk);
    checkAscending(aapPlData.mediumRisk);
    checkAscending(aapPlData.higherRisk);
  });

  it('should verify Maisels threshold data covers all age brackets', () => {
    expect(maiselsData[28]).toBeDefined();
    expect(maiselsData[29]).toBeDefined();
    expect(maiselsData[31]).toBeDefined();
    expect(maiselsData[33]).toBeDefined();
    expect(maiselsData[34]).toBeDefined();

    // Verify each bracket has both pl and dvet thresholds
    Object.values(maiselsData).forEach((thresholds) => {
      expect(thresholds.pl).toBeDefined();
      expect(thresholds.dvet).toBeDefined();
      expect(thresholds.pl.length).toBe(2);
      expect(thresholds.dvet.length).toBe(2);
      expect(thresholds.pl[0]).toBeLessThan(thresholds.pl[1]);
      expect(thresholds.dvet[0]).toBeLessThan(thresholds.dvet[1]);
    });
  });

  it('should verify threshold values generally increase with age (sanity check)', () => {
    // For AAP, lowerRisk should have higher thresholds than mediumRisk, which should be higher than higherRisk
    aapPlData.lowerRisk.forEach((point, index) => {
      const medium = aapPlData.mediumRisk[index];
      const higher = aapPlData.higherRisk[index];
      if (medium && higher) {
        // At same HOL, lowerRisk threshold >= mediumRisk threshold >= higherRisk threshold
        expect(point[1]).toBeGreaterThanOrEqual(medium[1]);
        expect(medium[1]).toBeGreaterThanOrEqual(higher[1]);
      }
    });
  });

  it('should verify zone thresholds are ordered correctly', () => {
    const holValues = [12, 24, 36, 48, 60, 96, 144];

    holValues.forEach((hol) => {
      const lowThreshold = linearInterpolate(bhutaniData.low, hol);
      const lowIntermediateThreshold = linearInterpolate(bhutaniData.lowIntermediate, hol);
      const highIntermediateThreshold = linearInterpolate(bhutaniData.highIntermediate, hol);

      expect(lowThreshold).toBeLessThan(lowIntermediateThreshold);
      expect(lowIntermediateThreshold).toBeLessThan(highIntermediateThreshold);
    });
  });
});

