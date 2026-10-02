const disabledLogicOperations = new Set(['prepareLogic', 'armLogic', 'dropLogic'])

/** Stale plug-ins must not turn a drag gesture into menu/dialog automation. */
export function assertRegionOperationEnabled(operation) {
  if (disabledLogicOperations.has(operation)) {
    throw new Error('Dialog-driven Logic restoration is disabled. Native timeline restoration is not supported.')
  }
}
