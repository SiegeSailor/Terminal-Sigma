export type Phase = "focus" | "break";

// Running when `endsAt` is set; paused or idle otherwise, holding `remaining`.
export type Timer = Readonly<{
	phase: Phase;
	remaining: number;
	endsAt?: number;
}>;

export type Durations = Readonly<Record<Phase, number>>;

const minute = 60_000;

export const idleTimer = (durations: Durations): Timer => ({
	phase: "focus",
	remaining: durations.focus * minute,
});

export const remainingOf = (timer: Timer, now: number) =>
	Math.max((timer.endsAt ?? now + timer.remaining) - now, 0);

export const toggleTimer = (timer: Timer, now: number): Timer =>
	timer.endsAt === undefined
		? {
				phase: timer.phase,
				remaining: timer.remaining,
				endsAt: now + timer.remaining,
			}
		: { phase: timer.phase, remaining: remainingOf(timer, now) };

// A finished focus starts the break right away; a finished break waits for the user.
export function advanceTimer(
	timer: Timer,
	now: number,
	durations: Durations,
): { timer: Timer; finished?: Phase } {
	if (timer.endsAt === undefined || now < timer.endsAt) {
		return { timer };
	}

	if (timer.phase === "focus") {
		const remaining = durations.break * minute;
		return {
			timer: { phase: "break", remaining, endsAt: now + remaining },
			finished: "focus",
		};
	}

	return { timer: idleTimer(durations), finished: "break" };
}

export function formatClock(milliseconds: number) {
	const seconds = Math.ceil(milliseconds / 1000);
	const pad = (value: number) => String(value).padStart(2, "0");

	return `${pad(Math.floor(seconds / 60))}:${pad(seconds % 60)}`;
}
