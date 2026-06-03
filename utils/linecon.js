import * as state from "../public/utils/state.js";

export const BALL_MASTER_TAG = "ball-master";
export const BALL_MASTER_STREAK_THRESHOLD = 50;

export function applyLineconBump(dave, bestStreak = 0) {
	if (!dave) {
		return null;
	}

	dave.lineconBumps = Math.max(0, Number(dave.lineconBumps ?? 0)) + 1;
	const normalizedBestStreak = Math.max(0, Number(bestStreak ?? 0));
	dave.lineconBestStreak = Math.max(0, Number(dave.lineconBestStreak ?? 0), normalizedBestStreak);

	const earnedBallMaster = dave.lineconBestStreak > BALL_MASTER_STREAK_THRESHOLD
		? state.addTag(dave, BALL_MASTER_TAG)
		: false;

	return {
		bumps: dave.lineconBumps,
		bestStreak: dave.lineconBestStreak,
		earnedBallMaster
	};
}
