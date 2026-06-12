import * as state from "../public/utils/state.js";

export const BALL_MASTER_TAG = "ball-master";
export const BALL_MASTER_STREAK_THRESHOLD = 50;
export const BEACH_BALL_ITEM = "🏐";
export const BEACH_BALL_STREAK_INTERVAL = 20;

function grantBeachBall(dave) {
	if (!dave[BEACH_BALL_ITEM]) {
		dave[BEACH_BALL_ITEM] = { count: 0, lastTime: Date.now() };
	}

	dave[BEACH_BALL_ITEM].count += 1;
	dave[BEACH_BALL_ITEM].lastTime = Date.now();
	return dave[BEACH_BALL_ITEM].count;
}

export function applyLineconBump(dave, bestStreak = 0) {
	if (!dave) {
		return null;
	}

	dave.lineconBumps = Math.max(0, Number(dave.lineconBumps ?? 0)) + 1;
	const normalizedBestStreak = Math.max(0, Number(bestStreak ?? 0));
	const awardedBeachBall = normalizedBestStreak > 0 && normalizedBestStreak % BEACH_BALL_STREAK_INTERVAL === 0;
	const beachBalls = awardedBeachBall ? grantBeachBall(dave) : state.getAmt(dave, BEACH_BALL_ITEM);
	dave.lineconBestStreak = Math.max(0, Number(dave.lineconBestStreak ?? 0), normalizedBestStreak);

	const earnedBallMaster = dave.lineconBestStreak > BALL_MASTER_STREAK_THRESHOLD
		? state.addTag(dave, BALL_MASTER_TAG)
		: false;

	return {
		bumps: dave.lineconBumps,
		bestStreak: dave.lineconBestStreak,
		earnedBallMaster,
		awardedBeachBall,
		beachBalls
	};
}
