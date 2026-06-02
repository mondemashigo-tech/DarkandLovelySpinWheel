export const C = {
  bg:       '#080810',
  card:     '#0E0E1A',
  border:   'rgba(46,232,255,0.12)',
  text:     '#E8E4FF',
  muted:    'rgba(232,228,255,0.45)',
  dimmed:   'rgba(232,228,255,0.25)',
  green:    '#4DFF9F',
  cyan:     '#2EE8FF',
  gold:     '#FFC83D',
  pink:     '#FF3D8A',
  orange:   '#FF8C00',
};

export const S = {
  card: {
    backgroundColor: C.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    padding: 16,
    marginBottom: 12,
  },
  label: {
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: C.muted,
    marginBottom: 4,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    overflow: 'hidden',
  },
};
