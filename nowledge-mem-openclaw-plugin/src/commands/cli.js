export function createCliRegistrar(client, logger) {
	return ({ program }) => {
		const cmd = program
			.command("nowledge-mem")
			.description("Nowledge Mem knowledge base commands");

		cmd
			.command("search")
			.argument("<query>", "Search query")
			.option("--limit <n>", "Max results", "5")
			.action(async (query, opts) => {
				const limit = Number.parseInt(opts.limit, 10) || 5;
				try {
					const results = await client.search(query, limit);
					if (results.length === 0) {
						console.log("No memories found.");
						return;
					}
					for (const r of results) {
						const pct = `${(r.score * 100).toFixed(0)}%`;
						console.log(
							`- [${pct}] ${r.title || "(untitled)"}: ${r.content.slice(0, 120)}`,
						);
					}
				} catch (err) {
					logger.error(`cli search failed: ${err}`);
					console.error("Search failed. Is nmem installed?");
				}
			});

		cmd
			.command("status")
			.description("Check Nowledge Mem status")
			.action(async () => {
				try {
					const healthy = await client.checkHealth();
					console.log(
						healthy ? "Nowledge Mem: running" : "Nowledge Mem: not responding",
					);
				} catch {
					console.log("Nowledge Mem: not installed");
				}
			});
	};
}
