import { useMemo, useEffect } from "react";
import { ChatUI, RemoteChatClient } from "@witqq/agent-sdk/chat/react";

export function App() {
  const runtime = useMemo(() => new RemoteChatClient({ baseUrl: "/api/chat" }), []);
  useEffect(() => () => { runtime.dispose(); }, [runtime]);

  return (
    <div className="agent-sdk-app" data-theme="dark">
      <ChatUI
        runtime={runtime}
        authBaseUrl="/api"
      />
    </div>
  );
}
