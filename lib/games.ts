export interface GameDefinition {
  slug:           string;
  name:           string;
  description:    string;
  displayPath:    string;
  controllerPath: string;
  color:          string;
}

export const GAMES: Record<string, GameDefinition> = {
  'paperio': {
    slug:           'paperio',
    name:           'Paper.io',
    description:    'Conquer the arena with paint!',
    displayPath:    '/display',
    controllerPath: '/join',
    color:          '#FF2D78',
  },
  'tap-frenzy': {
    slug:           'tap-frenzy',
    name:           'Tap Frenzy',
    description:    'Tap as fast as you can!',
    displayPath:    '/tap-frenzy/display',
    controllerPath: '/tap-frenzy/controller',
    color:          '#00E5FF',
  },
};
