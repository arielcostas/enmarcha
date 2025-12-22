import { z } from "zod";

export const RouteInfoSchema = z.object({
  shortName: z.string(),
  colour: z.string(),
  textColour: z.string(),
});

export const HeadsignInfoSchema = z.object({
  badge: z.string().optional().nullable(),
  destination: z.string(),
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

export const ArrivalSchema = z.object({
  route: RouteInfoSchema,
  headsign: HeadsignInfoSchema,
  estimate: ArrivalDetailsSchema,
  delay: DelayBadgeSchema.optional().nullable(),
  shift: ShiftBadgeSchema.optional().nullable(),
});

export const StopArrivalsResponseSchema = z.object({
  stopCode: z.string(),
  stopName: z.string(),
  arrivals: z.array(ArrivalSchema),
});

export type RouteInfo = z.infer<typeof RouteInfoSchema>;
export type HeadsignInfo = z.infer<typeof HeadsignInfoSchema>;
export type ArrivalPrecision = z.infer<typeof ArrivalPrecisionSchema>;
export type ArrivalDetails = z.infer<typeof ArrivalDetailsSchema>;
export type DelayBadge = z.infer<typeof DelayBadgeSchema>;
export type ShiftBadge = z.infer<typeof ShiftBadgeSchema>;
export type Arrival = z.infer<typeof ArrivalSchema>;
export type StopArrivalsResponse = z.infer<typeof StopArrivalsResponseSchema>;

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
