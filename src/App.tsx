import { useState } from "react";
import type { BookMeta } from "./data/books";
import { BookSelector } from "./components/BookSelector";
import { Reader } from "./components/Reader";

function App() {
  const [selectedBook, setSelectedBook] = useState<BookMeta | null>(null);

  if (selectedBook) {
    return <Reader book={selectedBook} onBack={() => setSelectedBook(null)} />;
  }

  return (
    <div className="min-h-dvh bg-stone-50 text-stone-900 dark:bg-stone-950 dark:text-stone-100">
      <header className="sticky top-0 z-10 flex items-center justify-center border-b border-stone-200 bg-stone-50/90 px-4 py-3 backdrop-blur dark:border-stone-800 dark:bg-stone-950/90">
        <h1 className="text-lg font-semibold">📖 Lingua AI Reader</h1>
      </header>
      <BookSelector onSelectBook={setSelectedBook} />
    </div>
  );
}

export default App;
