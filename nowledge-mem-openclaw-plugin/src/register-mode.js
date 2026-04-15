export function resolveRegistrationMode({ pluginId, configuredMemorySlot }) {
	const memorySlot = configuredMemorySlot ?? "memory-core";
	const memorySlotSelected = memorySlot === pluginId;
	return {
		memorySlot,
		memorySlotSelected,
		registerMemoryCompatTools: memorySlotSelected,
	};
}
