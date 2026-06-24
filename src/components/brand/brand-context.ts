import { createContext, useContext } from "react";
import { BRAND_DEFAULTS, type BrandSettings } from "./brand-config";

export const BrandContext = createContext<BrandSettings>({ ...BRAND_DEFAULTS });
export const useBrand = () => useContext(BrandContext);
