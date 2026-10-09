/* eslint-disable @typescript-eslint/naming-convention -- third-party names */
import type { Environment } from "./config.js";

export type TraceAttributes = Readonly<{
	sessionId: string;
	tags: readonly string[];
}>;

export type Tracer = Readonly<{
	isOn: boolean;
	trace: <Result>(
		name: string,
		attributes: TraceAttributes,
		work: () => Promise<Result>,
	) => Promise<Result>;
}>;

const untraced: Tracer = {
	isOn: false,
	trace: async (_name, _attributes, work) => work(),
};

type Started = Readonly<{ tracer: Tracer; stop: () => Promise<void> }>;

let started: Promise<Started> | undefined;

async function start(env: Environment): Promise<Started> {
	const [
		{ NodeTracerProvider },
		{ LangfuseSpanProcessor },
		{ LangfuseVercelAiSdkIntegration },
		{ propagateAttributes, startActiveObservation },
		{ registerTelemetry },
	] = await Promise.all([
		import("@opentelemetry/sdk-trace-node"),
		import("@langfuse/otel"),
		import("@langfuse/vercel-ai-sdk"),
		import("@langfuse/tracing"),
		import("ai"),
	]);
	const processor = new LangfuseSpanProcessor({
		publicKey: env.LANGFUSE_PUBLIC_KEY,
		secretKey: env.LANGFUSE_SECRET_KEY,
		baseUrl: env.LANGFUSE_BASE_URL ?? "https://cloud.langfuse.com",
		environment: "terminal-sigma",
	});
	const provider = new NodeTracerProvider({ spanProcessors: [processor] });
	provider.register();
	registerTelemetry(new LangfuseVercelAiSdkIntegration());

	const tracer: Tracer = {
		isOn: true,
		trace: async (name, attributes, work) =>
			startActiveObservation(name, async () =>
				propagateAttributes(
					{
						traceName: name,
						sessionId: attributes.sessionId,
						tags: [...attributes.tags],
					},
					work,
				),
			),
	};

	return {
		tracer,
		async stop() {
			await processor.forceFlush();
			await provider.shutdown();
		},
	};
}

// Langfuse starts once, and only when both keys are set; otherwise nothing
// is loaded and nothing is sent. A failed start is not cached, so a later
// call can retry, and tracing simply stays off meanwhile.
export async function tracerOf(env: Environment): Promise<Tracer> {
	if (!env.LANGFUSE_PUBLIC_KEY || !env.LANGFUSE_SECRET_KEY) {
		return untraced;
	}

	started ??= start(env);
	try {
		const { tracer } = await started;
		return tracer;
	} catch {
		started = undefined;
		return untraced;
	}
}

// Sends what is still buffered before the process exits; never throws and
// never waits longer than 2 seconds, so an unreachable Langfuse cannot hang it.
export async function stopTracing() {
	if (!started) {
		return;
	}

	let timer: NodeJS.Timeout | undefined;
	try {
		const { stop } = await started;
		await Promise.race([
			stop(),
			new Promise((resolve) => {
				timer = setTimeout(resolve, 2000);
			}),
		]);
	} catch {
		// Exiting matters more than the last traces.
	} finally {
		clearTimeout(timer);
	}
}
