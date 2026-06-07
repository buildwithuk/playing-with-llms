import { useState, useRef, useEffect } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import { OpenRouter } from "@openrouter/sdk";
import ReactMarkdown from "react-markdown";

const openrouter = new OpenRouter({
  apiKey: import.meta.env.VITE_OPENROUTER_API_KEY,
});

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface OpenRouterModel {
  id: string;
  name: string;
  pricing: {
    prompt: string;
    completion: string;
  };
}

function App() {
  const [inputText, setInputText] = useState<string>("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const [freeModels, setFreeModels] = useState<{ id: string; name: string }[]>(
    [],
  );
  const [selectedModel, setSelectedModel] = useState<string>("openrouter/free");
  const [isFetchingModels, setIsFetchingModels] = useState<boolean>(true);

  const abortControllerRef = useRef<AbortController | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const fetchModels = async () => {
      try {
        const response = await fetch("https://openrouter.ai/api/v1/models");
        if (!response.ok) throw new Error("Failed to pull active model array.");

        const json = await response.json();
        const allModels: OpenRouterModel[] = json.data;

        const filteredFree = allModels
          .filter(
            (model) =>
              parseFloat(model.pricing.prompt) === 0 &&
              parseFloat(model.pricing.completion) === 0,
          )
          .map((model) => ({
            id: model.id,
            name: model.name || model.id,
          }));

        const finalModelList = [
          { id: "openrouter/free", name: "Auto Free Router (Recommended)" },
          ...filteredFree,
        ];

        setFreeModels(finalModelList);
      } catch (err) {
        console.error("Error retrieving models from OpenRouter:", err);
        setFreeModels([
          { id: "openrouter/free", name: "Auto Free Router (Fallback)" },
          {
            id: "liquid/lfm-2.5-1.2b-thinking:free",
            name: "Liquid LFM 2.5 (Thinking)",
          },
          {
            id: "meta-llama/llama-3.3-70b-instruct:free",
            name: "Llama 3.3 70B",
          },
        ]);
      } finally {
        setIsFetchingModels(false);
      }
    };

    fetchModels();
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading || !inputText.trim()) return;

    const userPrompt = inputText.trim();
    setInputText("");
    setIsLoading(true);

    const updatedMessages: ChatMessage[] = [
      ...messages,
      { role: "user", content: userPrompt },
    ];

    setMessages(updatedMessages);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const cleanApiMessages = updatedMessages.map(({ role, content }) => ({
        role,
        content,
      }));

      const stream = await (openrouter.chat.send(
        {
          chatRequest: {
            model: selectedModel,
            messages: cleanApiMessages,
            stream: true,
          } as any,
        },
        {
          signal: controller.signal,
        },
      ) as unknown as Promise<AsyncIterable<any>>);

      let accumulatedContent = "";

      for await (const chunk of stream) {
        const choice = chunk.choices?.[0];
        if (!choice) continue;

        const contentChunk = choice.delta?.content;

        if (contentChunk) {
          accumulatedContent += contentChunk;

          setMessages([
            ...updatedMessages,
            {
              role: "assistant",
              content: accumulatedContent,
            },
          ]);
        }
      }
    } catch (error: any) {
      console.error("OpenRouter connection error:", error);
      if (error.name === "AbortError" || error.code === "ERR_USER_ABORTED") {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "⚠️ [Generation Stopped by User]" },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "❌ Failed to fetch response from backend server.",
          },
        ]);
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const handleClearChat = () => {
    handleStop();
    setMessages([]);
    setInputText("");
  };

  return (
    <div className="container-fluid vh-100 d-flex flex-column bg-light p-0">
      <header className="bg-white border-bottom py-3 px-4 shadow-sm d-flex flex-column flex-sm-row gap-3 justify-content-between align-items-sm-center">
        <div>
          <h5 className="m-0 fw-bold text-dark">OpenRouter Live Chat</h5>
        </div>

        <div
          className="d-flex align-items-center gap-2"
          style={{ minWidth: "280px" }}
        >
          <label
            htmlFor="modelSelect"
            className="small fw-bold text-muted text-nowrap m-0"
          >
            Model:
          </label>
          {isFetchingModels ? (
            <div className="d-flex align-items-center gap-2 text-muted small px-2">
              <div
                className="spinner-border spinner-border-sm text-secondary"
                role="status"
              />
              <span>Fetching models...</span>
            </div>
          ) : (
            <select
              id="modelSelect"
              className="form-select form-select-sm shadow-none border-secondary-subtle"
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              disabled={isLoading}
            >
              {freeModels.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </header>

      <div
        className="flex-grow-1 overflow-y-auto px-4 py-3"
        style={{ minHeight: 0 }}
      >
        <div className="mx-auto" style={{ maxWidth: "850px" }}>
          {messages.length === 0 && (
            <div className="text-center my-5 py-5 text-muted">
              <h4 className="fw-light">Welcome to the Chat Interface</h4>
              <p className="small">
                Current context: <code>{selectedModel}</code>
              </p>
            </div>
          )}

          {messages.map((msg, index) => (
            <div
              key={index}
              className={`d-flex gap-3 mb-4 ${msg.role === "user" ? "justify-content-end" : "justify-content-start"}`}
            >
              {msg.role === "assistant" && (
                <div className="flex-shrink-0">
                  <img
                    src="https://openrouter.ai/favicon.ico"
                    alt="Bot Profile"
                    className="rounded-circle border border-secondary-subtle shadow-sm"
                    style={{
                      width: "38px",
                      height: "38px",
                      objectFit: "contain",
                      padding: "4px",
                      backgroundColor: "#fff",
                    }}
                  />
                </div>
              )}

              <div
                className={`p-3 rounded-3 shadow-sm ${msg.role === "user" ? "bg-primary text-white" : "bg-white text-dark"}`}
                style={{ maxWidth: "75%" }}
              >
                {msg.role === "user" ? (
                  <div className="pre-line" style={{ whiteSpace: "pre-line" }}>
                    {msg.content}
                  </div>
                ) : (
                  <div className="markdown-content">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                )}
              </div>
            </div>
          ))}

          {isLoading && messages[messages.length - 1]?.role === "user" && (
            <div className="d-flex align-items-center gap-3 mb-4">
              <div className="flex-shrink-0">
                <img
                  src="https://openrouter.ai/favicon.ico"
                  alt="Bot Profile"
                  className="rounded-circle border border-secondary-subtle shadow-sm"
                  style={{
                    width: "38px",
                    height: "38px",
                    objectFit: "contain",
                    padding: "4px",
                    backgroundColor: "#fff",
                  }}
                />
              </div>
              <div className="d-flex align-items-center gap-2 text-muted small">
                <div
                  className="spinner-border spinner-border-sm text-secondary"
                  role="status"
                />
                <span>Awaiting stream response...</span>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>
      </div>

      <footer className="bg-white border-top p-3 shadow-sm">
        <div className="mx-auto" style={{ maxWidth: "850px" }}>
          <form onSubmit={handleSendChat} className="d-flex gap-2">
            <input
              type="text"
              className="form-control py-2 shadow-none"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={
                isLoading
                  ? "Processing output generation pipeline..."
                  : "Type your history-aware message here..."
              }
              disabled={isLoading || isFetchingModels}
            />

            {isLoading ? (
              <button
                className="btn btn-danger px-4"
                type="button"
                onClick={handleStop}
              >
                Stop
              </button>
            ) : (
              <button
                className="btn btn-primary px-4"
                type="submit"
                disabled={!inputText.trim() || isFetchingModels}
              >
                Send
              </button>
            )}
            <button
              className="btn btn-outline-secondary px-3"
              type="button"
              onClick={handleClearChat}
              disabled={messages.length === 0}
              title="Clear entire thread context"
            >
              Clear
            </button>
          </form>
        </div>
      </footer>
    </div>
  );
}

export default App;
