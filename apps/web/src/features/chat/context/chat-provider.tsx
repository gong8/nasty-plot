"use client"

import {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from "react"
import type { ChatContextMode } from "@nasty-plot/core"

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
      }}
    >
      {children}
    </ChatContext.Provider>
  )
}

export { MIN_WIDTH, MAX_WIDTH }
