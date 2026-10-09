// Fast at first and gentle at the end, from 0 to 1.
export const easeOutCubic = (progress: number) =>
	1 - (1 - Math.min(Math.max(progress, 0), 1)) ** 3;

export const tweenOf = (
	from: number,
	to: number,
	elapsed: number,
	duration: number,
) =>
	duration <= 0 ? to : from + (to - from) * easeOutCubic(elapsed / duration);

export const glideMilliseconds = 500;
