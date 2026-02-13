"use client"

import {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useEffect,
  useState,
  useRef,
  type ReactNode,
  type MutableRefObject,
} from "react"
import type { ChatContextMode, AutoAnalyzeDepth } from "@nasty-plot/core"

// --- Stream Control ---

export interface StreamControl {
  sendAutoAnalyze: (prompt: string, turn: number, depth: AutoAnalyzeDepth) => Promise<void>
  stopGeneration: () => void
  isStreaming: boolean
}

// --- Pending Context ---

export interface PendingChatContext {
  contextMode: ChatContextMode
  contextData: string // JSON string
}

// --- State ---

interface ChatSidebarState {
  isOpen: boolean
  width: number
  activeSessionId: string | null
}

type ChatAction =
  | { type: "TOGGLE_SIDEBAR" }
  | { type: "OPEN_SIDEBAR" }
  | { type: "CLOSE_SIDEBAR" }
  | { type: "SET_WIDTH"; width: number }
  | { type: "SWITCH_SESSION"; sessionId: string | null }
  | { type: "NEW_SESSION" }
  | { type: "HYDRATE"; state: ChatSidebarState }

const DEFAULT_WIDTH = 420
const MIN_WIDTH = 300
const MAX_WIDTH = 600
const STORAGE_KEY_WIDTH = "nasty-plot-sidebar-width"
const STORAGE_KEY_OPEN = "nasty-plot-sidebar-open"
const STORAGE_KEY_SESSION = "nasty-plot-active-session"

function clampWidth(width: number): number {
  return Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, width))
}

function chatReducer(state: ChatSidebarState, action: ChatAction): ChatSidebarState {
  switch (action.type) {
    case "TOGGLE_SIDEBAR":
      return { ...state, isOpen: !state.isOpen }
    case "OPEN_SIDEBAR":
      return { ...state, isOpen: true }
    case "CLOSE_SIDEBAR":
      return { ...state, isOpen: false }
    case "SET_WIDTH":
      return { ...state, width: clampWidth(action.width) }
    case "SWITCH_SESSION":
      return { ...state, activeSessionId: action.sessionId }
    case "NEW_SESSION":
      return { ...state, activeSessionId: null }
    case "HYDRATE":
      return action.state
    default:
      return state
  }
}

// --- Context ---

interface ChatContextValue {
  isOpen: boolean
  width: number
  activeSessionId: string | null
  pendingInput: string | null
  pendingContext: PendingChatContext | null
  pendingQuestion: string | null
  showNewChatModal: boolean
  autoAnalyze: { enabled: boolean; depth: AutoAnalyzeDepth }
  isAutoAnalyzing: boolean
  toggleSidebar: () => void
  openSidebar: (message?: string) => void
  closeSidebar: () => void
  clearPendingInput: () => void
  setWidth: (width: number) => void
  switchSession: (sessionId: string | null) => void
  newSession: () => void
  openContextChat: (params: PendingChatContext) => void
  clearPendingContext: () => void
  setPendingQuestion: (question: string) => void
  clearPendingQuestion: () => void
  openNewChatModal: () => void
  closeNewChatModal: () => void
  setAutoAnalyzeEnabled: (enabled: boolean) => void
  setAutoAnalyzeDepth: (depth: AutoAnalyzeDepth) => void
  registerStreamControl: (controls: StreamControl) => void
  triggerAutoAnalyze: (prompt: string, turn: number, depth: AutoAnalyzeDepth) => Promise<void>
  stopAutoAnalyze: () => void
  // Guided builder bridge
  guidedBuilderContextRef: MutableRefObject<Record<string, unknown> | null>
  setGuidedBuilderContext: (ctx: Record<string, unknown> | null) => void
  guidedActionNotifyRef: MutableRefObject<
    ((n: { name: string; label: string; input: Record<string, unknown> }) => void) | null
  >
  autoSendMessage: string | null
  queueAutoSend: (text: string) => void
  clearAutoSend: () => void
  isChatStreaming: boolean
  setIsChatStreaming: (streaming: boolean) => void
  guidedBuilderStep: string | null
  guidedBuilderTeamSize: number
}

const ChatContext = createContext<ChatContextValue | null>(null)

export function useChatSidebar(): ChatContextValue {
  const ctx = useContext(ChatContext)
  if (!ctx) throw new Error("useChatSidebar must be used within ChatProvider")
  return ctx
}

// --- Provider ---

const SSR_INITIAL_STATE: ChatSidebarState = {
  isOpen: false,
  width: DEFAULT_WIDTH,
  activeSessionId: null,
}

export function ChatProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(chatReducer, SSR_INITIAL_STATE)
  const [pendingInput, setPendingInput] = useState<string | null>(null)
  const [pendingContext, setPendingContext] = useState<PendingChatContext | null>(null)
  const [pendingQuestion, setPendingQuestionState] = useState<string | null>(null)
  const [showNewChatModal, setShowNewChatModal] = useState(false)
  const [autoAnalyzeEnabled, setAutoAnalyzeEnabled] = useState(false)
  const [autoAnalyzeDepth, setAutoAnalyzeDepth] = useState<AutoAnalyzeDepth>("quick")
  const streamControlRef = useRef<StreamControl | null>(null)
  // Guided builder bridge state (ref, not state — avoids re-render loops)
  const guidedBuilderContextRef = useRef<Record<string, unknown> | null>(null)
  const guidedActionNotifyRef = useRef<
    ((n: { name: string; label: string; input: Record<string, unknown> }) => void) | null
  >(null)
  const [autoSendMessage, setAutoSendMessage] = useState<string | null>(null)
  const [isChatStreaming, setIsChatStreaming] = useState(false)
  const [guidedBuilderStep, setGuidedBuilderStep] = useState<string | null>(null)
  const [guidedBuilderTeamSize, setGuidedBuilderTeamSize] = useState(0)
  const [isAutoAnalyzing, setIsAutoAnalyzing] = useState(false)

  // Hydrate from localStorage after mount (avoids SSR/client mismatch)
  useEffect(() => {
    const storedWidth = localStorage.getItem(STORAGE_KEY_WIDTH)
    const storedOpen = localStorage.getItem(STORAGE_KEY_OPEN)
    const storedSession = localStorage.getItem(STORAGE_KEY_SESSION)

    dispatch({
      type: "HYDRATE",
      state: {
        isOpen: storedOpen === "true",
        width: storedWidth ? clampWidth(Number(storedWidth)) : DEFAULT_WIDTH,
        activeSessionId: storedSession || null,
      },
    })
  }, [])

  // Persist to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_WIDTH, String(state.width))
  }, [state.width])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_OPEN, String(state.isOpen))
  }, [state.isOpen])

  useEffect(() => {
    if (state.activeSessionId) {
      localStorage.setItem(STORAGE_KEY_SESSION, state.activeSessionId)
    } else {
      localStorage.removeItem(STORAGE_KEY_SESSION)
    }
  }, [state.activeSessionId])

  const toggleSidebar = useCallback(() => dispatch({ type: "TOGGLE_SIDEBAR" }), [])
  const openSidebar = useCallback((message?: string) => {
    dispatch({ type: "OPEN_SIDEBAR" })
    if (message) setPendingInput(message)
  }, [])
  const closeSidebar = useCallback(() => dispatch({ type: "CLOSE_SIDEBAR" }), [])
  const clearPendingInput = useCallback(() => setPendingInput(null), [])
  const setWidth = useCallback((width: number) => dispatch({ type: "SET_WIDTH", width }), [])
  const switchSession = useCallback(
    (sessionId: string | null) => dispatch({ type: "SWITCH_SESSION", sessionId }),
    [],
  )
  const newSession = useCallback(() => dispatch({ type: "NEW_SESSION" }), [])
  const openContextChat = useCallback((params: PendingChatContext) => {
    setPendingContext(params)
    dispatch({ type: "NEW_SESSION" })
    dispatch({ type: "OPEN_SIDEBAR" })
  }, [])
  const clearPendingContext = useCallback(() => setPendingContext(null), [])
  const setPendingQuestion = useCallback(
    (question: string) => setPendingQuestionState(question),
    [],
  )
  const clearPendingQuestion = useCallback(() => setPendingQuestionState(null), [])
  const openNewChatModal = useCallback(() => {
    dispatch({ type: "OPEN_SIDEBAR" })
    setShowNewChatModal(true)
  }, [])
  const closeNewChatModal = useCallback(() => setShowNewChatModal(false), [])

  const registerStreamControl = useCallback((controls: StreamControl) => {
    streamControlRef.current = controls
  }, [])

  const triggerAutoAnalyze = useCallback(
    async (prompt: string, turn: number, depth: AutoAnalyzeDepth) => {
      const ctrl = streamControlRef.current
      if (!ctrl) return
      setIsAutoAnalyzing(true)
      try {
        await ctrl.sendAutoAnalyze(prompt, turn, depth)
      } finally {
        setIsAutoAnalyzing(false)
      }
    },
    [],
  )

  const stopAutoAnalyze = useCallback(() => {
    const ctrl = streamControlRef.current
    if (!ctrl) return
    ctrl.stopGeneration()
    setIsAutoAnalyzing(false)
  }, [])

  // Guided builder bridge callbacks
  const setGuidedBuilderContext = useCallback((ctx: Record<string, unknown> | null) => {
    guidedBuilderContextRef.current = ctx
    setGuidedBuilderStep((ctx?.step as string) ?? null)
    setGuidedBuilderTeamSize((ctx?.teamSize as number) ?? 0)
  }, [])
  const queueAutoSend = useCallback((text: string) => setAutoSendMessage(text), [])
  const clearAutoSend = useCallback(() => setAutoSendMessage(null), [])

  return (
    <ChatContext.Provider
      value={{
        isOpen: state.isOpen,
        width: state.width,
        activeSessionId: state.activeSessionId,
        pendingInput,
        pendingContext,
        pendingQuestion,
        showNewChatModal,
        autoAnalyze: { enabled: autoAnalyzeEnabled, depth: autoAnalyzeDepth },
        isAutoAnalyzing,
        toggleSidebar,
        openSidebar,
        closeSidebar,
        clearPendingInput,
        setWidth,
        switchSession,
        newSession,
        openContextChat,
        clearPendingContext,
        setPendingQuestion,
        clearPendingQuestion,
        openNewChatModal,
        closeNewChatModal,
        setAutoAnalyzeEnabled,
        setAutoAnalyzeDepth,
        registerStreamControl,
        triggerAutoAnalyze,
        stopAutoAnalyze,
        guidedBuilderContextRef,
        setGuidedBuilderContext,
        guidedActionNotifyRef,
        autoSendMessage,
        queueAutoSend,
        clearAutoSend,
        isChatStreaming,
        setIsChatStreaming,
        guidedBuilderStep,
        guidedBuilderTeamSize,
      }}
    >
      {children}
    </ChatContext.Provider>
  )
}

export { MIN_WIDTH, MAX_WIDTH }
