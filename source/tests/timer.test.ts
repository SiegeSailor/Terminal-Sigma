import test from "ava";
import {
	advanceTimer,
	formatClock,
	idleTimer,
	remainingOf,
	toggleTimer,
} from "../timer.js";

const durations = { focus: 25, break: 5 };
const minute = 60_000;

test("starts, pauses, and resumes without losing time", (t) => {
	const started = toggleTimer(idleTimer(durations), 0);
	t.is(started.endsAt, 25 * minute);

	const paused = toggleTimer(started, 10 * minute);
	t.is(paused.endsAt, undefined);
	t.is(remainingOf(paused, 99 * minute), 15 * minute);

	const resumed = toggleTimer(paused, 20 * minute);
	t.is(resumed.endsAt, 35 * minute);
});

test("rolls a finished focus into a break, then back to idle", (t) => {
	const started = toggleTimer(idleTimer(durations), 0);

	t.is(advanceTimer(started, 24 * minute, durations).finished, undefined);

	const afterFocus = advanceTimer(started, 25 * minute, durations);
	t.is(afterFocus.finished, "focus");
	t.is(afterFocus.timer.phase, "break");
	t.is(afterFocus.timer.endsAt, 30 * minute);

	const afterBreak = advanceTimer(afterFocus.timer, 30 * minute, durations);
	t.is(afterBreak.finished, "break");
	t.deepEqual(afterBreak.timer, idleTimer(durations));
});

test("formats a countdown as minutes and seconds", (t) => {
	t.is(formatClock(25 * minute), "25:00");
	t.is(formatClock(61_500), "01:02");
	t.is(formatClock(0), "00:00");
});
