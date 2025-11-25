/**
 * Pharmacy Partner Configuration
 * This file contains partner URLs and integration configs for medicine ordering
 */

export type PharmacyPartner = "pharmeasy" | "tata1mg" | "netmeds" | "apollo" | "other";

export interface PharmacyPartnerConfig {
  id: PharmacyPartner;
  name: string;
  baseUrl: string;
  searchUrlTemplate: string; // Template with {medicineName} placeholder
  affiliateId?: string;
  apiKey?: string;
  enabled: boolean;
  logo?: string;
  description?: string;
}

/**
 * Pharmacy partner configurations
 * URL templates use {medicineName} as placeholder for medicine search
 */
export const PHARMACY_PARTNERS: Record<PharmacyPartner, PharmacyPartnerConfig> = {
  pharmeasy: {
    id: "pharmeasy",
    name: "PharmEasy",
    baseUrl: "https://pharmeasy.in",
    searchUrlTemplate: "https://pharmeasy.in/search/all?name={medicineName}",
    enabled: true,
    description: "India's leading online pharmacy and healthcare platform",
  },
  tata1mg: {
    id: "tata1mg",
    name: "Tata 1mg",
    baseUrl: "https://www.1mg.com",
    searchUrlTemplate: "https://www.1mg.com/search/all?name={medicineName}",
    enabled: true,
    description: "Trusted healthcare platform by Tata Group",
  },
  netmeds: {
    id: "netmeds",
    name: "Netmeds",
    baseUrl: "https://www.netmeds.com",
    searchUrlTemplate: "https://www.netmeds.com/catalogsearch/result/{medicineName}/all",
    enabled: true,
    description: "Online pharmacy with fast delivery",
  },
  apollo: {
    id: "apollo",
    name: "Apollo Pharmacy",
    baseUrl: "https://www.apollopharmacy.in",
    searchUrlTemplate: "https://www.apollopharmacy.in/search-medicines/{medicineName}",
    enabled: true,
    description: "Apollo Hospitals' trusted pharmacy network",
  },
  other: {
    id: "other",
    name: "Other",
    baseUrl: "",
    searchUrlTemplate: "",
    enabled: false,
    description: "Custom pharmacy partner",
  },
};

/**
 * Generate redirect URL for a medicine at a specific partner
 * @param partner - Pharmacy partner ID
 * @param medicineName - Name of the medicine
 * @returns Generated redirect URL
 */
export function generatePartnerUrl(
  partner: PharmacyPartner,
  medicineName: string
): string {
  const config = PHARMACY_PARTNERS[partner];
  
  if (!config || !config.enabled) {
    throw new Error(`Partner ${partner} is not available`);
  }

  // URL encode the medicine name
  const encodedMedicine = encodeURIComponent(medicineName);
  
  // Replace placeholder with encoded medicine name
  return config.searchUrlTemplate.replace("{medicineName}", encodedMedicine);
}

/**
 * Get all enabled pharmacy partners
 * @returns Array of enabled partner configs
 */
export function getEnabledPartners(): PharmacyPartnerConfig[] {
  return Object.values(PHARMACY_PARTNERS).filter((partner) => partner.enabled);
}

/**
 * Get partner config by ID
 * @param partnerId - Partner ID
 * @returns Partner config or null if not found
 */
export function getPartnerById(partnerId: PharmacyPartner): PharmacyPartnerConfig | null {
  return PHARMACY_PARTNERS[partnerId] || null;
}

/**
 * Validate if a partner is enabled
 * @param partnerId - Partner ID
 * @returns True if partner is enabled
 */
export function isPartnerEnabled(partnerId: PharmacyPartner): boolean {
  const partner = PHARMACY_PARTNERS[partnerId];
  return partner ? partner.enabled : false;
}
