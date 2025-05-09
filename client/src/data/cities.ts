import type { BingoState } from "@/types";

export const initialBingoState: BingoState = {
  currentCity: "",
  cities: {
    amsterdam: {
      id: "amsterdam",
      title: "Amsterdam Bingo",
      subtitle: "Complete activities to unlock achievements",
      items: [
        { id: 'amsterdam-1', text: 'Take a canal cruise', completed: false },
        { id: 'amsterdam-2', text: 'Visit the Anne Frank House', completed: false },
        { id: 'amsterdam-3', text: 'Rent a bike and cycle around', completed: false },
        { id: 'amsterdam-4', text: 'Try Dutch cheese at a local market', completed: false },
        { id: 'amsterdam-5', text: 'See the tulips at Bloemenmarkt', completed: false },
        { id: 'amsterdam-6', text: 'Visit the Van Gogh Museum', completed: false },
        { id: 'amsterdam-7', text: 'Eat a stroopwafel', completed: false },
        { id: 'amsterdam-8', text: 'Take a photo at the I Amsterdam sign', completed: false },
        { id: 'amsterdam-9', text: 'Try Dutch herring', completed: false },
        { id: 'amsterdam-10', text: 'Visit the Rijksmuseum', completed: false },
        { id: 'amsterdam-11', text: 'Explore the Jordaan district', completed: false },
        { id: 'amsterdam-12', text: 'Drink beer at a brown café', completed: false },
        { id: 'amsterdam-13', text: 'Arrive in Amsterdam', completed: false, isCenterSpace: true, description: 'Welcome to Amsterdam! This beautiful Dutch capital is famous for its elaborate canal system, narrow houses, artistic heritage, and cycling culture.' },
        { id: 'amsterdam-14', text: 'See the narrowest house in Amsterdam', completed: false },
        { id: 'amsterdam-15', text: 'Visit Vondelpark', completed: false },
        { id: 'amsterdam-16', text: 'Take a photo of a windmill', completed: false },
        { id: 'amsterdam-17', text: 'Try bitterballen', completed: false },
        { id: 'amsterdam-18', text: 'Visit the NEMO Science Museum', completed: false },
        { id: 'amsterdam-19', text: 'Shop at the Nine Streets', completed: false },
        { id: 'amsterdam-20', text: 'Visit the Amsterdam Dungeon', completed: false },
        { id: 'amsterdam-21', text: 'Take a day trip to Zaanse Schans', completed: false },
        { id: 'amsterdam-22', text: 'Try Dutch apple pie', completed: false },
        { id: 'amsterdam-23', text: 'Visit the Royal Palace', completed: false },
        { id: 'amsterdam-24', text: 'Go to the A\'DAM Lookout', completed: false },
        { id: 'amsterdam-25', text: 'Explore the Red Light District', completed: false }
      ],
      tips: [
        { title: 'Stroopwafel', text: 'A waffle made from two thin layers of baked dough with a caramel syrup filling in the middle' },
        { title: 'Brown Café', text: 'Traditional Dutch pubs with a brown interior from years of smoking' },
        { title: 'Bitterballen', text: 'Deep-fried crispy meatballs traditionally served with mustard' },
        { title: 'Herring', text: 'Try it "Amsterdam style" - chopped with onions and pickles' },
        { title: 'Cycling', text: 'Remember that bikes have right of way, and there are special traffic lights for cyclists' }
      ]
    },
    barcelona: {
      id: "barcelona",
      title: "Barcelona Bingo",
      subtitle: "Complete activities to unlock achievements",
      items: [
        { id: 'barcelona-1', text: 'Visit Sagrada Familia', completed: false },
        { id: 'barcelona-2', text: 'Walk down La Rambla', completed: false },
        { id: 'barcelona-3', text: 'Visit Park Güell', completed: false },
        { id: 'barcelona-4', text: 'Eat tapas at a local bar', completed: false },
        { id: 'barcelona-5', text: 'See a Flamenco show', completed: false },
        { id: 'barcelona-6', text: 'Explore Casa Batlló', completed: false },
        { id: 'barcelona-7', text: 'Try paella by the beach', completed: false },
        { id: 'barcelona-8', text: 'Visit La Boqueria Market', completed: false },
        { id: 'barcelona-9', text: 'Explore the Gothic Quarter', completed: false },
        { id: 'barcelona-10', text: 'Visit the Picasso Museum', completed: false },
        { id: 'barcelona-11', text: 'Take a photo with street art', completed: false },
        { id: 'barcelona-12', text: 'Drink sangria at a plaza', completed: false },
        { id: 'barcelona-13', text: 'Arrive in Barcelona', completed: false, isCenterSpace: true, description: 'Welcome to Barcelona! Known for its stunning architecture, beautiful beaches, and vibrant culture, Barcelona is the cosmopolitan capital of Spain\'s Catalonia region.' },
        { id: 'barcelona-14', text: 'See Magic Fountain show', completed: false },
        { id: 'barcelona-15', text: 'Visit Barcelona Cathedral', completed: false },
        { id: 'barcelona-16', text: 'Relax at Barceloneta Beach', completed: false },
        { id: 'barcelona-17', text: 'Try churros con chocolate', completed: false },
        { id: 'barcelona-18', text: 'Visit Camp Nou', completed: false },
        { id: 'barcelona-19', text: 'Take the cable car to Montjuïc', completed: false },
        { id: 'barcelona-20', text: 'Visit Casa Milà (La Pedrera)', completed: false },
        { id: 'barcelona-21', text: 'Shop at Passeig de Gràcia', completed: false },
        { id: 'barcelona-22', text: 'Try Cava (Spanish sparkling wine)', completed: false },
        { id: 'barcelona-23', text: 'Visit Palau de la Música Catalana', completed: false },
        { id: 'barcelona-24', text: 'Explore El Born district', completed: false },
        { id: 'barcelona-25', text: 'Visit the Maritime Museum', completed: false }
      ],
      tips: [
        { title: 'Tapas', text: 'Small plates of food - order several to share and try a variety of dishes' },
        { title: 'Paella', text: 'Traditional rice dish - seafood paella is most authentic in Barcelona' },
        { title: 'Gothic Quarter', text: 'Medieval neighborhood with narrow winding streets and hidden squares' },
        { title: 'Magic Fountain', text: 'Check schedule for the free light and music show' },
        { title: 'La Boqueria', text: 'Go early in the morning to avoid crowds at this famous market' }
      ]
    },
    london: {
      id: "london",
      title: "London Bingo",
      subtitle: "Complete activities to unlock achievements",
      items: [
        { id: 'london-1', text: 'See Big Ben', completed: false },
        { id: 'london-2', text: 'Ride the London Eye', completed: false },
        { id: 'london-3', text: 'Visit the Tower of London', completed: false },
        { id: 'london-4', text: 'Watch the Changing of the Guard', completed: false },
        { id: 'london-5', text: 'Take a photo at Abbey Road', completed: false },
        { id: 'london-6', text: 'Have afternoon tea', completed: false },
        { id: 'london-7', text: 'Visit the British Museum', completed: false },
        { id: 'london-8', text: 'Ride a double-decker bus', completed: false },
        { id: 'london-9', text: 'See a West End show', completed: false },
        { id: 'london-10', text: 'Walk across Tower Bridge', completed: false },
        { id: 'london-11', text: 'Visit Buckingham Palace', completed: false },
        { id: 'london-12', text: 'Explore Camden Market', completed: false },
        { id: 'london-13', text: 'Arrive in London', completed: false, isCenterSpace: true, description: 'Welcome to London! The capital of England and the United Kingdom is a 21st-century city with history stretching back to Roman times, famous for its iconic landmarks, museums, and diverse cultural scene.' },
        { id: 'london-14', text: 'Try fish and chips', completed: false },
        { id: 'london-15', text: 'Visit the National Gallery', completed: false },
        { id: 'london-16', text: 'Take a photo in a red phone box', completed: false },
        { id: 'london-17', text: 'Visit Hyde Park', completed: false },
        { id: 'london-18', text: 'Drink a pint in a pub', completed: false },
        { id: 'london-19', text: 'Explore Covent Garden', completed: false },
        { id: 'london-20', text: 'Visit the Tate Modern', completed: false },
        { id: 'london-21', text: 'Ride the Tube', completed: false },
        { id: 'london-22', text: 'Visit Platform 9¾ at King\'s Cross', completed: false },
        { id: 'london-23', text: 'See the Rosetta Stone', completed: false },
        { id: 'london-24', text: 'Shop at Harrods', completed: false },
        { id: 'london-25', text: 'Visit St. Paul\'s Cathedral', completed: false }
      ],
      tips: [
        { title: 'Afternoon Tea', text: 'Traditional British experience with tea, sandwiches, scones, and pastries' },
        { title: 'Changing of the Guard', text: 'Check the schedule as it doesn\'t happen every day' },
        { title: 'British Museum', text: 'Free entry and houses the Rosetta Stone and other famous artifacts' },
        { title: 'Oyster Card', text: 'Get one for easier and cheaper travel on public transport' },
        { title: 'West End', text: 'Look for discount ticket booths in Leicester Square for same-day shows' }
      ]
    },
    paris: {
      id: "paris",
      title: "Paris Bingo",
      subtitle: "Complete activities to unlock achievements",
      items: [
        { id: 'paris-1', text: 'Visit the Eiffel Tower', completed: false },
        { id: 'paris-2', text: 'See Mona Lisa at the Louvre', completed: false },
        { id: 'paris-3', text: 'Visit Notre-Dame Cathedral', completed: false },
        { id: 'paris-4', text: 'Eat a croissant at a café', completed: false },
        { id: 'paris-5', text: 'Walk along the Seine', completed: false },
        { id: 'paris-6', text: 'Visit Sacré-Cœur Basilica', completed: false },
        { id: 'paris-7', text: 'Explore Montmartre', completed: false },
        { id: 'paris-8', text: 'See a cabaret at Moulin Rouge', completed: false },
        { id: 'paris-9', text: 'Visit the Musée d\'Orsay', completed: false },
        { id: 'paris-10', text: 'Stroll through Luxembourg Gardens', completed: false },
        { id: 'paris-11', text: 'Try escargot', completed: false },
        { id: 'paris-12', text: 'Shop on Champs-Élysées', completed: false },
        { id: 'paris-13', text: 'Arrive in Paris', completed: false, isCenterSpace: true, description: 'Welcome to Paris! The capital of France, known as the "City of Light," is famous for its art, fashion, gastronomy, and culture. The city\'s iconic landmarks include the Eiffel Tower, Notre-Dame Cathedral, and the Louvre Museum.' },
        { id: 'paris-14', text: 'Visit Arc de Triomphe', completed: false },
        { id: 'paris-15', text: 'Take a photo at Trocadéro', completed: false },
        { id: 'paris-16', text: 'Visit the Catacombs', completed: false },
        { id: 'paris-17', text: 'Try macarons from Ladurée', completed: false },
        { id: 'paris-18', text: 'Explore Le Marais district', completed: false },
        { id: 'paris-19', text: 'Visit Centre Pompidou', completed: false },
        { id: 'paris-20', text: 'Take a Seine river cruise', completed: false },
        { id: 'paris-21', text: 'Visit Sainte-Chapelle', completed: false },
        { id: 'paris-22', text: 'Have dinner in a bistro', completed: false },
        { id: 'paris-23', text: 'Visit Père Lachaise Cemetery', completed: false },
        { id: 'paris-24', text: 'Try French wine in a wine bar', completed: false },
        { id: 'paris-25', text: 'Visit Palace of Versailles', completed: false }
      ],
      tips: [
        { title: 'Louvre', text: 'Go early or late in the day to avoid crowds, closed on Tuesdays' },
        { title: 'Eiffel Tower', text: 'Book tickets in advance to avoid long lines' },
        { title: 'Montmartre', text: 'Famous artistic district with great views of the city' },
        { title: 'Café Culture', text: 'Take your time - Parisians don\'t rush their coffee' },
        { title: 'Museum Pass', text: 'Worth it if you plan to visit several museums' }
      ]
    },
    rome: {
      id: "rome",
      title: "Rome Bingo",
      subtitle: "Complete activities to unlock achievements",
      items: [
        { id: 'rome-1', text: 'Visit the Colosseum', completed: false },
        { id: 'rome-2', text: 'Throw a coin in Trevi Fountain', completed: false },
        { id: 'rome-3', text: 'Explore the Roman Forum', completed: false },
        { id: 'rome-4', text: 'Visit Vatican Museums & Sistine Chapel', completed: false },
        { id: 'rome-5', text: 'See the Pantheon', completed: false },
        { id: 'rome-6', text: 'Eat gelato near a monument', completed: false },
        { id: 'rome-7', text: 'Visit St. Peter\'s Basilica', completed: false },
        { id: 'rome-8', text: 'Try real Roman pizza', completed: false },
        { id: 'rome-9', text: 'Climb the Spanish Steps', completed: false },
        { id: 'rome-10', text: 'Visit Castel Sant\'Angelo', completed: false },
        { id: 'rome-11', text: 'Explore Trastevere neighborhood', completed: false },
        { id: 'rome-12', text: 'Visit Borghese Gallery', completed: false },
        { id: 'rome-13', text: 'Arrive in Rome', completed: false, isCenterSpace: true, description: 'Welcome to Rome! The "Eternal City" and capital of Italy has a history spanning over 2,500 years. It\'s famous for ancient ruins like the Colosseum, Renaissance masterpieces, and delicious cuisine.' },
        { id: 'rome-14', text: 'Try Cacio e Pepe pasta', completed: false },
        { id: 'rome-15', text: 'Visit the Mouth of Truth', completed: false },
        { id: 'rome-16', text: 'Shop at Campo de\' Fiori market', completed: false },
        { id: 'rome-17', text: 'Visit Piazza Navona', completed: false },
        { id: 'rome-18', text: 'Try suppli (fried rice balls)', completed: false },
        { id: 'rome-19', text: 'Visit the Capitoline Museums', completed: false },
        { id: 'rome-20', text: 'Take a photo with a gladiator', completed: false },
        { id: 'rome-21', text: 'Visit the Catacombs', completed: false },
        { id: 'rome-22', text: 'Drink espresso at a standing bar', completed: false },
        { id: 'rome-23', text: 'Explore Aventine Hill', completed: false },
        { id: 'rome-24', text: 'Try Italian wine', completed: false },
        { id: 'rome-25', text: 'Visit Basilica di Santa Maria Maggiore', completed: false }
      ],
      tips: [
        { title: 'Skip-the-line Tickets', text: 'Essential for Colosseum and Vatican Museums' },
        { title: 'Water Fountains', text: 'Free drinking water fountains (nasoni) are all over Rome' },
        { title: 'Aperitivo', text: 'Pre-dinner drinks often come with free snacks' },
        { title: 'Trastevere', text: 'Best area for authentic Roman cuisine and nightlife' },
        { title: 'Early Mornings', text: 'Best time to see major sites without crowds' }
      ]
    },
    vienna: {
      id: "vienna",
      title: "Vienna Bingo",
      subtitle: "Complete activities to unlock achievements",
      items: [
        { id: 'vienna-1', text: 'Visit Schönbrunn Palace', completed: false },
        { id: 'vienna-2', text: 'Try Sachertorte at Hotel Sacher', completed: false },
        { id: 'vienna-3', text: 'Watch a performance at Vienna State Opera', completed: false },
        { id: 'vienna-4', text: 'Visit St. Stephen\'s Cathedral', completed: false },
        { id: 'vienna-5', text: 'Ride the Giant Ferris Wheel', completed: false },
        { id: 'vienna-6', text: 'Visit Belvedere Palace', completed: false },
        { id: 'vienna-7', text: 'Try Wiener Schnitzel', completed: false },
        { id: 'vienna-8', text: 'Visit Hofburg Palace', completed: false },
        { id: 'vienna-9', text: 'Take a photo at Hundertwasserhaus', completed: false },
        { id: 'vienna-10', text: 'Visit the Naschmarkt', completed: false },
        { id: 'vienna-11', text: 'Experience a traditional coffeehouse', completed: false },
        { id: 'vienna-12', text: 'Visit the Museum Quarter', completed: false },
        { id: 'vienna-13', text: 'Arrive in Vienna', completed: false, isCenterSpace: true, description: 'Welcome to Vienna! The capital of Austria is known for its imperial palaces, classical music heritage, and café culture. This elegant city was once home to Mozart, Beethoven, and Sigmund Freud.' },
        { id: 'vienna-14', text: 'See the Lipizzaner horses', completed: false },
        { id: 'vienna-15', text: 'Explore the Vienna Woods', completed: false },
        { id: 'vienna-16', text: 'Visit the Albertina Museum', completed: false },
        { id: 'vienna-17', text: 'Try Apfelstrudel', completed: false },
        { id: 'vienna-18', text: 'Visit the Austrian National Library', completed: false },
        { id: 'vienna-19', text: 'Try Viennese coffee', completed: false },
        { id: 'vienna-20', text: 'Visit the Natural History Museum', completed: false },
        { id: 'vienna-21', text: 'Take a Danube cruise', completed: false },
        { id: 'vienna-22', text: 'Visit the Vienna City Hall', completed: false },
        { id: 'vienna-23', text: 'Try Kaiserschmarrn', completed: false },
        { id: 'vienna-24', text: 'Visit the Vienna Secession Building', completed: false },
        { id: 'vienna-25', text: 'Shop at Mariahilfer Straße', completed: false }
      ],
      tips: [
        { title: 'Coffeehouse Culture', text: 'Traditional Viennese coffeehouses are UNESCO-listed cultural heritage' },
        { title: 'Sachertorte', text: 'Famous chocolate cake with apricot jam - try the original at Hotel Sacher' },
        { title: 'Standing-room Opera Tickets', text: 'Affordable way to experience world-class opera' },
        { title: 'Naschmarkt', text: 'Vienna\'s most popular market with food stalls and restaurants' },
        { title: 'Vienna Pass', text: 'Offers free entry to top attractions and public transport' }
      ]
    }
  }
};
