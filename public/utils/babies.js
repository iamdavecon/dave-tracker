export const BABY_ITEM = "👶";

export function getBabyStats(dave, state) {
	const count = state.getAmt(dave, BABY_ITEM);
	const lost = Math.max(0, Number(dave?.babiesLost ?? 0));
	const received = Math.max(0, Number(dave?.babiesReceived ?? 0));

	return {
		count,
		lost,
		received,
		hasActivity: count > 0 || lost > 0 || received > 0
	};
}
