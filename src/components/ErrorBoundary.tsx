// Catches render crashes that would otherwise leave a blank white window,
// and logs them to the app's log file (via @tauri-apps/plugin-log) so a
// user's bug report can include something more useful than "it went blank."

import { Component, type ReactNode } from "react";
import { error as logError } from "@tauri-apps/plugin-log";

type Props = { children: ReactNode };
type State = { hasError: boolean };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(err: Error, info: { componentStack?: string | null }) {
    logError(`Render crash: ${err.message}\n${err.stack ?? ""}\n${info.componentStack ?? ""}`).catch(() => {});
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="app app--loading">
          <span>Something went wrong. Check the app logs, then restart Manager.</span>
        </div>
      );
    }
    return this.props.children;
  }
}
