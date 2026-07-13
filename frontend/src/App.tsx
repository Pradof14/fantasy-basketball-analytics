import { PlayersPage } from "./pages/PlayersPage";

function App() {
  return (
    <div className="min-h-screen bg-court-bg">
      <header className="border-b border-court-line px-6 py-4">
        <span className="font-mono text-sm tracking-wide text-stat-accent">
          FANTASY BBALL ANALYTICS
        </span>
      </header>
      <PlayersPage />
    </div>
  );
}

export default App;
