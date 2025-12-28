import { z } from "zod";

export const RouteInfoSchema = z.object({
  shortName: z.string(),
  colour: z.string(),
  textColour: z.string(),
});

export const HeadsignInfoSchema = z.object({
  badge: z.string().optional().nullable(),
  destination: z.string().nullable(),
  marquee: z.string().optional().nullable(),
});

export const ArrivalPrecisionSchema = z.enum([
  "confident",
  "unsure",
  "scheduled",
  "past",
]);

export const ArrivalDetailsSchema = z.object({
  minutes: z.number().int(),
  precision: ArrivalPrecisionSchema,
});

export const DelayBadgeSchema = z.object({
  minutes: z.number(),
});

export const ShiftBadgeSchema = z.object({
  shiftName: z.string(),
  shiftTrip: z.string(),
});

export const PositionSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  orientationDegrees: z.number(),
  shapeIndex: z.number(),
});

export const ArrivalSchema = z.object({
  tripId: z.string(),
  route: RouteInfoSchema,
  headsign: HeadsignInfoSchema,
  estimate: ArrivalDetailsSchema,
  delay: DelayBadgeSchema.optional().nullable(),
  shift: ShiftBadgeSchema.optional().nullable(),
  shape: z.any().optional().nullable(),
  currentPosition: PositionSchema.optional().nullable(),
  stopShapeIndex: z.number().optional().nullable(),
});

export const StopArrivalsResponseSchema = z.object({
  stopCode: z.string(),
  stopName: z.string(),
  stopLocation: PositionSchema.optional().nullable(),
  routes: z.array(RouteInfoSchema),
  arrivals: z.array(ArrivalSchema),
});

export type RouteInfo = z.infer<typeof RouteInfoSchema>;
export type HeadsignInfo = z.infer<typeof HeadsignInfoSchema>;
export type ArrivalPrecision = z.infer<typeof ArrivalPrecisionSchema>;
export type ArrivalDetails = z.infer<typeof ArrivalDetailsSchema>;
export type DelayBadge = z.infer<typeof DelayBadgeSchema>;
export type ShiftBadge = z.infer<typeof ShiftBadgeSchema>;
export type Position = z.infer<typeof PositionSchema>;
export type Arrival = z.infer<typeof ArrivalSchema>;
export type StopArrivalsResponse = z.infer<typeof StopArrivalsResponseSchema>;

// Transit Routes
export const RouteSchema = z.object({
  id: z.string(),
  shortName: z.string().nullable(),
  longName: z.string().nullable(),
  color: z.string().nullable(),
  textColor: z.string().nullable(),
  sortOrder: z.number().nullable(),
  agencyName: z.string().nullable().optional(),
  tripCount: z.number(),
});

export const PatternStopSchema = z.object({
  id: z.string(),
  code: z.string().nullable(),
  name: z.string(),
  lat: z.number(),
  lon: z.number(),
  scheduledDepartures: z.array(z.number()),
});

export const PatternSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  headsign: z.string().nullable(),
  directionId: z.number(),
  code: z.string().nullable(),
  semanticHash: z.string().nullable(),
  tripCount: z.number(),
  geometry: z.array(z.array(z.number())).nullable(),
  stops: z.array(PatternStopSchema),
});

export const RouteDetailsSchema = z.object({
  shortName: z.string().nullable(),
  longName: z.string().nullable(),
  color: z.string().nullable(),
  textColor: z.string().nullable(),
  patterns: z.array(PatternSchema),
});

export type Route = z.infer<typeof RouteSchema>;
export type PatternStop = z.infer<typeof PatternStopSchema>;
export type Pattern = z.infer<typeof PatternSchema>;
export type RouteDetails = z.infer<typeof RouteDetailsSchema>;

// Consolidated Circulation (Legacy/Alternative API)
export const ConsolidatedCirculationSchema = z.object({
  line: z.string(),
  route: z.string(),
  schedule: z
    .object({
      running: z.boolean(),
      minutes: z.number(),
      serviceId: z.string(),
      tripId: z.string(),
      shapeId: z.string().optional().nullable(),
    })
    .optional()
    .nullable(),
  realTime: z
    .object({
      minutes: z.number(),
      distance: z.number(),
    })
    .optional()
    .nullable(),
  currentPosition: z
    .object({
      latitude: z.number(),
      longitude: z.number(),
      orientationDegrees: z.number(),
      shapeIndex: z.number().optional().nullable(),
    })
    .optional()
    .nullable(),
  isPreviousTrip: z.boolean().optional().nullable(),
  previousTripShapeId: z.string().optional().nullable(),
  nextStreets: z.array(z.string()).optional().nullable(),
});

export type ConsolidatedCirculation = z.infer<
  typeof ConsolidatedCirculationSchema
>;

// Route Planner
export const PlannerPlaceSchema = z.object({
  name: z.string().optional().nullable(),
  lat: z.number(),
  lon: z.number(),
  stopId: z.string().optional().nullable(),
  stopCode: z.string().optional().nullable(),
});

export const PlannerGeometrySchema = z.object({
  type: z.string(),
  coordinates: z.array(z.array(z.number())),
});

export const PlannerStepSchema = z.object({
  distanceMeters: z.number(),
  relativeDirection: z.string().optional().nullable(),
  absoluteDirection: z.string().optional().nullable(),
  streetName: z.string().optional().nullable(),
  lat: z.number(),
  lon: z.number(),
});

export const PlannerLegSchema = z.object({
  mode: z.string().optional().nullable(),
  feedId: z.string().optional().nullable(),
  routeId: z.string().optional().nullable(),
  tripId: z.string().optional().nullable(),
  routeName: z.string().optional().nullable(),
  routeShortName: z.string().optional().nullable(),
  routeLongName: z.string().optional().nullable(),
  routeColor: z.string().optional().nullable(),
  routeTextColor: z.string().optional().nullable(),
  headsign: z.string().optional().nullable(),
  agencyName: z.string().optional().nullable(),
  from: PlannerPlaceSchema.optional().nullable(),
  to: PlannerPlaceSchema.optional().nullable(),
  startTime: z.string(),
  endTime: z.string(),
  distanceMeters: z.number(),
  geometry: PlannerGeometrySchema.optional().nullable(),
  steps: z.array(PlannerStepSchema),
  intermediateStops: z.array(PlannerPlaceSchema),
});

export const ItinerarySchema = z.object({
  durationSeconds: z.number(),
  startTime: z.string(),
  endTime: z.string(),
  walkDistanceMeters: z.number(),
  walkTimeSeconds: z.number(),
  transitTimeSeconds: z.number(),
  waitingTimeSeconds: z.number(),
  legs: z.array(PlannerLegSchema),
  cashFare: z.number().optional().nullable(),
  cashFareIsTotal: z.boolean().optional().nullable(),
  cardFare: z.number().optional().nullable(),
  cardFareIsTotal: z.boolean().optional().nullable(),
});

export const RoutePlanSchema = z.object({
  itineraries: z.array(ItinerarySchema),
  timeOffsetSeconds: z.number().optional().nullable(),
});

export type PlannerPlace = z.infer<typeof PlannerPlaceSchema>;
export type PlannerGeometry = z.infer<typeof PlannerGeometrySchema>;
export type PlannerStep = z.infer<typeof PlannerStepSchema>;
export type PlannerLeg = z.infer<typeof PlannerLegSchema>;
export type Itinerary = z.infer<typeof ItinerarySchema>;
export type RoutePlan = z.infer<typeof RoutePlanSchema>;
