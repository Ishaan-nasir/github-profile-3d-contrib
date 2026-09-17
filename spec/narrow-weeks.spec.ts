import * as aggregate from '../src/aggregate-user-info';
import { dummyData } from './dummy-data';

const dayOf = (d: Date): number => d.getUTCDay();

describe('WEEKS narrowing', () => {
    it('defaults to the full period', () => {
        const info = aggregate.aggregateUserInfo(dummyData);
        expect(info.contributionCalendar.length).toEqual(371);
        expect(info.windowWeeks).toBeNull();
        expect(info.windowContributions).toEqual(info.totalContributions);
    });

    it.each([13, 26, 52])('narrows to %i Sunday-aligned weeks', (weeks) => {
        const info = aggregate.aggregateUserInfo(dummyData, weeks);
        expect(info.windowWeeks).toEqual(weeks);
        // starts on a Sunday, or the grid shears
        expect(dayOf(info.contributionCalendar[0].date)).toEqual(0);
        // exactly `weeks` columns
        expect(info.contributionCalendar.length).toEqual(weeks * 7);
    });

    it('keeps the last day of the full period', () => {
        const full = aggregate.aggregateUserInfo(dummyData);
        const narrowed = aggregate.aggregateUserInfo(dummyData, 13);
        const lastFull = full.contributionCalendar.slice(-1)[0].date;
        const lastNarrow = narrowed.contributionCalendar.slice(-1)[0].date;
        expect(lastNarrow.getTime()).toEqual(lastFull.getTime());
    });

    it('scopes the total to the window', () => {
        const info = aggregate.aggregateUserInfo(dummyData, 13);
        const summed = info.contributionCalendar.reduce(
            (n, d) => n + d.contributionCount,
            0,
        );
        expect(info.windowContributions).toEqual(summed);
        expect(info.windowContributions).toBeLessThan(info.totalContributions);
    });

    it('reports the full period for the radar and language charts', () => {
        const info = aggregate.aggregateUserInfo(dummyData, 13);
        const full = aggregate.aggregateUserInfo(dummyData);
        expect(info.fullPeriod?.start).toEqual(
            full.contributionCalendar[0].date,
        );
        expect(info.fullPeriod?.end).toEqual(
            full.contributionCalendar.slice(-1)[0].date,
        );
    });

    it('is a no-op when the window is wider than the data', () => {
        const info = aggregate.aggregateUserInfo(dummyData, 53);
        expect(info.contributionCalendar.length).toEqual(371);
        expect(info.windowWeeks).toBeNull();
    });
});
