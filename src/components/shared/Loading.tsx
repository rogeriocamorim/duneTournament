export function Loading() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="inline-block w-16 h-16 border-4 border-dune-spice-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-dune-sand-300 text-lg font-dune">Loading...</p>
      </div>
    </div>
  );
}
