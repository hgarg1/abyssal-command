import { StrictMode, Component, type ErrorInfo, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('Abyssal UI failure', error, info); }
  render() {
    return this.state.error
      ? <div className="fatal-error"><b>COMMAND INTERFACE FAILURE</b><p>{this.state.error.message}</p><button onClick={() => location.reload()}>Reinitialize</button></div>
      : this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(<StrictMode><ErrorBoundary><App /></ErrorBoundary></StrictMode>);
