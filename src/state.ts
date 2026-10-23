import type { Schema } from "@very-coffee/statespace";
import type { Policy } from "./deck";
import type { PlayerCount } from "./ruleset";

export type Role = "liberal" | "fascist" | "hitler";

export type Phase =
  | "nominate"
  | "vote"
  | "president_discard"
  | "chancellor_play"
  | "veto_confirm"
  | "investigate"
  | "special_election"
  | "peek"
  | "execute"
  | "terminal";

export type Player = {
  id: number;
  role: Role;
  alive: boolean;
  investigated: boolean;
};

export type SecretHitlerState = {
  playerCount: PlayerCount;
  seed: number | null;
  shuffleCount: number;
  deck: Policy[];
  discard: Policy[];
  liberalTrack: number;
  fascistTrack: number;
  electionTracker: number;
  players: Player[];
  president: number;
  chancellor: number | null;
  nominee: number | null;
  lastElectedPresident: number | null;
  lastElectedChancellor: number | null;
  specialElectionReturn: number | null;
  votes: Record<string, "ja" | "nein" | null>;
  presidentHand: Policy[];
  chancellorHand: Policy[];
  phase: Phase;
  winner: "liberal" | "fascist" | null;
};

const policySchema = { type: "string", enum: ["liberal", "fascist"] };
const nullableInt = { type: ["integer", "null"] };

export const secretHitlerSchema = {
  type: "object",
  properties: {
    playerCount: { type: "integer", minimum: 5, maximum: 10 },
    seed: { type: ["number", "null"] },
    shuffleCount: { type: "integer", minimum: 0 },
    deck: { type: "array", items: policySchema },
    discard: { type: "array", items: policySchema },
    liberalTrack: { type: "integer", minimum: 0, maximum: 5 },
    fascistTrack: { type: "integer", minimum: 0, maximum: 6 },
    electionTracker: { type: "integer", minimum: 0, maximum: 3 },
    players: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "integer" },
          role: { type: "string", enum: ["liberal", "fascist", "hitler"] },
          alive: { type: "boolean" },
          investigated: { type: "boolean" },
        },
        required: ["id", "role", "alive", "investigated"],
        additionalProperties: false,
      },
      minItems: 5,
      maxItems: 10,
    },
    president: { type: "integer", minimum: 0 },
    chancellor: nullableInt,
    nominee: nullableInt,
    lastElectedPresident: nullableInt,
    lastElectedChancellor: nullableInt,
    specialElectionReturn: nullableInt,
    votes: {
      type: "object",
      additionalProperties: {
        type: ["string", "null"],
        enum: ["ja", "nein", null],
      },
    },
    presidentHand: { type: "array", items: policySchema },
    chancellorHand: { type: "array", items: policySchema },
    phase: {
      type: "string",
      enum: [
        "nominate",
        "vote",
        "president_discard",
        "chancellor_play",
        "veto_confirm",
        "investigate",
        "special_election",
        "peek",
        "execute",
        "terminal",
      ],
    },
    winner: { type: ["string", "null"], enum: ["liberal", "fascist", null] },
  },
  required: [
    "playerCount",
    "seed",
    "shuffleCount",
    "deck",
    "discard",
    "liberalTrack",
    "fascistTrack",
    "electionTracker",
    "players",
    "president",
    "chancellor",
    "nominee",
    "lastElectedPresident",
    "lastElectedChancellor",
    "specialElectionReturn",
    "votes",
    "presidentHand",
    "chancellorHand",
    "phase",
    "winner",
  ],
  additionalProperties: false,
} as unknown as Schema<SecretHitlerState>;
