import { z } from "zod";

const status = z.enum(["base", "home", "out", "tzav", "org", "abroad", "loc", ""]);
const veh = z.enum(["898", "506", "497", "207", "savana", "berlingo", "private", ""]);
const name = z.string().min(1).max(120);
const pid = z.string().max(20).optional();

const roles = z.object({
  cmd: z.array(z.string().max(120)).max(500).optional(),
  pakal: z.record(z.string().max(120), z.string().max(120)).optional(),
});
const alerts = z.object({
  breaks: z
    .array(
      z.object({
        from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        label: z.string().max(200).optional(),
      }),
    )
    .max(200)
    .optional(),
});

export const changeSchema = z.union([
  z.object({ kind: z.literal("status"), pid, name, date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), status }),
  z.object({ kind: z.literal("veh"), pid, name, veh }),
  z.object({ kind: z.literal("config"), key: z.literal("roles"), value: roles }),
  z.object({ kind: z.literal("config"), key: z.literal("alerts"), value: alerts }),
]);

export const changesBody = z.object({ changes: z.array(changeSchema).min(1).max(300) });
