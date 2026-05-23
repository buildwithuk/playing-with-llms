import { useState, useRef } from "react";
import "bootstrap/dist/css/bootstrap.min.css";

function App() {
  const [inputText, setInputText] = useState<string>("");
  const [thinkingText, setThinkingText] = useState<string>("");
  const [responseText, setResponseText] = useState<string>("");
  const [isThinking, setIsThinking] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // useRef preserves the AbortController instance across renders without triggering updates
  const abortControllerRef = useRef<AbortController | null>(null);

  const requestText = async (prompt: string) => {
    setThinkingText("");
    setResponseText("");
    setIsThinking(true);
    setIsLoading(true);

    // 1. Create a fresh AbortController instance for this request
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await fetch("http://localhost:11434/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "nemotron-3-nano:4b",
          messages: [{ role: "user", content: prompt }],
          stream: true,
        }),
        signal: controller.signal, // 2. Pass the cancellation signal to the fetch request
      });

      if (!response.body) return;

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunkText = decoder.decode(value);
        const lines = chunkText.split("\n");

        for (const line of lines) {
          if (!line.trim()) continue;

          const json = JSON.parse(line);
          const msg = json.message;

          if (!msg) continue;

          if (msg.thinking) {
            setThinkingText((prev) => prev + msg.thinking);
          } else if (msg.content) {
            if (isThinking) setIsThinking(false);
            setResponseText((prev) => prev + msg.content);
          }
        }
      }
    } catch (error: any) {
      // 3. Catch if the error was triggered manually by our abort execution
      if (error.name === "AbortError") {
        console.log("Stream generation was cleanly interrupted by the user.");
        // Optional: Append a small marker to indicate it was stopped
        setResponseText((prev) => prev + "\n\n⚠️ [Generation Stopped]");
      } else {
        console.error("Failed to connect to local Ollama instance:", error);
      }
    } finally {
      setIsThinking(false);
      setIsLoading(false);
      abortControllerRef.current = null; // Clean up memory reference
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoading && inputText && inputText.trim()) {
      requestText(inputText);
    }
  };

  // 4. Function to trigger cancellation
  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  return (
    <div
      className="container-fluid vh-100 d-flex flex-column p-3 bg-light"
      style={{ overflow: "hidden" }}
    >
      <h5 className="text-muted border-bottom pb-2 mb-3">
        Local LLM Interface
      </h5>

      {/* Three-Column Row spanning the remaining height */}
      <div className="row flex-grow-1" style={{ minHeight: 0 }}>
        {/* Section 1: Input controls */}
        <div className="col-md-3 d-flex flex-column mb-3 mb-md-0">
          <div className="card h-100 shadow-sm p-3">
            <h6 className="card-title text-primary fw-bold mb-3">
              1. Prompt Input
            </h6>
            <form
              onSubmit={handleSubmit}
              className="d-flex flex-column h-100 justify-content-between"
            >
              <div className="mb-3 flex-grow-1">
                <textarea
                  className="form-control h-100"
                  style={{ resize: "none" }}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Type your prompt here..."
                />
              </div>

              {/* Dynamic Button Row Layout */}
              <div className="d-flex gap-2">
                {isLoading ? (
                  <>
                    <button
                      className="btn btn-primary flex-grow-1 py-2"
                      type="submit"
                      disabled
                    >
                      <span
                        className="spinner-border spinner-border-sm me-2"
                        role="status"
                        aria-hidden="true"
                      ></span>
                      Running...
                    </button>
                    <button
                      className="btn btn-danger py-2 px-3"
                      type="button"
                      onClick={handleStop}
                    >
                      Stop
                    </button>
                  </>
                ) : (
                  <button
                    className="btn btn-primary w-100 py-2"
                    type="submit"
                    disabled={!inputText || !inputText.trim()}
                  >
                    Submit Prompt
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>

        {/* Section 2: Thinking Process */}
        <div className="col-md-4 d-flex flex-column mb-3 mb-md-0">
          <div
            className="card h-100 shadow-sm d-flex flex-column"
            style={{ minHeight: 0 }}
          >
            <div className="card-header bg-white border-bottom text-muted d-flex align-items-center gap-2 fw-bold py-3">
              {isThinking && (
                <div
                  className="spinner-border spinner-border-sm text-secondary"
                  role="status"
                />
              )}
              <span>
                {isThinking ? "2. Model is Thinking..." : "2. Thought Process"}
              </span>
            </div>
            {/* Scrollable container block */}
            <div
              className="card-body text-secondary font-monospace bg-light"
              style={{
                overflowY: "auto",
                whiteSpace: "pre-line",
                fontSize: "0.85rem",
              }}
            >
              {thinkingText || (
                <span className="text-muted italic font-sans">
                  Awaiting model logic...
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Section 3: Final Output Response */}
        <div className="col-md-5 d-flex flex-column">
          <div
            className="card h-100 shadow-sm d-flex flex-column"
            style={{ minHeight: 0 }}
          >
            <div className="card-header bg-white border-bottom text-success fw-bold py-3">
              3. Final Response
            </div>
            {/* Scrollable container block */}
            <div
              className="card-body bg-white"
              style={{ overflowY: "auto", whiteSpace: "pre-line" }}
            >
              {responseText || (
                <span className="text-muted col-12 d-block">
                  No output generated yet.
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
