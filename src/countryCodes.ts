// ISO2 to ISO_NUMERIC mapping
// Based on ISO 3166-1 numeric codes
export const ISO2_TO_NUMERIC: Record<string, number> = {
  'US': 840, 'GB': 826, 'CA': 124, 'AU': 36, 'DE': 276, 'FR': 250, 'JP': 392, 'CN': 156,
  'IT': 380, 'ES': 724, 'NL': 528, 'BE': 56, 'GR': 300, 'PT': 620, 'SE': 752, 'NO': 578,
  'DK': 208, 'FI': 246, 'PL': 616, 'CZ': 203, 'HU': 348, 'RO': 642, 'BG': 100, 'HR': 191,
  'SK': 703, 'SI': 705, 'EE': 233, 'LV': 428, 'LT': 440, 'IE': 372, 'IS': 352, 'CH': 756,
  'AT': 40, 'LU': 442, 'MT': 470, 'CY': 196, 'MX': 484, 'BR': 76, 'AR': 32, 'CL': 152,
  'CO': 170, 'PE': 604, 'VE': 862, 'EC': 218, 'BO': 68, 'PY': 600, 'UY': 858, 'IN': 356,
  'PK': 586, 'BD': 50, 'ID': 360, 'PH': 608, 'VN': 704, 'TH': 764, 'MY': 458, 'SG': 702,
  'KR': 410, 'TW': 158, 'HK': 344, 'NZ': 554, 'ZA': 710, 'EG': 818, 'NG': 566, 'KE': 404,
  'ET': 231, 'GH': 288, 'TZ': 834, 'UG': 800, 'MA': 504, 'DZ': 12, 'TN': 788, 'LY': 434,
  'SD': 729, 'AO': 24, 'MZ': 508, 'ZM': 894, 'ZW': 716, 'BW': 72, 'NA': 516, 'MG': 450,
  'RU': 643, 'UA': 804, 'BY': 112, 'KZ': 398, 'UZ': 860, 'TM': 795, 'TJ': 762, 'KG': 417,
  'AF': 4, 'IR': 364, 'IQ': 368, 'SA': 682, 'AE': 784, 'IL': 376, 'JO': 400, 'LB': 422,
  'SY': 760, 'TR': 792, 'GE': 268, 'AM': 51, 'AZ': 31, 'AL': 8, 'MK': 807, 'RS': 688,
  'BA': 70, 'ME': 499, 'XK': 383, 'MD': 498, 'AFG': 4, 'ALB': 8, 'DZA': 12, 'ASM': 16,
  'AND': 20, 'AGO': 24, 'AIA': 660, 'ATA': 10, 'ATG': 28, 'ARG': 32, 'ARM': 51, 'ABW': 533,
  'AUS': 36, 'AUT': 40, 'AZE': 31, 'BHS': 44, 'BHR': 48, 'BGD': 50, 'BRB': 52, 'BLR': 112,
  'BEL': 56, 'BLZ': 84, 'BEN': 204, 'BMU': 60, 'BTN': 64, 'BOL': 68, 'BIH': 70, 'BWA': 72,
  'BRA': 76, 'IOT': 86, 'VGB': 92, 'BRN': 96, 'BGR': 100, 'BFA': 854, 'BDI': 108, 'KHM': 116,
  'CMR': 120, 'CAN': 124, 'CPV': 132, 'CYM': 136, 'CAF': 140, 'TCD': 148, 'CHL': 152, 'CHN': 156,
  'CXR': 162, 'CCK': 166, 'COL': 170, 'COM': 174, 'COG': 178, 'COK': 184, 'CRI': 188, 'CIV': 384,
  'HRV': 191, 'CUB': 192, 'CYP': 196, 'CZE': 203, 'PRK': 408, 'COD': 180, 'DNK': 208, 'DJI': 262,
  'DMA': 212, 'DOM': 214, 'ECU': 218, 'EGY': 818, 'SLV': 222, 'GNQ': 226, 'ERI': 232, 'EST': 233,
  'ETH': 231, 'FLK': 238, 'FRO': 234, 'FJI': 242, 'FIN': 246, 'FRA': 250, 'GUF': 254, 'PYF': 258,
  'ATF': 260, 'GAB': 266, 'GMB': 270, 'GEO': 268, 'DEU': 276, 'GHA': 288, 'GIB': 292, 'GRC': 300,
  'GRL': 304, 'GRD': 308, 'GLP': 312, 'GUM': 316, 'GTM': 320, 'GGY': 831, 'GIN': 324, 'GNB': 624,
  'GUY': 328, 'HTI': 332, 'HMD': 334, 'VAT': 336, 'HND': 340, 'HKG': 344, 'HUN': 348, 'ISL': 352,
  'IND': 356, 'IDN': 360, 'IRN': 364, 'IRQ': 368, 'IRL': 372, 'IMN': 833, 'ISR': 376, 'ITA': 380,
  'JAM': 388, 'JPN': 392, 'JEY': 832, 'JOR': 400, 'KAZ': 398, 'KEN': 404, 'KIR': 296, 'KWT': 414,
  'KGZ': 417, 'LAO': 418, 'LVA': 428, 'LBN': 422, 'LSO': 426, 'LBR': 430, 'LBY': 434, 'LIE': 438,
  'LTU': 440, 'LUX': 442, 'MAC': 446, 'MDG': 450, 'MWI': 454, 'MYS': 458, 'MDV': 462, 'MLI': 466,
  'MLT': 470, 'MHL': 584, 'MTQ': 474, 'MRT': 478, 'MUS': 480, 'MYT': 175, 'MEX': 484, 'FSM': 583,
  'MDA': 498, 'MCO': 492, 'MNG': 496, 'MNE': 499, 'MSR': 500, 'MAR': 504, 'MOZ': 508, 'MMR': 104,
  'NAM': 516, 'NRU': 520, 'NPL': 524, 'NLD': 528, 'NCL': 540, 'NZL': 554, 'NIC': 558, 'NER': 562,
  'NGA': 566, 'NIU': 570, 'NFK': 574, 'MNP': 580, 'NOR': 578, 'OMN': 512, 'PAK': 586, 'PLW': 585,
  'PSE': 275, 'PAN': 591, 'PNG': 598, 'PRY': 600, 'PER': 604, 'PHL': 608, 'PCN': 612, 'POL': 616,
  'PRT': 620, 'PRI': 630, 'QAT': 634, 'MKD': 807, 'ROU': 642, 'RUS': 643, 'RWA': 646, 'REU': 638,
  'BLM': 652, 'SHN': 654, 'KNA': 659, 'LCA': 662, 'MAF': 663, 'SPM': 666, 'VCT': 670, 'WSM': 882,
  'SMR': 674, 'STP': 678, 'SAU': 682, 'SEN': 686, 'SRB': 688, 'SYC': 690, 'SLE': 694, 'SGP': 702,
  'SXM': 534, 'SVK': 703, 'SVN': 705, 'SLB': 90, 'SOM': 706, 'ZAF': 710, 'SGS': 239, 'SSD': 728,
  'ESP': 724, 'LKA': 144, 'SDN': 729, 'SUR': 740, 'SJM': 744, 'SWZ': 748, 'SWE': 752, 'CHE': 756,
  'SYR': 760, 'TWN': 158, 'TJK': 762, 'TZA': 834, 'THA': 764, 'TLS': 626, 'TGO': 768, 'TKL': 772,
  'TON': 776, 'TTO': 780, 'TUN': 788, 'TUR': 792, 'TKM': 795, 'TCA': 796, 'TUV': 798, 'UGA': 800,
  'UKR': 804, 'ARE': 784, 'GBR': 826, 'UMI': 840, 'USA': 840, 'URY': 858, 'UZB': 860, 'VUT': 548,
  'VEN': 862, 'VNM': 704, 'VIR': 850, 'WLF': 876, 'ESH': 732, 'YEM': 887, 'ZMB': 894, 'ZWE': 716,
  'ALA': 248, 'ANT': 530, 'BVT': 74
};

export function iso2ToNumeric(iso2: string): number {
  if (!iso2) return 0;
  const upper = iso2.toUpperCase();
  return ISO2_TO_NUMERIC[upper] || 0;
}
