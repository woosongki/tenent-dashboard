import storesData from "../../data/stores/stores.json";

export type StoreBrand = "NC백화점" | "뉴코아아울렛" | "2001아울렛" | "동아백화점";
export type StoreType = "백화점" | "아울렛" | "뉴코아몰" | "WAVE";

export interface Store {
  id: string;
  brand: StoreBrand;
  type: StoreType;
  name: string;
  address: string;
  phone: string | null;
  hasKimsclub: boolean;
  // 지오코딩 결과
  lat: number;
  lng: number;
  bcode: string;
  lawdCd: string;
  region1: string;
  region2: string;
  region3: string;
  roadAddress: string | null;
  jibunAddress: string | null;
  geocoded: boolean;
}

interface StoresFile {
  version: string;
  compiledAt: string;
  geocodedAt?: string;
  stores: Store[];
}

const file = storesData as unknown as StoresFile;

export function getAllStores(): Store[] {
  return file.stores.filter((s) => s.geocoded);
}

export function getStoreById(id: string): Store | undefined {
  return file.stores.find((s) => s.id === id);
}

export function getStoresByBrand(brand: StoreBrand): Store[] {
  return getAllStores().filter((s) => s.brand === brand);
}

/** Cmd+K 검색 팔레트용 */
export function searchStoresByQuery(query: string, limit = 5): Store[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return getAllStores()
    .filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.brand.toLowerCase().includes(q) ||
        s.region1.toLowerCase().includes(q) ||
        s.region2.toLowerCase().includes(q) ||
        s.address.toLowerCase().includes(q),
    )
    .slice(0, limit);
}

/** Slate 디자인 시스템에 맞춘 브랜드 컬러 */
export const BRAND_BADGE: Record<StoreBrand, string> = {
  "NC백화점": "bg-rose-50 text-rose-700 border-rose-200",
  "뉴코아아울렛": "bg-amber-50 text-amber-700 border-amber-200",
  "2001아울렛": "bg-sky-50 text-sky-700 border-sky-200",
  "동아백화점": "bg-emerald-50 text-emerald-700 border-emerald-200",
};

export function storeMeta() {
  return {
    version: file.version,
    compiledAt: file.compiledAt,
    geocodedAt: file.geocodedAt,
  };
}
