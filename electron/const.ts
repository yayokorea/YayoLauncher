export const ADMINTOOL_URL = 'https://eml.yayokorea.net'

// Shared with the YayoGate server plugin; injected at build time (see CONTRIBUTING.md).
// Empty in local builds, where the server refuses the connection.
export const GATE_SECRET: string = import.meta.env.VITE_YAYO_GATE_SECRET ?? ''
