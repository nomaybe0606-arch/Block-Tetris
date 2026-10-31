export const BALANCE = {
  cellPoints: 1,
  lineBonus: 10,
  lineExponent: 2,
  comboMax: 8,
  comboGraceMoves: 2,
  generator: {
    duplicateMultiplier: 0.16,
    unplaceableMultiplier: 0.25,
    crowdedThreshold: 0.55,
    smallPieceBoost: 1.8,
    weights: { single: 0.55, small: 1.3, medium: 1, large: 0.65 },
  },
};
