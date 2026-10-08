import test from "ava";
import {
	caloriesOf,
	exerciseName,
	intensityOf,
	leadingActivity,
	leadingExercise,
	setGroupsOf,
} from "../exercises.js";
import {
	intensities,
	languages,
	messagesOf,
	workoutActivities,
} from "../i18n.js";

test("works out calories as MET × kg × hours", (t) => {
	// Running at 6 mph is 9.3 METs: 9.3 × 70 kg × 0.5 h.
	t.is(caloriesOf("running", "moderate", 30, 70), 326);
	t.is(caloriesOf("yoga", "light", 60, 60), 138);
	t.is(caloriesOf("strength", "vigorous", 45, 80), 360);
});

test("reads every activity and intensity the dashboard shows, in every language", (t) => {
	for (const language of languages) {
		const messages = messagesOf(language);

		for (const activity of workoutActivities) {
			t.is(
				leadingActivity(`${messages.workoutActivity[activity]} 30m`)?.value,
				activity,
			);
		}

		for (const intensity of intensities) {
			t.is(intensityOf(messages.intensity[intensity]), intensity);
		}
	}
});

test("matches aliases as whole words, longest first", (t) => {
	t.deepEqual(leadingActivity("jog 5k"), { value: "running", rest: "5k" });
	t.deepEqual(leadingActivity("근력 운동 40m"), {
		value: "strength",
		rest: "40m",
	});
	t.is(leadingActivity("runner 5k"), undefined);
	t.deepEqual(leadingExercise("Bench Press 60x5"), {
		value: "bench",
		rest: "60x5",
	});
	t.deepEqual(leadingExercise("臥推 60x5"), { value: "bench", rest: "60x5" });
	t.is(intensityOf("HARD"), "vigorous");
	t.is(intensityOf("輕鬆"), "light");
	t.is(intensityOf("sideways"), undefined);
});

test("names a known exercise in each language and keeps any other as typed", (t) => {
	t.is(exerciseName("bench", "ko"), "벤치프레스");
	t.is(exerciseName("farmer carry", "en"), "farmer carry");
});

test("groups identical sets into runs", (t) => {
	const set = (weight: number, reps: number) => ({
		exercise: "bench",
		weight,
		reps,
	});

	t.deepEqual(setGroupsOf([set(60, 5), set(60, 5), set(60, 5), set(65, 3)]), [
		{ exercise: "bench", weight: 60, reps: 5, count: 3 },
		{ exercise: "bench", weight: 65, reps: 3, count: 1 },
	]);
	t.deepEqual(setGroupsOf([{ exercise: "dip", reps: 8 }]), [
		{ exercise: "dip", weight: 0, reps: 8, count: 1 },
	]);
	t.deepEqual(setGroupsOf(undefined), []);
});
