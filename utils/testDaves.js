const TEST_DAVE_SEED = Object.freeze({
  "DC_TEST_DAVE": {
    "userId": "DC_TEST_DAVE",
    "name": "DC_TEST_DAVE",
    "state": "unstable",
    "infectedUsers": [],
    "infectedBy": [],
    "updatedAt": 2777376805613,
    "lat": 36.17,
    "lng": -115.14,
    "fragmentsCollected": [],
"👶": {
      "count": 1,
      "lastTime": 1781055959244
    }
  },
  "TEST_DAVE1": {
    "userId": "TEST_DAVE1",
    "name": "TEST_DAVE1",
    "state": "unstable",
    "infectedUsers": [],
    "infectedBy": [],
    "updatedAt": 2777376805613,
    "lat": 38.60839513038755,
    "lng": -90.50781867573762,
    "fragmentsCollected": []
  },
  "TEST_DAVE2": {
    "userId": "TEST_DAVE2",
    "name": "🌭TEST_DAVE2",
    "state": "dope",
    "infectedUsers": [],
    "infectedBy": [],
    "updatedAt": 2777376805614,
    "lat": 38.60809513038755,
    "lng": -90.50721867573762
  },
  "TEST_DAVE3": {
    "userId": "TEST_DAVE3",
    "name": "🌮TEST_DAVE3",
    "state": "ascended",
    "infectedUsers": [],
    "infectedBy": [],
    "updatedAt": 2777376805615,
    "lat": 38.60749513038755,
    "lng": -90.50721867573762
  },
  "TEST_DAVE4": {
    "userId": "TEST_DAVE4",
    "name": "TEST_DAVE4",
    "state": "awakening",
    "infectedUsers": [],
    "infectedBy": [],
    "updatedAt": 2777376805616,
    "lat": 38.60719513038755,
    "lng": -90.50781867573762
  },
  "TEST_DAVE5": {
    "userId": "TEST_DAVE5",
    "name": "🌶️TEST_DAVE5",
    "state": "immune",
    "infectedUsers": [],
    "infectedBy": [],
    "updatedAt": 2777376805617,
    "lat": 38.60749513038755,
    "lng": -90.50841867573762
  },
  "TEST_DAVE7": {
    "userId": "TEST_DAVE7",
    "name": "TEST_DAVE7",
    "state": "infected",
    "infectedUsers": [],
    "infectedBy": [],
    "updatedAt": 2777376805619,
    "lat": 38.60869513038755,
    "lng": -90.50781867573762
  },
  "TEST_DAVE8": {
    "userId": "TEST_DAVE8",
    "name": "TEST_DAVE8",
    "state": "corrupted",
    "infectedUsers": [],
    "infectedBy": [],
    "updatedAt": 2777376805620,
    "lat": 38.60779513038755,
    "lng": -90.50691867573762
  },  "TEST_DAVE10": {
    "userId": "TEST_DAVE10",
    "name": "TEST_DAVE10",
    "state": "resonant",
    "infectedUsers": [],
    "infectedBy": [],
    "updatedAt": 2777376805622,
    "lat": 38.60699513038755,
    "lng": -90.50871867573762,
    "fragmentsCollected": []
  },
  "TEST_DAVE11": {
    "userId": "TEST_DAVE11",
    "name": "TEST_DAVE11",
    "state": "unstable",
    "infectedUsers": [],
    "infectedBy": [],
    "updatedAt": 2777376805623,
    "lat": 38.60824513038755,
    "lng": -90.50811867573762,
    "fragmentsCollected": []
  },
  "TEST_DAVE12": {
    "userId": "TEST_DAVE12",
    "name": "TEST_DAVE12",
    "state": "immune",
    "infectedUsers": [],
    "infectedBy": [],
    "updatedAt": 2777376805624,
    "lat": 38.60794513038755,
    "lng": -90.50751867573762,
    "fragmentsCollected": []
  },
  "TEST_DAVE13": {
    "userId": "TEST_DAVE13",
    "name": "TEST_DAVE13",
    "state": "infected",
    "infectedUsers": [],
    "infectedBy": [],
    "updatedAt": 2777376805625,
    "lat": 38.60764513038755,
    "lng": -90.50811867573762,
    "fragmentsCollected": []
  },
  "TEST_DAVE14": {
    "userId": "TEST_DAVE14",
    "name": "TEST_DAVE14",
    "state": "ascended",
    "infectedUsers": [],
    "infectedBy": [],
    "updatedAt": 2777376805626,
    "lat": 38.60809513038755,
    "lng": -90.50856867573762,
    "fragmentsCollected": []
  },
  "TEST_DAVE15": {
    "userId": "TEST_DAVE15",
    "name": "TEST_DAVE15",
    "state": "corrupted",
    "infectedUsers": [],
    "infectedBy": [],
    "updatedAt": 2777376805627,
    "lat": 38.60719513038755,
    "lng": -90.50736867573762,
    "fragmentsCollected": []
  }
});

export const TEST_DAVE_IDS = Object.freeze(Object.keys(TEST_DAVE_SEED));

export function createTestDaves(now = Date.now()) {
	return Object.fromEntries(
		Object.entries(TEST_DAVE_SEED).map(([id, dave]) => [
			id,
			{
				...structuredClone(dave),
				isTest: true,
				visible: true,
				updatedAt: now
			}
		])
	);
}
