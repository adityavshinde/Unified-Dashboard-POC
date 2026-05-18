import "@fontsource/roboto/300.css";
import "@fontsource/roboto/400.css";
import "@fontsource/roboto/500.css";
import "@fontsource/roboto/700.css";
import { Dashboard } from "./dashboard/Dashboard";
import { AiModeProvider } from "./theme/AiModeContext";
import { ColorModeProvider } from "./theme/ColorModeContext";
import { StatCardsPreferencesProvider } from "./theme/StatCardsPreferencesContext";
import "./index.css";

export function App() {
  return (
    <ColorModeProvider>
      <StatCardsPreferencesProvider>
        <AiModeProvider>
          <Dashboard />
        </AiModeProvider>
      </StatCardsPreferencesProvider>
    </ColorModeProvider>
  );
}

export default App;
