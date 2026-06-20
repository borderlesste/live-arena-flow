import { sponsors } from "@/data/mocks";
import type { Sponsor } from "@/types";

export function listSponsors(): Sponsor[] { return sponsors; }
export function getMainSponsor(): Sponsor | undefined { return sponsors.find((s) => s.tier === "main"); }
