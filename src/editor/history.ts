import type { HistoryState, LogoDocument } from "./types";

export function createHistory(initial: LogoDocument): HistoryState {
  return {
    past: [],
    present: initial,
    future: [],
  };
}

export function pushHistory(history: HistoryState, next: LogoDocument): HistoryState {
  if (history.present === next) {
    return history;
  }

  return {
    past: [...history.past, history.present],
    present: next,
    future: [],
  };
}

export function undo(history: HistoryState): HistoryState {
  const previous = history.past.at(-1);

  if (!previous) {
    return history;
  }

  return {
    past: history.past.slice(0, -1),
    present: previous,
    future: [history.present, ...history.future],
  };
}

export function redo(history: HistoryState): HistoryState {
  const next = history.future[0];

  if (!next) {
    return history;
  }

  return {
    past: [...history.past, history.present],
    present: next,
    future: history.future.slice(1),
  };
}
