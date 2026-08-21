// Normally you'd want to put these exports in the files that register them, but if you do that you'll get an import order error if you import them in certain cases.
// (importing them runs the whole file to get the ID, causing an import error). I guess it's best practice to separate out IDs, pretty annoying...

export const AXIOM_CTRL_L_ACTION_ID = 'axiom.ctrlLAction'

export const AXIOM_CTRL_K_ACTION_ID = 'axiom.ctrlKAction'

export const AXIOM_ACCEPT_DIFF_ACTION_ID = 'axiom.acceptDiff'

export const AXIOM_REJECT_DIFF_ACTION_ID = 'axiom.rejectDiff'

export const AXIOM_GOTO_NEXT_DIFF_ACTION_ID = 'axiom.goToNextDiff'

export const AXIOM_GOTO_PREV_DIFF_ACTION_ID = 'axiom.goToPrevDiff'

export const AXIOM_GOTO_NEXT_URI_ACTION_ID = 'axiom.goToNextUri'

export const AXIOM_GOTO_PREV_URI_ACTION_ID = 'axiom.goToPrevUri'

export const AXIOM_ACCEPT_FILE_ACTION_ID = 'axiom.acceptFile'

export const AXIOM_REJECT_FILE_ACTION_ID = 'axiom.rejectFile'

export const AXIOM_ACCEPT_ALL_DIFFS_ACTION_ID = 'axiom.acceptAllDiffs'

export const AXIOM_REJECT_ALL_DIFFS_ACTION_ID = 'axiom.rejectAllDiffs'
