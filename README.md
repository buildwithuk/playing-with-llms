### Local LLM Interface with Streamed Reasoner Analytics

A clean, responsive, single-page React interface built with Vite, TypeScript, and Bootstrap 5. This application connects directly to a local Ollama instance to provide real-time streaming of both Thought Processes (reasoning tokens) and Final Responses concurrently into a non-blocking three-column layout.

#### Key Features

- **Real-time Dual Streaming**: Captures and segregates native Ollama message.thinking (reasoning/thought traces) and message.content (final answers) on the fly without complex regex string parsing.

- **Deterministic Viewport Mechanics**: Implements strict `100vh` boundaries with independent Flexbox overflow containers `(overflow-y: auto)`, preventing layout shifting and scroll leakage below the monitor threshold.

- **Active Stream Interruption**: Uses native JavaScript AbortController hooks to allow instant generation cancellation via a dedicated UI Stop button.

- **Keyboard Navigation**: Native `<form>` encapsulation allows automatic Enter key execution alongside standard form validation.

#### Tech Stack Components

- **Frontend Build Tooling**: Vite + TypeScript (TSX compilation engine)

- **View Layer Engine**: React.js (Hooks utilized: useState, useRef)

- **Styling Matrix**: Bootstrap 5 utility frameworks

- **API Ingestion Engine**: Native Fetch API utilizing ReadableStream line readers (TextDecoder)
