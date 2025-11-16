import { CalculationInput, CalculationResult, BhutaniRiskZone, ThresholdResult, ThresholdStatus } from '../types';

type DataPoints = [number, number][];

// Data points extracted from the provided nomogram charts
const bhutaniData = {
    low: [[12, 3.5], [24, 5.5], [36, 7.5], [48, 8.5], [60, 9], [96, 11.5], [144, 12.5]] as DataPoints,
    lowIntermediate: [[12, 5], [24, 7.5], [36, 9.5], [48, 11], [60, 12], [96, 13.5], [144, 15]] as DataPoints,
    highIntermediate: [[12, 6.5], [24, 9.5], [36, 12], [48, 13.5], [60, 15], [96, 17], [144, 17.5]] as DataPoints,
};

const aapPlData = {
    lowerRisk: [[0,5],[24, 12], [48, 15], [72, 18], [96, 20], [120, 21], [168, 21.5]] as DataPoints,
    mediumRisk: [[0,4],[24, 10], [48, 13], [72, 15], [96, 17], [120, 18], [168, 18.5]] as DataPoints,
    higherRisk: [[0,3],[24, 8], [48, 11], [72, 13], [96, 14.5], [120, 15.5], [168, 16]] as DataPoints,
};

const aapDvetData = {
    lowerRisk: [[0,12],[24, 19], [48, 22], [72, 24], [96, 25], [168, 25]] as DataPoints,
    mediumRisk: [[0,10],[24, 17], [48, 19], [72, 21], [96, 22.5], [168, 23]] as DataPoints,
    higherRisk: [[0,8],[24, 15], [48, 17], [72, 18.5], [96, 20], [168, 20.5]] as DataPoints,
};

// Maisels thresholds as ranges [min, max] for phototherapy and exchange transfusion
const maiselsData = {
    28: { pl: [5, 6] as [number, number], dvet: [11, 14] as [number, number] }, // <28 0/7 weeks
    29: { pl: [6, 8] as [number, number], dvet: [12, 14] as [number, number] }, // 28 0/7-29 6/7 weeks
    31: { pl: [8, 10] as [number, number], dvet: [13, 16] as [number, number] }, // 30 0/7-31 6/7 weeks
    33: { pl: [10, 12] as [number, number], dvet: [15, 18] as [number, number] }, // 32 0/7-33 6/7 weeks
    34: { pl: [12, 14] as [number, number], dvet: [17, 19] as [number, number] }, // 34 0/7-34 6/7 weeks
};

function linearInterpolate(points: DataPoints, x: number): number {
    if (x <= points[0][0]) return points[0][1];
    if (x >= points[points.length - 1][0]) return points[points.length - 1][1];

    const p1 = points.find((p) => p[0] >= x) || points[points.length - 1];
    const p0 = points[points.lastIndexOf(p1) - 1] || points[0];

    const [x0, y0] = p0;
    const [x1, y1] = p1;

    if (x1 === x0) return y0;

    return y0 + (x - x0) * (y1 - y0) / (x1 - x0);
}

function getBhutaniZone(hol: number, tcb: number): BhutaniRiskZone {
    if (hol > 144) return BhutaniRiskZone.NotApplicable;

    const highIntermediateThreshold = linearInterpolate(bhutaniData.highIntermediate, hol);
    if (tcb > highIntermediateThreshold) return BhutaniRiskZone.High;

    const lowIntermediateThreshold = linearInterpolate(bhutaniData.lowIntermediate, hol);
    if (tcb > lowIntermediateThreshold) return BhutaniRiskZone.HighIntermediate;

    const lowThreshold = linearInterpolate(bhutaniData.low, hol);
    if (tcb > lowThreshold) return BhutaniRiskZone.LowIntermediate;

    return BhutaniRiskZone.Low;
}

function getAapThresholds(hol: number, aog: number, hasRiskFactors: boolean, tcb: number): { phototherapy: ThresholdResult, exchangeTransfusion: ThresholdResult } {
    let plCurve: DataPoints;
    let dvetCurve: DataPoints;

    if (aog >= 38) {
        if (hasRiskFactors) {
            plCurve = aapPlData.mediumRisk;
            dvetCurve = aapDvetData.mediumRisk;
        } else {
            plCurve = aapPlData.lowerRisk;
            dvetCurve = aapDvetData.lowerRisk;
        }
    } else { // 35 <= aog < 38
        if (hasRiskFactors) {
            plCurve = aapPlData.higherRisk;
            dvetCurve = aapDvetData.higherRisk;
        } else {
            plCurve = aapPlData.mediumRisk;
            dvetCurve = aapDvetData.mediumRisk;
        }
    }

    const plThreshold = linearInterpolate(plCurve, hol);
    const dvetThreshold = linearInterpolate(dvetCurve, hol);

    return {
        phototherapy: {
            status: tcb >= plThreshold ? 'ABOVE' : 'BELOW',
            threshold: parseFloat(plThreshold.toFixed(2)),
        },
        exchangeTransfusion: {
            status: tcb >= dvetThreshold ? 'ABOVE' : 'BELOW',
            threshold: parseFloat(dvetThreshold.toFixed(2)),
        },
    };
}


function getMaiselsThresholds(aog: number, tcb: number): { phototherapy: ThresholdResult, exchangeTransfusion: ThresholdResult } {
    let thresholds;
    if (aog < 28) thresholds = maiselsData[28];
    else if (aog < 30) thresholds = maiselsData[29];
    else if (aog < 32) thresholds = maiselsData[31];
    else if (aog < 34) thresholds = maiselsData[33];
    else thresholds = maiselsData[34];

    const [plMin, plMax] = thresholds.pl;
    const [dvetMin, dvetMax] = thresholds.dvet;

    // Determine status: ABOVE (above max), WITHIN (within range), or BELOW (below min)
    const getStatus = (value: number, min: number, max: number): ThresholdStatus => {
        if (value > max) return 'ABOVE';
        if (value < min) return 'BELOW';
        return 'WITHIN';
    };

    return {
        phototherapy: {
            status: getStatus(tcb, plMin, plMax),
            threshold: `${plMin}-${plMax}`,
        },
        exchangeTransfusion: {
            status: getStatus(tcb, dvetMin, dvetMax),
            threshold: `${dvetMin}-${dvetMax}`,
        },
    };
}


export const calculateBilirubinRisk = (input: CalculationInput): CalculationResult | null => {
    const { birthDateTime, measurementDateTime, tcbValue, gestationalWeeks, gestationalDays, hasRiskFactors } = input;

    if (!birthDateTime || !measurementDateTime || !tcbValue || !gestationalWeeks) {
        return null;
    }
    
    const formatDateTime = (dt: string) => {
        // Normalize date separator to '-' and date-time separator to 'T' to create a format that new Date() can reliably parse.
        // This handles formats like 'yyyy/mm/dd - hh:mm', 'yyyy-mm-dd hh:mm', etc.
        return dt.replace(/\//g, '-').replace(/\s+-\s+|\s+/, 'T');
    };

    const birthDate = new Date(formatDateTime(birthDateTime));
    const measurementDate = new Date(formatDateTime(measurementDateTime));

    if (isNaN(birthDate.getTime()) || isNaN(measurementDate.getTime())) {
        return null; // Invalid date format entered
    }

    if (measurementDate <= birthDate) return null;

    const hol = (measurementDate.getTime() - birthDate.getTime()) / (1000 * 60 * 60);
    const aogDecimal = gestationalWeeks + (gestationalDays / 7);

    // Bhutani zone is only applicable for neonates >= 35 weeks gestational age
    const bhutaniZone = aogDecimal < 35 ? BhutaniRiskZone.NotApplicable : getBhutaniZone(hol, tcbValue);

    let therapyThresholds;

    if (aogDecimal >= 35) {
        therapyThresholds = getAapThresholds(hol, aogDecimal, hasRiskFactors, tcbValue);
    } else {
        therapyThresholds = getMaiselsThresholds(aogDecimal, tcbValue);
    }

    return {
        dob: birthDate.toLocaleDateString(),
        tob: birthDate.toLocaleTimeString(),
        hol: parseFloat(hol.toFixed(1)),
        tcb: tcbValue,
        aog: `${gestationalWeeks}w ${gestationalDays}d`,
        bhutaniZone,
        phototherapy: therapyThresholds.phototherapy,
        exchangeTransfusion: therapyThresholds.exchangeTransfusion,
    };
};