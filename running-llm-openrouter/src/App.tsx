import { useState, useRef, useEffect } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import { OpenRouter } from "@openrouter/sdk";

const openrouter = new OpenRouter({
  apiKey: import.meta.env.VITE_OPENROUTER_API_KEY,
});

function App() {
  const [inputText, setInputText] = useState<string>("");
  const [thinkingText, setThinkingText] = useState<string>("");
  const [responseText, setResponseText] = useState<string>("");
  const [isThinking, setIsThinking] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const abortControllerRef = useRef<AbortController | null>(null);

  const thinkingEndRef = useRef<HTMLDivElement | null>(null);
  const responseEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    thinkingEndRef.current?.scrollIntoView({ behavior: "auto" });
  }, [thinkingText]);

  useEffect(() => {
    responseEndRef.current?.scrollIntoView({ behavior: "auto" });
  }, [responseText]);

  const requestText = async (prompt: string) => {
    setThinkingText("");
    setResponseText("");
    setIsThinking(true);
    setIsLoading(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const stream = await (openrouter.chat.send(
        {
          chatRequest: {
            model: "liquid/lfm-2.5-1.2b-thinking:free",
            messages: [{ role: "user", content: prompt }],
            stream: true,
            include_reasoning: true,
          } as any, // Bypasses internal parameter validation matching engine
        },
        {
          signal: controller.signal,
        },
      ) as unknown as Promise<AsyncIterable<any>>);

      for await (const chunk of stream) {
        console.log(chunk);
        const choice = chunk.choices?.[0];
        if (!choice) continue;

        const thinking = (choice.delta as any).reasoning;
        const content = choice.delta?.content;

        if (thinking) {
          setThinkingText((prev) => prev + thinking);
        } else if (content) {
          if (isThinking) setIsThinking(false);
          setResponseText((prev) => prev + content);
        }
      }
    } catch (error: any) {
      console.log(error);
      if (error.name === "AbortError" || error.code === "ERR_USER_ABORTED") {
        console.log("Stream generation was cleanly interrupted by the user.");
        setResponseText((prev) => prev + "\n\n⚠️ [Generation Stopped]");
      } else {
        console.error("Failed to connect to OpenRouter:", error);
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

  // Function to trigger cancellation
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
        OpenRouter LLM Interface
      </h5>

      <div className="row flex-grow-1" style={{ minHeight: 0 }}>
        <div
          className="col-md-3 d-flex flex-column mb-3 mb-md-0"
          style={{ height: "100%" }}
        >
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

        <div
          className="col-md-4 d-flex flex-column mb-3 mb-md-0"
          style={{ height: "100%" }}
        >
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
            <div
              className="card-body text-secondary font-monospace bg-light"
              style={{
                height: "100%",
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
              <div ref={thinkingEndRef} />
            </div>
          </div>
        </div>

        <div className="col-md-5 d-flex flex-column" style={{ height: "100%" }}>
          <div
            className="card h-100 shadow-sm d-flex flex-column"
            style={{ minHeight: 0 }}
          >
            <div className="card-header bg-white border-bottom text-success fw-bold py-3">
              3. Final Response
            </div>
            <div
              className="card-body bg-white"
              style={{
                height: "100%",
                overflowY: "auto",
                whiteSpace: "pre-line",
              }}
            >
              {responseText || (
                <span className="text-muted col-12 d-block">
                  No output generated yet.
                </span>
              )}
              <div ref={responseEndRef} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
