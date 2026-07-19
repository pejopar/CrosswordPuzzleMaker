import React, { createContext, useContext, useEffect, useReducer, useRef } from 'react';
import { Dir, Issue, Project } from '../model/types';
import { createSampleProject } from '../model/sample';

export type Tool =
  | 'select'
  | 'move'
  | 'letter'
  | 'textClue'
  | 'imageClue'
  | 'arrow'
  | 'blocked'
  | 'decor'
  | 'eraser';

export type SidebarTab = 'sisalto' | 'rakenne' | 'sanat' | 'kuvat' | 'tyyli';
export type ViewMode = 'editor' | 'preview' | 'answers';

export interface Rect {
  r0: number;
  c0: number;
  r1: number;
  c1: number;
}

export type ModalKind =
  | { kind: 'new' }
  | { kind: 'import' }
  | { kind: 'autofill' }
  | { kind: 'export' }
  | {
      kind: 'confirm';
      title: string;
      message: string;
      confirmLabel?: string;
      danger?: boolean;
      onConfirm: () => void;
    };

export interface AiPreview {
  cells: { r: number; c: number; letter: string }[];
  label: string;
}

export interface UIState {
  tool: Tool;
  tab: SidebarTab;
  sel: { r: number; c: number } | null;
  selRect: Rect | null;
  selRegionId: string | null;
  dirPref: Dir;
  zoom: number;
  view: ViewMode;
  modal: ModalKind | null;
  ctxMenu: { x: number; y: number; r: number; c: number } | null;
  bottomOpen: boolean;
  issues: Issue[] | null;
  aiPreview: AiPreview | null;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  toast: string | null;
}

export interface AppState {
  past: Project[];
  project: Project;
  future: Project[];
  ui: UIState;
}

export type Action =
  | { type: 'mutate'; fn: (p: Project) => Project }
  | { type: 'ui'; patch: Partial<UIState> }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'load'; project: Project };

const HISTORY_LIMIT = 60;

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'mutate': {
      const next = action.fn(state.project);
      if (next === state.project) return state;
      return {
        ...state,
        past: [...state.past.slice(-HISTORY_LIMIT + 1), state.project],
        project: next,
        future: [],
      };
    }
    case 'ui':
      return { ...state, ui: { ...state.ui, ...action.patch } };
    case 'undo': {
      if (!state.past.length) return state;
      const prev = state.past[state.past.length - 1];
      return {
        ...state,
        past: state.past.slice(0, -1),
        project: prev,
        future: [state.project, ...state.future],
        ui: { ...state.ui, aiPreview: null, issues: null },
      };
    }
    case 'redo': {
      if (!state.future.length) return state;
      const [next, ...rest] = state.future;
      return {
        ...state,
        past: [...state.past, state.project],
        project: next,
        future: rest,
        ui: { ...state.ui, aiPreview: null, issues: null },
      };
    }
    case 'load':
      return {
        past: [],
        project: action.project,
        future: [],
        ui: {
          ...state.ui,
          sel: null,
          selRect: null,
          selRegionId: null,
          modal: null,
          ctxMenu: null,
          issues: null,
          aiPreview: null,
        },
      };
  }
}

const STORAGE_KEY = 'ristikkostudio.project.v1';

function loadInitial(): Project {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      if (p && p.cells && p.rows) return p as Project;
    }
  } catch {
    // paikallinen tallennus ei käytettävissä – aloitetaan esimerkkiprojektista
  }
  return createSampleProject();
}

const initialState = (): AppState => ({
  past: [],
  project: loadInitial(),
  future: [],
  ui: {
    tool: 'select',
    tab: 'sisalto',
    sel: null,
    selRect: null,
    selRegionId: null,
    dirPref: 'across',
    zoom: 1,
    view: 'editor',
    modal: null,
    ctxMenu: null,
    bottomOpen: false,
    issues: null,
    aiPreview: null,
    saveStatus: 'saved',
    toast: null,
  },
});

interface StoreCtx {
  state: AppState;
  dispatch: React.Dispatch<Action>;
  mutate: (fn: (p: Project) => Project) => void;
  ui: (patch: Partial<UIState>) => void;
  undo: () => void;
  redo: () => void;
  toast: (msg: string) => void;
}

const Ctx = createContext<StoreCtx>(null!);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  const saveTimer = useRef<number | null>(null);
  const toastTimer = useRef<number | null>(null);

  // Automaattinen paikallinen tallennus
  useEffect(() => {
    dispatch({ type: 'ui', patch: { saveStatus: 'saving' } });
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state.project));
        dispatch({ type: 'ui', patch: { saveStatus: 'saved' } });
      } catch {
        dispatch({ type: 'ui', patch: { saveStatus: 'error' } });
      }
    }, 700);
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    };
  }, [state.project]);

  const value: StoreCtx = {
    state,
    dispatch,
    mutate: (fn) => dispatch({ type: 'mutate', fn }),
    ui: (patch) => dispatch({ type: 'ui', patch }),
    undo: () => dispatch({ type: 'undo' }),
    redo: () => dispatch({ type: 'redo' }),
    toast: (msg) => {
      dispatch({ type: 'ui', patch: { toast: msg } });
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
      toastTimer.current = window.setTimeout(
        () => dispatch({ type: 'ui', patch: { toast: null } }),
        3200
      );
    },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): StoreCtx {
  return useContext(Ctx);
}
