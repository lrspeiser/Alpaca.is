// Header component kept as minimal wrapper for potential future styling
// No title or info button as requested

interface HeaderProps {
  onOpenInfoModal?: () => void; // Made optional since we're not using it
}

export default function Header({ onOpenInfoModal }: HeaderProps) {
  // Return a simplified header that takes up minimal space
  return (
    <header className="sticky top-0 z-50 glass shadow-sm">
      <div className="container mx-auto px-4 py-2 flex justify-between items-center">
        {/* Empty space for layout consistency */}
        <div className="flex-1"></div>
      </div>
    </header>
  );
}
