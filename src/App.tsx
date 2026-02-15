import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { TournamentProvider } from './context/TournamentContext';
import { Header } from './components/layout/Header';
import { TournamentSetup } from './components/setup/TournamentSetup';
import { TableDraft } from './components/draft/TableDraft';
import { RoundManager } from './components/round/RoundManager';
import { ResultsEntry } from './components/results/ResultsEntry';
import { Standings } from './components/standings/Standings';
import { FinalResults } from './components/standings/FinalResults';

function App() {
  return (
    <TournamentProvider>
      <BrowserRouter basename="/duneTournament">
        <div className="min-h-screen bg-dune-gradient">
          <Header />
          <Routes>
            <Route path="/" element={<Navigate to="/setup" replace />} />
            <Route path="/setup" element={<TournamentSetup />} />
            <Route path="/draft" element={<TableDraft />} />
            <Route path="/round" element={<RoundManager />} />
            <Route path="/results" element={<ResultsEntry />} />
            <Route path="/standings" element={<Standings />} />
            <Route path="/final" element={<FinalResults />} />
          </Routes>
        </div>
      </BrowserRouter>
    </TournamentProvider>
  );
}

export default App;
