export const GAMES = {
  paperio: {
    slug:           'paperio',
    name:           'Paper.io',
    description:    'Conquer territory with your spray can',
    displayPath:    '/display',
    controllerPath: '/controller',
    color:          '#FF2D78',
  },
  'last-one-standing': {
    slug:           'last-one-standing',
    name:           'Last One Standing',
    description:    'Tap at the right moment or get eliminated',
    displayPath:    '/last-one-standing/display',
    controllerPath: '/last-one-standing/controller',
    color:          '#76FF03',
  },
} as const;

export type GameSlug = keyof typeof GAMES;
export type Game     = (typeof GAMES)[GameSlug];
