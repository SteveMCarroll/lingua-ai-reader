function App() {
  return (
    <div className="min-h-dvh bg-stone-50 text-stone-900 dark:bg-stone-950 dark:text-stone-100">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-stone-200 bg-stone-50/90 px-4 py-3 backdrop-blur dark:border-stone-800 dark:bg-stone-950/90">
        <h1 className="text-lg font-semibold">Lingua AI Reader</h1>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-8">
        <p className="text-stone-500">Select a book to begin reading.</p>
      </main>
    </div>
  )
}

export default App
