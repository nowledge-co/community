import { findBridgeCommand } from '../../../hooks/nmem-runtime.mjs';

const command = findBridgeCommand();
if (command) {
  process.stdout.write(command);
} else {
  process.exitCode = 1;
}
