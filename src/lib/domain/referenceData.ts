/**
 * Приложение А starter prices/norms - dated 09.09.2026, editable, scoped
 * records (§Appendix A). This is a representative subset wired into the
 * calculation engine, not a re-verified market catalogue; see the seed
 * script for the full Material/WorkNorm rows loaded into the database.
 */
export const REFERENCE_PRICES = {
  laborRatePerHourRub: 550,
  travelSurchargePerPersonDayRub: 1000,
  izospanARub: 60,
  izospanBRub: 50,
  izospanAmRub: 100,
  filmReserveFraction: 0.1,
  seamTapePriceRub: 950, // per 25m roll
  ceilingCanvasPerM2Rub: 420,
  ceilingCuttingFraction: 0.02,
  ceilingInstallPerM2Rub: 420,
  trackHeadGU10Rub: 600,
  facadeFixtureRub: 1500,
  internalSpotRub: 600,
  ledChandelierRub: 7000,
  blackConvectorRub: 10000,
  warmFloorScreedPerM2Rub: 1700,
  warmFloorFilmPerM2Rub: 50,
  warmFloorMeshPerM2Rub: 200,
  warmFloorPipePricePerMRub: 40,
  warmFloorPipeNormPerM2: 7,
  tilePerM2Rub: 3000,
  tileBasePackagePerM2Rub: 5000,
  pileFasteningBoltRub: 30, // глухарь 12x120 / 12x220
  boilerPersonHourRub: 750,
  foundationEquipmentPerHourRub: 4000,
  moduleDeliveryPerModuleRub: 15000,
  craneBaseRatePerHourRub: 4000,
} as const;

export const OVERHEAD_STARTING_POLICY = {
  adsMonthlyRub: 200000,
  adsModularShare: 0.65,
  officeMonthlyRub: 40000,
  workshopRentMonthlyRub: 350000,
  electricityMonthlyRub: 40000,
  plannedComparableHousesPerYear: 20,
  toolAmortizationPerHouseRub: 70000,
} as const;

export const PRICING_STARTING_POLICY = {
  taxFraction: 0.06,
  commissionFraction: 0.02,
  reserveFraction: 0.05,
} as const;
