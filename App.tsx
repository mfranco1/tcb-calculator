import React, { useState } from 'react';
import { CalculationInput, CalculationResult, BhutaniRiskZone, ThresholdStatus } from './types';
import { calculateBilirubinRisk } from './services/bilirubinCalculator';
import { BeakerIcon, ChartBarIcon, ClockIcon, SunIcon, CopyIcon, CheckIcon } from './constants';

const App: React.FC = () => {
    const initialState = {
        birthDateTime: '',
        measurementDateTime: '',
        tcbValue: '',
        gestationalWeeks: '',
        gestationalDays: '',
        hasRiskFactors: false,
    };

    const [input, setInput] = useState(initialState);
    const [result, setResult] = useState<CalculationResult | null>(null);
    const [error, setError] = useState<string>('');
    const [isCopied, setIsCopied] = useState(false);
    const [toastMessage, setToastMessage] = useState('');

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type, checked } = e.target;
        setInput(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value,
        }));
    };

    const handleSetCurrentTime = () => {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        
        const formattedDateTime = `${year}/${month}/${day} - ${hours}:${minutes}`;
        
        setInput(prev => ({
            ...prev,
            measurementDateTime: formattedDateTime,
        }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        const tcbValue = parseFloat(input.tcbValue);
        const gestationalWeeks = parseInt(input.gestationalWeeks, 10);
        const gestationalDays = input.gestationalDays === '' ? 0 : parseInt(input.gestationalDays, 10);

        if (isNaN(gestationalWeeks) || gestationalWeeks < 28 || gestationalWeeks > 42) {
            setError("Gestational weeks must be between 28 and 42.");
            return;
        }

        if (isNaN(gestationalDays) || gestationalDays < 0 || gestationalDays > 6) {
            setError("Gestational days must be between 0 and 6.");
            return;
        }

        if (isNaN(tcbValue) || tcbValue <= 0) {
            setError("TcB value must be greater than 0.");
            return;
        }

        const calculationInput: CalculationInput = {
            birthDateTime: input.birthDateTime,
            measurementDateTime: input.measurementDateTime,
            hasRiskFactors: input.hasRiskFactors,
            tcbValue,
            gestationalWeeks,
            gestationalDays,
        };

        const calculationResult = calculateBilirubinRisk(calculationInput);
        if (calculationResult) {
            setResult(calculationResult);
        } else {
            setError("Could not calculate risk. Please check your inputs. Birth date/time must be before measurement date/time.");
        }
    };

    const handleReset = () => {
        setInput(initialState);
        setResult(null);
        setError('');
        setIsCopied(false);
    };

    const handleCopyToClipboard = async () => {
        if (!result) return;

        const parts = input.birthDateTime.split(/\s+-\s+|\s+/);
        const dob = (parts[0] || '').trim() || 'N/A';
        const tob = (parts[1] || '').trim() || 'N/A';

        const weeks = parseInt(input.gestationalWeeks, 10);
        const days = input.gestationalDays === '' ? 0 : parseInt(input.gestationalDays, 10);

        const gestationalAgeText = Number.isFinite(weeks)
            ? `${weeks} weeks ${Number.isFinite(days) ? `${days}/7` : '0/7'} days`
            : 'N/A';

        const totalWeeks = Number.isFinite(weeks)
            ? weeks + ((Number.isFinite(days) ? days : 0) / 7)
            : null;

        const riskCategory = (() => {
            if (totalWeeks === null) return 'N/A';
            if (totalWeeks >= 38) {
                return input.hasRiskFactors ? 'Medium Risk Neonate' : 'Low Risk Neonate';
            }
            if (totalWeeks >= 35) {
                return input.hasRiskFactors ? 'High Risk Neonate' : 'Medium Risk Neonate';
            }
            return 'High Risk Neonate';
        })();

        const holRounded = Math.round(result.hol);
        const tcbFormatted = result.tcb.toFixed(1);

        const formatThreshold = (threshold: number | string) => {
            const numericValue = typeof threshold === 'number' ? threshold : parseFloat(threshold as string);
            if (!Number.isFinite(numericValue)) {
                return `${threshold}`;
            }
            const rounded = Math.round(numericValue * 10) / 10;
            const withOneDecimal = rounded.toFixed(1);
            return withOneDecimal.endsWith('.0') ? withOneDecimal.slice(0, -2) : withOneDecimal;
        };

        const phototherapyThreshold = formatThreshold(result.phototherapy.threshold);
        const dvetThreshold = formatThreshold(result.exchangeTransfusion.threshold);

        const textToCopy = [
            `DOB: ${dob}`,
            `TOB: ${tob}`,
            `AOG: ${gestationalAgeText}`,
            `HOL: ${holRounded}`,
            `${riskCategory}`,
            `TCB: ${tcbFormatted} mg/dL`,
            `PHOTOLEVEL: ${result.phototherapy.status} (${phototherapyThreshold})`,
            `DVET level: ${result.exchangeTransfusion.status} (${dvetThreshold})`,
            `Bhutani Risk Zone: ${result.bhutaniZone}`,
        ].join('\n');

        try {
            await navigator.clipboard.writeText(textToCopy);
            setIsCopied(true);
            setToastMessage('Results copied to clipboard!');
            setTimeout(() => setIsCopied(false), 2000);
            setTimeout(() => setToastMessage(''), 3000);
        } catch (err) {
            console.error('Failed to copy text: ', err);
            setToastMessage('Failed to copy!');
             setTimeout(() => setToastMessage(''), 3000);
        }
    };

    const getZoneColor = (zone: BhutaniRiskZone) => {
        switch (zone) {
            case BhutaniRiskZone.High: return 'text-red-600 font-bold';
            case BhutaniRiskZone.HighIntermediate: return 'text-orange-600 font-bold';
            case BhutaniRiskZone.LowIntermediate: return 'text-yellow-600';
            case BhutaniRiskZone.Low: return 'text-green-600';
            default: return 'text-gray-500';
        }
    };

    const getStatusColor = (status: ThresholdStatus) => {
        switch (status) {
            case 'ABOVE': return 'text-red-600 font-bold';
            case 'BELOW': return 'text-green-600';
            case 'WITHIN': return 'text-yellow-600';
            default: return 'text-gray-500';
        }
    };

    return (
        <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
            <div className="max-w-4xl w-full bg-white rounded-lg shadow-xl p-8 space-y-8">
                <header className="text-center">
                    <h1 className="text-4xl font-bold text-gray-800">Neonatal Bilirubin Risk Calculator</h1>
                    <p className="text-gray-600 mt-2">Based on Bhutani Nomogram and AAP Guidelines</p>
                </header>

                <main className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <section className="p-6 bg-gray-50 rounded-lg border border-gray-200">
                        <h2 className="text-2xl font-semibold text-gray-700 mb-6">Patient Data</h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label htmlFor="birthDateTime" className="block text-sm font-medium text-gray-700">Birth Date & Time</label>
                                <input type="text" id="birthDateTime" name="birthDateTime" value={input.birthDateTime} onChange={handleChange} required className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 placeholder:text-gray-500 text-gray-900" placeholder="yyyy/mm/dd - hh:mm"/>
                            </div>
                            <div>
                                <label htmlFor="measurementDateTime" className="block text-sm font-medium text-gray-700">Measurement Date & Time</label>
                                <div className="flex items-center space-x-2 mt-1">
                                    <input type="text" id="measurementDateTime" name="measurementDateTime" value={input.measurementDateTime} onChange={handleChange} required className="block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 placeholder:text-gray-500 text-gray-900" placeholder="yyyy/mm/dd - hh:mm"/>
                                    <button 
                                        type="button" 
                                        onClick={handleSetCurrentTime}
                                        className="px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                                        title="Set to current time"
                                    >
                                        Now
                                    </button>
                                </div>
                            </div>
                             <div>
                                <label htmlFor="tcbValue" className="block text-sm font-medium text-gray-700">TcB Value (mg/dL)</label>
                                <input type="number" id="tcbValue" name="tcbValue" value={input.tcbValue} onChange={handleChange} step="0.1" required className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-gray-900" placeholder="e.g. 8.5" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Gestational Age</label>
                                <div className="flex items-center space-x-2 mt-1">
                                    <input type="number" name="gestationalWeeks" value={input.gestationalWeeks} onChange={handleChange} placeholder="Weeks" required className="block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-gray-900" />
                                    <span>weeks</span>
                                    <input type="number" name="gestationalDays" value={input.gestationalDays} onChange={handleChange} placeholder="Days" className="block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-gray-900" />
                                    <span>days</span>
                                </div>
                            </div>
                             <div className="flex items-center">
                                <input type="checkbox" id="hasRiskFactors" name="hasRiskFactors" checked={input.hasRiskFactors} onChange={handleChange} className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded" />
                                <label htmlFor="hasRiskFactors" className="ml-2 block text-sm text-gray-900">Has AAP Neurotoxicity Risk Factors?</label>
                            </div>
                            {error && <p className="text-red-500 text-sm">{error}</p>}
                            <div className="flex items-center justify-between pt-4">
                                <button
                                    type="submit"
                                    className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                                >
                                    Calculate Risk
                                </button>
                                <button
                                    type="button"
                                    onClick={handleReset}
                                    className="inline-flex items-center px-6 py-3 border border-gray-300 rounded-md shadow-sm text-base font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                                >
                                    Reset
                                </button>
                            </div>
                        </form>
                    </section>
                    
                    <section className="p-6 bg-gray-50 rounded-lg border border-gray-200 flex flex-col">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-2xl font-semibold text-gray-700">Results</h2>
                            {result && (
                                <button
                                    type="button"
                                    onClick={handleCopyToClipboard}
                                    className="p-2 rounded-md text-gray-500 hover:bg-gray-200 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:text-indigo-600 disabled:hover:bg-transparent"
                                    title={isCopied ? "Copied!" : "Copy to clipboard"}
                                    disabled={isCopied}
                                >
                                    {isCopied ? <CheckIcon /> : <CopyIcon />}
                                </button>
                            )}
                        </div>
                        {result ? (
                            <div className="space-y-4">
                                <div className="p-4 bg-white rounded-lg shadow">
                                    <h3 className="font-semibold text-gray-800 flex items-center"><ClockIcon /> <span className="ml-2">Age and Measurements</span></h3>
                                    <p className="text-gray-700">Date of Birth: {result.dob} @ {result.tob}</p>
                                    <p className="text-gray-700">Hours of Life: {result.hol} hrs</p>
                                    <p className="text-gray-700">Gestational Age: {result.aog}</p>
                                    <p className="text-gray-700">TcB Value: {result.tcb} mg/dL</p>
                                </div>
                                <div className="p-4 bg-white rounded-lg shadow">
                                    <h3 className="font-semibold text-gray-800 flex items-center"><ChartBarIcon /> <span className="ml-2">Bhutani Nomogram Risk Zone</span></h3>
                                    <p className={getZoneColor(result.bhutaniZone)}>{result.bhutaniZone}</p>

                                </div>
                                <div className="p-4 bg-white rounded-lg shadow">
                                     <h3 className="font-semibold text-gray-800 flex items-center"><SunIcon /> <span className="ml-2">Phototherapy Threshold (AAP)</span></h3>
                                     <p className="text-gray-700">Threshold: {result.phototherapy.threshold} mg/dL</p>
                                     <p className="text-gray-700">Status: <span className={getStatusColor(result.phototherapy.status)}>{result.phototherapy.status}</span></p>
                                </div>
                                <div className="p-4 bg-white rounded-lg shadow">
                                    <h3 className="font-semibold text-gray-800 flex items-center"><BeakerIcon /> <span className="ml-2">Exchange Transfusion Threshold (AAP)</span></h3>
                                    <p className="text-gray-700">Threshold: {result.exchangeTransfusion.threshold} mg/dL</p>
                                    <p className="text-gray-700">Status: <span className={getStatusColor(result.exchangeTransfusion.status)}>{result.exchangeTransfusion.status}</span></p>
                                </div>
                            </div>
                        ) : (
                             <div className="text-center text-gray-500 p-8 border-2 border-dashed border-gray-300 rounded-lg flex-grow flex items-center justify-center">
                                <p>Enter patient data and click "Calculate" to see the results.</p>
                             </div>
                        )}
                    </section>
                </main>
            </div>
            {toastMessage && (
                <div className="fixed bottom-8 right-8 bg-gray-900 text-white py-2 px-4 rounded-lg shadow-xl flex items-center gap-x-2">
                    <CheckIcon />
                    <span>{toastMessage}</span>
                </div>
            )}
        </div>
    );
};

export default App;