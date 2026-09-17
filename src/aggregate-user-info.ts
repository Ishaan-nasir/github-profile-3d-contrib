import * as client from './github-graphql';
import * as type from './type';

const OTHER_COLOR = '#444444';

const toNumberContributionLevel = (level: type.ContributionLevel): number => {
    switch (level) {
        case 'NONE':
            return 0;
        case 'FIRST_QUARTILE':
            return 1;
        case 'SECOND_QUARTILE':
            return 2;
        case 'THIRD_QUARTILE':
            return 3;
        case 'FOURTH_QUARTILE':
            return 4;
    }
};

const compare = (num1: number, num2: number): number => {
    if (num1 < num2) {
        return -1;
    } else if (num1 > num2) {
        return 1;
    } else {
        return 0;
    }
};

/**
 * Narrow a flat, daily-contiguous calendar to its last `weeks` columns.
 *
 * The isometric grid derives each cell's column from
 * `floor((epochDays(date) - sundayOfFirstWeek) / 7)`, so the retained
 * window MUST begin on a Sunday; starting mid-week shears the whole
 * lattice. Rather than trimming forward from `slice(-weeks * 7)` -- which
 * lands on an arbitrary weekday -- anchor on the final day, step back to
 * the Sunday that opens its (possibly partial) week, then step back whole
 * weeks. That start index is Sunday-aligned by construction and yields
 * exactly `weeks` columns.
 */
const narrowToLastWeeks = (
    calendar: Array<type.CalendarInfo>,
    weeks: number,
): Array<type.CalendarInfo> => {
    if (calendar.length === 0) {
        return calendar;
    }
    const lastIndex = calendar.length - 1;
    const sundayOfLastWeek = lastIndex - calendar[lastIndex].date.getUTCDay();
    const start = sundayOfLastWeek - (weeks - 1) * 7;
    return start <= 0 ? calendar : calendar.slice(start);
};

export const aggregateUserInfo = (
    response: client.ResponseType,
    weeks: number | null = null,
): type.UserInfo => {
    if (!response.data) {
        if (response.errors && response.errors.length) {
            throw new Error(response.errors[0].message);
        } else {
            throw new Error('JSON\n' + JSON.stringify(response, null, 2));
        }
    }

    const user = response.data.user;
    const calendar = user.contributionsCollection.contributionCalendar.weeks
        .flatMap((week) => week.contributionDays)
        .map((week) => ({
            contributionCount: week.contributionCount,
            contributionLevel: toNumberContributionLevel(
                week.contributionLevel,
            ),
            date: new Date(week.date),
        }));
    const fullPeriod =
        calendar.length === 0
            ? null
            : {
                  start: calendar[0].date,
                  end: calendar[calendar.length - 1].date,
              };
    const windowed =
        weeks !== null && weeks * 7 < calendar.length
            ? narrowToLastWeeks(calendar, weeks)
            : calendar;
    const windowWeeks = windowed === calendar ? null : weeks;
    const windowContributions = windowed.reduce(
        (sum, day) => sum + day.contributionCount,
        0,
    );

    const contributesLanguage: { [language: string]: type.LangInfo } = {};
    user.contributionsCollection.commitContributionsByRepository
        .filter((repo) => repo.repository.primaryLanguage)
        .forEach((repo) => {
            const language = repo.repository.primaryLanguage?.name || '';
            const color = repo.repository.primaryLanguage?.color || OTHER_COLOR;
            const contributions = repo.contributions.totalCount;

            const info = contributesLanguage[language];
            if (info) {
                info.contributions += contributions;
            } else {
                contributesLanguage[language] = {
                    language: language,
                    color: color,
                    contributions: contributions,
                };
            }
        });
    const languages: Array<type.LangInfo> = Object.values(
        contributesLanguage,
    ).sort((obj1, obj2) => -compare(obj1.contributions, obj2.contributions));

    const totalForkCount = user.repositories.nodes
        .map((node) => node.forkCount)
        .reduce((num1, num2) => num1 + num2, 0);
    const totalStargazerCount = user.repositories.nodes
        .map((node) => node.stargazerCount)
        .reduce((num1, num2) => num1 + num2, 0);
    const userInfo: type.UserInfo = {
        isHalloween:
            user.contributionsCollection.contributionCalendar.isHalloween,
        contributionCalendar: windowed,
        windowWeeks: windowWeeks,
        windowContributions: windowContributions,
        fullPeriod: fullPeriod,
        contributesLanguage: languages,
        totalContributions:
            user.contributionsCollection.contributionCalendar
                .totalContributions,
        totalCommitContributions:
            user.contributionsCollection.totalCommitContributions,
        totalIssueContributions:
            user.contributionsCollection.totalIssueContributions,
        totalPullRequestContributions:
            user.contributionsCollection.totalPullRequestContributions,
        totalPullRequestReviewContributions:
            user.contributionsCollection.totalPullRequestReviewContributions,
        totalRepositoryContributions:
            user.contributionsCollection.totalRepositoryContributions,
        totalForkCount: totalForkCount,
        totalStargazerCount: totalStargazerCount,
    };
    return userInfo;
};
