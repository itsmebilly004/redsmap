import { TickSpotData } from '@deriv/api-types';

export const getLast = (arr: any[]): any => arr && (arr.length === 0 ? undefined : arr[arr.length - 1]);

export const historyToTicks = (history: any): any[] =>
    history.times.map((t: any, idx: any) => ({
        epoch: +t,
        quote: +history.prices[idx],
    }));
