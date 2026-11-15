import { area, groupLabel, percent } from "@/lib/format";
import type { ApiRegion } from "@/lib/types";

/** What a region is and where its outline came from. All of it is the extraction's own metadata. */
export default function RegionFacts({ region, all, hovering }: { region: ApiRegion | null; all: ApiRegion[]; hovering: boolean }) {
  if (!region) {
    return (
      <p className="text-[14px] text-ink-3">
        21 regions: river basins, deserts, mountains, grasslands, forests and tundra. Point at an outline for details.
      </p>
    );
  }
  const overlaps = region.overlaps.map((o) => `${all.find((r) => r.id === o.region)?.name ?? o.region} (${percent(o.share_of_smaller_region)} of the smaller)`);
  return (
    <div className="text-[13.5px]" aria-live={hovering ? "off" : "polite"}>
      <p className="text-[15px] font-medium text-ink">{region.name}</p>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-ink-2 sm:grid-cols-[auto_1fr_auto_1fr]">
        <dt className="text-ink-3">Type</dt>
        <dd>{groupLabel(region.group)}</dd>
        <dt className="text-ink-3">Area</dt>
        <dd className="num">{area(region.area_km2)}</dd>
        <dt className="text-ink-3">GLDAS cells</dt>
        <dd className="num">{region.grid_cells?.toLocaleString("en-US") ?? "no data"} at 0.25 degrees{region.land_fraction !== null && region.land_fraction < 0.995 ? `, ${percent(region.land_fraction)} land` : ""}</dd>
        <dt className="text-ink-3">Outline</dt>
        <dd>
          {region.boundary_source?.url ? (
            <a href={region.boundary_source.url} target="_blank" rel="noreferrer">{region.boundary_source.name}</a>
          ) : (region.boundary_source?.name ?? "no data")}
          {region.boundary_source?.license ? `, ${region.boundary_source.license}` : ""}
        </dd>
      </dl>
      {overlaps.length > 0 && <p className="mt-1.5 text-ink-3">Overlaps {overlaps.join(" and ")}.</p>}
    </div>
  );
}
