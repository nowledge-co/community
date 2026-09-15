export function createSyncScope() {
	const controller = new AbortController();
	return {
		controller,
		titleController: new AbortController(),
		deadline: Number.POSITIVE_INFINITY,
		check() {
			if (Date.now() >= this.deadline)
				controller.abort(new Error("Thread sync lifecycle deadline exceeded"));
			controller.signal.throwIfAborted();
		},
	};
}

export function withAbort(promise, signal) {
	return new Promise((resolve, reject) => {
		const abort = () => reject(signal.reason);
		signal.addEventListener("abort", abort, { once: true });
		Promise.resolve(promise)
			.then(resolve, reject)
			.finally(() => signal.removeEventListener("abort", abort));
		if (signal.aborted) abort();
	});
}
