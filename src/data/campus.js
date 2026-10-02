/**
 * The campus, as plain data.
 *
 * Lakeview Campus is made up for this project. To model your own campus,
 * change the three lists below; nothing else in the code needs to know.
 *
 *   LOCATIONS   an array of records, one per place (the "array" in the DSA list)
 *   PATHS       the walkways and roads that join two places (the graph's edges)
 *   CATEGORIES  how places are grouped (the category tree)
 *
 * x and y are positions on the map in metres: x grows to the east, y grows to
 * the south, and the whole map is 1200 m by 760 m. Each path's distance is its
 * length on the map, rounded to the nearest 5 m.
 */

export const MAP_SIZE = { width: 1200, height: 760 };

/** Average walking pace, used to turn metres into minutes. */
export const WALK_METRES_PER_MINUTE = 80;

export const LOCATIONS = [
  { id: 'GAT', name: 'Main Gate', category: 'gates', x: 560, y: 705, about: 'Main entrance with the security desk. Visitors sign in here.' },
  { id: 'BUS', name: 'Bus Bay', category: 'rides', x: 385, y: 700, about: 'College buses and city buses stop here.' },
  { id: 'PRK', name: 'Parking', category: 'rides', x: 735, y: 700, about: 'Two-wheeler and car parking for students and staff.' },
  { id: 'ADM', name: 'Admin Block', category: 'services', x: 465, y: 595, about: 'Admissions, fee counter and the exam cell.' },
  { id: 'AUD', name: 'Auditorium', category: 'events', x: 670, y: 590, about: 'Seats 800. Used for fests, guest talks and convocation.' },
  { id: 'QUA', name: 'Central Quad', category: 'open', x: 580, y: 450, about: 'The lawn in the middle of campus. Most paths cross here.' },
  { id: 'LIB', name: 'Central Library', category: 'study', x: 590, y: 290, about: 'Three floors of books and a reading hall open till 9 pm.' },
  { id: 'LHC', name: 'Lecture Hall Complex', category: 'study', x: 400, y: 440, about: 'Twelve large halls shared by all first-year classes.' },
  { id: 'LAB', name: 'Innovation Lab', category: 'study', x: 300, y: 120, about: 'Maker space with 3D printers, robotics kits and project rooms.' },
  { id: 'CSE', name: 'CSE Block', category: 'departments', x: 300, y: 300, about: 'Computer Science and Engineering: classrooms and computer labs.' },
  { id: 'ECE', name: 'ECE Block', category: 'departments', x: 200, y: 430, about: 'Electronics and Communication: circuits and signal labs.' },
  { id: 'MEC', name: 'Mechanical Block', category: 'departments', x: 150, y: 190, about: 'Mechanical Engineering: workshops and the CAD lab.' },
  { id: 'SCI', name: 'Science Block', category: 'departments', x: 440, y: 190, about: 'Physics, chemistry and maths departments.' },
  { id: 'MBA', name: 'Management Block', category: 'departments', x: 620, y: 140, about: 'School of Management: case-study rooms and seminar hall.' },
  { id: 'CAF', name: 'Food Court', category: 'meals', x: 760, y: 460, about: 'Six counters serving South Indian, North Indian and Chinese.' },
  { id: 'MES', name: 'Hostel Mess', category: 'meals', x: 930, y: 510, about: 'Breakfast, lunch and dinner for hostel residents.' },
  { id: 'COF', name: 'Coffee Kiosk', category: 'snacks', x: 490, y: 350, about: 'Filter coffee, tea and sandwiches between classes.' },
  { id: 'JUI', name: 'Juice Corner', category: 'snacks', x: 900, y: 380, about: 'Fresh juice and fruit bowls next to the sports area.' },
  { id: 'BHO', name: "Boys' Hostel", category: 'stay', x: 1040, y: 600, about: 'Four blocks of rooms with a common room on each floor.' },
  { id: 'GHO', name: "Girls' Hostel", category: 'stay', x: 830, y: 130, about: 'Three blocks of rooms with a study lounge.' },
  { id: 'GST', name: 'Guest House', category: 'stay', x: 890, y: 680, about: 'Rooms for visiting parents and faculty.' },
  { id: 'SPC', name: 'Sports Complex', category: 'sports', x: 930, y: 250, about: 'Indoor badminton, table tennis, gym and a swimming pool.' },
  { id: 'GRD', name: 'Playground', category: 'sports', x: 1060, y: 370, about: 'Cricket and football ground with a 400 m running track.' },
  { id: 'OAT', name: 'Open-Air Theatre', category: 'events', x: 300, y: 580, about: 'Stepped seating by the lake for cultural nights.' },
  { id: 'LAK', name: 'Lake Garden', category: 'open', x: 160, y: 600, about: 'A quiet walking loop around the lake.' },
  { id: 'MED', name: 'Medical Centre', category: 'services', x: 1110, y: 480, about: 'A doctor on duty all day and an ambulance on call.' },
  { id: 'ATM', name: 'Bank and ATM', category: 'services', x: 800, y: 570, about: 'Bank branch with two ATMs.' },
  { id: 'BKS', name: 'Campus Store', category: 'services', x: 720, y: 340, about: 'Stationery, lab coats, printouts and textbooks.' },
  { id: 'BGT', name: 'Back Gate', category: 'gates', x: 1120, y: 170, about: 'Side entrance near the sports area. Closed after 9 pm.' },
];

/**
 * kind: 'walk' (open walkway), 'covered' (roofed walkway), 'road' (shared with
 * vehicles) or 'steps' (stairs, left out of step-free routes).
 */
export const PATHS = [
  { from: 'MEC', to: 'LAB', distance: 170, kind: 'walk' },
  { from: 'MEC', to: 'CSE', distance: 190, kind: 'walk' },
  { from: 'MEC', to: 'ECE', distance: 250, kind: 'walk', name: 'West Walk' },
  { from: 'LAB', to: 'SCI', distance: 160, kind: 'walk' },
  { from: 'LAB', to: 'CSE', distance: 180, kind: 'walk' },
  { from: 'SCI', to: 'CSE', distance: 180, kind: 'walk' },
  { from: 'SCI', to: 'LIB', distance: 185, kind: 'steps', name: 'Science Steps' },
  { from: 'SCI', to: 'MBA', distance: 190, kind: 'walk', name: 'North Walk' },
  { from: 'CSE', to: 'ECE', distance: 165, kind: 'walk' },
  { from: 'CSE', to: 'LHC', distance: 175, kind: 'walk' },
  { from: 'ECE', to: 'LHC', distance: 205, kind: 'walk' },
  { from: 'ECE', to: 'LAK', distance: 175, kind: 'walk' },
  { from: 'LAK', to: 'OAT', distance: 145, kind: 'walk', name: 'Lakeside Trail' },
  { from: 'LAK', to: 'BUS', distance: 250, kind: 'walk', name: 'Lakeside Trail' },
  { from: 'OAT', to: 'LHC', distance: 175, kind: 'steps', name: 'Theatre Steps' },
  { from: 'OAT', to: 'ADM', distance: 170, kind: 'walk' },
  { from: 'LHC', to: 'COF', distance: 130, kind: 'walk' },
  { from: 'LHC', to: 'QUA', distance: 185, kind: 'covered', name: 'Academic Corridor' },
  { from: 'COF', to: 'LIB', distance: 120, kind: 'walk' },
  { from: 'COF', to: 'QUA', distance: 135, kind: 'walk' },
  { from: 'LIB', to: 'QUA', distance: 165, kind: 'walk', name: 'Library Walk' },
  { from: 'LIB', to: 'MBA', distance: 155, kind: 'walk' },
  { from: 'LIB', to: 'BKS', distance: 140, kind: 'walk' },
  { from: 'MBA', to: 'GHO', distance: 215, kind: 'walk', name: 'North Walk' },
  { from: 'BKS', to: 'CAF', distance: 130, kind: 'walk' },
  { from: 'BKS', to: 'SPC', distance: 230, kind: 'walk' },
  { from: 'QUA', to: 'CAF', distance: 185, kind: 'covered', name: 'Food Court Link' },
  { from: 'QUA', to: 'ADM', distance: 190, kind: 'walk', name: 'Main Avenue' },
  { from: 'QUA', to: 'AUD', distance: 170, kind: 'walk' },
  { from: 'ADM', to: 'AUD', distance: 210, kind: 'walk' },
  { from: 'ADM', to: 'GAT', distance: 150, kind: 'walk', name: 'Main Avenue' },
  { from: 'ADM', to: 'BUS', distance: 135, kind: 'walk' },
  { from: 'AUD', to: 'GAT', distance: 160, kind: 'walk' },
  { from: 'AUD', to: 'PRK', distance: 130, kind: 'walk' },
  { from: 'AUD', to: 'ATM', distance: 135, kind: 'walk' },
  { from: 'GAT', to: 'BUS', distance: 180, kind: 'road', name: 'Gate Road' },
  { from: 'GAT', to: 'PRK', distance: 180, kind: 'road', name: 'Gate Road' },
  { from: 'PRK', to: 'GST', distance: 160, kind: 'road', name: 'Ring Road' },
  { from: 'GST', to: 'ATM', distance: 145, kind: 'walk' },
  { from: 'GST', to: 'BHO', distance: 170, kind: 'walk' },
  { from: 'GST', to: 'MED', distance: 300, kind: 'road', name: 'Ring Road' },
  { from: 'ATM', to: 'CAF', distance: 120, kind: 'walk' },
  { from: 'ATM', to: 'MES', distance: 145, kind: 'steps', name: 'Mess Steps' },
  { from: 'CAF', to: 'MES', distance: 180, kind: 'walk' },
  { from: 'CAF', to: 'JUI', distance: 165, kind: 'walk' },
  { from: 'MES', to: 'BHO', distance: 145, kind: 'walk' },
  { from: 'MES', to: 'JUI', distance: 135, kind: 'walk' },
  { from: 'BHO', to: 'MED', distance: 140, kind: 'walk' },
  { from: 'MED', to: 'GRD', distance: 125, kind: 'road', name: 'Ring Road' },
  { from: 'GRD', to: 'JUI', distance: 165, kind: 'walk' },
  { from: 'GRD', to: 'BGT', distance: 210, kind: 'road', name: 'Ring Road' },
  { from: 'SPC', to: 'JUI', distance: 135, kind: 'walk' },
  { from: 'SPC', to: 'GHO', distance: 160, kind: 'walk' },
  { from: 'SPC', to: 'BGT', distance: 210, kind: 'walk' },
  { from: 'GHO', to: 'BGT', distance: 295, kind: 'road', name: 'North Road' },
];

export const CATEGORIES = {
  id: 'campus',
  name: 'Campus',
  children: [
    {
      id: 'academics',
      name: 'Academics',
      children: [
        { id: 'departments', name: 'Departments' },
        { id: 'study', name: 'Study spaces' },
      ],
    },
    {
      id: 'food',
      name: 'Food',
      children: [
        { id: 'meals', name: 'Meals' },
        { id: 'snacks', name: 'Snacks and drinks' },
      ],
    },
    { id: 'stay', name: 'Stay' },
    {
      id: 'leisure',
      name: 'Sports and leisure',
      children: [
        { id: 'sports', name: 'Sports' },
        { id: 'events', name: 'Event venues' },
        { id: 'open', name: 'Open spaces' },
      ],
    },
    { id: 'services', name: 'Services' },
    {
      id: 'transport',
      name: 'Getting around',
      children: [
        { id: 'gates', name: 'Gates' },
        { id: 'rides', name: 'Buses and parking' },
      ],
    },
  ],
};
